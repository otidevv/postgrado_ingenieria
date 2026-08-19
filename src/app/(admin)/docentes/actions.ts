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
const SUPERADMIN_KEY = "superadmin";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fail<T = any>(error: string, fieldErrors?: Record<string, string>): ActionResult<T> {
  return { ok: false, error, fieldErrors } as ActionResult<T>;
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

async function ensureSuperadminRemains(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const remaining = await tx.user.count({
    where: {
      active: true,
      roles: { some: { role: { key: SUPERADMIN_KEY } } },
    },
  });
  if (remaining < 1) {
    throw new Denied(
      "Debe existir al menos un superadministrador activo. Acción cancelada.",
    );
  }
}

// Returns true if `userId` has the superadmin role.
async function isTargetSuper(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: { select: { role: { select: { key: true } } } } },
  });
  return !!u?.roles.some((ur) => ur.role.key === SUPERADMIN_KEY);
}

function meIsSuper(me: CurrentUser): boolean {
  return me.roles.some((r) => r.key === SUPERADMIN_KEY);
}

function isSerializationFailure(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034"
  );
}

/**
 * Run a transaction at Serializable isolation, retrying on write-conflict.
 * Serializable is required for the "≥1 active superadmin" invariant: under the
 * default Read Committed, two concurrent removals each count the other's
 * still-active super and both pass, leaving zero (write skew). Serializable
 * makes Postgres abort one of the conflicting pair instead.
 */
async function serializableTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      if (isSerializationFailure(e)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/* ─────────────────────────────── createTeacher ─────────────────────────────── */

export async function createTeacher(
  input: TeacherInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await authorize("users.write");

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
      // C2: Converting an existing user requires users.assign-roles permission.
      if (!me.permissions.has("users.assign-roles")) {
        return fail("Se requiere permiso para asignar roles.");
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

    // Lateral escalation guard: a non-superadmin cannot suspend/reactivate a superadmin.
    if (profile.userId !== me.id && !meIsSuper(me) && (await isTargetSuper(profile.userId))) {
      return fail(
        "Solo un superadministrador puede modificar el estado de otro superadministrador.",
      );
    }

    await serializableTx(async (tx) => {
      await tx.user.update({
        where: { id: profile.userId },
        data: { active },
      });
      if (!active) await ensureSuperadminRemains(tx);
    });

    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("setTeacherActive", e);
    return fail("No se pudo cambiar el estado del docente.");
  }
}
