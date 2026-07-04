"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import type { ActionResult, DiplomaStatus } from "./types";

const VALID: DiplomaStatus[] = ["draft", "published", "closed"];

/** Cambia el estado (visibilidad pública) de un diplomado. Requiere diplomas.write. */
export async function setDiplomaStatus(
  id: string,
  status: DiplomaStatus,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }
  if (!VALID.includes(status)) {
    return { ok: false, error: "Estado inválido." };
  }

  const updated = await prisma.diploma
    .update({ where: { id }, data: { status }, select: { slug: true } })
    .catch(() => null);

  if (!updated) return { ok: false, error: "No se pudo actualizar el diplomado." };

  // Refresca el panel y las vistas públicas afectadas.
  revalidatePath("/diplomados");
  revalidatePath("/");
  revalidatePath(`/diplomado/${updated.slug}`);
  return { ok: true };
}
