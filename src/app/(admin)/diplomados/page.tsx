import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { DiplomasView } from "./DiplomasView";
import type { DiplomaRow } from "./types";

export const metadata = { title: "Diplomados · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePermission("diplomas.read");

  const diplomas = await prisma.diploma.findMany({
    orderBy: [{ featured: "desc" }, { order: "asc" }, { title: "asc" }],
    include: { _count: { select: { modules: true } } },
  });

  const rows: DiplomaRow[] = diplomas.map((d) => ({
    id: d.id,
    slug: d.slug,
    code: d.code,
    title: d.title,
    subtitle: d.subtitle,
    status: d.status,
    featured: d.featured,
    moduleCount: d._count.modules,
    totalHours: d.totalHours,
    credits: d.credits,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return (
    <DiplomasView rows={rows} perms={{ canWrite: me.permissions.has("diplomas.write") }} />
  );
}
