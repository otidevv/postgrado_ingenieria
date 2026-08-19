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

    let previous: { storedPath: string | null } | null = null;
    try {
      previous = await prisma.$transaction(async (tx) => {
        const prev = await tx.submission.findUnique({
          where: {
            assessmentId_enrollmentId: {
              assessmentId,
              enrollmentId: aula.enrollmentId,
            },
          },
          select: { storedPath: true },
        });

        // Re-verifica el Grade dentro de la transacción, inmediatamente antes
        // del upsert: si el docente calificó justo en esta ventana (entre el
        // chequeo de arriba y ahora), bloquea el reemplazo igualmente.
        const gradedNow = await tx.grade.findUnique({
          where: {
            assessmentId_enrollmentId: {
              assessmentId,
              enrollmentId: aula.enrollmentId,
            },
          },
          select: { assessmentId: true },
        });
        if (gradedNow) {
          throw new Error("Esta evaluación ya fue calificada; no se puede reemplazar la entrega.");
        }

        await tx.submission.upsert({
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

        return prev;
      });
    } catch (e) {
      // La transacción falló (incluida la re-verificación de nota concurrente):
      // limpia el archivo recién escrito para no dejar huérfanos en storage/entregas/.
      if (stored) {
        await deleteSubmissionFile(stored.storedPath);
      }
      if (e instanceof Error && e.message.startsWith("Esta evaluación ya fue calificada")) {
        return { ok: false, error: e.message };
      }
      throw e;
    }

    // Limpia el archivo anterior si fue reemplazado (solo tras éxito de la transacción).
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
