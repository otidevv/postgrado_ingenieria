import "server-only";

import { prisma } from "@/lib/prisma";

export type DiplomaCard = {
  slug: string;
  code: string;
  title: string;
  subtitle: string | null;
  summary: string;
  modality: string;
  totalHours: number;
  credits: number;
  moduleCount: number;
  admissionLabel: string | null;
};

/** Diplomados publicados para la landing, ordenados (destacados primero). */
export async function getPublishedDiplomas(): Promise<DiplomaCard[]> {
  const rows = await prisma.diploma.findMany({
    where: { status: "published" },
    orderBy: [{ featured: "desc" }, { order: "asc" }, { title: "asc" }],
    include: { _count: { select: { modules: true } } },
  });

  return rows.map((d) => ({
    slug: d.slug,
    code: d.code,
    title: d.title,
    subtitle: d.subtitle,
    summary: d.summary,
    modality: d.modality,
    totalHours: d.totalHours,
    credits: d.credits,
    moduleCount: d._count.modules,
    admissionLabel: d.admissionLabel,
  }));
}

/** Diplomado publicado por slug, con sus módulos ordenados. Null si no existe. */
export async function getPublishedDiplomaBySlug(slug: string) {
  return prisma.diploma.findFirst({
    where: { slug, status: "published" },
    include: { modules: { orderBy: { order: "asc" } } },
  });
}
