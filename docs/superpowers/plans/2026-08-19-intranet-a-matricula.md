# Intranet académica — Subsistema A: Matrícula (Plan de implementación)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rol `estudiante` con perfil, matrícula de postulantes aceptados con un clic (cuenta + contraseña temporal) y página admin `/matriculas` con alta manual y gestión de estados.

**Architecture:** Se replica el patrón de Fase 1 (perfil 1-a-1 sobre `User`, server actions con `ActionResult`, páginas admin con RBAC). `Enrollment` enlaza `StudentProfile` ↔ `Diploma` con vínculo opcional a la postulación de origen. Los permisos de TODA la Fase 2 (`enrollments.*`, `teaching.manage`, `aula.view`) se declaran de una vez para no tocar la semilla tres veces.

**Tech Stack:** Next.js 16.2.6 (App Router, server actions), React 19, Prisma 7 (+adapter-pg, cliente en `src/generated/prisma`), PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-08-19-intranet-academica-fase2-design.md`

## Global Constraints

- **Next.js NO estándar:** ante dudas de API, leer `node_modules/next/dist/docs/01-app/` (breaking changes; `params` es Promise en páginas).
- Copy y mensajes de error en **español**.
- Imports: `import { prisma } from "@/lib/prisma"`; `import { Prisma } from "@/generated/prisma/client"` para errores/tipos.
- Autorización: `getCurrentUser()` + `permissions.has(...)` en cada action; páginas con `requirePermission(...)`.
- Patrón `ActionResult<T> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }`.
- La BD usa `prisma db push` (NO `migrate dev`; no existe carpeta de migraciones). Nunca `--force-reset`/`--accept-data-loss`.
- **Sin framework de tests**: ciclo = `npx tsc --noEmit` → lint del área tocada → script `npx tsx` contra la BD dev y/o navegador (dev server en `http://localhost:3000`, credenciales admin en `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` de `.env`). Hay ~17 errores de lint preexistentes ajenos; ignorarlos.
- Commits frecuentes en español + línea `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Clases CSS del admin (`page`, `tablewrap`, `dtable`, `badge`, `btn`, `modal`, `field`, `banner`, `iconbtn`, `linkbtn`) viven en `src/app/globals.css`; el sidebar filtra por `perm` (campo de `SIDEBAR_NAV` en `src/components/admin/data.ts`).

---

### Task 1: Esquema Prisma + permisos y roles de la Fase 2

**Files:**
- Modify: `prisma/schema.prisma` (nuevos modelos; back-relations en `User`, `Diploma`, `DiplomaApplication`)
- Modify: `src/lib/auth/permissions.ts` (4 permisos nuevos, rol `estudiante`, ampliar `docente`/`admin`/`viewer`)
- Create: `prisma/verify-enrollments.ts`

**Interfaces:**
- Consumes: enum `IdDocType` existente; modelos `User`, `Diploma`, `DiplomaApplication`.
- Produces: modelos `StudentProfile`, `Enrollment` (+enum `EnrollmentStatus`) con los nombres exactos de abajo; permisos `enrollments.read`, `enrollments.write`, `teaching.manage`, `aula.view`; rol `estudiante`. Las Tasks 2–4 y los subsistemas B/C dependen de estos nombres.

- [ ] **Step 1: Modelos en `prisma/schema.prisma`**

Añadir después del bloque de `TeacherProfile`:

```prisma
// ─────────────────────────── Matrículas ───────────────────────────

model StudentProfile {
  id        String    @id @default(cuid())
  userId    String    @unique
  docType   IdDocType @default(DNI)
  docNumber String
  phone     String?

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  enrollments Enrollment[]

  @@index([docNumber])
}

enum EnrollmentStatus {
  active     // cursando
  withdrawn  // retirado (conserva historial, pierde acceso al aula)
  completed  // concluido
}

model Enrollment {
  id            String           @id @default(cuid())
  studentId     String
  diplomaId     String
  applicationId String?          @unique // postulación de origen; null = alta manual
  status        EnrollmentStatus @default(active)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  student     StudentProfile      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  diploma     Diploma             @relation(fields: [diplomaId], references: [id], onDelete: Restrict)
  application DiplomaApplication? @relation(fields: [applicationId], references: [id], onDelete: SetNull)

  @@unique([studentId, diplomaId])
  @@index([diplomaId])
}
```

Back-relations: en `User` añadir `studentProfile StudentProfile?`; en `Diploma` añadir `enrollments Enrollment[]`; en `DiplomaApplication` añadir `enrollment Enrollment?`.

- [ ] **Step 2: Sincronizar BD**

Run: `npx prisma db push` (y `npx prisma generate` si no regeneró el cliente).
Expected: cambio aditivo aplicado sin pedir pérdida de datos; si la pidiera, DETENERSE y reportar BLOCKED.

- [ ] **Step 3: Permisos y roles en `src/lib/auth/permissions.ts`**

Al final del array `PERMISSIONS` añadir:

```ts
  {
    key: "enrollments.read",
    name: "Ver matrículas",
    description: "Consultar los estudiantes matriculados en los diplomados",
    category: "Matrículas",
  },
  {
    key: "enrollments.write",
    name: "Gestionar matrículas",
    description: "Matricular estudiantes y cambiar el estado de sus matrículas",
    category: "Matrículas",
  },
  {
    key: "teaching.manage",
    name: "Gestionar mi docencia",
    description:
      "Administrar sesiones, asistencia, evaluaciones, notas y materiales de los módulos asignados como docente",
    category: "Docencia",
  },
  {
    key: "aula.view",
    name: "Acceder a mi aula",
    description: "Ver los cursos, notas, asistencia y trabajos propios como estudiante",
    category: "Aula",
  },
```

En `ROLE_DEFS`:
- Rol `admin`: añadir `"enrollments.read"` y `"enrollments.write"` a sus permissions.
- Rol `docente`: sus permissions pasan a `["diplomas.read", "teaching.manage"]`.
- Rol `viewer`: añadir `"enrollments.read"`.
- Antes de la entrada `reporter`, añadir:

```ts
  {
    key: "estudiante",
    name: "Estudiante",
    description:
      "Estudiante matriculado en un diplomado. Accede a su aula (notas, asistencia, trabajos).",
    system: true,
    permissions: ["aula.view"],
  },
```

(El rol `superadmin` recibe todo automáticamente vía `PERMISSIONS.map`.)

- [ ] **Step 4: Sincronizar roles**

Run: `npx tsx prisma/seed.ts`
Expected: "Sincronizando permisos/roles" sin advertencias de permisos faltantes.

- [ ] **Step 5: Script de verificación**

Create `prisma/verify-enrollments.ts`:

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** Verifica modelos de matrícula y el rol estudiante con sus permisos. */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const role = await prisma.role.findUnique({
    where: { key: "estudiante" },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw new Error("Falta el rol estudiante");
  console.log("Rol:", role.name, role.permissions.map((p) => p.permission.key));

  const docente = await prisma.role.findUnique({
    where: { key: "docente" },
    include: { permissions: { include: { permission: true } } },
  });
  console.log("Docente:", docente?.permissions.map((p) => p.permission.key));

  console.log("Matrículas:", await prisma.enrollment.count());
  console.log("Perfiles de estudiante:", await prisma.studentProfile.count());
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 6: Verificar**

Run: `npx tsx prisma/verify-enrollments.ts`
Expected: `Rol: Estudiante [ 'aula.view' ]`, `Docente: [ 'diplomas.read', 'teaching.manage' ]`, `Matrículas: 0`, `Perfiles de estudiante: 0`.

Run: `npx tsc --noEmit` — sin errores.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/verify-enrollments.ts src/lib/auth/permissions.ts
git commit -m "feat: modelos de matrícula y permisos de la intranet académica"
```

---

### Task 2: Server actions de matrícula

**Files:**
- Create: `src/app/(admin)/matriculas/types.ts`
- Create: `src/app/(admin)/matriculas/actions.ts`

**Interfaces:**
- Consumes: modelos de Task 1; `hashPassword` de `@/lib/auth/password`; `getCurrentUser` de `@/lib/auth/server`.
- Produces (Tasks 3–4 los importan con estos nombres exactos):
  - `enrollFromApplication(applicationId: string): Promise<ActionResult<EnrollOutcome>>`
  - `createManualEnrollment(input: ManualEnrollInput): Promise<ActionResult<EnrollOutcome>>`
  - `setEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus): Promise<ActionResult>`
  - Tipos `ActionResult<T>`, `EnrollmentRow`, `ManualEnrollInput`, `EnrollOutcome`, `EnrollmentStatus`, `EnrollPerms`.

- [ ] **Step 1: `types.ts`**

```ts
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type EnrollmentStatus = "active" | "withdrawn" | "completed";

export type EnrollmentRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  docLabel: string; // "DNI 12345678"
  diplomaId: string;
  diplomaTitle: string;
  origin: "postulacion" | "manual";
  applicationCode: string | null; // código de la postulación de origen
  status: EnrollmentStatus;
  createdAt: string; // ISO
};

export type ManualEnrollInput = {
  name: string;
  email: string;
  password: string; // contraseña temporal elegida por el admin
  docType: "DNI" | "CE" | "PASAPORTE";
  docNumber: string;
  phone?: string;
  diplomaId: string;
};

/** Resultado de una matrícula. tempPassword solo cuando se creó cuenta nueva. */
export type EnrollOutcome = {
  enrollmentId: string;
  studentEmail: string;
  tempPassword: string | null;
};

export type EnrollPerms = { canWrite: boolean };

export type DiplomaOption = { id: string; title: string };
```

- [ ] **Step 2: `actions.ts`**

```ts
"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/server";
import type { PermissionKey } from "@/lib/auth/permissions";
import type {
  ActionResult,
  EnrollOutcome,
  EnrollmentStatus,
  ManualEnrollInput,
} from "./types";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ESTUDIANTE_ROLE_KEY = "estudiante";
const VALID_STATUS: EnrollmentStatus[] = ["active", "withdrawn", "completed"];
const VALID_DOCTYPES = ["DNI", "CE", "PASAPORTE"] as const;

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

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function refresh() {
  revalidatePath("/matriculas");
}

/** Contraseña temporal legible: 12 caracteres sin confusables (sin 0/O/1/l/I). */
function generateTempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

type EnrollTarget = {
  email: string;
  name: string;
  docType: "DNI" | "CE" | "PASAPORTE";
  docNumber: string;
  phone: string | null;
  diplomaId: string;
  applicationId: string | null;
  /** Contraseña a usar SOLO si hay que crear la cuenta. */
  passwordForNewUser: string;
};

/**
 * Núcleo compartido: garantiza usuario + rol estudiante + StudentProfile +
 * Enrollment en una transacción. Nunca cambia la contraseña de un usuario
 * existente.
 */
async function enrollCore(t: EnrollTarget): Promise<ActionResult<EnrollOutcome>> {
  const role = await prisma.role.findUnique({ where: { key: ESTUDIANTE_ROLE_KEY } });
  if (!role) return fail("El rol Estudiante no existe. Ejecuta la semilla de roles.");

  const existing = await prisma.user.findUnique({
    where: { email: t.email },
    include: { studentProfile: true },
  });

  const isNewUser = !existing;
  const passwordHash = isNewUser ? await hashPassword(t.passwordForNewUser) : null;

  try {
    const enrollment = await prisma.$transaction(async (tx) => {
      let userId: string;
      let profileId: string;

      if (!existing) {
        const user = await tx.user.create({
          data: {
            email: t.email,
            name: t.name,
            passwordHash: passwordHash!,
            roles: { create: [{ roleId: role.id }] },
            studentProfile: {
              create: { docType: t.docType, docNumber: t.docNumber, phone: t.phone },
            },
          },
          include: { studentProfile: true },
        });
        userId = user.id;
        profileId = user.studentProfile!.id;
      } else {
        userId = existing.id;
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId: role.id } },
          update: {},
          create: { userId, roleId: role.id },
        });
        if (existing.studentProfile) {
          profileId = existing.studentProfile.id;
        } else {
          const profile = await tx.studentProfile.create({
            data: { userId, docType: t.docType, docNumber: t.docNumber, phone: t.phone },
          });
          profileId = profile.id;
        }
      }

      return tx.enrollment.create({
        data: {
          studentId: profileId,
          diplomaId: t.diplomaId,
          applicationId: t.applicationId,
        },
        select: { id: true },
      });
    });

    refresh();
    return {
      ok: true,
      data: {
        enrollmentId: enrollment.id,
        studentEmail: t.email,
        tempPassword: isNewUser ? t.passwordForNewUser : null,
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Este estudiante ya está matriculado en ese diplomado.");
    }
    throw e;
  }
}

/* ─────────────────────────── enrollFromApplication ─────────────────────────── */

export async function enrollFromApplication(
  applicationId: string,
): Promise<ActionResult<EnrollOutcome>> {
  try {
    await authorize("enrollments.write");

    const app = await prisma.diplomaApplication.findUnique({
      where: { id: applicationId },
      include: { enrollment: { select: { id: true } } },
    });
    if (!app) return fail("Postulación no encontrada.");
    if (app.status !== "accepted") {
      return fail("Solo se puede matricular una postulación aceptada.");
    }
    if (app.enrollment) {
      return fail("Esta postulación ya generó una matrícula.");
    }

    const result = await enrollCore({
      email: app.email.trim().toLowerCase(),
      name: `${app.firstName} ${app.lastName}`.trim(),
      docType: app.docType,
      docNumber: app.docNumber,
      phone: app.phone || null,
      diplomaId: app.diplomaId,
      applicationId: app.id,
      passwordForNewUser: generateTempPassword(),
    });

    if (result.ok) revalidatePath(`/postulaciones/${applicationId}`);
    return result;
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("enrollFromApplication", e);
    return fail("No se pudo matricular al postulante.");
  }
}

/* ─────────────────────────── createManualEnrollment ─────────────────────────── */

export async function createManualEnrollment(
  input: ManualEnrollInput,
): Promise<ActionResult<EnrollOutcome>> {
  try {
    await authorize("enrollments.write");

    const name = (input.name ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();
    const password = input.password ?? "";
    const docNumber = (input.docNumber ?? "").trim();

    const fieldErrors: Record<string, string> = {};
    if (name.length < 2) fieldErrors.name = "El nombre es obligatorio.";
    if (!EMAIL_RE.test(email)) fieldErrors.email = "Correo no válido.";
    if (!VALID_DOCTYPES.includes(input.docType)) fieldErrors.docType = "Tipo no válido.";
    if (docNumber.length < 6 || docNumber.length > 20) {
      fieldErrors.docNumber = "Número de documento no válido.";
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser && password.length < 6) {
      fieldErrors.password = "La contraseña debe tener al menos 6 caracteres.";
    }
    const diploma = await prisma.diploma.findUnique({
      where: { id: input.diplomaId },
      select: { id: true },
    });
    if (!diploma) fieldErrors.diplomaId = "Selecciona un diplomado.";
    if (Object.keys(fieldErrors).length > 0) {
      return fail("Revisa los campos marcados.", fieldErrors);
    }

    return await enrollCore({
      email,
      name,
      docType: input.docType,
      docNumber,
      phone: (input.phone ?? "").trim() || null,
      diplomaId: input.diplomaId,
      applicationId: null,
      passwordForNewUser: password,
    });
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("createManualEnrollment", e);
    return fail("No se pudo crear la matrícula.");
  }
}

/* ─────────────────────────── setEnrollmentStatus ─────────────────────────── */

export async function setEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus,
): Promise<ActionResult> {
  try {
    await authorize("enrollments.write");
    if (!VALID_STATUS.includes(status)) return fail("Estado no válido.");

    const updated = await prisma.enrollment
      .update({ where: { id: enrollmentId }, data: { status } })
      .catch(() => null);
    if (!updated) return fail("Matrícula no encontrada.");
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("setEnrollmentStatus", e);
    return fail("No se pudo cambiar el estado de la matrícula.");
  }
}
```

- [ ] **Step 3: Verificar tipos y flujo con la BD**

Run: `npx tsc --noEmit` y `npx eslint "src/app/(admin)/matriculas/"` — sin errores.

Prueba de humo del núcleo con tsx (crear un archivo temporal `prisma/tmp-verify-enroll.ts`, ejecutarlo y borrarlo; NO commitearlo):

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Simula el núcleo: crea estudiante+matrícula manual sobre el diplomado de
// prueba y verifica la restricción de duplicado; limpia al final.
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const diploma = await prisma.diploma.findUnique({ where: { slug: "prueba-editor" } });
  const role = await prisma.role.findUnique({ where: { key: "estudiante" } });
  if (!diploma || !role) throw new Error("faltan diploma de prueba o rol");

  const email = "verify.alumno@unamad.edu.pe";
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      email,
      name: "Alumno Verificación",
      passwordHash: "x",
      roles: { create: [{ roleId: role.id }] },
      studentProfile: { create: { docType: "DNI", docNumber: "99887766" } },
    },
    include: { studentProfile: true },
  });
  const e1 = await prisma.enrollment.create({
    data: { studentId: user.studentProfile!.id, diplomaId: diploma.id },
  });
  console.log("matrícula creada:", e1.id, e1.status);

  const dup = await prisma.enrollment
    .create({ data: { studentId: user.studentProfile!.id, diplomaId: diploma.id } })
    .then(() => "SIN ERROR (mal)")
    .catch(() => "duplicado bloqueado (bien)");
  console.log(dup);

  await prisma.user.deleteMany({ where: { email } });
  console.log("matrículas restantes del alumno:", await prisma.enrollment.count({ where: { id: e1.id } }), "(esperado 0, cascade)");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Expected: crea la matrícula `active`, bloquea el duplicado, y el borrado en cascada la elimina.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/matriculas/types.ts" "src/app/(admin)/matriculas/actions.ts"
git commit -m "feat: server actions de matrícula (postulación, manual, estado)"
```

---

### Task 3: Página `/matriculas` + sidebar

**Files:**
- Create: `src/app/(admin)/matriculas/page.tsx`
- Create: `src/app/(admin)/matriculas/MatriculasView.tsx`
- Create: `src/app/(admin)/matriculas/ManualEnrollModal.tsx`
- Modify: `src/components/admin/data.ts` (ítem de sidebar)

**Interfaces:**
- Consumes: actions y tipos de Task 2; `Icon`, `useEscClose`, clases CSS globales.
- Produces: página navegable `/matriculas` (ver con `enrollments.read`, escribir con `enrollments.write`).

- [ ] **Step 1: Sidebar**

En `SIDEBAR_NAV` de `src/components/admin/data.ts`, tras la entrada `postulaciones`:

```ts
  { id: "matriculas", label: "Matrículas", icon: "folder", href: "/matriculas", perm: "enrollments.read" },
```

- [ ] **Step 2: `page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { MatriculasView } from "./MatriculasView";
import type { DiplomaOption, EnrollmentRow } from "./types";
import "../usuarios/users.css";

export const metadata = { title: "Matrículas · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePermission("enrollments.read");

  const [enrollments, diplomas] = await Promise.all([
    prisma.enrollment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        diploma: { select: { id: true, title: true } },
        application: { select: { code: true } },
      },
    }),
    prisma.diploma.findMany({
      orderBy: [{ featured: "desc" }, { order: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  const rows: EnrollmentRow[] = enrollments.map((e) => ({
    id: e.id,
    studentName: e.student.user.name,
    studentEmail: e.student.user.email,
    docLabel: `${e.student.docType} ${e.student.docNumber}`,
    diplomaId: e.diploma.id,
    diplomaTitle: e.diploma.title,
    origin: e.applicationId ? "postulacion" : "manual",
    applicationCode: e.application?.code ?? null,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
  }));

  const diplomaOptions: DiplomaOption[] = diplomas.map((d) => ({ id: d.id, title: d.title }));

  return (
    <MatriculasView
      rows={rows}
      diplomas={diplomaOptions}
      perms={{ canWrite: me.permissions.has("enrollments.write") }}
    />
  );
}
```

- [ ] **Step 3: `ManualEnrollModal.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/admin/Icon";
import { useEscClose } from "@/lib/ui/useEscClose";
import type { ActionResult, DiplomaOption, EnrollOutcome, ManualEnrollInput } from "./types";

type Props = {
  diplomas: DiplomaOption[];
  onClose: () => void;
  onSubmit: (input: ManualEnrollInput) => Promise<ActionResult<EnrollOutcome>>;
};

export function ManualEnrollModal({ diplomas, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [docType, setDocType] = useState<ManualEnrollInput["docType"]>("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [diplomaId, setDiplomaId] = useState(diplomas[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [done, setDone] = useState<EnrollOutcome | null>(null);

  useEscClose(true, onClose, submitting);

  const valid =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    docNumber.trim().length >= 6 &&
    diplomaId !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setTopError(null);
    setFieldErrors({});
    const res = await onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      docType,
      docNumber: docNumber.trim(),
      phone: phone.trim() || undefined,
      diplomaId,
    });
    setSubmitting(false);
    if (!res.ok) {
      setTopError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }
    setDone(res.data!);
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <div className="modal-backdrop" onClick={done ? onClose : undefined}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <h2>{done ? "Matrícula creada" : "Matrícula manual"}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </header>

        {done ? (
          <div className="modal__body">
            <p className="modal__intro">
              El estudiante <b>{done.studentEmail}</b> quedó matriculado.
            </p>
            {done.tempPassword ? (
              <div className="banner">
                <span className="banner__icon">
                  <Icon name="lock" size={18} />
                </span>
                <p>
                  Contraseña temporal: <code>{done.tempPassword}</code>
                  <br />
                  Guárdala ahora — no se volverá a mostrar.
                </p>
              </div>
            ) : (
              <p className="modal__intro">
                El correo ya tenía cuenta; su contraseña no cambió.
              </p>
            )}
            <footer className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Entendido
              </button>
            </footer>
          </div>
        ) : (
          <>
            <div className="modal__body">
              {topError && (
                <div className="login__error" role="alert" style={{ marginBottom: 16 }}>
                  <Icon name="info" size={16} />
                  <span>{topError}</span>
                </div>
              )}
              <label className="field">
                <span className="field__label">Nombre completo<span className="field__req">*</span></span>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
                {err("name")}
              </label>
              <label className="field">
                <span className="field__label">Correo<span className="field__req">*</span></span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email} />
                {err("email")}
              </label>
              <label className="field">
                <span className="field__label">Contraseña inicial (solo si el correo no tiene cuenta)</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                />
                {err("password")}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field__label">Tipo doc.</span>
                  <select value={docType} onChange={(e) => setDocType(e.target.value as ManualEnrollInput["docType"]) }>
                    <option value="DNI">DNI</option>
                    <option value="CE">CE</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Nº de documento<span className="field__req">*</span></span>
                  <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} aria-invalid={!!fieldErrors.docNumber} />
                  {err("docNumber")}
                </label>
              </div>
              <label className="field">
                <span className="field__label">Teléfono</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Diplomado<span className="field__req">*</span></span>
                <select value={diplomaId} onChange={(e) => setDiplomaId(e.target.value)} aria-invalid={!!fieldErrors.diplomaId}>
                  {diplomas.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
                {err("diplomaId")}
              </label>
            </div>
            <footer className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={!valid || submitting}>
                {submitting ? "Matriculando…" : "Matricular"}
              </button>
            </footer>
          </>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 4: `MatriculasView.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { createManualEnrollment, setEnrollmentStatus } from "./actions";
import { ManualEnrollModal } from "./ManualEnrollModal";
import type { DiplomaOption, EnrollPerms, EnrollmentRow, EnrollmentStatus } from "./types";

const STATUS_META: Record<EnrollmentStatus, { label: string; badge: string }> = {
  active: { label: "Activa", badge: "badge--green" },
  withdrawn: { label: "Retirada", badge: "badge--amber" },
  completed: { label: "Concluida", badge: "badge--neutral" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function MatriculasView({
  rows,
  diplomas,
  perms,
}: {
  rows: EnrollmentRow[];
  diplomas: DiplomaOption[];
  perms: EnrollPerms;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [fDiploma, setFDiploma] = useState("");
  const [fStatus, setFStatus] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (fDiploma === "" || r.diplomaId === fDiploma) &&
          (fStatus === "" || r.status === fStatus),
      ),
    [rows, fDiploma, fStatus],
  );

  const changeStatus = (id: string, status: EnrollmentStatus) => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await setEnrollmentStatus(id, status);
      setBusyId(null);
      if (!res.ok) setError(res.error);
    });
  };

  const activas = rows.filter((r) => r.status === "active").length;

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Matrículas</h1>
          <span className="page__sub">
            {rows.length} matrícula{rows.length === 1 ? "" : "s"} · {activas} activa{activas === 1 ? "" : "s"}
          </span>
        </div>
        {perms.canWrite && (
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            <Icon name="plus" size={16} />
            Matrícula manual
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={fDiploma} onChange={(e) => setFDiploma(e.target.value)}>
          <option value="">Todos los diplomados</option>
          {diplomas.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="withdrawn">Retirada</option>
          <option value="completed">Concluida</option>
        </select>
      </div>

      {error && (
        <div className="banner" role="alert" style={{ borderColor: "#f5c2c7" }}>
          <span className="banner__icon" style={{ color: "#d93025" }}>
            <Icon name="alert" size={18} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="folder" size={40} />
            <h3>Sin matrículas</h3>
            <p>Matricula postulantes aceptados desde su postulación, o usa la matrícula manual.</p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Documento</th>
                  <th>Diplomado</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  const isBusy = pending && busyId === r.id;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.studentName}</div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>{r.studentEmail}</div>
                      </td>
                      <td className="dtable__muted">{r.docLabel}</td>
                      <td>{r.diplomaTitle}</td>
                      <td className="dtable__muted">
                        {r.origin === "postulacion" ? (r.applicationCode ?? "Postulación") : "Manual"}
                      </td>
                      <td>
                        <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                      <td className="dtable__muted">{fmtDate(r.createdAt)}</td>
                      <td className="dtable__settings">
                        {perms.canWrite && (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            {r.status === "active" ? (
                              <>
                                <button className="btn btn--ghost" disabled={isBusy} onClick={() => changeStatus(r.id, "withdrawn")}>
                                  {isBusy ? "…" : "Retirar"}
                                </button>
                                <button className="btn btn--ghost" disabled={isBusy} onClick={() => changeStatus(r.id, "completed")}>
                                  {isBusy ? "…" : "Concluir"}
                                </button>
                              </>
                            ) : (
                              <button className="btn btn--ghost" disabled={isBusy} onClick={() => changeStatus(r.id, "active")}>
                                {isBusy ? "…" : "Reactivar"}
                              </button>
                            )}
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

      {showModal && (
        <ManualEnrollModal
          diplomas={diplomas}
          onClose={() => setShowModal(false)}
          onSubmit={createManualEnrollment}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar en navegador**

`npx tsc --noEmit` y lint del área — sin errores. Con sesión admin:
1. `/matriculas` visible en el sidebar; tabla con estado vacío.
2. Matrícula manual sobre el diplomado "Prueba Editor" (correo nuevo) → aparece la contraseña temporal una vez; la fila aparece con origen "Manual".
3. Repetir la misma matrícula → "Este estudiante ya está matriculado en ese diplomado.".
4. Retirar → badge "Retirada"; Reactivar → "Activa"; Concluir → "Concluida".
5. Filtros por diplomado y estado funcionan.
6. Dejar la matrícula de prueba en estado Activa (el subsistema B la usará).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/matriculas" src/components/admin/data.ts
git commit -m "feat: página de matrículas con alta manual y estados"
```

---

### Task 4: Botón "Matricular" en la postulación aceptada + E2E

**Files:**
- Create: `src/app/(admin)/postulaciones/[id]/EnrollPanel.tsx`
- Modify: `src/app/(admin)/postulaciones/[id]/page.tsx` (consulta de matrícula + montar panel)

**Interfaces:**
- Consumes: `enrollFromApplication` y tipos de Task 2.
- Produces: flujo completo postulación aceptada → matrícula.

- [ ] **Step 1: `EnrollPanel.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { enrollFromApplication } from "../../matriculas/actions";
import type { EnrollOutcome } from "../../matriculas/types";

type Props = {
  applicationId: string;
  status: string; // ApplicationStatus
  canEnroll: boolean; // enrollments.write
  existing: { id: string; status: string } | null; // matrícula ya creada
};

export function EnrollPanel({ applicationId, status, canEnroll, existing }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<EnrollOutcome | null>(null);

  if (status !== "accepted") return null;

  const enroll = () => {
    setError(null);
    startTransition(async () => {
      const res = await enrollFromApplication(applicationId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOutcome(res.data!);
    });
  };

  return (
    <section className="ps-card">
      <h2 className="ps-card__title">Matrícula</h2>

      {existing || outcome ? (
        <>
          <p className="ps-empty-note">
            {outcome ? "Matrícula creada correctamente." : "Este postulante ya está matriculado."}
          </p>
          {outcome?.tempPassword && (
            <div className="banner">
              <span className="banner__icon">
                <Icon name="lock" size={18} />
              </span>
              <p>
                Cuenta: <b>{outcome.studentEmail}</b>
                <br />
                Contraseña temporal: <code>{outcome.tempPassword}</code>
                <br />
                Guárdala ahora — no se volverá a mostrar.
              </p>
            </div>
          )}
          <Link href="/matriculas" className="linkbtn">
            <Icon name="external" size={15} />
            Ver matrículas
          </Link>
        </>
      ) : (
        <>
          <p className="ps-empty-note">
            La postulación está aceptada. Al matricular se crea la cuenta del
            estudiante (si no existe) y su matrícula en el diplomado.
          </p>
          {error && (
            <div className="login__error" role="alert" style={{ marginBottom: 10 }}>
              <Icon name="info" size={16} />
              <span>{error}</span>
            </div>
          )}
          {canEnroll && (
            <button className="btn btn--primary" disabled={pending} onClick={enroll}>
              {pending ? "Matriculando…" : "Matricular"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Montarlo en `page.tsx`**

En `src/app/(admin)/postulaciones/[id]/page.tsx`:
1. Import: `import { EnrollPanel } from "./EnrollPanel";`
2. En el `include` del `findUnique`, añadir `enrollment: { select: { id: true, status: true } },`
3. Tras `const canWrite = ...`, añadir `const canEnroll = me.permissions.has("enrollments.write");`
4. En el `<aside className="ps-detail-side">`, ENTRE el bloque de documentos y `<ReviewPanel …/>`, montar:

```tsx
          <EnrollPanel
            applicationId={a.id}
            status={a.status}
            canEnroll={canEnroll}
            existing={a.enrollment}
          />
```

- [ ] **Step 3: Verificación E2E en navegador**

`npx tsc --noEmit` y lint — sin errores. Con sesión admin:
1. Abrir una postulación NO aceptada → el panel "Matrícula" no aparece.
2. Aceptar una postulación (ReviewPanel) → aparece el panel con el botón "Matricular".
3. Matricular → se muestra correo + contraseña temporal (si la cuenta es nueva); anotar ambas en el reporte (dato de prueba para el subsistema B/C).
4. Recargar la página → el panel dice "ya está matriculado" (persistencia del vínculo `applicationId`).
5. En `/matriculas` aparece la fila con origen = código de la postulación.
6. Volver a intentar matricular la misma postulación vía consola/reintento → error "ya generó una matrícula".

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/postulaciones/[id]"
git commit -m "feat: matricular postulantes aceptados desde la postulación"
```

---

## Autorevisión del plan (hecha)

- **Cobertura del spec (subsistema A):** modelos y back-relations (T1), permisos y roles de toda la fase declarados una vez (T1), conversión aceptado→matrícula con contraseña temporal única vez y sin tocar contraseñas existentes (T2/T4), alta manual (T2/T3), página `/matriculas` con filtros y estados (T3), guard de duplicados por `@@unique` (T2), `Diploma` con `onDelete: Restrict` para matrículas (T1).
- **Sin placeholders:** todos los pasos llevan código o comandos concretos.
- **Consistencia de tipos:** `EnrollOutcome`/`ManualEnrollInput`/`EnrollmentRow` definidos en T2 y consumidos tal cual en T3/T4; `enrollCore` privado del módulo actions; el campo `perm` del sidebar ya existe desde el fix de Fase 1.
