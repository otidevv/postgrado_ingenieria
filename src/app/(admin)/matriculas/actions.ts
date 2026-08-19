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
    if (!existingUser) {
      if (password.length < 6) {
        fieldErrors.password = "La contraseña debe tener al menos 6 caracteres.";
      } else if (password.length > 200) {
        fieldErrors.password = "Contraseña demasiado larga.";
      }
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
