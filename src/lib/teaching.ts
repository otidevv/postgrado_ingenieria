import "server-only";

import { prisma } from "@/lib/prisma";

export type RosterStudent = {
  enrollmentId: string;
  name: string;
  email: string;
};

/** Id del TeacherProfile del usuario, o null si no es docente. */
export async function getMyTeacherProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

/** Módulo SOLO si pertenece al docente (por userId). Null en caso contrario. */
export async function getOwnedModule(moduleId: string, userId: string) {
  const profileId = await getMyTeacherProfileId(userId);
  if (!profileId) return null;
  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      name: true,
      code: true,
      order: true,
      teacherId: true,
      diplomaId: true,
      diploma: { select: { title: true, slug: true } },
    },
  });
  if (!mod || mod.teacherId !== profileId) return null;
  return mod;
}

/** Matrículas ACTIVAS del diplomado, ordenadas por nombre del alumno. */
export async function getActiveRoster(diplomaId: string): Promise<RosterStudent[]> {
  const rows = await prisma.enrollment.findMany({
    where: { diplomaId, status: "active" },
    include: { student: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { student: { user: { name: "asc" } } },
  });
  return rows.map((e) => ({
    enrollmentId: e.id,
    name: e.student.user.name,
    email: e.student.user.email,
  }));
}

/**
 * Promedio ponderado sobre los ítems CALIFICADOS (score ≠ null).
 * Null si no hay ninguno calificado o la suma de pesos calificados es 0.
 */
export { weightedAverage } from "./teaching-client";
