"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getOwnedModule } from "@/lib/teaching";
import type { ActionResult, AssessmentKind, AttendanceStatus } from "../types";

const ATTENDANCE: AttendanceStatus[] = ["presente", "tardanza", "falta", "justificada"];

type OwnedModule = NonNullable<Awaited<ReturnType<typeof getOwnedModule>>>;

/**
 * Autoriza teaching.manage + propiedad del módulo. Devuelve el módulo o un
 * ActionResult de error listo para retornar.
 */
async function authorizeOwnedModule(
  moduleId: string,
): Promise<{ ok: true; module: OwnedModule } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "No autenticado." };
  if (!me.permissions.has("teaching.manage")) {
    return { ok: false, error: "No tienes permisos de docencia." };
  }
  const mod = await getOwnedModule(moduleId, me.id);
  if (!mod) return { ok: false, error: "Este módulo no está a tu cargo." };
  return { ok: true, module: mod };
}

function refresh(moduleId: string) {
  revalidatePath(`/docencia/${moduleId}`);
  revalidatePath("/docencia");
}

/* ─────────────────────────────── sesiones ─────────────────────────────── */

export async function saveSession(
  moduleId: string,
  input: { id: string | null; date: string; topic: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const topic = (input.topic ?? "").trim();
    const date = new Date(input.date ?? "");
    const fieldErrors: Record<string, string> = {};
    if (topic.length < 2 || topic.length > 300) fieldErrors.topic = "Indica el tema de la sesión.";
    if (Number.isNaN(date.getTime())) fieldErrors.date = "Fecha no válida.";
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }

    let id: string;
    if (input.id) {
      const updated = await prisma.moduleSession.updateMany({
        where: { id: input.id, moduleId },
        data: { date, topic },
      });
      if (updated.count === 0) return { ok: false, error: "Sesión no encontrada." };
      id = input.id;
    } else {
      const created = await prisma.$transaction(
        async (tx) => {
          const count = await tx.moduleSession.count({ where: { moduleId } });
          return tx.moduleSession.create({
            data: { moduleId, date, topic, order: count + 1 },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      id = created.id;
    }
    refresh(moduleId);
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("saveSession", e);
    return { ok: false, error: "No se pudo guardar la sesión." };
  }
}

export async function deleteSession(
  moduleId: string,
  sessionId: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const session = await prisma.moduleSession.findFirst({
      where: { id: sessionId, moduleId },
      select: { id: true, order: true },
    });
    if (!session) return { ok: false, error: "Sesión no encontrada." };

    await prisma.$transaction(async (tx) => {
      await tx.moduleSession.delete({ where: { id: session.id } });
      await tx.moduleSession.updateMany({
        where: { moduleId, order: { gt: session.order } },
        data: { order: { decrement: 1 } },
      });
    });
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("deleteSession", e);
    return { ok: false, error: "No se pudo eliminar la sesión." };
  }
}

/* ─────────────────────────────── asistencia ─────────────────────────────── */

export async function saveAttendance(
  moduleId: string,
  sessionId: string,
  records: Array<{ enrollmentId: string; status: AttendanceStatus }>,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const session = await prisma.moduleSession.findFirst({
      where: { id: sessionId, moduleId },
      select: { id: true },
    });
    if (!session) return { ok: false, error: "Sesión no encontrada." };

    const clean = (Array.isArray(records) ? records : []).filter(
      (r) => typeof r?.enrollmentId === "string" && ATTENDANCE.includes(r?.status),
    );

    // Roster activo del diplomado del módulo (lista completa esperada por el cliente).
    const roster = await prisma.enrollment.findMany({
      where: { diplomaId: auth.module.diplomaId, status: "active" },
      select: { id: true },
    });
    const rosterSet = new Set(roster.map((v) => v.id));
    const toSave = clean.filter((r) => rosterSet.has(r.enrollmentId));

    // Cualquier miembro del roster activo que no venga en `records` queda
    // "sin registrar": se borra su AttendanceRecord (si existía) para esta sesión.
    const savedSet = new Set(toSave.map((r) => r.enrollmentId));
    const toDelete = [...rosterSet].filter((id) => !savedSet.has(id));

    await prisma.$transaction([
      ...toSave.map((r) =>
        prisma.attendanceRecord.upsert({
          where: {
            sessionId_enrollmentId: { sessionId, enrollmentId: r.enrollmentId },
          },
          update: { status: r.status },
          create: { sessionId, enrollmentId: r.enrollmentId, status: r.status },
        }),
      ),
      prisma.attendanceRecord.deleteMany({
        where: { sessionId, enrollmentId: { in: toDelete } },
      }),
    ]);
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("saveAttendance", e);
    return { ok: false, error: "No se pudo guardar la asistencia." };
  }
}

/* ─────────────────────────────── evaluaciones ─────────────────────────────── */

const KINDS: AssessmentKind[] = ["tarea", "trabajo", "examen", "participacion"];

export async function saveAssessment(
  moduleId: string,
  input: {
    id: string | null;
    title: string;
    description: string;
    kind: AssessmentKind;
    weight: number;
    dueDate: string; // "" = sin fecha
    allowsSubmission: boolean;
  },
): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const title = (input.title ?? "").trim();
    const fieldErrors: Record<string, string> = {};
    if (title.length < 2 || title.length > 200) fieldErrors.title = "Indica el título.";
    if (!KINDS.includes(input.kind)) fieldErrors.kind = "Tipo no válido.";
    if (!Number.isInteger(input.weight) || input.weight < 0 || input.weight > 100) {
      fieldErrors.weight = "Peso entero entre 0 y 100.";
    }
    let dueDate: Date | null = null;
    if ((input.dueDate ?? "").trim() !== "") {
      dueDate = new Date(input.dueDate);
      if (Number.isNaN(dueDate.getTime())) fieldErrors.dueDate = "Fecha no válida.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }

    const data = {
      title,
      description: (input.description ?? "").trim() || null,
      kind: input.kind,
      weight: input.weight,
      dueDate,
      allowsSubmission: input.allowsSubmission === true,
    };

    let id: string;
    if (input.id) {
      const updated = await prisma.assessment.updateMany({
        where: { id: input.id, moduleId },
        data,
      });
      if (updated.count === 0) return { ok: false, error: "Evaluación no encontrada." };
      id = input.id;
    } else {
      const created = await prisma.assessment.create({
        data: { ...data, moduleId },
        select: { id: true },
      });
      id = created.id;
    }
    refresh(moduleId);
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("saveAssessment", e);
    return { ok: false, error: "No se pudo guardar la evaluación." };
  }
}

export async function deleteAssessment(
  moduleId: string,
  assessmentId: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const deleted = await prisma.assessment.deleteMany({
      where: { id: assessmentId, moduleId },
    });
    if (deleted.count === 0) return { ok: false, error: "Evaluación no encontrada." };
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("deleteAssessment", e);
    return { ok: false, error: "No se pudo eliminar la evaluación." };
  }
}

/* ─────────────────────────────── notas ─────────────────────────────── */

export async function saveGrade(
  moduleId: string,
  assessmentId: string,
  enrollmentId: string,
  score: number | null,
  feedback: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, moduleId },
      select: { id: true },
    });
    if (!assessment) return { ok: false, error: "Evaluación no encontrada." };

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, diplomaId: auth.module.diplomaId, status: "active" },
      select: { id: true },
    });
    if (!enrollment) {
      return { ok: false, error: "La matrícula no está activa en este diplomado." };
    }

    if (score === null) {
      await prisma.grade.deleteMany({ where: { assessmentId, enrollmentId } });
      refresh(moduleId);
      return { ok: true };
    }

    const rounded = Math.round(score * 100) / 100;
    if (Number.isNaN(rounded) || rounded < 0 || rounded > 20) {
      return { ok: false, error: "La nota debe estar entre 0 y 20." };
    }

    await prisma.grade.upsert({
      where: { assessmentId_enrollmentId: { assessmentId, enrollmentId } },
      update: { score: rounded, feedback: feedback.trim() || null, gradedAt: new Date() },
      create: {
        assessmentId,
        enrollmentId,
        score: rounded,
        feedback: feedback.trim() || null,
      },
    });
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("saveGrade", e);
    return { ok: false, error: "No se pudo guardar la nota." };
  }
}

/* ─────────────────────────────── materiales ─────────────────────────────── */

export async function saveMaterial(
  moduleId: string,
  input: { id: string | null; title: string; url: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const title = (input.title ?? "").trim();
    const url = (input.url ?? "").trim();
    const fieldErrors: Record<string, string> = {};
    if (title.length < 2 || title.length > 200) fieldErrors.title = "Indica el título.";
    if (!/^https?:\/\/.+/.test(url)) fieldErrors.url = "Debe ser una URL http(s) válida.";
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }

    let id: string;
    if (input.id) {
      const updated = await prisma.moduleMaterial.updateMany({
        where: { id: input.id, moduleId },
        data: { title, url },
      });
      if (updated.count === 0) return { ok: false, error: "Material no encontrado." };
      id = input.id;
    } else {
      const created = await prisma.$transaction(
        async (tx) => {
          const count = await tx.moduleMaterial.count({ where: { moduleId } });
          return tx.moduleMaterial.create({
            data: { moduleId, title, url, order: count + 1 },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      id = created.id;
    }
    refresh(moduleId);
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("saveMaterial", e);
    return { ok: false, error: "No se pudo guardar el material." };
  }
}

export async function moveMaterial(
  moduleId: string,
  materialId: string,
  dir: "up" | "down",
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const material = await prisma.moduleMaterial.findFirst({
      where: { id: materialId, moduleId },
      select: { id: true, order: true },
    });
    if (!material) return { ok: false, error: "Material no encontrado." };

    const targetOrder = dir === "up" ? material.order - 1 : material.order + 1;
    const neighbor = await prisma.moduleMaterial.findFirst({
      where: { moduleId, order: targetOrder },
      select: { id: true },
    });
    if (!neighbor) return { ok: true }; // ya está en el extremo

    await prisma.$transaction([
      prisma.moduleMaterial.update({ where: { id: neighbor.id }, data: { order: material.order } }),
      prisma.moduleMaterial.update({ where: { id: material.id }, data: { order: targetOrder } }),
    ]);
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("moveMaterial", e);
    return { ok: false, error: "No se pudo mover el material." };
  }
}

export async function deleteMaterial(
  moduleId: string,
  materialId: string,
): Promise<ActionResult> {
  try {
    const auth = await authorizeOwnedModule(moduleId);
    if (!auth.ok) return auth;

    const material = await prisma.moduleMaterial.findFirst({
      where: { id: materialId, moduleId },
      select: { id: true, order: true },
    });
    if (!material) return { ok: false, error: "Material no encontrado." };

    await prisma.$transaction(async (tx) => {
      await tx.moduleMaterial.delete({ where: { id: material.id } });
      await tx.moduleMaterial.updateMany({
        where: { moduleId, order: { gt: material.order } },
        data: { order: { decrement: 1 } },
      });
    });
    refresh(moduleId);
    return { ok: true };
  } catch (e) {
    console.error("deleteMaterial", e);
    return { ok: false, error: "No se pudo eliminar el material." };
  }
}
