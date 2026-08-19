# Intranet académica — Subsistema C: Portal del estudiante (Plan de implementación)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El alumno entra a `/aula`, ve sus diplomados y módulos, consulta sus notas, asistencia y materiales, y sube entregas de trabajos (archivo o enlace) que el docente ve y descarga desde su intranet.

**Architecture:** El modelo `Submission` ya existe (subsistema B). Se añade almacenamiento protegido en `storage/entregas/` (clon del patrón de postulaciones), un route handler de descarga con autorización de 3 vías (alumno dueño / docente del módulo / admin), lib `aula.ts` con guards por matrícula activa, y páginas `/aula` + `/aula/modulo/[moduleId]` de solo-lectura salvo la entrega de trabajos. El docente gana enlaces de descarga en su pestaña Estudiantes.

**Tech Stack:** Next.js 16.2.6 (App Router, server actions con FormData, route handlers), React 19, Prisma 7, PostgreSQL, filesystem local (`storage/`, ya git-ignorado).

**Spec:** `docs/superpowers/specs/2026-08-19-intranet-academica-fase2-design.md` (secciones C y Seguridad)

## Global Constraints

- Igual que los planes A/B: Next no estándar (`params` es Promise; docs en `node_modules/next/dist/docs/01-app/`), copy en español, `prisma db push` (no aplica aquí: sin cambios de esquema salvo un campo — ver T1), `ActionResult<T>`, sin framework de tests (tsc + lint + navegador; ~17 errores de lint preexistentes ajenos), commits en español + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, WIP del usuario sin commitear: `git add` SOLO archivos de cada tarea.
- **Propiedad obligatoria:** alumno = matrícula ACTIVA propia en el diplomado del módulo; nunca ve datos de otros. Docente = módulo propio (patrón B). Descargas SIEMPRE por route handler autorizado, nunca URL pública.
- Entregas: archivo PDF/DOC/DOCX/ZIP máx. 10 MB **o** enlace http(s); reemplazable mientras NO exista `Grade` de esa evaluación para esa matrícula y la fecha límite no haya vencido; vencida la fecha, ni nueva ni reemplazo.
- **Semántica de vencimiento (ruling de la revisión final B):** `dueDate` se guarda como medianoche UTC del día elegido. El plazo vence al FINAL de ese día calendario en Lima (UTC-5): la entrega está abierta mientras `Date.now() < dueDate.getTime() + 29 * 3600 * 1000` (24 h del día + 5 h de offset). Usar esta fórmula EXACTA en servidor (`submitWork`) y cliente (`isPastDue`), nunca `now > dueDate` a secas.
- Fechas date-only (dueDate): mostrar SIEMPRE la fecha calendario del ISO (`slice(0,10)` o `timeZone: "UTC"`), nunca con huso local (lección del subsistema B).
- Datos de prueba: alumno `alumno.e2e.matricula@example.com` / `YYw4bkc5yybe` (matrícula activa en TIC); docente `docente.e2e@example.com` / `docencia123` (módulo TIC #2 con evaluaciones, una de ellas con "acepta entrega").

---

### Task 1: Almacenamiento de entregas + descarga protegida

**Files:**
- Create: `src/lib/submissions-storage.ts`
- Create: `src/app/api/entregas/[submissionId]/route.ts`
- Modify: `prisma/schema.prisma` (añadir `sizeBytes Int?` y `mimeType String?` a `Submission`)

**Interfaces:**
- Consumes: patrón de `src/lib/applications-storage.ts`; modelo `Submission` (B).
- Produces (T3–T4 consumen):
  - `saveSubmissionFile(assessmentId: string, enrollmentId: string, file: File): Promise<{ storedPath: string; sizeBytes: number }>` — valida MIME/tamaño ANTES de escribir; lanza `Error` con mensaje en español si inválido.
  - `deleteSubmissionFile(storedPath: string): Promise<void>` — borra sin fallar si no existe.
  - `readSubmissionFile(storedPath: string): Promise<Buffer>` — bloquea path traversal.
  - `SUBMISSION_MAX_BYTES`, `SUBMISSION_MIMES` exportados.
  - Ruta `GET /api/entregas/[submissionId]` — sirve el archivo si el solicitante es el alumno dueño, el docente del módulo o un admin con `enrollments.read`; 404/403 en caso contrario.

- [ ] **Step 1: Campo de tamaño/MIME en `Submission`**

En `prisma/schema.prisma`, dentro de `model Submission`, tras `storedPath`:

```prisma
  mimeType  String?
  sizeBytes Int?
```

y bajo el `@@unique` existente del modelo, añadir el índice que las consultas por alumno del aula necesitan:

```prisma
  @@index([enrollmentId])
```

Run: `npx prisma db push` (aditivo). `npx prisma generate` si hace falta.

- [ ] **Step 2: `src/lib/submissions-storage.ts`**

```ts
import "server-only";

import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

// Las entregas de los alumnos se guardan FUERA de /public (no se sirven
// directamente). Se descargan por /api/entregas/[id], que autoriza al
// alumno dueño, al docente del módulo o a un admin.
const STORAGE_ROOT = resolve(process.cwd(), "storage", "entregas");

export const SUBMISSION_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUBMISSION_MIMES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
};

/**
 * Valida y guarda el archivo de una entrega bajo
 * storage/entregas/<assessmentId>/. Devuelve la ruta relativa y el tamaño.
 * Lanza Error con mensaje en español si el archivo no es válido.
 */
export async function saveSubmissionFile(
  assessmentId: string,
  enrollmentId: string,
  file: File,
): Promise<{ storedPath: string; sizeBytes: number }> {
  const ext = SUBMISSION_MIMES[file.type];
  if (!ext) {
    throw new Error("Formato no permitido. Sube un PDF, Word (doc/docx) o ZIP.");
  }
  if (file.size > SUBMISSION_MAX_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB.");
  }

  const dir = join(STORAGE_ROOT, assessmentId);
  await mkdir(dir, { recursive: true });

  const stored = `${enrollmentId}-${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > SUBMISSION_MAX_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB.");
  }
  await writeFile(join(dir, stored), buf);

  return { storedPath: `${assessmentId}/${stored}`, sizeBytes: buf.length };
}

/** Borra el archivo de una entrega; silencioso si ya no existe. */
export async function deleteSubmissionFile(storedPath: string): Promise<void> {
  const abs = resolveSafe(storedPath);
  await unlink(abs).catch(() => undefined);
}

/** Lee un archivo almacenado, bloqueando path traversal. */
export async function readSubmissionFile(storedPath: string): Promise<Buffer> {
  return readFile(resolveSafe(storedPath));
}

function resolveSafe(storedPath: string): string {
  const abs = resolve(STORAGE_ROOT, storedPath);
  if (abs !== STORAGE_ROOT && !abs.startsWith(STORAGE_ROOT + sep)) {
    throw new Error("Ruta de archivo inválida.");
  }
  return abs;
}
```

- [ ] **Step 3: Route handler `src/app/api/entregas/[submissionId]/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { readSubmissionFile } from "@/lib/submissions-storage";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ submissionId: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { submissionId } = await ctx.params;
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      fileName: true,
      storedPath: true,
      mimeType: true,
      enrollment: { select: { student: { select: { userId: true } } } },
      assessment: {
        select: {
          module: { select: { teacher: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!sub || !sub.storedPath) {
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  const isOwner = sub.enrollment.student.userId === me.id;
  const isTeacher = sub.assessment.module.teacher?.userId === me.id;
  const isAdmin = me.permissions.has("enrollments.read");
  if (!isOwner && !isTeacher && !isAdmin) {
    return NextResponse.json({ error: "Sin acceso a esta entrega." }, { status: 403 });
  }

  try {
    const buf = await readSubmissionFile(sub.storedPath);
    const fileName = sub.fileName ?? "entrega";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": sub.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }
}
```

- [ ] **Step 4: Verificar**

`npx tsc --noEmit` y lint limpios. `GET /api/entregas/no-existe` con sesión iniciada → 404 JSON; sin sesión → 401 (probar con fetch en consola del navegador). El resto se prueba E2E en T3–T4.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/submissions-storage.ts src/app/api/entregas
git commit -m "feat: almacenamiento y descarga protegida de entregas"
```

---

### Task 2: Lib del aula + página `/aula`

**Files:**
- Create: `src/lib/aula.ts`
- Create: `src/app/(admin)/aula/page.tsx`
- Create: `src/app/(admin)/aula/AulaHome.tsx`
- Modify: `src/components/admin/data.ts` (sidebar)

**Interfaces:**
- Consumes: modelos A/B.
- Produces (T3 consume):
  - `getAulaModule(moduleId: string, userId: string)` — devuelve `{ module: { id, name, code, order, diplomaId, diploma: { title } }, enrollmentId: string } | null`; null si el usuario no tiene matrícula ACTIVA en el diplomado del módulo.

- [ ] **Step 1: `src/lib/aula.ts`**

```ts
import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Módulo visto desde el aula del alumno: solo si el usuario tiene una
 * matrícula ACTIVA en el diplomado del módulo. Devuelve también su
 * enrollmentId (todas las lecturas del aula filtran por él).
 */
export async function getAulaModule(moduleId: string, userId: string) {
  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      name: true,
      code: true,
      order: true,
      diplomaId: true,
      diploma: { select: { title: true } },
    },
  });
  if (!mod) return null;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      diplomaId: mod.diplomaId,
      status: "active",
      student: { userId },
    },
    select: { id: true },
  });
  if (!enrollment) return null;

  return { module: mod, enrollmentId: enrollment.id };
}
```

- [ ] **Step 2: Sidebar**

En `SIDEBAR_NAV` (`src/components/admin/data.ts`), tras `docencia`:

```ts
  { id: "aula", label: "Mi aula", icon: "apps", href: "/aula", perm: "aula.view" },
```

- [ ] **Step 3: `page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { AulaHome } from "./AulaHome";

export const metadata = { title: "Mi aula · UNAMAD" };
export const dynamic = "force-dynamic";

export type AulaDiploma = {
  enrollmentId: string;
  diplomaTitle: string;
  modules: Array<{ id: string; order: number; name: string; teacherLabel: string | null }>;
};

export default async function Page() {
  const me = await requirePermission("aula.view");

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "active", student: { userId: me.id } },
    orderBy: { createdAt: "asc" },
    include: {
      diploma: {
        select: {
          title: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              name: true,
              teacher: {
                select: {
                  academicDegree: true,
                  user: { select: { name: true, active: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const rows: AulaDiploma[] = enrollments.map((e) => ({
    enrollmentId: e.id,
    diplomaTitle: e.diploma.title,
    modules: e.diploma.modules.map((m) => ({
      id: m.id,
      order: m.order,
      name: m.name,
      teacherLabel:
        m.teacher && m.teacher.user.active
          ? `${m.teacher.academicDegree} ${m.teacher.user.name}`
          : null,
    })),
  }));

  return <AulaHome rows={rows} />;
}
```

- [ ] **Step 4: `AulaHome.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import type { AulaDiploma } from "./page";

export function AulaHome({ rows }: { rows: AulaDiploma[] }) {
  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Mi aula</h1>
          <span className="page__sub">
            {rows.length} diplomado{rows.length === 1 ? "" : "s"} en curso
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="apps" size={40} />
            <h3>Sin matrículas activas</h3>
            <p>Cuando tu matrícula esté activa, tus cursos aparecerán aquí.</p>
          </div>
        </div>
      ) : (
        rows.map((d) => (
          <div key={d.enrollmentId} className="tablewrap" style={{ marginBottom: 16 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{d.diplomaTitle}</h2>
            </div>
            <div className="tablewrap__scroll">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Módulo</th>
                    <th>Docente</th>
                    <th className="dtable__settings">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {d.modules.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>Módulo {m.order}</div>
                      </td>
                      <td className="dtable__muted">{m.teacherLabel ?? "Por asignar"}</td>
                      <td className="dtable__settings">
                        <Link className="btn btn--primary" href={`/aula/modulo/${m.id}`}>
                          Entrar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar en navegador**

`npx tsc --noEmit` y lint limpios. Login `alumno.e2e.matricula@example.com` / `YYw4bkc5yybe`:
1. Aterriza en `/inicio`; sidebar muestra solo Inicio y **Mi aula**.
2. `/aula` lista el diplomado TIC con sus 6 módulos y docentes ("Dr. Nelly…", "Mg. Docente E2E", "Por asignar" en el resto).
3. "Entrar" navega a `/aula/modulo/<id>` (404 hasta T3 — esperado).

- [ ] **Step 6: Commit**

```bash
git add src/lib/aula.ts "src/app/(admin)/aula" src/components/admin/data.ts
git commit -m "feat: página Mi aula con los diplomados del estudiante"
```

---

### Task 3: Página del módulo del alumno + entrega de trabajos

**Files:**
- Create: `src/app/(admin)/aula/modulo/[moduleId]/page.tsx`
- Create: `src/app/(admin)/aula/modulo/[moduleId]/actions.ts`
- Create: `src/app/(admin)/aula/modulo/[moduleId]/AulaModule.tsx`
- Create: `src/app/(admin)/aula/aula.css`

**Interfaces:**
- Consumes: `getAulaModule` (T2), `weightedAverage` de `@/lib/teaching-client`, `saveSubmissionFile`/`deleteSubmissionFile` (T1), tipos de docencia NO se reutilizan (el aula define los suyos, más simples).
- Produces:
  - `submitWork(moduleId: string, assessmentId: string, formData: FormData): Promise<ActionResult>` — FormData con `file` (File opcional), `linkUrl` (string opcional), `comment` (string opcional); exactamente uno de file/linkUrl obligatorio.

- [ ] **Step 1: `actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getAulaModule } from "@/lib/aula";
import {
  deleteSubmissionFile,
  saveSubmissionFile,
} from "@/lib/submissions-storage";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitWork(
  moduleId: string,
  assessmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const me = await getCurrentUser();
    if (!me || !me.permissions.has("aula.view")) {
      return { ok: false, error: "No tienes acceso al aula." };
    }
    const aula = await getAulaModule(moduleId, me.id);
    if (!aula) return { ok: false, error: "No estás matriculado en este módulo." };

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, moduleId },
      select: { id: true, allowsSubmission: true, dueDate: true },
    });
    if (!assessment) return { ok: false, error: "Evaluación no encontrada." };
    if (!assessment.allowsSubmission) {
      return { ok: false, error: "Esta evaluación no acepta entregas en línea." };
    }
    // Vence al final del día calendario en Lima (ver Global Constraints).
    if (
      assessment.dueDate &&
      Date.now() >= assessment.dueDate.getTime() + 29 * 3600 * 1000
    ) {
      return { ok: false, error: "La fecha límite de entrega ya venció." };
    }

    // Reemplazo bloqueado si ya está calificada.
    const graded = await prisma.grade.findUnique({
      where: {
        assessmentId_enrollmentId: {
          assessmentId,
          enrollmentId: aula.enrollmentId,
        },
      },
      select: { assessmentId: true },
    });
    if (graded) {
      return { ok: false, error: "Esta evaluación ya fue calificada; no se puede reemplazar la entrega." };
    }

    const file = formData.get("file");
    const linkUrl = String(formData.get("linkUrl") ?? "").trim();
    const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);
    const hasFile = file instanceof File && file.size > 0;

    if (!hasFile && linkUrl === "") {
      return { ok: false, error: "Adjunta un archivo o pega un enlace." };
    }
    if (hasFile && linkUrl !== "") {
      return { ok: false, error: "Elige una sola forma de entrega: archivo o enlace." };
    }
    if (linkUrl !== "" && !/^https?:\/\/.+/.test(linkUrl)) {
      return { ok: false, error: "El enlace debe empezar con http(s)://" };
    }

    let stored: { storedPath: string; sizeBytes: number } | null = null;
    let mimeType: string | null = null;
    let fileName: string | null = null;
    if (hasFile) {
      const f = file as File;
      stored = await saveSubmissionFile(assessmentId, aula.enrollmentId, f);
      mimeType = f.type;
      fileName = f.name.slice(0, 200);
    }

    const previous = await prisma.submission.findUnique({
      where: {
        assessmentId_enrollmentId: {
          assessmentId,
          enrollmentId: aula.enrollmentId,
        },
      },
      select: { storedPath: true },
    });

    await prisma.submission.upsert({
      where: {
        assessmentId_enrollmentId: {
          assessmentId,
          enrollmentId: aula.enrollmentId,
        },
      },
      update: {
        fileName,
        storedPath: stored?.storedPath ?? null,
        mimeType,
        sizeBytes: stored?.sizeBytes ?? null,
        linkUrl: linkUrl || null,
        comment: comment || null,
        submittedAt: new Date(),
      },
      create: {
        assessmentId,
        enrollmentId: aula.enrollmentId,
        fileName,
        storedPath: stored?.storedPath ?? null,
        mimeType,
        sizeBytes: stored?.sizeBytes ?? null,
        linkUrl: linkUrl || null,
        comment: comment || null,
      },
    });

    // Limpia el archivo anterior si fue reemplazado.
    if (previous?.storedPath && previous.storedPath !== stored?.storedPath) {
      await deleteSubmissionFile(previous.storedPath);
    }

    revalidatePath(`/aula/modulo/${moduleId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("Formato no permitido") || msg.startsWith("El archivo supera")) {
      return { ok: false, error: msg };
    }
    console.error("submitWork", e);
    return { ok: false, error: "No se pudo registrar la entrega." };
  }
}
```

- [ ] **Step 2: `page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getAulaModule } from "@/lib/aula";
import { weightedAverage } from "@/lib/teaching-client";
import { Icon } from "@/components/admin/Icon";
import { AulaModule, type AulaData } from "./AulaModule";
import "../../aula.css";
import "../../../usuarios/users.css";

export const metadata = { title: "Módulo · Mi aula · UNAMAD" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ moduleId: string }> }) {
  const me = await requirePermission("aula.view");
  const { moduleId } = await params;

  const aula = await getAulaModule(moduleId, me.id);
  if (!aula) redirect("/403");
  const { module: mod, enrollmentId } = aula;

  const [sessions, assessments, materials, grades, submissions] = await Promise.all([
    prisma.moduleSession.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
      include: { attendance: { where: { enrollmentId } } },
    }),
    prisma.assessment.findMany({ where: { moduleId }, orderBy: { createdAt: "asc" } }),
    prisma.moduleMaterial.findMany({ where: { moduleId }, orderBy: { order: "asc" } }),
    prisma.grade.findMany({ where: { enrollmentId, assessment: { moduleId } } }),
    prisma.submission.findMany({ where: { enrollmentId, assessment: { moduleId } } }),
  ]);

  const gradeByAssessment = new Map(grades.map((g) => [g.assessmentId, g]));
  const subByAssessment = new Map(submissions.map((s) => [s.assessmentId, s]));

  const data: AulaData = {
    moduleId: mod.id,
    moduleName: mod.name,
    diplomaTitle: mod.diploma.title,
    sessions: sessions.map((s) => ({
      order: s.order,
      date: s.date.toISOString(),
      topic: s.topic,
      status: s.attendance[0]?.status ?? null,
    })),
    materials: materials.map((m) => ({ id: m.id, title: m.title, url: m.url })),
    assessments: assessments.map((a) => {
      const g = gradeByAssessment.get(a.id);
      const s = subByAssessment.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        kind: a.kind,
        weight: a.weight,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        allowsSubmission: a.allowsSubmission,
        score: g ? Number(g.score) : null,
        feedback: g?.feedback ?? null,
        submission: s
          ? {
              id: s.id,
              fileName: s.fileName,
              linkUrl: s.linkUrl,
              submittedAt: s.submittedAt.toISOString(),
            }
          : null,
      };
    }),
  };

  const average = weightedAverage(
    data.assessments.map((a) => ({ weight: a.weight, score: a.score })),
  );

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>{mod.name}</h1>
          <span className="page__sub">
            {mod.diploma.title} · Módulo {mod.order}
            {average !== null ? ` · Promedio: ${average.toFixed(2)}` : ""}
          </span>
        </div>
        <Link className="linkbtn" href="/aula">
          <Icon name="chevron-right" size={15} />
          Mi aula
        </Link>
      </div>
      <AulaModule data={data} average={average} />
    </div>
  );
}
```

- [ ] **Step 3: `aula.css`**

```css
/* Aula del estudiante */
.au-tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.au-tab {
  padding: 9px 14px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--muted, #6b7280);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.au-tab.is-active {
  color: var(--text, #111827);
  font-weight: 600;
  border-bottom-color: var(--primary, #2563eb);
}
.au-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.au-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.au-table th,
.au-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.au-badge-nota {
  font-weight: 700;
}
@media (max-width: 640px) {
  .au-card { padding: 12px; }
}
```

- [ ] **Step 4: `AulaModule.tsx`**

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { submitWork } from "./actions";

export type AulaAssessment = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  weight: number;
  dueDate: string | null;
  allowsSubmission: boolean;
  score: number | null;
  feedback: string | null;
  submission: {
    id: string;
    fileName: string | null;
    linkUrl: string | null;
    submittedAt: string;
  } | null;
};

export type AulaData = {
  moduleId: string;
  moduleName: string;
  diplomaTitle: string;
  sessions: Array<{ order: number; date: string; topic: string; status: string | null }>;
  materials: Array<{ id: string; title: string; url: string }>;
  assessments: AulaAssessment[];
};

const TABS = [
  { id: "notas", label: "Notas" },
  { id: "asistencia", label: "Asistencia" },
  { id: "materiales", label: "Materiales" },
  { id: "trabajos", label: "Trabajos" },
] as const;

const ATT_LABEL: Record<string, string> = {
  presente: "Presente",
  tardanza: "Tardanza",
  falta: "Falta",
  justificada: "Justificada",
};

const KIND_LABEL: Record<string, string> = {
  tarea: "Tarea",
  trabajo: "Trabajo",
  examen: "Examen",
  participacion: "Participación",
};

function calDate(iso: string): string {
  return iso.slice(0, 10);
}

function isPastDue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  // Fin del día calendario en Lima (misma fórmula que el servidor).
  return Date.now() >= new Date(dueDate).getTime() + 29 * 3600 * 1000;
}

function SubmitForm({
  moduleId,
  assessment,
  onDone,
}: {
  moduleId: string;
  assessment: AulaAssessment;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    const fd = new FormData();
    const file = fileRef.current?.files?.[0];
    if (file) fd.set("file", file);
    fd.set("linkUrl", linkUrl);
    fd.set("comment", comment);
    startTransition(async () => {
      const res = await submitWork(moduleId, assessment.id, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
    });
  };

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 10 }}>
      <div className="dw-row" style={{ gap: 14, flexWrap: "wrap", display: "flex", alignItems: "flex-end" }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field__label">Archivo (PDF, Word o ZIP, máx. 10 MB)</span>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.zip" />
        </label>
        <label className="field" style={{ margin: 0, minWidth: 220, flex: 1 }}>
          <span className="field__label">…o enlace (Drive, GitHub, etc.)</span>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
        </label>
      </div>
      <label className="field" style={{ marginTop: 8 }}>
        <span className="field__label">Comentario (opcional)</span>
        <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      </label>
      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
      <button className="btn btn--primary" onClick={send} disabled={pending}>
        {pending ? "Enviando…" : assessment.submission ? "Reemplazar entrega" : "Enviar entrega"}
      </button>
    </div>
  );
}

export function AulaModule({ data, average }: { data: AulaData; average: number | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("notas");
  const [openForm, setOpenForm] = useState<string | null>(null);

  const attended = data.sessions.filter(
    (s) => s.status === "presente" || s.status === "tardanza",
  ).length;
  const recorded = data.sessions.filter((s) => s.status !== null).length;

  return (
    <div>
      <div className="au-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`au-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notas" && (
        <div className="au-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>Mis notas</h2>
          {data.assessments.length === 0 ? (
            <p className="dtable__muted">El docente aún no define evaluaciones.</p>
          ) : (
            <table className="au-table">
              <thead>
                <tr>
                  <th>Evaluación</th>
                  <th>Peso</th>
                  <th>Nota</th>
                  <th>Retroalimentación</th>
                </tr>
              </thead>
              <tbody>
                {data.assessments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.title}</div>
                      <div className="dtable__muted" style={{ fontSize: 12 }}>
                        {KIND_LABEL[a.kind] ?? a.kind}
                      </div>
                    </td>
                    <td>{a.weight}%</td>
                    <td className="au-badge-nota">
                      {a.score === null ? "—" : a.score.toFixed(2)}
                    </td>
                    <td className="dtable__muted">{a.feedback ?? "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600 }}>Promedio ponderado</td>
                  <td className="au-badge-nota" colSpan={2}>
                    {average === null ? "—" : average.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "asistencia" && (
        <div className="au-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>
            Mi asistencia
            {recorded > 0 && (
              <span className="dtable__muted" style={{ fontWeight: 400, fontSize: 13 }}>
                {" "}· {Math.round((attended / recorded) * 100)}% ({attended}/{recorded})
              </span>
            )}
          </h2>
          {data.sessions.length === 0 ? (
            <p className="dtable__muted">Aún no hay sesiones registradas.</p>
          ) : (
            <table className="au-table">
              <thead>
                <tr>
                  <th>Sesión</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.order}>
                    <td>Sesión {s.order} · {s.topic}</td>
                    <td className="dtable__muted">{calDate(s.date)}</td>
                    <td>{s.status ? ATT_LABEL[s.status] : "Sin registrar"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "materiales" && (
        <div className="au-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>Materiales</h2>
          {data.materials.length === 0 ? (
            <p className="dtable__muted">El docente aún no publica materiales.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.materials.map((m) => (
                <li key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="linkbtn">
                    <Icon name="external" size={15} />
                    {m.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "trabajos" && (
        <div>
          {data.assessments.filter((a) => a.allowsSubmission).length === 0 && (
            <div className="au-card">
              <p className="dtable__muted">No hay trabajos con entrega en línea.</p>
            </div>
          )}
          {data.assessments
            .filter((a) => a.allowsSubmission)
            .map((a) => {
              const pastDue = isPastDue(a.dueDate);
              const graded = a.score !== null;
              const canSubmit = !pastDue && !graded;
              return (
                <div key={a.id} className="au-card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.title}</div>
                      <div className="dtable__muted" style={{ fontSize: 12 }}>
                        {KIND_LABEL[a.kind] ?? a.kind} · {a.weight}%
                        {a.dueDate ? ` · vence ${calDate(a.dueDate)}` : ""}
                        {pastDue ? " · VENCIDO" : ""}
                        {graded ? ` · calificado: ${a.score!.toFixed(2)}` : ""}
                      </div>
                      {a.description && (
                        <p style={{ fontSize: 13, marginTop: 6 }}>{a.description}</p>
                      )}
                    </div>
                    <div>
                      {a.submission ? (
                        <span className="badge badge--green">Entregado</span>
                      ) : (
                        <span className="badge badge--neutral">Pendiente</span>
                      )}
                    </div>
                  </div>

                  {a.submission && (
                    <p style={{ fontSize: 13, marginTop: 8 }}>
                      Tu entrega ({a.submission.submittedAt.slice(0, 10)}):{" "}
                      {a.submission.fileName ? (
                        <a className="linkbtn" href={`/api/entregas/${a.submission.id}`}>
                          <Icon name="download" size={14} />
                          {a.submission.fileName}
                        </a>
                      ) : a.submission.linkUrl ? (
                        <a className="linkbtn" href={a.submission.linkUrl} target="_blank" rel="noopener noreferrer">
                          <Icon name="external" size={14} />
                          Ver enlace
                        </a>
                      ) : null}
                    </p>
                  )}

                  {canSubmit && openForm !== a.id && (
                    <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setOpenForm(a.id)}>
                      {a.submission ? "Reemplazar entrega" : "Enviar entrega"}
                    </button>
                  )}
                  {canSubmit && openForm === a.id && (
                    <SubmitForm
                      moduleId={data.moduleId}
                      assessment={a}
                      onDone={() => {
                        setOpenForm(null);
                        router.refresh();
                      }}
                    />
                  )}
                  {!canSubmit && (
                    <p className="dtable__muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                      {graded
                        ? "Ya calificado: la entrega no puede reemplazarse."
                        : "Fecha límite vencida: ya no se aceptan entregas."}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar en navegador**

`npx tsc --noEmit` y lint limpios. Login alumno E2E:
1. `/aula` → Entrar al módulo 2 (Bases de Datos): pestañas Notas (con las notas del subsistema B y el promedio), Asistencia (con su registro y %), Materiales (los del docente).
2. Trabajos: la evaluación con entrega aparece; subir un PDF pequeño → badge "Entregado", enlace de descarga funciona (descarga el mismo archivo).
3. Reemplazar con un enlace https:// → la entrega pasa a enlace.
4. Negativos: archivo .exe o >10MB → error claro; en una evaluación calificada → mensaje "Ya calificado"; visitar `/aula/modulo/<id de un módulo de un diplomado donde NO está matriculado…>` — si todos los módulos son de TIC, probar con el diplomado prueba-editor creando un módulo NO es necesario: usa un id inexistente → /403.
5. Entrar al módulo 1 (de Nelly, mismo diplomado) → funciona (está matriculado en TIC) aunque no tenga contenido.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/aula"
git commit -m "feat: aula del estudiante con notas, asistencia, materiales y entregas"
```

---

### Task 4: El docente ve las entregas + E2E del ciclo completo

**Files:**
- Modify: `src/app/(admin)/docencia/types.ts` (añadir `id` a `SubmissionInfo`)
- Modify: `src/app/(admin)/docencia/[moduleId]/page.tsx` (incluir id/fileName/linkUrl en el select de submissions)
- Modify: `src/app/(admin)/docencia/[moduleId]/StudentsTab.tsx` (enlaces a las entregas)

**Interfaces:**
- Consumes: ruta `GET /api/entregas/[submissionId]` (T1), `SubmissionInfo` (B).
- Produces: `SubmissionInfo` gana `id: string`.

- [ ] **Step 1: Tipo y datos**

En `src/app/(admin)/docencia/types.ts`, añadir `id: string;` como primer campo de `SubmissionInfo`.

En `[moduleId]/page.tsx`, en el `select` de `prisma.submission.findMany`, añadir `id: true,` y en el mapeo a `submissionRows` añadir `id: s.id,`.

- [ ] **Step 2: Enlaces en `StudentsTab.tsx`**

Reemplazar la celda de entregas (`<td>{delivered}/{submittable.length}</td>`) por:

```tsx
                  {submittable.length > 0 && (
                    <td>
                      <div>{delivered}/{submittable.length}</div>
                      {submittable.map((a) => {
                        const sub = submissions.find(
                          (s) => s.assessmentId === a.id && s.enrollmentId === r.enrollmentId,
                        );
                        if (!sub) return null;
                        return (
                          <div key={a.id} style={{ fontSize: 12 }}>
                            {sub.fileName ? (
                              <a className="linkbtn" href={`/api/entregas/${sub.id}`}>
                                {a.title.length > 18 ? `${a.title.slice(0, 18)}…` : a.title}: {sub.fileName}
                              </a>
                            ) : sub.linkUrl ? (
                              <a className="linkbtn" href={sub.linkUrl} target="_blank" rel="noopener noreferrer">
                                {a.title.length > 18 ? `${a.title.slice(0, 18)}…` : a.title}: enlace
                              </a>
                            ) : null}
                          </div>
                        );
                      })}
                    </td>
                  )}
```

- [ ] **Step 3: E2E del ciclo completo (subsistemas A+B+C)**

`npx tsc --noEmit`, lint y `npm run build` limpios. Flujo completo en navegador:
1. **Docente** (`docente.e2e@example.com`): en Estudiantes ve la entrega del alumno con enlace; descargarla funciona; califica esa evaluación en la pestaña de notas.
2. **Alumno** (`alumno.e2e.matricula@example.com`): en Notas ve la nueva nota y el promedio actualizado; en Trabajos el trabajo aparece "calificado" y ya no permite reemplazo.
3. **Negativo transversal:** con la sesión del alumno, `fetch("/api/entregas/<id de una entrega ajena>")` → 403 (si no existe otra entrega, basta el caso 404 de id inexistente + revisar el código de autorización).
4. Capturas del aula (notas/trabajos) y de la vista del docente con la entrega (sin commitear).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/docencia"
git commit -m "feat: el docente accede a las entregas de sus estudiantes"
```

---

## Autorevisión del plan (hecha)

- **Cobertura del spec (C):** almacenamiento en storage/entregas con patrón protegido y descarga por handler con 3 vías de autorización (T1); `/aula` con matrículas activas (T2); página del módulo con guard por matrícula, notas/asistencia/materiales/trabajos, entrega archivo-o-enlace con límites (PDF/DOC/DOCX/ZIP, 10MB), reemplazo bloqueado tras calificar y tras vencimiento (T3); docente ve/descarga entregas y ciclo E2E completo (T4). Fechas date-only siempre por slice(0,10). YAGNI respetado (sin notificaciones/exportes).
- **Sin placeholders:** todos los pasos con código o comandos concretos.
- **Consistencia de tipos:** `SubmissionInfo.id` añadido en T4 y usado en StudentsTab; `AulaData/AulaAssessment` definidos en T3 y usados en su page; `submitWork(moduleId, assessmentId, FormData)` coincide entre action y SubmitForm; `getAulaModule` devuelve `{module, enrollmentId}` como consumen T3 page/actions; campos `mimeType/sizeBytes` añadidos en T1 y escritos en T3.
