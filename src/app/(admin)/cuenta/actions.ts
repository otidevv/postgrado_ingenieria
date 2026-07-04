"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/server";
import type { ActionResult } from "./types";

const PASSWORD_MIN = 6;
const PASSWORD_MAX = 200;

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}
function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

/**
 * Change the CURRENT user's own password. Requires the current password,
 * then rotates the hash and revokes every OTHER session (keeps this one).
 */
export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<{ sessionsRevoked: number }>> {
  try {
    const me = await getCurrentUser();
    if (!me) return fail("No autenticado.");

    const current = input.currentPassword ?? "";
    const next = input.newPassword ?? "";

    const fieldErrors: Record<string, string> = {};
    if (!current) fieldErrors.currentPassword = "Ingresa tu contraseña actual.";
    if (next.length < PASSWORD_MIN)
      fieldErrors.newPassword = `Mínimo ${PASSWORD_MIN} caracteres.`;
    else if (next.length > PASSWORD_MAX)
      fieldErrors.newPassword = "Contraseña demasiado larga.";
    if (Object.keys(fieldErrors).length > 0)
      return fail("Revisa los campos marcados.", fieldErrors);

    const row = await prisma.user.findUnique({
      where: { id: me.id },
      select: { passwordHash: true },
    });
    if (!row) return fail("Usuario no encontrado.");

    const valid = await verifyPassword(current, row.passwordHash);
    if (!valid)
      return fail("La contraseña actual no es correcta.", {
        currentPassword: "Contraseña incorrecta.",
      });

    if (await verifyPassword(next, row.passwordHash))
      return fail("La nueva contraseña debe ser distinta a la actual.", {
        newPassword: "Debe ser diferente.",
      });

    const passwordHash = await hashPassword(next);

    // Rotate + invalidate every OTHER session, preserving the current one so
    // the user isn't logged out mid-flow.
    const revoked = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: me.id }, data: { passwordHash } });
      const purged = await tx.session.deleteMany({
        where: {
          userId: me.id,
          NOT: { id: me.sessionId },
          expiresAt: { gt: new Date() },
        },
      });
      return purged.count;
    });

    revalidatePath("/cuenta");
    return ok({ sessionsRevoked: revoked });
  } catch (e) {
    console.error("changeOwnPassword", e);
    return fail("No se pudo cambiar la contraseña.");
  }
}

/** Revoke a single session belonging to the current user (not the current one). */
export async function revokeOwnSession(sessionId: string): Promise<ActionResult> {
  try {
    const me = await getCurrentUser();
    if (!me) return fail("No autenticado.");
    if (sessionId === me.sessionId)
      return fail("No puedes cerrar tu sesión actual desde aquí; usa «Cerrar sesión».");

    await prisma.session.deleteMany({
      where: { id: sessionId, userId: me.id },
    });
    revalidatePath("/cuenta");
    return ok();
  } catch (e) {
    console.error("revokeOwnSession", e);
    return fail("No se pudo cerrar la sesión.");
  }
}

/** Revoke ALL other sessions for the current user. */
export async function revokeOtherSessions(): Promise<ActionResult<{ count: number }>> {
  try {
    const me = await getCurrentUser();
    if (!me) return fail("No autenticado.");

    const result = await prisma.session.deleteMany({
      where: {
        userId: me.id,
        NOT: { id: me.sessionId },
        expiresAt: { gt: new Date() },
      },
    });
    revalidatePath("/cuenta");
    return ok({ count: result.count });
  } catch (e) {
    console.error("revokeOtherSessions", e);
    return fail("No se pudieron cerrar las sesiones.");
  }
}
