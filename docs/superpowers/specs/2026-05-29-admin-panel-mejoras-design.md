# Mejoras del Admin Panel (UNAMAD / conadis) — Diseño

**Fecha:** 2026-05-29
**Estado:** Aprobado por el usuario ("si dale")
**Stack:** Next.js 16.2.6 (App Router, `src/`), React 19.2.4, Tailwind v4 (`@import "tailwindcss"` + CSS propio con tokens), Prisma 7 (cliente en `@/generated/prisma`, adapter-pg).

## Contexto

El panel ya es un clon pulido de Google Admin Console, en español, con:
- Módulos funcionales: **Usuarios** (`/usuarios`) y **Roles** (`/roles`) — CRUD, RBAC, modales, drawers, bulk actions.
- API de **Incidentes** (`/api/v1/incidents`) + schema Prisma completo, **sin UI de administración**.
- Sistema de diseño en `src/app/globals.css` con tokens claro/oscuro ya definidos, pero `<html>` fijo en `data-theme="light"` y **sin toggle**.
- TopBar con búsqueda/notificaciones/cuenta **decorativas**.
- Sin página de inicio: `/` redirige a `/usuarios`.

Auth: `getCurrentUser`/`requireUser`/`requirePermission(key)`/`userHas(user,key)` en `@/lib/auth/server`. Permisos en `@/lib/auth/permissions` (`users.*`, `roles.*`, `incidents.*`).

Convención del proyecto: páginas server component con `export const dynamic = "force-dynamic"`, server actions en `actions.ts` que usan Prisma directo + `revalidatePath`, vistas cliente separadas (`*Client.tsx`).

## Objetivo

Cuatro focos aprobados, datos reales (solo lo existente), dark mode con toggle + memoria. Construcción por fases independientes y entregables.

---

## Fundamento — Sistema de tema (dark mode)

**Archivos nuevos**
- `src/lib/ui/theme.ts`: `type Theme = "light"|"dark"|"system"`; `THEME_KEY`; `resolveTheme()`; `THEME_INIT_SCRIPT` (IIFE anti-FOUC que fija `document.documentElement.dataset.theme` leyendo localStorage o `matchMedia("(prefers-color-scheme: dark)")`).
- `src/components/admin/ThemeToggle.tsx` (cliente): botón en TopBar (íconos `sun`/`moon`), menú claro/oscuro/sistema, persiste en localStorage, reacciona a cambios del SO cuando está en "system".

**Archivos modificados**
- `src/app/layout.tsx`: quitar `data-theme="light"` fijo; `<html lang="es" suppressHydrationWarning>`; inyectar `<script>` con `THEME_INIT_SCRIPT` en `<head>`.
- `src/components/admin/Icon.tsx`: añadir íconos `sun`, `moon`, `alert` (triángulo), y `inbox`/`tag` si se necesitan.
- `src/components/admin/TopBar.tsx`: insertar `<ThemeToggle/>` en `topbar__right`.
- `src/app/globals.css`: `html { color-scheme: light dark }`; `[data-theme=dark] { color-scheme: dark }`; corregir hovers `rgba(0,0,0,…)` en oscuro; añadir **tokens semánticos**:
  - Estado incidente: `--st-open`, `--st-triaged`, `--st-progress`, `--st-resolved`, `--st-rejected`, `--st-closed` (par bg/fg, light+dark).
  - Severidad: `--sev-low`, `--sev-medium`, `--sev-high`, `--sev-critical`.

**Criterio de aceptación:** sin parpadeo al recargar; toggle persiste; "sistema" sigue al SO; todo legible en oscuro.

---

## Fase 1 — Dashboard `/inicio` (datos reales)

**Archivos nuevos**
- `src/app/(admin)/inicio/page.tsx` (server, `dynamic="force-dynamic"`, `requireUser`): consultas perm-gated.
- `src/app/(admin)/inicio/DashboardView.tsx` (presentacional, props serializables).
- `src/app/(admin)/inicio/dashboard.css`, `src/app/(admin)/inicio/types.ts`.

**Archivos modificados**
- `src/app/page.tsx`: `redirect("/inicio")`.
- `src/components/admin/data.ts`: añadir `{ id:"inicio", label:"Inicio", icon:"home", href:"/inicio" }` al inicio.

**Datos (Prisma, solo si el usuario tiene el permiso):**
- `users.read`: `user.count()`, activos (`active:true`), suspendidos (`active:false`), recientes (`orderBy createdAt desc take 5`), últimos accesos (`lastLoginAt != null orderBy desc take 5`).
- `roles.read`: `role.count()`, distribución (`role.findMany include _count.users`).
- `incidents.read`: `incident.groupBy by status`, `by severity`, total, recientes (`take 6 include category,reporter`), `incidentStatusLog.findMany orderBy createdAt desc take 6`.
- Feed "Actividad reciente": fusión de usuarios creados + incidentes + cambios de estado, ordenado desc, top 8.

**UI:** saludo por hora (es-PE) + fecha; KPIs auto-fit (Usuarios, Roles, Incidentes abiertos, Incidentes críticos); "Incidentes por estado/severidad" con barras CSS (sin librerías); "Actividad reciente"; "Usuarios por rol"; "Accesos rápidos" (perm-gated). Estados vacíos cuidados.

---

## Fase 2 — Módulo de Incidentes

**Archivos nuevos** en `src/app/(admin)/incidentes/`
- `page.tsx` (server, `requirePermission("incidents.read")`): lee filtros de `searchParams` (status, severity, category, q, assignee, page); carga incidentes, categorías, usuarios asignables, conteos por estado para tabs.
- `IncidentsClient.tsx`: bandeja con tabs por estado, filtros (severidad/categoría/asignado), búsqueda `?q`, badges de estado/severidad, avatar de asignado; fila → drawer.
- `IncidentDrawer.tsx`: detalle (descripción, reportante, ubicación, categoría) + **línea de tiempo** (status log + comentarios).
- `actions.ts`: server actions `changeStatus` (con nota → crea `IncidentStatusLog`), `assignIncident`, `addComment`, `setSeverity`, `deleteIncident` (si `incidents.delete`). Cada una: `requirePermission` + Prisma + `revalidatePath`.
- `types.ts`, estilos (reutilizar `users.css`/globals; añadir lo mínimo).

**Modificados:** `data.ts` (ítem "Incidentes", icono `alert`).

**Notas:** mismo patrón que `usuarios/`. Permisos ya existen. `incidents.write` para acciones; lectura mínima `incidents.read`.

---

## Fase 3 — Funciones reales del TopBar

- **Búsqueda global:** `src/app/api/admin/search/route.ts` (`requireUser`, perm-gated por módulo): busca usuarios (nombre/email si `users.read`), roles (si `roles.read`), incidentes (código/título si `incidents.read`); devuelve resultados agrupados. `TopBar` muestra popover con resultados, navegación por teclado y enlace al destino. Debounce.
- **Notificaciones reales:** computadas en `(admin)/layout.tsx` (server, Prisma, perm-gated) → `AdminShell` → `TopBar`. Badge = conteo real. Fuente: incidentes abiertos/críticos recientes, usuarios nuevos, cambios de estado.
- **Cuenta:** quitar "Añadir otra cuenta"; mostrar roles reales; "Gestionar tu cuenta" → `/cuenta` (perfil + sesiones activas). *Opcional.*

---

## Orden de construcción

Fundamento → Fase 1 → Fase 2 → Fase 3. Cada fase compila y se entrega sola.

## Verificación

- Por fase: `npm run build`, `npm run lint`, typecheck.
- Runtime: `DATABASE_URL` local disponible (`postgresql://…@localhost:5432/admingoogle`). Prueba visual en claro/oscuro y responsive (móvil/tablet/desktop). Estados vacíos (p. ej. incidentes en cero).
- Sin nuevas dependencias (visualizaciones con CSS).

## Fuera de alcance (YAGNI)

- Librerías de gráficas. Edición de perfil/contraseña desde `/cuenta` (solo lectura). Cambios al schema Prisma. i18n (se mantiene español).
