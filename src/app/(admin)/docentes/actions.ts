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
