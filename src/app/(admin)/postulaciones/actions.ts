"use server";

import { revalidatePath } from "next/cache";
import { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { APPLICATION_STATUS } from "@/lib/applications";
import type { ActionResult } from "./types";

const VALID_STATUS = APPLICATION_STATUS.map((s) => s.value) as string[];

/** Cambia el estado de una postulación. Requiere applications.write. */
export async function setApplicationStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("applications.write")) {
    return { ok: false, error: "No tienes permiso para gestionar postulaciones." };
  }
  if (!VALID_STATUS.includes(status)) {
    return { ok: false, error: "Estado inválido." };
  }

  const updated = await prisma.diplomaApplication
    .update({
      where: { id },
      data: {
        status: status as $Enums.ApplicationStatus,
        reviewedById: me.id,
        reviewedAt: new Date(),
      },
      select: { id: true },
    })
    .catch(() => null);

  if (!updated) return { ok: false, error: "No se pudo actualizar la postulación." };

  revalidatePath("/postulaciones");
  revalidatePath(`/postulaciones/${id}`);
  return { ok: true };
}

/** Guarda la nota interna de revisión. Requiere applications.write. */
export async function saveReviewNote(
  id: string,
  note: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("applications.write")) {
    return { ok: false, error: "No tienes permiso para gestionar postulaciones." };
  }

  const clean = note.trim().slice(0, 2000);
  const updated = await prisma.diplomaApplication
    .update({
      where: { id },
      data: {
        reviewNote: clean.length ? clean : null,
        reviewedById: me.id,
        reviewedAt: new Date(),
      },
      select: { id: true },
    })
    .catch(() => null);

  if (!updated) return { ok: false, error: "No se pudo guardar la nota." };

  revalidatePath(`/postulaciones/${id}`);
  return { ok: true };
}
