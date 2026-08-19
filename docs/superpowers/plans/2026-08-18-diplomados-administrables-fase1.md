# Diplomados administrables + Docentes (Fase 1) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Administrar diplomados por completo desde el panel (CRUD + módulos), gestionar docentes como usuarios con rol `docente` y asignar un docente responsable por módulo, reflejándolo en la web pública.

**Architecture:** Se extiende el RBAC existente con un rol `docente` y un modelo `TeacherProfile` (1-a-1 con `User`). `DiplomaModule` gana `teacherId` opcional. Nueva página admin `/docentes` (patrón de `/usuarios`) y editor dedicado `/diplomados/[id]` con guardado por sección vía server actions. La web pública deriva los instructores de los docentes asignados a módulos, con fallback al `String[] instructors` legado.

**Tech Stack:** Next.js 16.2.6 (App Router, server actions), React 19, Prisma 7 (+ adapter-pg, cliente generado en `src/generated/prisma`), PostgreSQL, CSS propio del admin.

**Spec:** `docs/superpowers/specs/2026-08-18-diplomados-administrables-fase1-design.md`

## Global Constraints

- **Next.js NO estándar:** antes de escribir código de páginas/actions, leer la guía relevante en `node_modules/next/dist/docs/01-app/` (AGENTS.md lo exige; hay breaking changes respecto al conocimiento de entrenamiento).
- Todo el copy de UI y mensajes de error en **español**.
- Prisma se importa así: `import { prisma } from "@/lib/prisma"` (cliente) y `import { Prisma } from "@/generated/prisma/client"` (namespace de errores/tipos).
- Autorización en cada server action con el patrón existente: `getCurrentUser()` + `permissions.has(...)`; páginas con `requirePermission(...)` de `@/lib/auth/server`.
- Patrón de resultado: `ActionResult` (`ok/error/fieldErrors`), errores P2002 capturados con mensaje claro.
- **No hay framework de tests unitarios** en el proyecto (solo `next dev/build/lint`). El ciclo de verificación por tarea es: `npx tsc --noEmit` → `npm run lint` → script de verificación con `npx tsx` contra la BD de desarrollo y/o flujo en navegador (dev server en `http://localhost:3000`). Los scripts de verificación viven en `prisma/verify-*.ts` (patrón existente).
- Commits frecuentes: un commit por tarea como mínimo, mensajes en español estilo repo (`feat: …`), con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- La clases CSS del admin (`page`, `tablewrap`, `dtable`, `badge`, `btn`, `modal`, `field`, …) ya existen; `modal`/`field` están en `src/app/(admin)/usuarios/users.css` (CSS global importable desde cualquier página del grupo admin).

---

### Task 1: Esquema Prisma — `TeacherProfile` + `DiplomaModule.teacherId`

**Files:**
- Modify: `prisma/schema.prisma` (modelos `User`, `DiplomaModule`; nuevo `TeacherProfile`)
- Create: `prisma/verify-teachers.ts`

**Interfaces:**
- Consumes: modelos existentes `User`, `DiplomaModule`.
- Produces: modelo `TeacherProfile { id, userId, academicDegree, specialty?, bio?, photoUrl?, orcid?, user, modules }`; campo `DiplomaModule.teacherId: String?` con relación `teacher: TeacherProfile?`; relación `User.teacherProfile: TeacherProfile?`. Tareas 3–9 dependen de estos nombres exactos.

- [ ] **Step 1: Añadir el modelo y las relaciones al schema**

En `prisma/schema.prisma`, después del modelo `Session`, añadir:

```prisma
// ─────────────────────────── Docentes ───────────────────────────

model TeacherProfile {
  id             String  @id @default(cuid())
  userId         String  @unique
  academicDegree String            // "Dr.", "Mg.", "Ing."
  specialty      String?           // p. ej. "Redes y Seguridad"
  bio            String?
  photoUrl       String?
  orcid          String?

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  modules DiplomaModule[]
}
```

En el modelo `User`, junto a las demás relaciones, añadir:

```prisma
  teacherProfile TeacherProfile?
```

En el modelo `DiplomaModule`, añadir tras `topics String[]`:

```prisma
  teacherId String?

  teacher TeacherProfile? @relation(fields: [teacherId], references: [id], onDelete: SetNull)
```

y bajo los índices existentes del modelo:

```prisma
  @@index([teacherId])
```

- [ ] **Step 2: Ejecutar la migración y regenerar el cliente**

Run: `npx prisma migrate dev --name add-teacher-profile`
Expected: migración aplicada sin errores; cliente regenerado en `src/generated/prisma`.
(Si `migrate dev` pide confirmación interactiva, usar `npx prisma migrate dev --name add-teacher-profile --skip-seed`.)

- [ ] **Step 3: Escribir el script de verificación**

Create `prisma/verify-teachers.ts`:

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** Verifica que TeacherProfile y DiplomaModule.teacherId existen y son consultables. */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const teachers = await prisma.teacherProfile.count();
  const unassigned = await prisma.diplomaModule.count({ where: { teacherId: null } });
  console.log(`TeacherProfile: ${teachers} registros`);
  console.log(`Módulos sin docente: ${unassigned}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Verificar**

Run: `npx tsx prisma/verify-teachers.ts`
Expected: imprime `TeacherProfile: 0 registros` y el número de módulos existentes sin docente (todos), sin lanzar errores.

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/verify-teachers.ts
git commit -m "feat: modelo TeacherProfile y docente responsable por módulo"
```

---

### Task 2: Rol `docente` en RBAC

**Files:**
- Modify: `src/lib/auth/permissions.ts` (añadir a `ROLE_DEFS`)

**Interfaces:**
- Consumes: `PERMISSIONS`/`ROLE_DEFS` existentes; `prisma/seed.ts` ya sincroniza `ROLE_DEFS` de forma idempotente (no requiere cambios).
- Produces: rol con `key: "docente"` en BD. La Task 3 lo busca por esa key exacta.

- [ ] **Step 1: Añadir el rol a `ROLE_DEFS`**

En `src/lib/auth/permissions.ts`, dentro del array `ROLE_DEFS`, antes de la entrada `reporter`, añadir:

```ts
  {
    key: "docente",
    name: "Docente",
    description:
      "Docente de posgrado. Puede consultar los diplomados; su panel de gestión llega en una fase posterior.",
    system: true,
    permissions: ["diplomas.read"],
  },
```

- [ ] **Step 2: Sincronizar la BD**

Run: `npx tsx prisma/seed.ts`
Expected: log "→ Sincronizando roles…" sin advertencias de permisos faltantes.

- [ ] **Step 3: Verificar**

Run (PowerShell o bash, una línea):

```bash
npx tsx -e "import 'dotenv/config'; import {PrismaPg} from '@prisma/adapter-pg'; import {PrismaClient} from './src/generated/prisma/client'; const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}); p.role.findUnique({where:{key:'docente'},include:{permissions:{include:{permission:true}}}}).then(r=>{console.log(r?.name, r?.permissions.map(x=>x.permission.key)); return p.$disconnect();})"
```

Expected: `Docente [ 'diplomas.read' ]`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat: rol docente en RBAC"
```

---

### Task 3: Server actions de docentes

**Files:**
- Create: `src/app/(admin)/docentes/types.ts`
- Create: `src/app/(admin)/docentes/actions.ts`
- Modify: `prisma/verify-teachers.ts` (ampliar verificación)

**Interfaces:**
- Consumes: `prisma`, `hashPassword` de `@/lib/auth/password`, `getCurrentUser` de `@/lib/auth/server`, rol `docente` (Task 2), modelo `TeacherProfile` (Task 1).
- Produces (Task 4 los importa con estos nombres exactos):
  - `createTeacher(input: TeacherInput): Promise<ActionResult<{ id: string }>>` — con `input.convertExisting === true` convierte un usuario existente (mismo email) en docente en lugar de fallar.
  - `updateTeacherProfile(profileId: string, input: TeacherProfileInput): Promise<ActionResult>`
  - `setTeacherActive(profileId: string, active: boolean): Promise<ActionResult>`
  - Tipos `ActionResult<T>`, `TeacherRow`, `TeacherInput`, `TeacherProfileInput`.

- [ ] **Step 1: Crear `types.ts`**

```ts
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type TeacherRow = {
  id: string; // TeacherProfile.id
  userId: string;
  name: string;
  email: string;
  academicDegree: string;
  specialty: string | null;
  bio: string | null;
  photoUrl: string | null;
  orcid: string | null;
  active: boolean;
  moduleCount: number;
};

export type TeacherProfileInput = {
  academicDegree: string;
  specialty?: string;
  bio?: string;
  photoUrl?: string;
  orcid?: string;
};

export type TeacherInput = TeacherProfileInput & {
  name: string;
  email: string;
  password: string;
  /** true = el email ya pertenece a un usuario y se aprobó convertirlo en docente. */
  convertExisting?: boolean;
};

export type TeacherPerms = { canWrite: boolean };
```

- [ ] **Step 2: Crear `actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/server";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { ActionResult, TeacherInput, TeacherProfileInput } from "./types";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DOCENTE_ROLE_KEY = "docente";

class Denied extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Denied";
  }
}

async function authorize(perm: PermissionKey): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Denied("No autenticado.");
  if (!user.permissions.has(perm)) {
    throw new Denied("No tienes permisos para esta acción.");
  }
  return user;
}

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors };
}

function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

function refresh() {
  revalidatePath("/docentes");
}

function cleanOptional(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function validateProfile(
  input: TeacherProfileInput,
): { fieldErrors: Record<string, string> } | { data: {
  academicDegree: string;
  specialty: string | null;
  bio: string | null;
  photoUrl: string | null;
  orcid: string | null;
} } {
  const fieldErrors: Record<string, string> = {};
  const academicDegree = (input.academicDegree ?? "").trim();
  if (academicDegree.length < 2 || academicDegree.length > 40) {
    fieldErrors.academicDegree = "Indica el grado académico (p. ej. Mg., Dr.).";
  }
  const photoUrl = cleanOptional(input.photoUrl);
  if (photoUrl && !/^https?:\/\/.+/.test(photoUrl)) {
    fieldErrors.photoUrl = "Debe ser una URL http(s) válida.";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    data: {
      academicDegree,
      specialty: cleanOptional(input.specialty),
      bio: cleanOptional(input.bio),
      photoUrl,
      orcid: cleanOptional(input.orcid),
    },
  };
}

/* ─────────────────────────────── createTeacher ─────────────────────────────── */

export async function createTeacher(
  input: TeacherInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await authorize("users.write");

    const name = (input.name ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();
    const password = input.password ?? "";

    const fieldErrors: Record<string, string> = {};
    if (name.length < 2) fieldErrors.name = "El nombre es obligatorio.";
    if (!EMAIL_RE.test(email)) fieldErrors.email = "Correo no válido.";
    const profile = validateProfile(input);
    if ("fieldErrors" in profile) Object.assign(fieldErrors, profile.fieldErrors);

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { teacherProfile: true },
    });

    if (!existing && password.length < 6) {
      fieldErrors.password = "La contraseña debe tener al menos 6 caracteres.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }
    if ("fieldErrors" in profile) return fail("Revisa los campos marcados."); // inalcanzable; satisface a TS

    const role = await prisma.role.findUnique({ where: { key: DOCENTE_ROLE_KEY } });
    if (!role) return fail("El rol Docente no existe. Ejecuta la semilla de roles.");

    if (existing) {
      if (existing.teacherProfile) {
        return fail("Ese usuario ya es docente.", { email: "Ya registrado como docente." });
      }
      if (!input.convertExisting) {
        // Señal para que la UI ofrezca la conversión explícitamente.
        return {
          ok: false,
          error: "EXISTING_USER",
          fieldErrors: { email: "Este correo ya pertenece a un usuario." },
        };
      }
      const created = await prisma.$transaction(async (tx) => {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: existing.id, roleId: role.id } },
          update: {},
          create: { userId: existing.id, roleId: role.id },
        });
        return tx.teacherProfile.create({
          data: { userId: existing.id, ...profile.data },
        });
      });
      refresh();
      return ok({ id: created.id });
    }

    const passwordHash = await hashPassword(password);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            roles: { create: [{ roleId: role.id }] },
          },
        });
        return tx.teacherProfile.create({
          data: { userId: user.id, ...profile.data },
        });
      });
      refresh();
      return ok({ id: created.id });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fail("Ya existe un usuario con ese correo.", { email: "Correo en uso." });
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("createTeacher", e);
    return fail("No se pudo crear el docente.");
  }
}

/* ──────────────────────────── updateTeacherProfile ──────────────────────────── */

export async function updateTeacherProfile(
  profileId: string,
  input: TeacherProfileInput,
): Promise<ActionResult> {
  try {
    await authorize("users.write");
    const profile = validateProfile(input);
    if ("fieldErrors" in profile) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors: profile.fieldErrors };
    }
    const updated = await prisma.teacherProfile
      .update({ where: { id: profileId }, data: profile.data })
      .catch(() => null);
    if (!updated) return fail("Docente no encontrado.");
    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("updateTeacherProfile", e);
    return fail("No se pudo actualizar el perfil.");
  }
}

/* ────────────────────────────── setTeacherActive ────────────────────────────── */

export async function setTeacherActive(
  profileId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const me = await authorize("users.write");
    const profile = await prisma.teacherProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
    if (!profile) return fail("Docente no encontrado.");
    if (profile.userId === me.id && !active) {
      return fail("No puedes suspender tu propia cuenta.");
    }
    await prisma.user.update({
      where: { id: profile.userId },
      data: { active },
    });
    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("setTeacherActive", e);
    return fail("No se pudo cambiar el estado del docente.");
  }
}
```

Nota: `setTeacherActive` no necesita la salvaguarda de superadmin de `/usuarios` porque un perfil docente nunca envuelve a un superadmin en el flujo normal; si el usuario también fuera superadmin, la gestión de su estado se hace desde `/usuarios`, que sí la tiene. No duplicar esa lógica aquí (YAGNI).

- [ ] **Step 3: Ampliar el script de verificación y probar el flujo real contra la BD**

Reemplazar el contenido de `prisma/verify-teachers.ts` por:

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Verificación de la infraestructura de docentes:
 * crea (si falta) un docente de prueba con rol `docente`, lo lista y lo limpia.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const role = await prisma.role.findUnique({ where: { key: "docente" } });
  if (!role) throw new Error("Falta el rol docente (ejecuta prisma/seed.ts)");

  const email = "verify.docente@unamad.edu.pe";
  await prisma.user.deleteMany({ where: { email } }); // limpia corridas previas

  const user = await prisma.user.create({
    data: {
      email,
      name: "Docente de Verificación",
      passwordHash: "x",
      roles: { create: [{ roleId: role.id }] },
      teacherProfile: { create: { academicDegree: "Mg.", specialty: "Prueba" } },
    },
    include: { teacherProfile: true },
  });
  console.log("Creado:", user.name, "perfil:", user.teacherProfile?.id);

  const rows = await prisma.teacherProfile.findMany({
    include: { user: true, _count: { select: { modules: true } } },
  });
  console.log(`Docentes en BD: ${rows.length}`);
  for (const t of rows) {
    console.log(` - ${t.academicDegree} ${t.user.name} (${t._count.modules} módulos)`);
  }

  await prisma.user.deleteMany({ where: { email } }); // cascade borra el perfil
  const orphans = await prisma.teacherProfile.count({ where: { user: { email } } });
  console.log("Perfiles huérfanos tras borrar:", orphans, "(esperado: 0)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Verificar**

Run: `npx tsx prisma/verify-teachers.ts`
Expected: crea el docente, lo lista con `0 módulos`, y reporta `Perfiles huérfanos tras borrar: 0`.

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/docentes/types.ts" "src/app/(admin)/docentes/actions.ts" prisma/verify-teachers.ts
git commit -m "feat: server actions de docentes (crear, editar perfil, activar)"
```

---

### Task 4: UI `/docentes` + navegación

**Files:**
- Create: `src/app/(admin)/docentes/page.tsx`
- Create: `src/app/(admin)/docentes/DocentesView.tsx`
- Create: `src/app/(admin)/docentes/TeacherModal.tsx`
- Modify: `src/components/admin/data.ts` (item de sidebar)

**Interfaces:**
- Consumes: `createTeacher`, `updateTeacherProfile`, `setTeacherActive` y tipos de Task 3; clases CSS de `users.css`; `useEscClose` de `@/lib/ui/useEscClose`; `Icon` de `@/components/admin/Icon`.
- Produces: página navegable en `/docentes` (permiso `users.read` para ver, `users.write` para escribir).

- [ ] **Step 1: Sidebar**

En `src/components/admin/data.ts`, en `SIDEBAR_NAV`, insertar tras la entrada `diplomados`:

```ts
  { id: "docentes", label: "Docentes", icon: "user", href: "/docentes" },
```

- [ ] **Step 2: `page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { DocentesView } from "./DocentesView";
import type { TeacherRow } from "./types";
import "../usuarios/users.css";

export const metadata = { title: "Docentes · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePermission("users.read");

  const profiles = await prisma.teacherProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      _count: { select: { modules: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const rows: TeacherRow[] = profiles.map((t) => ({
    id: t.id,
    userId: t.user.id,
    name: t.user.name,
    email: t.user.email,
    academicDegree: t.academicDegree,
    specialty: t.specialty,
    bio: t.bio,
    photoUrl: t.photoUrl,
    orcid: t.orcid,
    active: t.user.active,
    moduleCount: t._count.modules,
  }));

  return (
    <DocentesView
      rows={rows}
      perms={{ canWrite: me.permissions.has("users.write") }}
    />
  );
}
```

- [ ] **Step 3: `TeacherModal.tsx` (crear y editar en un componente)**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/admin/Icon";
import { useEscClose } from "@/lib/ui/useEscClose";
import type { ActionResult, TeacherInput, TeacherProfileInput, TeacherRow } from "./types";

type Props = {
  /** null = crear; TeacherRow = editar perfil académico. */
  initial: TeacherRow | null;
  onClose: () => void;
  onCreate: (input: TeacherInput) => Promise<ActionResult<{ id: string }>>;
  onUpdate: (profileId: string, input: TeacherProfileInput) => Promise<ActionResult>;
};

const DEGREES = ["Mg.", "Dr.", "Ing.", "Lic.", "MSc.", "PhD."];

export function TeacherModal({ initial, onClose, onCreate, onUpdate }: Props) {
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [academicDegree, setAcademicDegree] = useState(initial?.academicDegree ?? "Mg.");
  const [specialty, setSpecialty] = useState(initial?.specialty ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [orcid, setOrcid] = useState(initial?.orcid ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [offerConvert, setOfferConvert] = useState(false);

  useEscClose(true, onClose, submitting);

  const valid = editing
    ? academicDegree.trim().length >= 2
    : name.trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(email) &&
      (offerConvert || password.length >= 6) &&
      academicDegree.trim().length >= 2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setTopError(null);
    setFieldErrors({});

    const profile: TeacherProfileInput = {
      academicDegree: academicDegree.trim(),
      specialty: specialty.trim() || undefined,
      bio: bio.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
      orcid: orcid.trim() || undefined,
    };

    const res = editing
      ? await onUpdate(initial.id, profile)
      : await onCreate({
          ...profile,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          convertExisting: offerConvert,
        });

    if (!res.ok) {
      if (res.error === "EXISTING_USER") {
        setOfferConvert(true);
        setTopError(
          "Este correo ya pertenece a un usuario del sistema. Si continúas, se le añadirá el rol Docente y su perfil académico (su contraseña actual no cambia).",
        );
      } else {
        setTopError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
      setSubmitting(false);
      return;
    }
    onClose();
  };

  const err = (key: string) =>
    fieldErrors[key] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[key]}</span>
    ) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <h2>{editing ? "Editar docente" : "Nuevo docente"}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="modal__body">
          {topError && (
            <div className="login__error" role="alert" style={{ marginBottom: 16 }}>
              <Icon name="info" size={16} />
              <span>{topError}</span>
            </div>
          )}

          {!editing && (
            <>
              <label className="field">
                <span className="field__label">
                  Nombre completo<span className="field__req">*</span>
                </span>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="p. ej. Nelly J. Ulloa Gallardo"
                  aria-invalid={!!fieldErrors.name}
                />
                {err("name")}
              </label>

              <label className="field">
                <span className="field__label">
                  Correo<span className="field__req">*</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setOfferConvert(false);
                  }}
                  placeholder="docente@unamad.edu.pe"
                  aria-invalid={!!fieldErrors.email}
                />
                {err("email")}
              </label>

              {!offerConvert && (
                <label className="field">
                  <span className="field__label">
                    Contraseña inicial<span className="field__req">*</span>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="mínimo 6 caracteres"
                    aria-invalid={!!fieldErrors.password}
                    autoComplete="new-password"
                  />
                  {err("password")}
                </label>
              )}
            </>
          )}

          <label className="field">
            <span className="field__label">
              Grado académico<span className="field__req">*</span>
            </span>
            <select
              value={academicDegree}
              onChange={(e) => setAcademicDegree(e.target.value)}
              aria-invalid={!!fieldErrors.academicDegree}
            >
              {DEGREES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {err("academicDegree")}
          </label>

          <label className="field">
            <span className="field__label">Especialidad</span>
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="p. ej. Redes y Seguridad"
            />
          </label>

          <label className="field">
            <span className="field__label">Reseña (bio)</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Trayectoria breve del docente"
            />
          </label>

          <label className="field">
            <span className="field__label">Foto (URL)</span>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
              aria-invalid={!!fieldErrors.photoUrl}
            />
            {err("photoUrl")}
          </label>

          <label className="field">
            <span className="field__label">ORCID</span>
            <input
              type="text"
              value={orcid}
              onChange={(e) => setOrcid(e.target.value)}
              placeholder="0000-0000-0000-0000"
            />
          </label>
        </div>
        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid || submitting}>
            {submitting
              ? "Guardando…"
              : editing
                ? "Guardar cambios"
                : offerConvert
                  ? "Convertir en docente"
                  : "Crear docente"}
          </button>
        </footer>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: `DocentesView.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { createTeacher, setTeacherActive, updateTeacherProfile } from "./actions";
import { TeacherModal } from "./TeacherModal";
import type { TeacherPerms, TeacherRow } from "./types";

export function DocentesView({ rows, perms }: { rows: TeacherRow[]; perms: TeacherPerms }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "create" | TeacherRow>("closed");

  const toggleActive = (t: TeacherRow) => {
    setError(null);
    setBusyId(t.id);
    startTransition(async () => {
      const res = await setTeacherActive(t.id, !t.active);
      setBusyId(null);
      if (!res.ok) setError(res.error);
    });
  };

  const activos = rows.filter((r) => r.active).length;

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Docentes</h1>
          <span className="page__sub">
            {rows.length} docente{rows.length === 1 ? "" : "s"} · {activos} activo{activos === 1 ? "" : "s"}
          </span>
        </div>
        {perms.canWrite && (
          <button className="btn btn--primary" onClick={() => setModal("create")}>
            <Icon name="plus" size={16} />
            Nuevo docente
          </button>
        )}
      </div>

      {error && (
        <div className="banner" role="alert" style={{ borderColor: "#f5c2c7" }}>
          <span className="banner__icon" style={{ color: "#d93025" }}>
            <Icon name="alert" size={18} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="user" size={40} />
            <h3>Aún no hay docentes</h3>
            <p>Crea el primer docente para poder asignarlo a los módulos de un diplomado.</p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Docente</th>
                  <th>Especialidad</th>
                  <th className="dtable__num">Módulos</th>
                  <th>Estado</th>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const isBusy = pending && busyId === t.id;
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {t.academicDegree} {t.name}
                        </div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>{t.email}</div>
                      </td>
                      <td className="dtable__muted">{t.specialty ?? "—"}</td>
                      <td className="dtable__num">{t.moduleCount}</td>
                      <td>
                        <span className={`badge ${t.active ? "badge--green" : "badge--neutral"}`}>
                          {t.active ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      <td className="dtable__settings">
                        {perms.canWrite && (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button className="btn btn--ghost" onClick={() => setModal(t)}>
                              Editar
                            </button>
                            <button
                              className="btn btn--ghost"
                              disabled={isBusy}
                              onClick={() => toggleActive(t)}
                            >
                              {isBusy ? "…" : t.active ? "Suspender" : "Reactivar"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal !== "closed" && (
        <TeacherModal
          initial={modal === "create" ? null : modal}
          onClose={() => setModal("closed")}
          onCreate={createTeacher}
          onUpdate={updateTeacherProfile}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar en navegador**

Run: `npx tsc --noEmit` y `npm run lint` — sin errores.
Con el dev server corriendo (`npm run dev`), iniciar sesión como admin en `http://localhost:3000/login` y:
1. Abrir `/docentes` → tabla vacía con estado vacío correcto y el ítem "Docentes" activo en el sidebar.
2. Crear un docente nuevo (nombre, correo nuevo, contraseña, grado) → aparece en la tabla.
3. Crear un docente con el correo de un usuario existente → el modal muestra el aviso de conversión y el botón cambia a "Convertir en docente"; confirmar → aparece en la tabla.
4. Editar el perfil (especialidad) → persiste tras recargar.
5. Suspender y reactivar → el badge cambia.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/docentes" src/components/admin/data.ts
git commit -m "feat: página de gestión de docentes en el admin"
```

---

### Task 5: Crear/eliminar diplomado + accesos desde la lista

**Files:**
- Modify: `src/app/(admin)/diplomados/types.ts` (ampliar `ActionResult`)
- Modify: `src/app/(admin)/diplomados/actions.ts` (añadir `createDiploma`, `deleteDiploma`)
- Modify: `src/app/(admin)/diplomados/page.tsx` (contar postulaciones)
- Modify: `src/app/(admin)/diplomados/DiplomasView.tsx` (botones Editar/Nuevo/Eliminar, quitar banner de semilla)

**Interfaces:**
- Consumes: patrón de actions existente en ese archivo.
- Produces (Task 6 enlaza a `/diplomados/[id]`):
  - `createDiploma(input: { title: string; slug: string; code: string }): Promise<ActionResult<{ id: string }>>`
  - `deleteDiploma(id: string): Promise<ActionResult>` — rechaza si el diplomado tiene postulaciones.
  - `DiplomaRow` gana `applicationCount: number`.
  - `ActionResult` pasa a: `type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };` (compatible con el uso actual).

- [ ] **Step 1: Ampliar `types.ts`**

Reemplazar la línea del `ActionResult` actual por:

```ts
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
```

y añadir `applicationCount: number;` a `DiplomaRow`.

- [ ] **Step 2: Añadir actions**

En `src/app/(admin)/diplomados/actions.ts`, añadir al final (mismos imports ya presentes; añadir `Prisma` de `@/generated/prisma/client`):

```ts
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Crea un diplomado en borrador con los datos mínimos. Requiere diplomas.write. */
export async function createDiploma(input: {
  title: string;
  slug: string;
  code: string;
}): Promise<ActionResult<{ id: string }>> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }

  const title = (input.title ?? "").trim();
  const slug = (input.slug ?? "").trim().toLowerCase();
  const code = (input.code ?? "").trim().toUpperCase();

  const fieldErrors: Record<string, string> = {};
  if (title.length < 3) fieldErrors.title = "El título es obligatorio.";
  if (!SLUG_RE.test(slug) || slug.length > 40)
    fieldErrors.slug = "Solo minúsculas, números y guiones (p. ej. gestion-publica).";
  if (code.length < 2 || code.length > 12)
    fieldErrors.code = "Código de 2 a 12 caracteres (p. ej. DGP).";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  try {
    const created = await prisma.diploma.create({
      data: {
        title,
        slug,
        code,
        subtitle: "Diplomado de Posgrado",
        faculty: "Facultad de Ingeniería · Unidad de Posgrado",
        summary: "",
        description: "",
        objective: "",
        status: "draft",
        modality: "Por definir",
        schedule: "Por definir",
        totalHours: 0,
        credits: 0,
        enrollmentFee: 0,
        moduleFee: 0,
        certificationFee: 0,
      },
      select: { id: true },
    });
    revalidatePath("/diplomados");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "Ese slug o código ya existe.",
        fieldErrors: { slug: "Debe ser único." },
      };
    }
    console.error("createDiploma", e);
    return { ok: false, error: "No se pudo crear el diplomado." };
  }
}

/** Elimina un diplomado SIN postulaciones. Requiere diplomas.write. */
export async function deleteDiploma(id: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }
  const target = await prisma.diploma.findUnique({
    where: { id },
    select: { slug: true, _count: { select: { applications: true } } },
  });
  if (!target) return { ok: false, error: "Diplomado no encontrado." };
  if (target._count.applications > 0) {
    return {
      ok: false,
      error:
        "Este diplomado tiene postulaciones registradas; ciérralo u ocúltalo en lugar de eliminarlo.",
    };
  }
  await prisma.diploma.delete({ where: { id } });
  revalidatePath("/diplomados");
  revalidatePath("/");
  revalidatePath(`/diplomado/${target.slug}`);
  return { ok: true };
}
```

- [ ] **Step 3: `page.tsx` — contar postulaciones**

En el `include` del `findMany`, cambiar `_count: { select: { modules: true } }` por `_count: { select: { modules: true, applications: true } }` y en el mapeo añadir `applicationCount: d._count.applications,`.

- [ ] **Step 4: `DiplomasView.tsx` — cabecera y acciones**

1. Eliminar por completo el `<div className="banner">…semilla…</div>` informativo (el primero, no el de error).
2. En `page__head`, tras el `page__title`, añadir (solo con `perms.canWrite`):

```tsx
        {perms.canWrite && (
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={16} />
            Nuevo diplomado
          </button>
        )}
```

con estado `const [showCreate, setShowCreate] = useState(false);`.

3. En la celda de acciones de cada fila, antes de los botones de estado, añadir:

```tsx
                          {perms.canWrite && (
                            <Link className="linkbtn" href={`/diplomados/${r.id}`}>
                              <Icon name="settings" size={15} />
                              Editar
                            </Link>
                          )}
```

y, al final de la fila de botones, un botón Eliminar visible solo si `r.applicationCount === 0`:

```tsx
                          {perms.canWrite && r.applicationCount === 0 && (
                            <button
                              className="btn btn--ghost"
                              disabled={isBusy}
                              onClick={() => {
                                if (confirm(`¿Eliminar "${r.title}"? Esta acción no se puede deshacer.`)) {
                                  setBusyId(r.id);
                                  startTransition(async () => {
                                    const res = await deleteDiploma(r.id);
                                    setBusyId(null);
                                    if (!res.ok) setError(res.error);
                                  });
                                }
                              }}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
```

4. Modal de creación al final del componente (usa las clases de `users.css`; añadir `import "../usuarios/users.css";` en `src/app/(admin)/diplomados/page.tsx`):

```tsx
      {showCreate && (
        <CreateDiplomaModal
          onClose={() => setShowCreate(false)}
          onSubmit={createDiploma}
        />
      )}
```

5. Crear el componente `CreateDiplomaModal` dentro del mismo archivo `DiplomasView.tsx` (es pequeño y solo se usa aquí):

```tsx
function slugFromTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function CreateDiplomaModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; slug: string; code: string }) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [topError, setTopError] = useState<string | null>(null);

  const valid = title.trim().length >= 3 && slug.length >= 2 && code.trim().length >= 2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setTopError(null);
    setFieldErrors({});
    const res = await onSubmit({ title: title.trim(), slug, code: code.trim().toUpperCase() });
    if (!res.ok) {
      setTopError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setSubmitting(false);
      return;
    }
    router.push(`/diplomados/${res.data!.id}`);
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <h2>Nuevo diplomado</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="modal__body">
          <p className="modal__intro">
            Se crea como borrador. Completa el contenido en el editor antes de publicarlo.
          </p>
          {topError && (
            <div className="login__error" role="alert" style={{ marginBottom: 16 }}>
              <Icon name="info" size={16} />
              <span>{topError}</span>
            </div>
          )}
          <label className="field">
            <span className="field__label">Título<span className="field__req">*</span></span>
            <input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!touchedSlug) setSlug(slugFromTitle(e.target.value));
              }}
              placeholder="p. ej. Gestión Pública"
              aria-invalid={!!fieldErrors.title}
            />
            {err("title")}
          </label>
          <label className="field">
            <span className="field__label">Slug (URL pública)<span className="field__req">*</span></span>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(slugFromTitle(e.target.value));
                setTouchedSlug(true);
              }}
              placeholder="gestion-publica"
              aria-invalid={!!fieldErrors.slug}
            />
            {err("slug")}
          </label>
          <label className="field">
            <span className="field__label">Código<span className="field__req">*</span></span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DGP"
              aria-invalid={!!fieldErrors.code}
            />
            {err("code")}
          </label>
        </div>
        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid || submitting}>
            {submitting ? "Creando…" : "Crear y editar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
```

Imports nuevos que necesita `DiplomasView.tsx`: `useRouter` de `next/navigation`, `createDiploma` y `deleteDiploma` de `./actions`.

- [ ] **Step 5: Verificar en navegador**

`npx tsc --noEmit` y `npm run lint` — sin errores. En `/diplomados`:
1. El banner de la semilla ya no aparece.
2. "Nuevo diplomado" abre el modal; crear "Prueba Editor" (`prueba-editor`, `DPE`) → navega a `/diplomados/<id>` (dará 404 hasta la Task 6 — esperado; verificar solo que la URL es correcta y la fila aparece al volver).
3. Slug duplicado (`tic`) → error "Ese slug o código ya existe.".
4. El diplomado TIC (con postulaciones, si las hay) no muestra el botón de eliminar; el de prueba sí, y eliminarlo lo quita de la lista. Dejar creado uno de prueba para las tareas siguientes.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/diplomados"
git commit -m "feat: crear y eliminar diplomados desde el panel"
```

---

### Task 6: Editor `/diplomados/[id]` — página, datos generales y métricas

**Files:**
- Create: `src/app/(admin)/diplomados/[id]/page.tsx`
- Create: `src/app/(admin)/diplomados/[id]/types.ts`
- Create: `src/app/(admin)/diplomados/[id]/actions.ts`
- Create: `src/app/(admin)/diplomados/[id]/DiplomaEditor.tsx`
- Create: `src/app/(admin)/diplomados/[id]/GeneralSection.tsx`
- Create: `src/app/(admin)/diplomados/[id]/MetricsSection.tsx`
- Create: `src/app/(admin)/diplomados/[id]/editor.css`

**Interfaces:**
- Consumes: `requirePermission`, `prisma`, clases admin + `users.css` (campos/`field`).
- Produces (Tasks 7–8 amplían estos archivos):
  - `types.ts`: `ActionResult<T>` (misma forma que Task 5), `EditorDiploma`, `EditorModule`, `TeacherOption`, `EditorPerms`.
  - `actions.ts`: `updateDiplomaGeneral(id, input): Promise<ActionResult>`, `updateDiplomaMetrics(id, input): Promise<ActionResult>`, más el helper interno `authorizeWrite()` y `revalidateDiploma(slug)` que las tareas 7–8 reutilizan.
  - `DiplomaEditor.tsx` renderiza secciones; Tasks 7–8 le añaden `ListsSection` y `ModulesSection`.

- [ ] **Step 1: `types.ts`**

```ts
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type DiplomaStatus = "draft" | "published" | "closed";

export type EditorDiploma = {
  id: string;
  slug: string;
  code: string;
  title: string;
  subtitle: string | null;
  faculty: string;
  summary: string;
  description: string;
  objective: string;
  status: DiplomaStatus;
  modality: string;
  schedule: string;
  admissionLabel: string | null;
  featured: boolean;
  order: number;
  totalHours: number;
  credits: number;
  weeksPerModule: number;
  minEnrollment: number;
  enrollmentFee: number;
  moduleFee: number;
  certificationFee: number;
  objectives: string[];
  requirements: string[];
  graduateProfile: string[];
};

export type EditorModule = {
  id: string;
  code: string;
  order: number;
  name: string;
  syncHours: number;
  asyncHours: number;
  totalHours: number;
  credits: number;
  summary: string;
  topics: string[];
  teacherId: string | null;
};

export type TeacherOption = {
  id: string; // TeacherProfile.id
  label: string; // "Mg. Nelly Ulloa Gallardo"
};

export type EditorPerms = { canWrite: boolean };

export type GeneralInput = {
  title: string;
  slug: string;
  code: string;
  subtitle: string;
  faculty: string;
  summary: string;
  description: string;
  objective: string;
  modality: string;
  schedule: string;
  admissionLabel: string;
  featured: boolean;
  order: number;
};

export type MetricsInput = {
  totalHours: number;
  credits: number;
  weeksPerModule: number;
  minEnrollment: number;
  enrollmentFee: number;
  moduleFee: number;
  certificationFee: number;
};
```

- [ ] **Step 2: `actions.ts` (base + dos acciones)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import type { ActionResult, GeneralInput, MetricsInput } from "./types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function authorizeWrite(): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }
  return { ok: true };
}

function revalidateDiploma(slug: string) {
  revalidatePath("/diplomados");
  revalidatePath(`/diplomados`, "layout");
  revalidatePath("/");
  revalidatePath(`/diplomado/${slug}`);
}

function reqStr(v: unknown, field: string, label: string, errs: Record<string, string>, max = 5000): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length === 0) errs[field] = `${label} es obligatorio.`;
  else if (s.length > max) errs[field] = `Máximo ${max} caracteres.`;
  return s;
}

function nonNegInt(v: unknown, field: string, errs: Record<string, string>, max = 100000): number {
  const n = typeof v === "number" ? v : NaN;
  if (!Number.isInteger(n) || n < 0 || n > max) {
    errs[field] = "Debe ser un número entero no negativo.";
    return 0;
  }
  return n;
}

/* ─────────────────────────── updateDiplomaGeneral ─────────────────────────── */

export async function updateDiplomaGeneral(
  id: string,
  input: GeneralInput,
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const errs: Record<string, string> = {};
  const title = reqStr(input.title, "title", "El título", errs, 200);
  const summary = reqStr(input.summary, "summary", "El resumen", errs, 600);
  const description = reqStr(input.description, "description", "La descripción", errs);
  const objective = reqStr(input.objective, "objective", "El objetivo", errs);
  const faculty = reqStr(input.faculty, "faculty", "La facultad", errs, 160);
  const modality = reqStr(input.modality, "modality", "La modalidad", errs, 120);
  const schedule = reqStr(input.schedule, "schedule", "El horario", errs, 120);
  const slug = (input.slug ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug) || slug.length > 40) {
    errs.slug = "Solo minúsculas, números y guiones.";
  }
  const code = (input.code ?? "").trim().toUpperCase();
  if (code.length < 2 || code.length > 12) errs.code = "Código de 2 a 12 caracteres.";
  const order = nonNegInt(input.order, "order", errs, 999);
  if (Object.keys(errs).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors: errs };
  }

  try {
    const updated = await prisma.diploma.update({
      where: { id },
      data: {
        title,
        slug,
        code,
        subtitle: (input.subtitle ?? "").trim() || null,
        faculty,
        summary,
        description,
        objective,
        modality,
        schedule,
        admissionLabel: (input.admissionLabel ?? "").trim() || null,
        featured: input.featured === true,
        order,
      },
      select: { slug: true },
    });
    revalidateDiploma(updated.slug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ese slug o código ya existe.", fieldErrors: { slug: "Debe ser único." } };
    }
    console.error("updateDiplomaGeneral", e);
    return { ok: false, error: "No se pudo guardar los datos generales." };
  }
}

/* ─────────────────────────── updateDiplomaMetrics ─────────────────────────── */

export async function updateDiplomaMetrics(
  id: string,
  input: MetricsInput,
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const errs: Record<string, string> = {};
  const data = {
    totalHours: nonNegInt(input.totalHours, "totalHours", errs),
    credits: nonNegInt(input.credits, "credits", errs, 500),
    weeksPerModule: nonNegInt(input.weeksPerModule, "weeksPerModule", errs, 52),
    minEnrollment: nonNegInt(input.minEnrollment, "minEnrollment", errs, 10000),
    enrollmentFee: nonNegInt(input.enrollmentFee, "enrollmentFee", errs),
    moduleFee: nonNegInt(input.moduleFee, "moduleFee", errs),
    certificationFee: nonNegInt(input.certificationFee, "certificationFee", errs),
  };
  if (Object.keys(errs).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors: errs };
  }

  const updated = await prisma.diploma
    .update({ where: { id }, data, select: { slug: true } })
    .catch(() => null);
  if (!updated) return { ok: false, error: "Diplomado no encontrado." };
  revalidateDiploma(updated.slug);
  return { ok: true };
}
```

- [ ] **Step 3: `page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { DiplomaEditor } from "./DiplomaEditor";
import type { EditorDiploma, EditorModule, TeacherOption } from "./types";
import "../../usuarios/users.css";
import "./editor.css";

export const metadata = { title: "Editar diplomado · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("diplomas.read");
  const { id } = await params;

  const d = await prisma.diploma.findUnique({
    where: { id },
    include: { modules: { orderBy: { order: "asc" } } },
  });
  if (!d) notFound();

  const teachers = await prisma.teacherProfile.findMany({
    where: { user: { active: true } },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const diploma: EditorDiploma = {
    id: d.id,
    slug: d.slug,
    code: d.code,
    title: d.title,
    subtitle: d.subtitle,
    faculty: d.faculty,
    summary: d.summary,
    description: d.description,
    objective: d.objective,
    status: d.status,
    modality: d.modality,
    schedule: d.schedule,
    admissionLabel: d.admissionLabel,
    featured: d.featured,
    order: d.order,
    totalHours: d.totalHours,
    credits: d.credits,
    weeksPerModule: d.weeksPerModule,
    minEnrollment: d.minEnrollment,
    enrollmentFee: d.enrollmentFee,
    moduleFee: d.moduleFee,
    certificationFee: d.certificationFee,
    objectives: d.objectives,
    requirements: d.requirements,
    graduateProfile: d.graduateProfile,
  };

  const modules: EditorModule[] = d.modules.map((m) => ({
    id: m.id,
    code: m.code,
    order: m.order,
    name: m.name,
    syncHours: m.syncHours,
    asyncHours: m.asyncHours,
    totalHours: m.totalHours,
    credits: m.credits,
    summary: m.summary,
    topics: m.topics,
    teacherId: m.teacherId,
  }));

  const teacherOptions: TeacherOption[] = teachers.map((t) => ({
    id: t.id,
    label: `${t.academicDegree} ${t.user.name}`,
  }));

  return (
    <DiplomaEditor
      diploma={diploma}
      modules={modules}
      teachers={teacherOptions}
      perms={{ canWrite: me.permissions.has("diplomas.write") }}
    />
  );
}
```

- [ ] **Step 4: `editor.css`**

```css
/* Editor de diplomado */
.edsec {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}
.edsec__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.edsec__head h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.edsec__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px 16px;
}
.edsec__grid .field--full {
  grid-column: 1 / -1;
}
.edsec__foot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.edsec__saved {
  font-size: 12.5px;
  color: var(--muted, #6b7280);
}
.edlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.edlist__row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.edlist__row input {
  flex: 1;
}
@media (max-width: 640px) {
  .edsec { padding: 14px; }
}
```

- [ ] **Step 5: `GeneralSection.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateDiplomaGeneral } from "./actions";
import type { EditorDiploma, GeneralInput } from "./types";

export function GeneralSection({ diploma, canWrite }: { diploma: EditorDiploma; canWrite: boolean }) {
  const [form, setForm] = useState<GeneralInput>({
    title: diploma.title,
    slug: diploma.slug,
    code: diploma.code,
    subtitle: diploma.subtitle ?? "",
    faculty: diploma.faculty,
    summary: diploma.summary,
    description: diploma.description,
    objective: diploma.objective,
    modality: diploma.modality,
    schedule: diploma.schedule,
    admissionLabel: diploma.admissionLabel ?? "",
    featured: diploma.featured,
    order: diploma.order,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const set = <K extends keyof GeneralInput>(k: K, v: GeneralInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await updateDiplomaGeneral(diploma.id, form);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setSaved(true);
    });
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Datos generales</h2>
      </div>
      <div className="edsec__grid">
        <label className="field field--full">
          <span className="field__label">Título</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.title} />
          {err("title")}
        </label>
        <label className="field">
          <span className="field__label">Slug (URL)</span>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.slug} />
          {err("slug")}
        </label>
        <label className="field">
          <span className="field__label">Código</span>
          <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} disabled={!canWrite} aria-invalid={!!fieldErrors.code} />
          {err("code")}
        </label>
        <label className="field">
          <span className="field__label">Subtítulo</span>
          <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} disabled={!canWrite} placeholder="Diplomado de Posgrado" />
        </label>
        <label className="field">
          <span className="field__label">Facultad</span>
          <input value={form.faculty} onChange={(e) => set("faculty", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.faculty} />
          {err("faculty")}
        </label>
        <label className="field">
          <span className="field__label">Modalidad</span>
          <input value={form.modality} onChange={(e) => set("modality", e.target.value)} disabled={!canWrite} placeholder="Semipresencial · Google Meet" aria-invalid={!!fieldErrors.modality} />
          {err("modality")}
        </label>
        <label className="field">
          <span className="field__label">Horario</span>
          <input value={form.schedule} onChange={(e) => set("schedule", e.target.value)} disabled={!canWrite} placeholder="Viernes y sábado" aria-invalid={!!fieldErrors.schedule} />
          {err("schedule")}
        </label>
        <label className="field">
          <span className="field__label">Etiqueta de admisión</span>
          <input value={form.admissionLabel} onChange={(e) => set("admissionLabel", e.target.value)} disabled={!canWrite} placeholder="Admisión 2026-II" />
        </label>
        <label className="field">
          <span className="field__label">Orden</span>
          <input
            type="number"
            min={0}
            value={form.order}
            onChange={(e) => set("order", Number(e.target.value))}
            disabled={!canWrite}
            aria-invalid={!!fieldErrors.order}
          />
          {err("order")}
        </label>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => set("featured", e.target.checked)}
            disabled={!canWrite}
            style={{ width: "auto" }}
          />
          <span className="field__label" style={{ margin: 0 }}>Destacado en la portada</span>
        </label>
        <label className="field field--full">
          <span className="field__label">Resumen (tarjetas)</span>
          <textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.summary} />
          {err("summary")}
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción (fundamentación)</span>
          <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.description} />
          {err("description")}
        </label>
        <label className="field field--full">
          <span className="field__label">Objetivo general</span>
          <textarea rows={3} value={form.objective} onChange={(e) => set("objective", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.objective} />
          {err("objective")}
        </label>
      </div>
      {canWrite && (
        <div className="edsec__foot">
          {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
          {saved && !error && <span className="edsec__saved">Guardado ✓</span>}
          <button className="btn btn--primary" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar datos generales"}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: `MetricsSection.tsx`**

Misma estructura que `GeneralSection` pero con estado `MetricsInput` y `updateDiplomaMetrics`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateDiplomaMetrics } from "./actions";
import type { EditorDiploma, MetricsInput } from "./types";

const FIELDS: Array<{ key: keyof MetricsInput; label: string }> = [
  { key: "totalHours", label: "Horas totales" },
  { key: "credits", label: "Créditos" },
  { key: "weeksPerModule", label: "Semanas por módulo" },
  { key: "minEnrollment", label: "Matrícula mínima (alumnos)" },
  { key: "enrollmentFee", label: "Matrícula (S/)" },
  { key: "moduleFee", label: "Costo por módulo (S/)" },
  { key: "certificationFee", label: "Certificación (S/)" },
];

export function MetricsSection({ diploma, canWrite }: { diploma: EditorDiploma; canWrite: boolean }) {
  const [form, setForm] = useState<MetricsInput>({
    totalHours: diploma.totalHours,
    credits: diploma.credits,
    weeksPerModule: diploma.weeksPerModule,
    minEnrollment: diploma.minEnrollment,
    enrollmentFee: diploma.enrollmentFee,
    moduleFee: diploma.moduleFee,
    certificationFee: diploma.certificationFee,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await updateDiplomaMetrics(diploma.id, form);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setSaved(true);
    });
  };

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Costos y métricas</h2>
      </div>
      <div className="edsec__grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span className="field__label">{f.label}</span>
            <input
              type="number"
              min={0}
              value={form[f.key]}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, [f.key]: Number(e.target.value) }));
                setSaved(false);
              }}
              disabled={!canWrite}
              aria-invalid={!!fieldErrors[f.key]}
            />
            {fieldErrors[f.key] && (
              <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[f.key]}</span>
            )}
          </label>
        ))}
      </div>
      {canWrite && (
        <div className="edsec__foot">
          {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
          {saved && !error && <span className="edsec__saved">Guardado ✓</span>}
          <button className="btn btn--primary" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar costos y métricas"}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: `DiplomaEditor.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { GeneralSection } from "./GeneralSection";
import { MetricsSection } from "./MetricsSection";
import type { EditorDiploma, EditorModule, EditorPerms, TeacherOption } from "./types";

const STATUS_LABEL: Record<EditorDiploma["status"], string> = {
  published: "Publicado",
  draft: "Borrador",
  closed: "Cerrado",
};

export function DiplomaEditor({
  diploma,
  modules,
  teachers,
  perms,
}: {
  diploma: EditorDiploma;
  modules: EditorModule[];
  teachers: TeacherOption[];
  perms: EditorPerms;
}) {
  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>{diploma.title}</h1>
          <span className="page__sub">
            {diploma.code} · {STATUS_LABEL[diploma.status]} · {modules.length} módulo
            {modules.length === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="linkbtn" href="/diplomados">
            <Icon name="chevron-right" size={15} style={{ transform: "rotate(180deg)" }} />
            Volver a la lista
          </Link>
          {diploma.status === "published" && (
            <Link className="linkbtn" href={`/diplomado/${diploma.slug}`} target="_blank">
              <Icon name="external" size={15} />
              Ver pública
            </Link>
          )}
        </div>
      </div>

      <GeneralSection diploma={diploma} canWrite={perms.canWrite} />
      <MetricsSection diploma={diploma} canWrite={perms.canWrite} />
      {/* ListsSection (Task 7) y ModulesSection (Task 8) se añaden aquí */}
    </div>
  );
}
```

Nota: si `Icon` no acepta `style`, quitar el `style` del chevron y usar el texto "‹ Volver a la lista" sin icono.

- [ ] **Step 8: Verificar en navegador**

`npx tsc --noEmit` y `npm run lint` — sin errores. Con sesión admin:
1. `/diplomados` → "Editar" en el diplomado TIC → editor con datos reales cargados.
2. Cambiar el horario a "Sábados" y guardar → "Guardado ✓"; recargar → persiste; la página pública `/diplomado/tic` refleja el cambio.
3. Poner slug `tic` en el diplomado de prueba → error de unicidad en el campo.
4. Restaurar el horario original de TIC.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(admin)/diplomados/[id]"
git commit -m "feat: editor de diplomado (datos generales y métricas)"
```

---

### Task 7: Editor — listas (objetivos, requisitos, perfil del egresado)

**Files:**
- Create: `src/app/(admin)/diplomados/[id]/ListEditor.tsx`
- Create: `src/app/(admin)/diplomados/[id]/ListsSection.tsx`
- Modify: `src/app/(admin)/diplomados/[id]/actions.ts` (añadir `updateDiplomaLists`)
- Modify: `src/app/(admin)/diplomados/[id]/types.ts` (añadir `ListsInput`)
- Modify: `src/app/(admin)/diplomados/[id]/DiplomaEditor.tsx` (montar la sección)

**Interfaces:**
- Consumes: `authorizeWrite`, `revalidateDiploma` (helpers ya definidos en `actions.ts`).
- Produces: `updateDiplomaLists(id: string, input: ListsInput): Promise<ActionResult>` con `ListsInput = { objectives: string[]; requirements: string[]; graduateProfile: string[] }`; componente reusable `ListEditor` (Task 8 lo reutiliza para `topics`).

- [ ] **Step 1: Tipo**

En `types.ts` añadir:

```ts
export type ListsInput = {
  objectives: string[];
  requirements: string[];
  graduateProfile: string[];
};
```

- [ ] **Step 2: Action**

En `actions.ts` añadir:

```ts
/* ──────────────────────────── updateDiplomaLists ──────────────────────────── */

function cleanList(v: unknown, max = 30): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 500)
    .slice(0, max);
}

export async function updateDiplomaLists(
  id: string,
  input: ListsInput,
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const updated = await prisma.diploma
    .update({
      where: { id },
      data: {
        objectives: cleanList(input.objectives),
        requirements: cleanList(input.requirements),
        graduateProfile: cleanList(input.graduateProfile),
      },
      select: { slug: true },
    })
    .catch(() => null);
  if (!updated) return { ok: false, error: "Diplomado no encontrado." };
  revalidateDiploma(updated.slug);
  return { ok: true };
}
```

(añadir `ListsInput` al import de tipos).

- [ ] **Step 3: `ListEditor.tsx` (componente controlado y reutilizable)**

```tsx
"use client";

import { Icon } from "@/components/admin/Icon";

export function ListEditor({
  items,
  onChange,
  disabled,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const setAt = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => onChange(items.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="edlist">
      {items.map((item, i) => (
        <div key={i} className="edlist__row">
          <input
            value={item}
            onChange={(e) => setAt(i, e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
          />
          {!disabled && (
            <>
              <button type="button" className="iconbtn" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                <Icon name="chevron-up" size={16} />
              </button>
              <button type="button" className="iconbtn" aria-label="Bajar" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                <Icon name="chevron-down" size={16} />
              </button>
              <button type="button" className="iconbtn" aria-label="Quitar" onClick={() => removeAt(i)}>
                <Icon name="trash" size={16} />
              </button>
            </>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="btn btn--ghost" onClick={() => onChange([...items, ""])}>
          <Icon name="plus" size={15} />
          Añadir
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `ListsSection.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateDiplomaLists } from "./actions";
import { ListEditor } from "./ListEditor";
import type { EditorDiploma, ListsInput } from "./types";

const GROUPS: Array<{ key: keyof ListsInput; title: string; placeholder: string }> = [
  { key: "objectives", title: "Objetivos específicos", placeholder: "Objetivo específico…" },
  { key: "requirements", title: "Requisitos del postulante", placeholder: "Requisito…" },
  { key: "graduateProfile", title: "Perfil del egresado", placeholder: "Competencia del egresado…" },
];

export function ListsSection({ diploma, canWrite }: { diploma: EditorDiploma; canWrite: boolean }) {
  const [form, setForm] = useState<ListsInput>({
    objectives: diploma.objectives,
    requirements: diploma.requirements,
    graduateProfile: diploma.graduateProfile,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateDiplomaLists(diploma.id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Listas del programa</h2>
      </div>
      {GROUPS.map((g) => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div className="field__label" style={{ marginBottom: 8 }}>{g.title}</div>
          <ListEditor
            items={form[g.key]}
            disabled={!canWrite}
            placeholder={g.placeholder}
            onChange={(items) => {
              setForm((f) => ({ ...f, [g.key]: items }));
              setSaved(false);
            }}
          />
        </div>
      ))}
      {canWrite && (
        <div className="edsec__foot">
          {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
          {saved && !error && <span className="edsec__saved">Guardado ✓</span>}
          <button className="btn btn--primary" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar listas"}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Montar en `DiplomaEditor.tsx`**

Importar `ListsSection` y añadir `<ListsSection diploma={diploma} canWrite={perms.canWrite} />` tras `<MetricsSection …/>`.

- [ ] **Step 6: Verificar en navegador**

`npx tsc --noEmit` y `npm run lint`. En el editor de TIC: añadir un requisito "Requisito de prueba", guardar, recargar → persiste y aparece en `/diplomado/tic` (pestaña de requisitos). Quitarlo y guardar de nuevo → desaparece. Reordenar con las flechas funciona.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(admin)/diplomados/[id]"
git commit -m "feat: edición de listas del diplomado (objetivos, requisitos, perfil)"
```

---

### Task 8: Editor — módulos y asignación de docente

**Files:**
- Create: `src/app/(admin)/diplomados/[id]/ModulesSection.tsx`
- Modify: `src/app/(admin)/diplomados/[id]/actions.ts` (añadir `saveModule`, `deleteModule`, `moveModule`)
- Modify: `src/app/(admin)/diplomados/[id]/types.ts` (añadir `ModuleInput`)
- Modify: `src/app/(admin)/diplomados/[id]/DiplomaEditor.tsx` (montar la sección)

**Interfaces:**
- Consumes: `ListEditor` (Task 7), `TeacherOption` (Task 6), helpers de `actions.ts`.
- Produces:
  - `saveModule(diplomaId: string, input: ModuleInput): Promise<ActionResult<{ id: string }>>` — crea si `input.id` es `null`, actualiza si no. Asigna `teacherId` (o `null`).
  - `deleteModule(moduleId: string): Promise<ActionResult>`
  - `moveModule(moduleId: string, dir: "up" | "down"): Promise<ActionResult>`
  - `ModuleInput = { id: string | null; code: string; name: string; summary: string; syncHours: number; asyncHours: number; credits: number; topics: string[]; teacherId: string | null }` (el `totalHours` del módulo se calcula como `syncHours + asyncHours` en el servidor; `order` lo gestiona el servidor).

- [ ] **Step 1: Tipo**

En `types.ts` añadir:

```ts
export type ModuleInput = {
  id: string | null; // null = crear
  code: string;
  name: string;
  summary: string;
  syncHours: number;
  asyncHours: number;
  credits: number;
  topics: string[];
  teacherId: string | null;
};
```

- [ ] **Step 2: Actions de módulos**

En `actions.ts` añadir (`ModuleInput` al import de tipos):

```ts
/* ────────────────────────────── módulos ────────────────────────────── */

export async function saveModule(
  diplomaId: string,
  input: ModuleInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const errs: Record<string, string> = {};
  const code = (input.code ?? "").trim().toUpperCase();
  if (code.length < 2 || code.length > 20) errs.code = "Código de 2 a 20 caracteres.";
  const name = reqStr(input.name, "name", "El nombre", errs, 160);
  const summary = reqStr(input.summary, "summary", "La sumilla", errs, 2000);
  const syncHours = nonNegInt(input.syncHours, "syncHours", errs, 1000);
  const asyncHours = nonNegInt(input.asyncHours, "asyncHours", errs, 1000);
  const credits = nonNegInt(input.credits, "credits", errs, 100);
  if (Object.keys(errs).length > 0) {
    return { ok: false, error: "Revisa los campos del módulo.", fieldErrors: errs };
  }

  const diploma = await prisma.diploma.findUnique({
    where: { id: diplomaId },
    select: { slug: true, _count: { select: { modules: true } } },
  });
  if (!diploma) return { ok: false, error: "Diplomado no encontrado." };

  if (input.teacherId) {
    const teacher = await prisma.teacherProfile.findUnique({ where: { id: input.teacherId } });
    if (!teacher) return { ok: false, error: "El docente seleccionado no existe." };
  }

  const topics = Array.isArray(input.topics)
    ? input.topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 300)
        .slice(0, 30)
    : [];

  const data = {
    code,
    name,
    summary,
    syncHours,
    asyncHours,
    totalHours: syncHours + asyncHours,
    credits,
    topics,
    teacherId: input.teacherId || null,
  };

  try {
    let id: string;
    if (input.id) {
      const updated = await prisma.diplomaModule.update({
        where: { id: input.id },
        data,
        select: { id: true },
      });
      id = updated.id;
    } else {
      const created = await prisma.diplomaModule.create({
        data: { ...data, diplomaId, order: diploma._count.modules + 1 },
        select: { id: true },
      });
      id = created.id;
    }
    revalidateDiploma(diploma.slug);
    return { ok: true, data: { id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un módulo con ese código en este diplomado.", fieldErrors: { code: "Código en uso." } };
    }
    console.error("saveModule", e);
    return { ok: false, error: "No se pudo guardar el módulo." };
  }
}

export async function deleteModule(moduleId: string): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: { diplomaId: true, order: true, diploma: { select: { slug: true } } },
  });
  if (!mod) return { ok: false, error: "Módulo no encontrado." };

  await prisma.$transaction(async (tx) => {
    await tx.diplomaModule.delete({ where: { id: moduleId } });
    // Compacta el orden de los módulos restantes.
    await tx.diplomaModule.updateMany({
      where: { diplomaId: mod.diplomaId, order: { gt: mod.order } },
      data: { order: { decrement: 1 } },
    });
  });
  revalidateDiploma(mod.diploma.slug);
  return { ok: true };
}

export async function moveModule(
  moduleId: string,
  dir: "up" | "down",
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: { id: true, diplomaId: true, order: true, diploma: { select: { slug: true } } },
  });
  if (!mod) return { ok: false, error: "Módulo no encontrado." };

  const targetOrder = dir === "up" ? mod.order - 1 : mod.order + 1;
  const neighbor = await prisma.diplomaModule.findFirst({
    where: { diplomaId: mod.diplomaId, order: targetOrder },
    select: { id: true },
  });
  if (!neighbor) return { ok: true }; // ya está en el extremo

  await prisma.$transaction([
    prisma.diplomaModule.update({ where: { id: neighbor.id }, data: { order: mod.order } }),
    prisma.diplomaModule.update({ where: { id: mod.id }, data: { order: targetOrder } }),
  ]);
  revalidateDiploma(mod.diploma.slug);
  return { ok: true };
}
```

- [ ] **Step 3: `ModulesSection.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { deleteModule, moveModule, saveModule } from "./actions";
import { ListEditor } from "./ListEditor";
import type { EditorModule, ModuleInput, TeacherOption } from "./types";

function toInput(m: EditorModule | null): ModuleInput {
  return m
    ? {
        id: m.id,
        code: m.code,
        name: m.name,
        summary: m.summary,
        syncHours: m.syncHours,
        asyncHours: m.asyncHours,
        credits: m.credits,
        topics: m.topics,
        teacherId: m.teacherId,
      }
    : {
        id: null,
        code: "",
        name: "",
        summary: "",
        syncHours: 0,
        asyncHours: 0,
        credits: 0,
        topics: [],
        teacherId: null,
      };
}

function ModuleForm({
  diplomaId,
  initial,
  teachers,
  onDone,
}: {
  diplomaId: string;
  initial: EditorModule | null;
  teachers: TeacherOption[];
  onDone: () => void;
}) {
  const [form, setForm] = useState<ModuleInput>(toInput(initial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const set = <K extends keyof ModuleInput>(k: K, v: ModuleInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveModule(diplomaId, form);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      onDone();
    });
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 14, marginTop: 6 }}>
      <div className="edsec__grid">
        <label className="field">
          <span className="field__label">Código</span>
          <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="DTIC-M1" aria-invalid={!!fieldErrors.code} />
          {err("code")}
        </label>
        <label className="field">
          <span className="field__label">Nombre</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Redes y Seguridad" aria-invalid={!!fieldErrors.name} />
          {err("name")}
        </label>
        <label className="field">
          <span className="field__label">Docente responsable</span>
          <select
            value={form.teacherId ?? ""}
            onChange={(e) => set("teacherId", e.target.value || null)}
          >
            <option value="">— Sin asignar —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Horas sincrónicas</span>
          <input type="number" min={0} value={form.syncHours} onChange={(e) => set("syncHours", Number(e.target.value))} aria-invalid={!!fieldErrors.syncHours} />
          {err("syncHours")}
        </label>
        <label className="field">
          <span className="field__label">Horas asincrónicas</span>
          <input type="number" min={0} value={form.asyncHours} onChange={(e) => set("asyncHours", Number(e.target.value))} aria-invalid={!!fieldErrors.asyncHours} />
          {err("asyncHours")}
        </label>
        <label className="field">
          <span className="field__label">Créditos</span>
          <input type="number" min={0} value={form.credits} onChange={(e) => set("credits", Number(e.target.value))} aria-invalid={!!fieldErrors.credits} />
          {err("credits")}
        </label>
        <label className="field field--full">
          <span className="field__label">Sumilla</span>
          <textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} aria-invalid={!!fieldErrors.summary} />
          {err("summary")}
        </label>
        <div className="field field--full">
          <span className="field__label">Temas principales</span>
          <ListEditor items={form.topics} onChange={(items) => set("topics", items)} placeholder="Tema…" />
        </div>
      </div>
      <div className="edsec__foot">
        {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
        <button className="btn btn--ghost" onClick={onDone} disabled={pending}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : initial ? "Guardar módulo" : "Crear módulo"}
        </button>
      </div>
    </div>
  );
}

export function ModulesSection({
  diplomaId,
  modules,
  teachers,
  canWrite,
}: {
  diplomaId: string;
  modules: EditorModule[];
  teachers: TeacherOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const teacherLabel = (id: string | null) =>
    id ? (teachers.find((t) => t.id === id)?.label ?? "Docente inactivo") : "Sin asignar";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error inesperado.");
      router.refresh();
    });
  };

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Módulos ({modules.length})</h2>
        {canWrite && editing === null && (
          <button className="btn btn--primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={15} />
            Añadir módulo
          </button>
        )}
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}

      {modules.map((m, i) => (
        <div key={m.id} style={{ borderTop: i > 0 ? "1px solid var(--border, #e5e7eb)" : "none", padding: "10px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="badge badge--neutral">{m.order}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 500 }}>{m.name}</div>
              <div className="dtable__muted" style={{ fontSize: 12 }}>
                {m.code} · {m.totalHours} h · {m.credits} créditos · {teacherLabel(m.teacherId)}
              </div>
            </div>
            {canWrite && editing === null && (
              <div style={{ display: "flex", gap: 6 }}>
                <button className="iconbtn" aria-label="Subir" disabled={pending || i === 0} onClick={() => run(() => moveModule(m.id, "up"))}>
                  <Icon name="chevron-up" size={16} />
                </button>
                <button className="iconbtn" aria-label="Bajar" disabled={pending || i === modules.length - 1} onClick={() => run(() => moveModule(m.id, "down"))}>
                  <Icon name="chevron-down" size={16} />
                </button>
                <button className="btn btn--ghost" onClick={() => setEditing(m.id)}>Editar</button>
                <button
                  className="iconbtn"
                  aria-label="Eliminar"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar el módulo "${m.name}"?`)) run(() => deleteModule(m.id));
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            )}
          </div>
          {editing === m.id && (
            <ModuleForm diplomaId={diplomaId} initial={m} teachers={teachers} onDone={done} />
          )}
        </div>
      ))}

      {modules.length === 0 && editing === null && (
        <p className="dtable__muted">Este diplomado aún no tiene módulos.</p>
      )}

      {editing === "new" && (
        <ModuleForm diplomaId={diplomaId} initial={null} teachers={teachers} onDone={done} />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Montar en `DiplomaEditor.tsx`**

Importar `ModulesSection` y añadir tras `<ListsSection …/>`:

```tsx
      <ModulesSection
        diplomaId={diploma.id}
        modules={modules}
        teachers={teachers}
        canWrite={perms.canWrite}
      />
```

- [ ] **Step 5: Verificar en navegador**

`npx tsc --noEmit` y `npm run lint`. En el editor de TIC:
1. Los 6 módulos aparecen ordenados con "Sin asignar".
2. Editar el módulo 1 → asignar el docente creado en Task 4 → guardar → la fila muestra "Mg. …".
3. Crear un módulo nuevo en el diplomado de prueba → aparece con orden correlativo; `totalHours = sync + async`.
4. Subir/bajar módulos reordena y persiste tras recargar.
5. Eliminar el módulo de prueba → el orden se compacta (sin huecos).
6. Código de módulo duplicado dentro del mismo diplomado → error "Código en uso.".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/diplomados/[id]"
git commit -m "feat: gestión de módulos y asignación de docente responsable"
```

---

### Task 9: Web pública — docentes reales + verificación E2E

**Files:**
- Modify: `src/lib/diplomas.ts` (incluir docentes en la consulta)
- Modify: `src/app/diplomado/[slug]/page.tsx` (instructores desde módulos con fallback)
- Modify: `src/app/diplomado/[slug]/ModuleAccordion.tsx` (mostrar docente del módulo)

**Interfaces:**
- Consumes: `getPublishedDiplomaBySlug` (se amplía su `include`), `TeacherProfile` + `user.name`.
- Produces: tipo `CourseModule` gana `teacherLabel: string | null`.

- [ ] **Step 1: Ampliar la consulta pública**

En `src/lib/diplomas.ts`, reemplazar `getPublishedDiplomaBySlug` por:

```ts
/** Diplomado publicado por slug, con módulos ordenados y su docente. Null si no existe. */
export async function getPublishedDiplomaBySlug(slug: string) {
  return prisma.diploma.findFirst({
    where: { slug, status: "published" },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          teacher: {
            include: { user: { select: { name: true, active: true } } },
          },
        },
      },
    },
  });
}
```

- [ ] **Step 2: Instructores desde los módulos (con fallback)**

En `src/app/diplomado/[slug]/page.tsx`:

1. Tras obtener `d`, calcular la lista de instructores a mostrar (docentes activos únicos de los módulos; si no hay ninguno, el array legado):

```tsx
  const assignedTeachers = Array.from(
    new Map(
      d.modules
        .filter((m) => m.teacher && m.teacher.user.active)
        .map((m) => [
          m.teacher!.id,
          {
            name: `${m.teacher!.academicDegree} ${m.teacher!.user.name}`,
            role: m.teacher!.specialty ?? "Docente · Facultad de Ingeniería",
            photoUrl: m.teacher!.photoUrl,
          },
        ]),
    ).values(),
  );

  const instructorCards =
    assignedTeachers.length > 0
      ? assignedTeachers
      : d.instructors.map((name) => ({
          name,
          role: "Docente · Facultad de Ingeniería",
          photoUrl: null as string | null,
        }));
```

2. Reemplazar el bloque actual de instructores (el que itera `d.instructors`) por el equivalente sobre `instructorCards`:

```tsx
                {instructorCards.length > 0 && (
                  <>
                    <h3 className="dp-side__h">
                      {instructorCards.length === 1 ? "Instructor" : "Instructores"}
                    </h3>
                    <ul className="dp-inst">
                      {instructorCards.slice(0, 4).map((t) => (
                        <li key={t.name} className="dp-inst__item">
                          {t.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="dp-inst__avatar"
                              src={t.photoUrl}
                              alt={t.name}
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <span
                              className="dp-inst__avatar"
                              style={{ background: avatarColor(t.name) }}
                            >
                              {initialsFor(t.name)}
                            </span>
                          )}
                          <span className="dp-inst__info">
                            <span className="dp-inst__name">{t.name}</span>
                            <span className="dp-inst__role">{t.role}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {instructorCards.length > 4 && (
                      <p className="dp-inst__more">
                        y {instructorCards.length - 4} docentes más
                      </p>
                    )}
                    <div className="dp-side__divider" />
                  </>
                )}
```

3. En el mapeo hacia `ModuleAccordion`, añadir:

```tsx
                  teacherLabel:
                    m.teacher && m.teacher.user.active
                      ? `${m.teacher.academicDegree} ${m.teacher.user.name}`
                      : null,
```

- [ ] **Step 3: `ModuleAccordion.tsx`**

Añadir `teacherLabel: string | null;` a `CourseModule` y, dentro del detalle (tras `dp-course__summary`), mostrar:

```tsx
                {m.teacherLabel && (
                  <p className="dp-course__summary" style={{ marginTop: 4 }}>
                    <strong>Docente:</strong> {m.teacherLabel}
                  </p>
                )}
```

- [ ] **Step 4: Verificación E2E del flujo completo (navegador)**

`npx tsc --noEmit`, `npm run lint` y `npm run build` — sin errores. Luego, con `npm run dev`:

1. Login admin → `/docentes` → verificar que existe al menos un docente activo (crear "Mg. Docente Demo" si no).
2. `/diplomados` → Editar TIC → módulo 1 → asignar el docente → guardar.
3. Abrir `/diplomado/tic` (sin sesión, ventana privada):
   - La tarjeta "Instructores" muestra "Mg. Docente Demo" (y ya no la lista legada, porque hay ≥1 asignado).
   - Abrir el módulo 1 en el acordeón → muestra "Docente: Mg. Docente Demo".
4. En `/docentes`, suspender al docente → recargar `/diplomado/tic` → vuelve a la lista legada (no hay docentes activos asignados) y el módulo no muestra docente. Reactivarlo.
5. Flujo negativo: quitar la asignación (— Sin asignar —) → la pública vuelve al fallback.
6. Dejar el docente asignado y activo (estado final deseado).
7. Tomar capturas de `/docentes`, del editor y de la pública (patrón del repo) para el registro.

- [ ] **Step 5: Commit**

```bash
git add src/lib/diplomas.ts src/app/diplomado
git commit -m "feat: web pública muestra los docentes asignados a los módulos"
```

---

## Autorevisión del plan (hecha)

- **Cobertura del spec:** rol docente (T2), TeacherProfile + teacherId (T1), `/docentes` con conversión de usuario existente (T3–T4), CRUD diplomados con borrador inicial y guard de postulaciones (T5), editor por secciones (T6–T8), asignación de docente por módulo (T8), pública con fallback y docente en acordeón (T9), semillas relegadas a carga inicial (banner eliminado en T5). Fuera de alcance respetado (sin panel docente, un docente por módulo, foto por URL).
- **Sin placeholders:** todos los pasos llevan código o comandos concretos.
- **Consistencia de tipos:** `ActionResult<T>` unificado (`ok/data | ok:false/error/fieldErrors`) en docentes, lista y editor; `TeacherOption {id,label}` producido en T6 y consumido en T8; `ModuleInput`/`EditorModule` coinciden campo a campo; `teacherLabel` producido en T9 paso 2 y consumido en paso 3.
