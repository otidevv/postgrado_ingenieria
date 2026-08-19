import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getMyTeacherProfileId } from "@/lib/teaching";
import { DocenciaHome } from "./DocenciaHome";

export const metadata = { title: "Mi docencia · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export type TeachingModuleRow = {
  id: string;
  code: string;
  name: string;
  order: number;
  diplomaTitle: string;
  studentCount: number;
  sessionCount: number;
  assessmentCount: number;
};

export default async function Page() {
  const me = await requirePermission("teaching.manage");
  const profileId = await getMyTeacherProfileId(me.id);

  const modules = profileId
    ? await prisma.diplomaModule.findMany({
        where: { teacherId: profileId },
        orderBy: [{ diploma: { title: "asc" } }, { order: "asc" }],
        include: {
          diploma: {
            select: {
              title: true,
              _count: { select: { enrollments: { where: { status: "active" } } } },
            },
          },
          _count: { select: { sessions: true, assessments: true } },
        },
      })
    : [];

  const rows: TeachingModuleRow[] = modules.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    order: m.order,
    diplomaTitle: m.diploma.title,
    studentCount: m.diploma._count.enrollments,
    sessionCount: m._count.sessions,
    assessmentCount: m._count.assessments,
  }));

  return <DocenciaHome rows={rows} />;
}
