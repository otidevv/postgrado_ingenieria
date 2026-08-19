# Intranet académica — Subsistema B: Intranet del docente (Plan de implementación)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El docente entra a `/docencia`, ve solo sus módulos asignados y gestiona por módulo: sesiones + asistencia, evaluaciones + notas (0–20, promedio ponderado), materiales y roster de estudiantes.

**Architecture:** Nuevos modelos (`ModuleSession`, `AttendanceRecord`, `Assessment`, `Grade`, `ModuleMaterial`) colgando de `DiplomaModule` y `Enrollment` (subsistema A). Toda action valida permiso `teaching.manage` **y propiedad** (el módulo pertenece al `TeacherProfile` del usuario). UI en `/docencia` (grupo admin) con página de módulo por pestañas.

**Tech Stack:** Next.js 16.2.6 (App Router, server actions), React 19, Prisma 7, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-08-19-intranet-academica-fase2-design.md` (secciones B y Seguridad)

## Global Constraints

- Igual que el plan A: Next no estándar (docs en `node_modules/next/dist/docs/01-app/`; `params` es Promise), copy en español, `prisma db push` (nunca migrate/reset), `ActionResult<T>` con `ok/error/fieldErrors`, sin framework de tests (tsc + lint + tsx/navegador; ~17 errores de lint preexistentes ajenos), commits en español + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, y el working tree contiene WIP del usuario sin commitear: `git add` SOLO los archivos de cada tarea.
- **Propiedad obligatoria:** ninguna action de este subsistema confía en ids del cliente; siempre se carga el recurso y se verifica la cadena hasta `TeacherProfile.userId === me.id`.
- Solo se gestionan matrículas con `status: "active"` (pasar lista / calificar a retirados: rechazado).
- Score: número con hasta 2 decimales en [0, 20]. Weight: entero en [0, 100]. Aviso (no bloqueo) si la suma de pesos del módulo ≠ 100.
- Datos de prueba existentes: diplomado TIC (slug `tic`) con módulo 1 asignado a la docente "Dr. Nelly Ulloa Gallardo" (contraseña desconocida — para E2E crear un docente propio); matrícula activa en TIC: `alumno.e2e.matricula@example.com`.

---

### Task 1: Esquema Prisma del subsistema B

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/verify-enrollments.ts` (ampliar conteos)

**Interfaces:**
- Consumes: `DiplomaModule`, `Enrollment` existentes.
- Produces: modelos `ModuleSession`, `AttendanceRecord` (+enum `AttendanceStatus`), `Assessment` (+enum `AssessmentKind`), `Grade`, `ModuleMaterial` con estos nombres exactos; back-relations `DiplomaModule.{sessions, assessments, materials}` y `Enrollment.{attendance, grades}`.

- [ ] **Step 1: Modelos**

Añadir en `prisma/schema.prisma` tras el bloque de `Enrollment`:

```prisma
// ─────────────────────────── Docencia ───────────────────────────

model ModuleSession {
  id       String   @id @default(cuid())
  moduleId String
  date     DateTime // fecha de la clase
  topic    String   // tema tratado
  order    Int

  module     DiplomaModule      @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  attendance AttendanceRecord[]

  @@index([moduleId])
}

enum AttendanceStatus {
  presente
  tardanza
  falta
  justificada
}

model AttendanceRecord {
  sessionId    String
  enrollmentId String
  status       AttendanceStatus

  session    ModuleSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  enrollment Enrollment    @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@id([sessionId, enrollmentId])
  @@index([enrollmentId])
}

enum AssessmentKind {
  tarea
  trabajo
  examen
  participacion
}

model Assessment {
  id               String         @id @default(cuid())
  moduleId         String
  title            String
  description      String?
  kind             AssessmentKind @default(tarea)
  weight           Int            // % del promedio del módulo (0–100)
  dueDate          DateTime?
  allowsSubmission Boolean        @default(false)
  createdAt        DateTime       @default(now())

  module      DiplomaModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  grades      Grade[]
  submissions Submission[]

  @@index([moduleId])
}

model Grade {
  assessmentId String
  enrollmentId String
  score        Decimal  @db.Decimal(4, 2) // 0.00–20.00
  feedback     String?
  gradedAt     DateTime @default(now())

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@id([assessmentId, enrollmentId])
  @@index([enrollmentId])
}

model ModuleMaterial {
  id       String @id @default(cuid())
  moduleId String
  title    String
  url      String
  order    Int    @default(0)

  module DiplomaModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@index([moduleId])
}

model Submission {
  id           String   @id @default(cuid())
  assessmentId String
  enrollmentId String
  fileName     String?  // nombre original mostrado
  storedPath   String?  // relativo a storage/entregas/
  linkUrl      String?  // alternativa: entrega por enlace
  comment      String?
  submittedAt  DateTime @default(now())

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@unique([assessmentId, enrollmentId])
}
```

(`Submission` se crea ya para no tocar el esquema dos veces; el subsistema C la usa.)

Back-relations: en `DiplomaModule` añadir `sessions ModuleSession[]`, `assessments Assessment[]`, `materials ModuleMaterial[]`; en `Enrollment` añadir `attendance AttendanceRecord[]`, `grades Grade[]`, `submissions Submission[]`.

- [ ] **Step 2: Sincronizar**

Run: `npx prisma db push` (aditivo; si pide pérdida de datos → BLOCKED). Luego `npx prisma generate` si hace falta.

- [ ] **Step 3: Ampliar verificación**

En `prisma/verify-enrollments.ts`, antes del `$disconnect()`, añadir:

```ts
  console.log("Sesiones:", await prisma.moduleSession.count());
  console.log("Evaluaciones:", await prisma.assessment.count());
  console.log("Notas:", await prisma.grade.count());
  console.log("Materiales:", await prisma.moduleMaterial.count());
  console.log("Entregas:", await prisma.submission.count());
```

- [ ] **Step 4: Verificar**

Run: `npx tsx prisma/verify-enrollments.ts` — los nuevos conteos imprimen 0 sin errores. `npx tsc --noEmit` limpio.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/verify-enrollments.ts
git commit -m "feat: modelos de docencia (sesiones, asistencia, evaluaciones, notas, materiales, entregas)"
```

---

### Task 2: Autorización por propiedad + página `/docencia` (lista de mis módulos)

**Files:**
- Create: `src/lib/teaching.ts`
- Create: `src/app/(admin)/docencia/page.tsx`
- Create: `src/app/(admin)/docencia/DocenciaHome.tsx`
- Modify: `src/components/admin/data.ts` (sidebar)

**Interfaces:**
- Consumes: modelos de Task 1; `getCurrentUser`/`requirePermission`.
- Produces (Tasks 3–5 y el subsistema C consumen):
  - `getMyTeacherProfileId(userId: string): Promise<string | null>` — id del TeacherProfile del usuario, o null.
  - `getOwnedModule(moduleId: string, userId: string)` — devuelve el módulo (`{ id, name, code, diplomaId, diploma: { title, slug } }`) **solo si** su `teacherId` es el perfil del usuario; si no, `null`.
  - `getActiveRoster(diplomaId: string): Promise<RosterStudent[]>` con `RosterStudent = { enrollmentId: string; name: string; email: string }` ordenado por nombre.
  - `weightedAverage(items: Array<{ weight: number; score: number | null }>): number | null` — promedio ponderado SOLO sobre ítems con score ≠ null; null si ninguno calificado; redondeado a 2 decimales.

- [ ] **Step 1: `src/lib/teaching.ts`**

```ts
import "server-only";

import { prisma } from "@/lib/prisma";

export type RosterStudent = {
  enrollmentId: string;
  name: string;
  email: string;
};

/** Id del TeacherProfile del usuario, o null si no es docente. */
export async function getMyTeacherProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

/** Módulo SOLO si pertenece al docente (por userId). Null en caso contrario. */
export async function getOwnedModule(moduleId: string, userId: string) {
  const profileId = await getMyTeacherProfileId(userId);
  if (!profileId) return null;
  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      name: true,
      code: true,
      order: true,
      teacherId: true,
      diplomaId: true,
      diploma: { select: { title: true, slug: true } },
    },
  });
  if (!mod || mod.teacherId !== profileId) return null;
  return mod;
}

/** Matrículas ACTIVAS del diplomado, ordenadas por nombre del alumno. */
export async function getActiveRoster(diplomaId: string): Promise<RosterStudent[]> {
  const rows = await prisma.enrollment.findMany({
    where: { diplomaId, status: "active" },
    include: { student: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { student: { user: { name: "asc" } } },
  });
  return rows.map((e) => ({
    enrollmentId: e.id,
    name: e.student.user.name,
    email: e.student.user.email,
  }));
}

/**
 * Promedio ponderado sobre los ítems CALIFICADOS (score ≠ null).
 * Null si no hay ninguno calificado o la suma de pesos calificados es 0.
 */
export function weightedAverage(
  items: Array<{ weight: number; score: number | null }>,
): number | null {
  let sum = 0;
  let weights = 0;
  for (const it of items) {
    if (it.score === null) continue;
    sum += it.score * it.weight;
    weights += it.weight;
  }
  if (weights === 0) return null;
  return Math.round((sum / weights) * 100) / 100;
}
```

- [ ] **Step 2: Sidebar**

En `SIDEBAR_NAV` (`src/components/admin/data.ts`), tras `matriculas`:

```ts
  { id: "docencia", label: "Mi docencia", icon: "rules", href: "/docencia", perm: "teaching.manage" },
```

- [ ] **Step 3: `page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getMyTeacherProfileId } from "@/lib/teaching";
import { DocenciaHome } from "./DocenciaHome";

export const metadata = { title: "Mi docencia · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export type TeachingModuleRow = {
  id: string;
  code: string;
  name: string;
  order: number;
  diplomaTitle: string;
  studentCount: number;
  sessionCount: number;
  assessmentCount: number;
};

export default async function Page() {
  const me = await requirePermission("teaching.manage");
  const profileId = await getMyTeacherProfileId(me.id);

  const modules = profileId
    ? await prisma.diplomaModule.findMany({
        where: { teacherId: profileId },
        orderBy: [{ diploma: { title: "asc" } }, { order: "asc" }],
        include: {
          diploma: {
            select: {
              title: true,
              _count: { select: { enrollments: { where: { status: "active" } } } },
            },
          },
          _count: { select: { sessions: true, assessments: true } },
        },
      })
    : [];

  const rows: TeachingModuleRow[] = modules.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    order: m.order,
    diplomaTitle: m.diploma.title,
    studentCount: m.diploma._count.enrollments,
    sessionCount: m._count.sessions,
    assessmentCount: m._count.assessments,
  }));

  return <DocenciaHome rows={rows} />;
}
```

- [ ] **Step 4: `DocenciaHome.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import type { TeachingModuleRow } from "./page";

export function DocenciaHome({ rows }: { rows: TeachingModuleRow[] }) {
  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Mi docencia</h1>
          <span className="page__sub">
            {rows.length} módulo{rows.length === 1 ? "" : "s"} a tu cargo
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="rules" size={40} />
            <h3>Sin módulos asignados</h3>
            <p>Cuando la coordinación te asigne un módulo, aparecerá aquí.</p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Diplomado</th>
                  <th className="dtable__num">Estudiantes</th>
                  <th className="dtable__num">Sesiones</th>
                  <th className="dtable__num">Evaluaciones</th>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div className="dtable__muted" style={{ fontSize: 12 }}>
                        {m.code} · Módulo {m.order}
                      </div>
                    </td>
                    <td>{m.diplomaTitle}</td>
                    <td className="dtable__num">{m.studentCount}</td>
                    <td className="dtable__num">{m.sessionCount}</td>
                    <td className="dtable__num">{m.assessmentCount}</td>
                    <td className="dtable__settings">
                      <Link className="btn btn--primary" href={`/docencia/${m.id}`}>
                        Gestionar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar en navegador**

`npx tsc --noEmit` y lint limpios. Preparar datos de E2E (una vez, con sesión admin):
1. En `/docentes` crear "Docente E2E" (`docente.e2e@example.com`, contraseña `docencia123`, grado Mg.).
2. En `/diplomados` → Editar TIC → módulo 2 → asignar "Mg. Docente E2E".
Luego, login como `docente.e2e@example.com`:
3. El sidebar muestra solo Inicio, Diplomados y **Mi docencia**.
4. `/docencia` lista el módulo 2 de TIC con 1+ estudiantes (la matrícula activa de TIC) y 0 sesiones/evaluaciones.
5. "Gestionar" navega a `/docencia/<id>` (404 hasta la Task 3 — esperado).
Anotar en el reporte las credenciales del docente E2E.

- [ ] **Step 6: Commit**

```bash
git add src/lib/teaching.ts "src/app/(admin)/docencia" src/components/admin/data.ts
git commit -m "feat: página Mi docencia con módulos del docente"
```

---

### Task 3: Página del módulo — sesiones y asistencia

**Files:**
- Create: `src/app/(admin)/docencia/types.ts`
- Create: `src/app/(admin)/docencia/[moduleId]/actions.ts`
- Create: `src/app/(admin)/docencia/[moduleId]/page.tsx`
- Create: `src/app/(admin)/docencia/[moduleId]/ModuleWorkspace.tsx`
- Create: `src/app/(admin)/docencia/[moduleId]/SessionsTab.tsx`
- Create: `src/app/(admin)/docencia/docencia.css`

**Interfaces:**
- Consumes: `getOwnedModule`, `getActiveRoster`, `RosterStudent` de `@/lib/teaching`.
- Produces (Tasks 4–5 amplían estos archivos):
  - `types.ts`: `ActionResult<T>`, `AttendanceStatus`, `SessionRow = { id: string; date: string; topic: string; order: number; attendance: Record<string, AttendanceStatus> }` (clave = enrollmentId), `AssessmentRow`, `GradeCell`, `MaterialRow` (los dos últimos definidos aquí ya para T4–T5, ver Step 1).
  - `actions.ts`: helper interno `authorizeOwnedModule(moduleId)` (usado por todas las actions del archivo), `saveSession(moduleId, input: { id: string | null; date: string; topic: string }): Promise<ActionResult<{ id: string }>>`, `deleteSession(moduleId, sessionId): Promise<ActionResult>`, `saveAttendance(moduleId, sessionId, records: Array<{ enrollmentId: string; status: AttendanceStatus }>): Promise<ActionResult>`.
  - `ModuleWorkspace.tsx` con pestañas; T4–T5 añaden las suyas.

- [ ] **Step 1: `src/app/(admin)/docencia/types.ts`**

```ts
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type AttendanceStatus = "presente" | "tardanza" | "falta" | "justificada";

export type SessionRow = {
  id: string;
  date: string; // ISO
  topic: string;
  order: number;
  /** enrollmentId → estado registrado (ausente del mapa = sin registrar) */
  attendance: Record<string, AttendanceStatus>;
};

export type AssessmentKind = "tarea" | "trabajo" | "examen" | "participacion";

export type AssessmentRow = {
  id: string;
  title: string;
  description: string | null;
  kind: AssessmentKind;
  weight: number;
  dueDate: string | null; // ISO
  allowsSubmission: boolean;
};

/** Celda de nota: enrollmentId+assessmentId → score (null = sin calificar). */
export type GradeCell = { score: number | null; feedback: string | null };

export type MaterialRow = {
  id: string;
  title: string;
  url: string;
  order: number;
};

export type SubmissionInfo = {
  enrollmentId: string;
  assessmentId: string;
  fileName: string | null;
  linkUrl: string | null;
  submittedAt: string; // ISO
};
```

- [ ] **Step 2: `[moduleId]/actions.ts` (base + sesiones + asistencia)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getOwnedModule } from "@/lib/teaching";
import type { ActionResult, AttendanceStatus } from "../types";

const ATTENDANCE: AttendanceStatus[] = ["presente", "tardanza", "falta", "justificada"];

type OwnedModule = NonNullable<Awaited<ReturnType<typeof getOwnedModule>>>;

/**
 * Autoriza teaching.manage + propiedad del módulo. Devuelve el módulo o un
 * ActionResult de error listo para retornar.
 */
async function authorizeOwnedModule(
  moduleId: string,
): Promise<{ ok: true; module: OwnedModule } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "No autenticado." };
  if (!me.permissions.has("teaching.manage")) {
    return { ok: false, error: "No tienes permisos de docencia." };
  }
  const module = await getOwnedModule(moduleId, me.id);
  if (!module) return { ok: false, error: "Este módulo no está a tu cargo." };
  return { ok: true, module };
}

function refresh(moduleId: string) {
  revalidatePath(`/docencia/${moduleId}`);
  revalidatePath("/docencia");
}

/* ─────────────────────────────── sesiones ─────────────────────────────── */

export async function saveSession(
  moduleId: string,
  input: { id: string | null; date: string; topic: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const topic = (input.topic ?? "").trim();
    const date = new Date(input.date ?? "");
    const fieldErrors: Record<string, string> = {};
    if (topic.length < 2 || topic.length > 300) fieldErrors.topic = "Indica el tema de la sesión.";
    if (Number.isNaN(date.getTime())) fieldErrors.date = "Fecha no válida.";
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }

    let id: string;
    if (input.id) {
      const updated = await prisma.moduleSession.updateMany({
        where: { id: input.id, moduleId },
        data: { date, topic },
      });
      if (updated.count === 0) return { ok: false, error: "Sesión no encontrada." };
      id = input.id;
    } else {
      const created = await prisma.$transaction(
        async (tx) => {
          const count = await tx.moduleSession.count({ where: { moduleId } });
          return tx.moduleSession.create({
            data: { moduleId, date, topic, order: count + 1 },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      id = created.id;
    }
    refresh(moduleId);
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("saveSession", e);
    return { ok: false, error: "No se pudo guardar la sesión." };
  }
}

export async function deleteSession(
  moduleId: string,
  sessionId: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const session = await prisma.moduleSession.findFirst({
      where: { id: sessionId, moduleId },
      select: { id: true, order: true },
    });
    if (!session) return { ok: false, error: "Sesión no encontrada." };

    await prisma.$transaction(async (tx) => {
      await tx.moduleSession.delete({ where: { id: session.id } });
      await tx.moduleSession.updateMany({
        where: { moduleId, order: { gt: session.order } },
        data: { order: { decrement: 1 } },
      });
    });
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("deleteSession", e);
    return { ok: false, error: "No se pudo eliminar la sesión." };
  }
}

/* ─────────────────────────────── asistencia ─────────────────────────────── */

export async function saveAttendance(
  moduleId: string,
  sessionId: string,
  records: Array<{ enrollmentId: string; status: AttendanceStatus }>,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const session = await prisma.moduleSession.findFirst({
      where: { id: sessionId, moduleId },
      select: { id: true },
    });
    if (!session) return { ok: false, error: "Sesión no encontrada." };

    const clean = (Array.isArray(records) ? records : []).filter(
      (r) => typeof r?.enrollmentId === "string" && ATTENDANCE.includes(r?.status),
    );
    if (clean.length === 0) return { ok: false, error: "No hay asistencia que guardar." };

    // Solo matrículas ACTIVAS del diplomado del módulo.
    const valid = await prisma.enrollment.findMany({
      where: {
        id: { in: clean.map((r) => r.enrollmentId) },
        diplomaId: auth.module.diplomaId,
        status: "active",
      },
      select: { id: true },
    });
    const validSet = new Set(valid.map((v) => v.id));
    const toSave = clean.filter((r) => validSet.has(r.enrollmentId));
    if (toSave.length === 0) {
      return { ok: false, error: "Ninguna matrícula válida para este módulo." };
    }

    await prisma.$transaction(
      toSave.map((r) =>
        prisma.attendanceRecord.upsert({
          where: {
            sessionId_enrollmentId: { sessionId, enrollmentId: r.enrollmentId },
          },
          update: { status: r.status },
          create: { sessionId, enrollmentId: r.enrollmentId, status: r.status },
        }),
      ),
    );
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("saveAttendance", e);
    return { ok: false, error: "No se pudo guardar la asistencia." };
  }
}
```

- [ ] **Step 3: `docencia.css`**

```css
/* Espacio de trabajo del módulo (docencia) */
.dw-tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.dw-tab {
  padding: 9px 14px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--muted, #6b7280);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.dw-tab.is-active {
  color: var(--text, #111827);
  font-weight: 600;
  border-bottom-color: var(--primary, #2563eb);
}
.dw-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.dw-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.dw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px 14px;
}
.dw-attend {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.dw-attend th,
.dw-attend td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.dw-attend select {
  min-width: 130px;
}
.dw-gradetable {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.dw-gradetable th,
.dw-gradetable td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  text-align: left;
}
.dw-gradetable input[type="number"] {
  width: 80px;
}
.dw-avg {
  font-weight: 600;
}
@media (max-width: 640px) {
  .dw-card { padding: 12px; }
}
```

- [ ] **Step 4: `[moduleId]/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getActiveRoster, getOwnedModule } from "@/lib/teaching";
import { Icon } from "@/components/admin/Icon";
import { ModuleWorkspace } from "./ModuleWorkspace";
import type {
  AssessmentRow,
  GradeCell,
  MaterialRow,
  SessionRow,
  SubmissionInfo,
} from "../types";
import "../docencia.css";
import "../../usuarios/users.css";

export const metadata = { title: "Módulo · Mi docencia · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ moduleId: string }> }) {
  const me = await requirePermission("teaching.manage");
  const { moduleId } = await params;

  const owned = await getOwnedModule(moduleId, me.id);
  if (!owned) redirect("/403");

  const [roster, sessions, assessments, materials, grades, submissions] = await Promise.all([
    getActiveRoster(owned.diplomaId),
    prisma.moduleSession.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
      include: { attendance: true },
    }),
    prisma.assessment.findMany({ where: { moduleId }, orderBy: { createdAt: "asc" } }),
    prisma.moduleMaterial.findMany({ where: { moduleId }, orderBy: { order: "asc" } }),
    prisma.grade.findMany({ where: { assessment: { moduleId } } }),
    prisma.submission.findMany({
      where: { assessment: { moduleId } },
      select: {
        enrollmentId: true,
        assessmentId: true,
        fileName: true,
        linkUrl: true,
        submittedAt: true,
      },
    }),
  ]);

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    topic: s.topic,
    order: s.order,
    attendance: Object.fromEntries(s.attendance.map((a) => [a.enrollmentId, a.status])),
  }));

  const assessmentRows: AssessmentRow[] = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    kind: a.kind,
    weight: a.weight,
    dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    allowsSubmission: a.allowsSubmission,
  }));

  const materialRows: MaterialRow[] = materials.map((m) => ({
    id: m.id,
    title: m.title,
    url: m.url,
    order: m.order,
  }));

  // "<enrollmentId>:<assessmentId>" → celda
  const gradeMap: Record<string, GradeCell> = {};
  for (const g of grades) {
    gradeMap[`${g.enrollmentId}:${g.assessmentId}`] = {
      score: Number(g.score),
      feedback: g.feedback,
    };
  }

  const submissionRows: SubmissionInfo[] = submissions.map((s) => ({
    enrollmentId: s.enrollmentId,
    assessmentId: s.assessmentId,
    fileName: s.fileName,
    linkUrl: s.linkUrl,
    submittedAt: s.submittedAt.toISOString(),
  }));

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>{owned.name}</h1>
          <span className="page__sub">
            {owned.code} · {owned.diploma.title} · {roster.length} estudiante
            {roster.length === 1 ? "" : "s"}
          </span>
        </div>
        <Link className="linkbtn" href="/docencia">
          <Icon name="chevron-right" size={15} />
          Mis módulos
        </Link>
      </div>

      <ModuleWorkspace
        moduleId={owned.id}
        roster={roster}
        sessions={sessionRows}
        assessments={assessmentRows}
        materials={materialRows}
        grades={gradeMap}
        submissions={submissionRows}
      />
    </div>
  );
}
```

- [ ] **Step 5: `ModuleWorkspace.tsx` (contenedor de pestañas)**

```tsx
"use client";

import { useState } from "react";
import type { RosterStudent } from "@/lib/teaching";
import type {
  AssessmentRow,
  GradeCell,
  MaterialRow,
  SessionRow,
  SubmissionInfo,
} from "../types";
import { SessionsTab } from "./SessionsTab";

export type WorkspaceProps = {
  moduleId: string;
  roster: RosterStudent[];
  sessions: SessionRow[];
  assessments: AssessmentRow[];
  materials: MaterialRow[];
  grades: Record<string, GradeCell>;
  submissions: SubmissionInfo[];
};

const TABS = [
  { id: "sesiones", label: "Sesiones y asistencia" },
  { id: "notas", label: "Evaluaciones y notas" },
  { id: "materiales", label: "Materiales" },
  { id: "estudiantes", label: "Estudiantes" },
] as const;

export function ModuleWorkspace(props: WorkspaceProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("sesiones");

  return (
    <div>
      <div className="dw-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`dw-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sesiones" && (
        <SessionsTab moduleId={props.moduleId} roster={props.roster} sessions={props.sessions} />
      )}
      {/* Pestañas de notas (T4), materiales y estudiantes (T5) se montan aquí */}
      {tab !== "sesiones" && (
        <div className="dw-card">
          <p className="dtable__muted">Disponible en la siguiente tarea del plan.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `SessionsTab.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import type { RosterStudent } from "@/lib/teaching";
import { deleteSession, saveAttendance, saveSession } from "./actions";
import type { AttendanceStatus, SessionRow } from "../types";

const STATUSES: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "presente", label: "Presente" },
  { value: "tardanza", label: "Tardanza" },
  { value: "falta", label: "Falta" },
  { value: "justificada", label: "Justificada" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function SessionForm({
  moduleId,
  initial,
  onDone,
}: {
  moduleId: string;
  initial: SessionRow | null;
  onDone: () => void;
}) {
  const [date, setDate] = useState(initial ? toDateInput(initial.date) : "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveSession(moduleId, {
        id: initial?.id ?? null,
        date,
        topic,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      onDone();
    });
  };

  return (
    <div className="dw-row" style={{ alignItems: "flex-end", marginTop: 8 }}>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Fecha</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!fieldErrors.date} />
        {fieldErrors.date && (
          <span style={{ color: "#b91c1c", fontSize: 12 }}>{fieldErrors.date}</span>
        )}
      </label>
      <label className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
        <span className="field__label">Tema de la sesión</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="p. ej. Introducción a redes"
          aria-invalid={!!fieldErrors.topic}
        />
        {fieldErrors.topic && (
          <span style={{ color: "#b91c1c", fontSize: 12 }}>{fieldErrors.topic}</span>
        )}
      </label>
      <button className="btn btn--primary" onClick={save} disabled={pending}>
        {pending ? "Guardando…" : initial ? "Guardar" : "Crear sesión"}
      </button>
      <button className="btn btn--ghost" onClick={onDone} disabled={pending}>
        Cancelar
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
    </div>
  );
}

function AttendanceEditor({
  moduleId,
  session,
  roster,
}: {
  moduleId: string;
  session: SessionRow;
  roster: RosterStudent[];
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(session.attendance);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAll = (status: AttendanceStatus) => {
    setMarks(Object.fromEntries(roster.map((r) => [r.enrollmentId, status])));
    setMsg(null);
  };

  const save = () => {
    setError(null);
    setMsg(null);
    const records = Object.entries(marks).map(([enrollmentId, status]) => ({
      enrollmentId,
      status,
    }));
    startTransition(async () => {
      const res = await saveAttendance(moduleId, session.id, records);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMsg("Asistencia guardada ✓");
      router.refresh();
    });
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div className="dw-row" style={{ marginBottom: 8 }}>
        <button className="btn btn--ghost" onClick={() => setAll("presente")}>
          Marcar todos presentes
        </button>
        {msg && <span className="dtable__muted">{msg}</span>}
        {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
      </div>
      <table className="dw-attend">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>Asistencia</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.enrollmentId}>
              <td>
                <div>{r.name}</div>
                <div className="dtable__muted" style={{ fontSize: 12 }}>{r.email}</div>
              </td>
              <td>
                <select
                  value={marks[r.enrollmentId] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as AttendanceStatus | "";
                    setMarks((m) => {
                      const next = { ...m };
                      if (v === "") delete next[r.enrollmentId];
                      else next[r.enrollmentId] = v;
                      return next;
                    });
                    setMsg(null);
                  }}
                >
                  <option value="">— Sin registrar —</option>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dw-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        <button className="btn btn--primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar asistencia"}
        </button>
      </div>
    </div>
  );
}

export function SessionsTab({
  moduleId,
  roster,
  sessions,
}: {
  moduleId: string;
  roster: RosterStudent[];
  sessions: SessionRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  const remove = (s: SessionRow) => {
    if (!confirm(`¿Eliminar la sesión "${s.topic}" y su asistencia?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSession(moduleId, s.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="dw-card">
        <div className="dw-row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            Sesiones ({sessions.length})
          </h2>
          {editing === null && (
            <button className="btn btn--primary" onClick={() => setEditing("new")}>
              <Icon name="plus" size={15} />
              Nueva sesión
            </button>
          )}
        </div>
        {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
        {editing === "new" && (
          <SessionForm moduleId={moduleId} initial={null} onDone={done} />
        )}
      </div>

      {sessions.length === 0 && editing === null && (
        <div className="dw-card">
          <p className="dtable__muted">
            Aún no hay sesiones. Crea la primera para poder pasar lista.
          </p>
        </div>
      )}

      {sessions.map((s) => {
        const isOpen = openId === s.id;
        const registered = Object.keys(s.attendance).length;
        return (
          <div key={s.id} className="dw-card">
            <div className="dw-row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 500 }}>
                  Sesión {s.order} · {s.topic}
                </div>
                <div className="dtable__muted" style={{ fontSize: 12 }}>
                  {fmtDate(s.date)} · asistencia registrada: {registered}/{roster.length}
                </div>
              </div>
              <div className="dw-row">
                <button
                  className="btn btn--ghost"
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                >
                  {isOpen ? "Cerrar lista" : "Pasar lista"}
                </button>
                <button className="btn btn--ghost" onClick={() => setEditing(s.id)}>
                  Editar
                </button>
                <button
                  className="iconbtn"
                  aria-label="Eliminar sesión"
                  disabled={pending}
                  onClick={() => remove(s)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
            {editing === s.id && (
              <SessionForm moduleId={moduleId} initial={s} onDone={done} />
            )}
            {isOpen && (
              <AttendanceEditor moduleId={moduleId} session={s} roster={roster} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Verificar en navegador**

`npx tsc --noEmit` y lint limpios. Login `docente.e2e@example.com` / `docencia123`:
1. `/docencia` → Gestionar → el workspace del módulo abre en "Sesiones y asistencia".
2. Crear sesión (fecha hoy, tema "Sesión de prueba E2E") → aparece como Sesión 1.
3. "Pasar lista" → el roster muestra al alumno matriculado; marcar "Presente", guardar → "Asistencia guardada ✓"; recargar → persiste (1/1 registrada).
4. Editar el tema → persiste. Crear una segunda sesión y eliminarla → el orden se compacta.
5. Guard: con la sesión admin, visitar `/docencia/<moduleId>` de un módulo NO asignado al admin → redirige a /403.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(admin)/docencia"
git commit -m "feat: sesiones y pase de asistencia del módulo"
```

---

### Task 4: Evaluaciones y notas

**Files:**
- Modify: `src/app/(admin)/docencia/[moduleId]/actions.ts` (añadir saveAssessment/deleteAssessment/saveGrade)
- Create: `src/app/(admin)/docencia/[moduleId]/GradesTab.tsx`
- Modify: `src/app/(admin)/docencia/[moduleId]/ModuleWorkspace.tsx` (montar pestaña)

**Interfaces:**
- Consumes: `authorizeOwnedModule`, `refresh` (helpers del archivo), tipos `AssessmentRow`/`GradeCell`, `weightedAverage` de `@/lib/teaching`.
- Produces:
  - `saveAssessment(moduleId, input: { id: string | null; title: string; description: string; kind: AssessmentKind; weight: number; dueDate: string; allowsSubmission: boolean }): Promise<ActionResult<{ id: string }>>` (dueDate "" = sin fecha)
  - `deleteAssessment(moduleId, assessmentId): Promise<ActionResult>`
  - `saveGrade(moduleId, assessmentId, enrollmentId, score: number | null, feedback: string): Promise<ActionResult>` — `score: null` elimina la nota.

- [ ] **Step 1: Actions**

Añadir a `[moduleId]/actions.ts` (importar `AssessmentKind` desde `../types`):

```ts
/* ─────────────────────────────── evaluaciones ─────────────────────────────── */

const KINDS: AssessmentKind[] = ["tarea", "trabajo", "examen", "participacion"];

export async function saveAssessment(
  moduleId: string,
  input: {
    id: string | null;
    title: string;
    description: string;
    kind: AssessmentKind;
    weight: number;
    dueDate: string; // "" = sin fecha
    allowsSubmission: boolean;
  },
): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const title = (input.title ?? "").trim();
    const fieldErrors: Record<string, string> = {};
    if (title.length < 2 || title.length > 200) fieldErrors.title = "Indica el título.";
    if (!KINDS.includes(input.kind)) fieldErrors.kind = "Tipo no válido.";
    if (!Number.isInteger(input.weight) || input.weight < 0 || input.weight > 100) {
      fieldErrors.weight = "Peso entero entre 0 y 100.";
    }
    let dueDate: Date | null = null;
    if ((input.dueDate ?? "").trim() !== "") {
      dueDate = new Date(input.dueDate);
      if (Number.isNaN(dueDate.getTime())) fieldErrors.dueDate = "Fecha no válida.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }

    const data = {
      title,
      description: (input.description ?? "").trim() || null,
      kind: input.kind,
      weight: input.weight,
      dueDate,
      allowsSubmission: input.allowsSubmission === true,
    };

    let id: string;
    if (input.id) {
      const updated = await prisma.assessment.updateMany({
        where: { id: input.id, moduleId },
        data,
      });
      if (updated.count === 0) return { ok: false, error: "Evaluación no encontrada." };
      id = input.id;
    } else {
      const created = await prisma.assessment.create({
        data: { ...data, moduleId },
        select: { id: true },
      });
      id = created.id;
    }
    refresh(moduleId);
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("saveAssessment", e);
    return { ok: false, error: "No se pudo guardar la evaluación." };
  }
}

export async function deleteAssessment(
  moduleId: string,
  assessmentId: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const deleted = await prisma.assessment.deleteMany({
      where: { id: assessmentId, moduleId },
    });
    if (deleted.count === 0) return { ok: false, error: "Evaluación no encontrada." };
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("deleteAssessment", e);
    return { ok: false, error: "No se pudo eliminar la evaluación." };
  }
}

/* ─────────────────────────────── notas ─────────────────────────────── */

export async function saveGrade(
  moduleId: string,
  assessmentId: string,
  enrollmentId: string,
  score: number | null,
  feedback: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, moduleId },
      select: { id: true },
    });
    if (!assessment) return { ok: false, error: "Evaluación no encontrada." };

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, diplomaId: auth.module.diplomaId, status: "active" },
      select: { id: true },
    });
    if (!enrollment) {
      return { ok: false, error: "La matrícula no está activa en este diplomado." };
    }

    if (score === null) {
      await prisma.grade.deleteMany({ where: { assessmentId, enrollmentId } });
      refresh(moduleId);
      return { ok: true };
    }

    const rounded = Math.round(score * 100) / 100;
    if (Number.isNaN(rounded) || rounded < 0 || rounded > 20) {
      return { ok: false, error: "La nota debe estar entre 0 y 20." };
    }

    await prisma.grade.upsert({
      where: { assessmentId_enrollmentId: { assessmentId, enrollmentId } },
      update: { score: rounded, feedback: feedback.trim() || null, gradedAt: new Date() },
      create: {
        assessmentId,
        enrollmentId,
        score: rounded,
        feedback: feedback.trim() || null,
      },
    });
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("saveGrade", e);
    return { ok: false, error: "No se pudo guardar la nota." };
  }
}
```

- [ ] **Step 2: `GradesTab.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import type { RosterStudent } from "@/lib/teaching";
import { weightedAverage } from "@/lib/teaching-client";
import { deleteAssessment, saveAssessment, saveGrade } from "./actions";
import type { AssessmentKind, AssessmentRow, GradeCell } from "../types";

const KIND_LABEL: Record<AssessmentKind, string> = {
  tarea: "Tarea",
  trabajo: "Trabajo",
  examen: "Examen",
  participacion: "Participación",
};

function AssessmentForm({
  moduleId,
  initial,
  onDone,
}: {
  moduleId: string;
  initial: AssessmentRow | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<AssessmentKind>(initial?.kind ?? "tarea");
  const [weight, setWeight] = useState(initial?.weight ?? 20);
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");
  const [allowsSubmission, setAllowsSubmission] = useState(initial?.allowsSubmission ?? false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveAssessment(moduleId, {
        id: initial?.id ?? null,
        title,
        description,
        kind,
        weight: Number(weight),
        dueDate,
        allowsSubmission,
      });
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
      <span style={{ color: "#b91c1c", fontSize: 12 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <div className="dw-grid" style={{ marginTop: 10 }}>
      <label className="field" style={{ gridColumn: "1 / -1", margin: 0 }}>
        <span className="field__label">Título</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Trabajo final del módulo" aria-invalid={!!fieldErrors.title} />
        {err("title")}
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Tipo</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
          {Object.entries(KIND_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Peso (%)</span>
        <input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} aria-invalid={!!fieldErrors.weight} />
        {err("weight")}
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Fecha límite</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={!!fieldErrors.dueDate} />
        {err("dueDate")}
      </label>
      <label className="field" style={{ margin: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={allowsSubmission}
          onChange={(e) => setAllowsSubmission(e.target.checked)}
          style={{ width: "auto" }}
        />
        <span className="field__label" style={{ margin: 0 }}>Acepta entrega en línea</span>
      </label>
      <label className="field" style={{ gridColumn: "1 / -1", margin: 0 }}>
        <span className="field__label">Descripción / indicaciones</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="dw-row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
        {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
        <button className="btn btn--ghost" onClick={onDone} disabled={pending}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : initial ? "Guardar" : "Crear evaluación"}
        </button>
      </div>
    </div>
  );
}

function GradeInput({
  moduleId,
  assessmentId,
  enrollmentId,
  cell,
}: {
  moduleId: string;
  assessmentId: string;
  enrollmentId: string;
  cell: GradeCell | undefined;
}) {
  const router = useRouter();
  const [value, setValue] = useState(cell?.score?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [bad, setBad] = useState(false);

  const commit = () => {
    const trimmed = value.trim();
    const score = trimmed === "" ? null : Number(trimmed);
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 20)) {
      setBad(true);
      return;
    }
    setBad(false);
    const prev = cell?.score ?? null;
    if (score === prev) return;
    startTransition(async () => {
      const res = await saveGrade(moduleId, assessmentId, enrollmentId, score, cell?.feedback ?? "");
      if (!res.ok) setBad(true);
      router.refresh();
    });
  };

  return (
    <input
      type="number"
      min={0}
      max={20}
      step={0.5}
      value={value}
      disabled={pending}
      aria-invalid={bad}
      style={bad ? { borderColor: "#b91c1c" } : undefined}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function GradesTab({
  moduleId,
  roster,
  assessments,
  grades,
}: {
  moduleId: string;
  roster: RosterStudent[];
  assessments: AssessmentRow[];
  grades: Record<string, GradeCell>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalWeight = assessments.reduce((s, a) => s + a.weight, 0);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  const remove = (a: AssessmentRow) => {
    if (!confirm(`¿Eliminar "${a.title}" y todas sus notas y entregas?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAssessment(moduleId, a.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="dw-card">
        <div className="dw-row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            Evaluaciones ({assessments.length})
          </h2>
          {editing === null && (
            <button className="btn btn--primary" onClick={() => setEditing("new")}>
              <Icon name="plus" size={15} />
              Nueva evaluación
            </button>
          )}
        </div>
        {totalWeight !== 100 && assessments.length > 0 && (
          <p style={{ color: "#b45309", fontSize: 13, marginTop: 8 }}>
            La suma de pesos es {totalWeight}% (se recomienda 100%). El promedio se
            calcula sobre lo calificado.
          </p>
        )}
        {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
        {editing === "new" && (
          <AssessmentForm moduleId={moduleId} initial={null} onDone={done} />
        )}
        {assessments.map((a) =>
          editing === a.id ? (
            <AssessmentForm key={a.id} moduleId={moduleId} initial={a} onDone={done} />
          ) : (
            <div key={a.id} className="dw-row" style={{ justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <div>
                <div style={{ fontWeight: 500 }}>{a.title}</div>
                <div className="dtable__muted" style={{ fontSize: 12 }}>
                  {KIND_LABEL[a.kind]} · {a.weight}%
                  {a.dueDate ? ` · vence ${a.dueDate.slice(0, 10)}` : ""}
                  {a.allowsSubmission ? " · acepta entrega" : ""}
                </div>
              </div>
              {editing === null && (
                <div className="dw-row">
                  <button className="btn btn--ghost" onClick={() => setEditing(a.id)}>Editar</button>
                  <button className="iconbtn" aria-label="Eliminar evaluación" disabled={pending} onClick={() => remove(a)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {assessments.length > 0 && (
        <div className="dw-card" style={{ overflowX: "auto" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>Notas (0–20)</h2>
          <table className="dw-gradetable">
            <thead>
              <tr>
                <th>Estudiante</th>
                {assessments.map((a) => (
                  <th key={a.id} title={a.title}>
                    {a.title.length > 14 ? `${a.title.slice(0, 14)}…` : a.title}
                    <div className="dtable__muted" style={{ fontWeight: 400, fontSize: 11 }}>{a.weight}%</div>
                  </th>
                ))}
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => {
                const avg = weightedAverage(
                  assessments.map((a) => ({
                    weight: a.weight,
                    score: grades[`${r.enrollmentId}:${a.id}`]?.score ?? null,
                  })),
                );
                return (
                  <tr key={r.enrollmentId}>
                    <td>{r.name}</td>
                    {assessments.map((a) => (
                      <td key={a.id}>
                        <GradeInput
                          moduleId={moduleId}
                          assessmentId={a.id}
                          enrollmentId={r.enrollmentId}
                          cell={grades[`${r.enrollmentId}:${a.id}`]}
                        />
                      </td>
                    ))}
                    <td className="dw-avg">{avg === null ? "—" : avg.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Nota de estructura:** `weightedAverage` se usa también en el cliente. Crear `src/lib/teaching-client.ts` (sin `server-only`) con la función pura y re-exportarla en `teaching.ts` (`export { weightedAverage } from "./teaching-client";`), eliminando la copia local de `teaching.ts`:

```ts
// src/lib/teaching-client.ts — utilidades puras compartidas cliente/servidor
export function weightedAverage(
  items: Array<{ weight: number; score: number | null }>,
): number | null {
  let sum = 0;
  let weights = 0;
  for (const it of items) {
    if (it.score === null) continue;
    sum += it.score * it.weight;
    weights += it.weight;
  }
  if (weights === 0) return null;
  return Math.round((sum / weights) * 100) / 100;
}
```

- [ ] **Step 3: Montar en `ModuleWorkspace.tsx`**

Importar `GradesTab` y reemplazar el placeholder para `tab === "notas"`:

```tsx
      {tab === "notas" && (
        <GradesTab
          moduleId={props.moduleId}
          roster={props.roster}
          assessments={props.assessments}
          grades={props.grades}
        />
      )}
```

(el placeholder genérico queda solo para materiales/estudiantes).

- [ ] **Step 4: Verificar en navegador**

`npx tsc --noEmit` y lint limpios. Login docente E2E:
1. Pestaña "Evaluaciones y notas": crear "Trabajo final" (trabajo, 60%, acepta entrega, vence en una semana) y "Examen" (examen, 40%). El aviso de pesos desaparece al sumar 100.
2. Calificar al alumno: Trabajo final = 15, Examen = 18 → promedio 16.20 (15·0.6 + 18·0.4).
3. Borrar la nota del examen (vaciar la celda) → promedio pasa a 15 (solo lo calificado).
4. Nota 25 → borde rojo, no se guarda.
5. Recargar → todo persiste.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/docencia" src/lib/teaching.ts src/lib/teaching-client.ts
git commit -m "feat: evaluaciones y tabla de notas con promedio ponderado"
```

---

### Task 5: Materiales + pestaña Estudiantes + E2E docente

**Files:**
- Modify: `src/app/(admin)/docencia/[moduleId]/actions.ts` (saveMaterial/deleteMaterial)
- Create: `src/app/(admin)/docencia/[moduleId]/MaterialsTab.tsx`
- Create: `src/app/(admin)/docencia/[moduleId]/StudentsTab.tsx`
- Modify: `src/app/(admin)/docencia/[moduleId]/ModuleWorkspace.tsx` (montar ambas)

**Interfaces:**
- Consumes: helpers del archivo actions, tipos, `weightedAverage`.
- Produces:
  - `saveMaterial(moduleId, input: { id: string | null; title: string; url: string }): Promise<ActionResult<{ id: string }>>`
  - `deleteMaterial(moduleId, materialId): Promise<ActionResult>`

- [ ] **Step 1: Actions de materiales**

Añadir a `[moduleId]/actions.ts`:

```ts
/* ─────────────────────────────── materiales ─────────────────────────────── */

export async function saveMaterial(
  moduleId: string,
  input: { id: string | null; title: string; url: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const title = (input.title ?? "").trim();
    const url = (input.url ?? "").trim();
    const fieldErrors: Record<string, string> = {};
    if (title.length < 2 || title.length > 200) fieldErrors.title = "Indica el título.";
    if (!/^https?:\/\/.+/.test(url)) fieldErrors.url = "Debe ser una URL http(s) válida.";
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }

    let id: string;
    if (input.id) {
      const updated = await prisma.moduleMaterial.updateMany({
        where: { id: input.id, moduleId },
        data: { title, url },
      });
      if (updated.count === 0) return { ok: false, error: "Material no encontrado." };
      id = input.id;
    } else {
      const created = await prisma.$transaction(
        async (tx) => {
          const count = await tx.moduleMaterial.count({ where: { moduleId } });
          return tx.moduleMaterial.create({
            data: { moduleId, title, url, order: count + 1 },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      id = created.id;
    }
    refresh(moduleId);
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("saveMaterial", e);
    return { ok: false, error: "No se pudo guardar el material." };
  }
}

export async function deleteMaterial(
  moduleId: string,
  materialId: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const material = await prisma.moduleMaterial.findFirst({
      where: { id: materialId, moduleId },
      select: { id: true, order: true },
    });
    if (!material) return { ok: false, error: "Material no encontrado." };

    await prisma.$transaction(async (tx) => {
      await tx.moduleMaterial.delete({ where: { id: material.id } });
      await tx.moduleMaterial.updateMany({
        where: { moduleId, order: { gt: material.order } },
        data: { order: { decrement: 1 } },
      });
    });
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("deleteMaterial", e);
    return { ok: false, error: "No se pudo eliminar el material." };
  }
}
```

- [ ] **Step 2: `MaterialsTab.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { deleteMaterial, saveMaterial } from "./actions";
import type { MaterialRow } from "../types";

export function MaterialsTab({
  moduleId,
  materials,
}: {
  moduleId: string;
  materials: MaterialRow[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const add = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveMaterial(moduleId, { id: null, title, url });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setTitle("");
      setUrl("");
      router.refresh();
    });
  };

  const remove = (m: MaterialRow) => {
    if (!confirm(`¿Quitar el material "${m.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteMaterial(moduleId, m.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  return (
    <div className="dw-card">
      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>
        Materiales del módulo ({materials.length})
      </h2>

      <div className="dw-row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <label className="field" style={{ margin: 0, minWidth: 180 }}>
          <span className="field__label">Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Diapositivas sesión 1" aria-invalid={!!fieldErrors.title} />
          {fieldErrors.title && <span style={{ color: "#b91c1c", fontSize: 12 }}>{fieldErrors.title}</span>}
        </label>
        <label className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <span className="field__label">Enlace</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-invalid={!!fieldErrors.url} />
          {fieldErrors.url && <span style={{ color: "#b91c1c", fontSize: 12 }}>{fieldErrors.url}</span>}
        </label>
        <button className="btn btn--primary" onClick={add} disabled={pending}>
          <Icon name="plus" size={15} />
          Añadir
        </button>
      </div>
      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}

      {materials.length === 0 ? (
        <p className="dtable__muted">Aún no hay materiales publicados.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {materials.map((m) => (
            <li key={m.id} className="dw-row" style={{ justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="linkbtn">
                <Icon name="external" size={15} />
                {m.title}
              </a>
              <button className="iconbtn" aria-label="Quitar material" disabled={pending} onClick={() => remove(m)}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `StudentsTab.tsx`**

```tsx
"use client";

import type { RosterStudent } from "@/lib/teaching";
import { weightedAverage } from "@/lib/teaching-client";
import type { AssessmentRow, GradeCell, SessionRow, SubmissionInfo } from "../types";

export function StudentsTab({
  roster,
  sessions,
  assessments,
  grades,
  submissions,
}: {
  roster: RosterStudent[];
  sessions: SessionRow[];
  assessments: AssessmentRow[];
  grades: Record<string, GradeCell>;
  submissions: SubmissionInfo[];
}) {
  const submittable = assessments.filter((a) => a.allowsSubmission);

  return (
    <div className="dw-card" style={{ overflowX: "auto" }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>
        Estudiantes ({roster.length})
      </h2>
      {roster.length === 0 ? (
        <p className="dtable__muted">No hay matrículas activas en este diplomado.</p>
      ) : (
        <table className="dw-gradetable">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Asistencia</th>
              <th>Promedio</th>
              {submittable.length > 0 && <th>Entregas</th>}
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => {
              // % de asistencia: presente + tardanza sobre sesiones con registro para el alumno
              let attended = 0;
              let recorded = 0;
              for (const s of sessions) {
                const st = s.attendance[r.enrollmentId];
                if (!st) continue;
                recorded += 1;
                if (st === "presente" || st === "tardanza") attended += 1;
              }
              const pct = recorded === 0 ? null : Math.round((attended / recorded) * 100);

              const avg = weightedAverage(
                assessments.map((a) => ({
                  weight: a.weight,
                  score: grades[`${r.enrollmentId}:${a.id}`]?.score ?? null,
                })),
              );

              const delivered = submittable.filter((a) =>
                submissions.some(
                  (s) => s.assessmentId === a.id && s.enrollmentId === r.enrollmentId,
                ),
              ).length;

              return (
                <tr key={r.enrollmentId}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div className="dtable__muted" style={{ fontSize: 12 }}>{r.email}</div>
                  </td>
                  <td>{pct === null ? "—" : `${pct}% (${attended}/${recorded})`}</td>
                  <td className="dw-avg">{avg === null ? "—" : avg.toFixed(2)}</td>
                  {submittable.length > 0 && (
                    <td>{delivered}/{submittable.length}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Montar en `ModuleWorkspace.tsx`**

Importar ambas y reemplazar por completo el placeholder restante:

```tsx
      {tab === "materiales" && (
        <MaterialsTab moduleId={props.moduleId} materials={props.materials} />
      )}
      {tab === "estudiantes" && (
        <StudentsTab
          roster={props.roster}
          sessions={props.sessions}
          assessments={props.assessments}
          grades={props.grades}
          submissions={props.submissions}
        />
      )}
```

- [ ] **Step 5: Verificación E2E del subsistema B**

`npx tsc --noEmit`, lint y `npm run build` limpios. Login docente E2E:
1. Materiales: añadir "Sílabo del módulo" con URL válida → aparece; URL sin http → error de campo; quitar un material → desaparece.
2. Estudiantes: el alumno muestra su % de asistencia (de la Task 3), su promedio (de la Task 4) y 0/1 entregas (aún sin portal alumno).
3. Guard transversal: como docente E2E, `fetch` de una action con el moduleId del módulo 1 (de Nelly) → "Este módulo no está a tu cargo." (probar con saveMaterial vía consola).
4. Capturas de las 4 pestañas (patrón del repo; no commitearlas).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/docencia"
git commit -m "feat: materiales y resumen de estudiantes del módulo"
```

---

## Autorevisión del plan (hecha)

- **Cobertura del spec (B):** modelos exactos + Submission adelantada (T1); `/docencia` solo con módulos propios (T2); sesiones CRUD + pase de lista con 4 estados y upsert masivo solo de matrículas activas (T3); evaluaciones con peso, aviso ≠100, tabla de notas 0–20 con promedio ponderado sobre lo calificado (T4); materiales con enlaces y roster con % asistencia/promedio/entregas (T5); propiedad verificada en TODAS las actions vía `authorizeOwnedModule`; guards E2E negativos incluidos.
- **Sin placeholders:** cada paso lleva código o comandos concretos.
- **Consistencia de tipos:** `SessionRow/AssessmentRow/GradeCell/MaterialRow/SubmissionInfo` definidos en T3 Step 1 y consumidos en T3–T5; `weightedAverage` vive en `teaching-client.ts` (puro, importable desde componentes cliente) y re-exportado por `teaching.ts` para el servidor; `getOwnedModule` selecciona `diplomaId` que `authorizeOwnedModule` usa para validar matrículas.
