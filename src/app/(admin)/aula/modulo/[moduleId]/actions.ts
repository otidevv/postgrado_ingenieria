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
