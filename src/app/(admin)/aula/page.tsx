import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { AulaHome } from "./AulaHome";

export const metadata = { title: "Mi aula · UNAMAD" };
export const dynamic = "force-dynamic";

export type AulaDiploma = {
  enrollmentId: string;
  diplomaTitle: string;
  modules: Array<{ id: string; order: number; name: string; teacherLabel: string | null }>;
};

export default async function Page() {
  const me = await requirePermission("aula.view");

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "active", student: { userId: me.id } },
    orderBy: { createdAt: "asc" },
    include: {
      diploma: {
        select: {
          title: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              name: true,
              teacher: {
                select: {
                  academicDegree: true,
                  user: { select: { name: true, active: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const rows: AulaDiploma[] = enrollments.map((e) => ({
    enrollmentId: e.id,
    diplomaTitle: e.diploma.title,
    modules: e.diploma.modules.map((m) => ({
      id: m.id,
      order: m.order,
      name: m.name,
      teacherLabel:
        m.teacher && m.teacher.user.active
          ? `${m.teacher.academicDegree} ${m.teacher.user.name}`
          : null,
    })),
  }));

  return <AulaHome rows={rows} />;
}
