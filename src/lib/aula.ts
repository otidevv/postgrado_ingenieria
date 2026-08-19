import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Módulo visto desde el aula del alumno: solo si el usuario tiene una
 * matrícula ACTIVA en el diplomado del módulo. Devuelve también su
 * enrollmentId (todas las lecturas del aula filtran por él).
 */
export async function getAulaModule(moduleId: string, userId: string) {
  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      name: true,
      code: true,
      order: true,
      diplomaId: true,
      diploma: { select: { title: true } },
    },
  });
  if (!mod) return null;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      diplomaId: mod.diplomaId,
      status: "active",
      student: { userId },
    },
    select: { id: true },
  });
  if (!enrollment) return null;

  return { module: mod, enrollmentId: enrollment.id };
}
