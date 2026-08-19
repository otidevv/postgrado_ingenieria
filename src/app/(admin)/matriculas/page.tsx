import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { MatriculasView } from "./MatriculasView";
import type { DiplomaOption, EnrollmentRow } from "./types";
import "../usuarios/users.css";

export const metadata = { title: "Matrículas · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePermission("enrollments.read");

  const [enrollments, diplomas] = await Promise.all([
    prisma.enrollment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        diploma: { select: { id: true, title: true } },
        application: { select: { code: true } },
      },
    }),
    prisma.diploma.findMany({
      orderBy: [{ featured: "desc" }, { order: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  const rows: EnrollmentRow[] = enrollments.map((e) => ({
    id: e.id,
    studentName: e.student.user.name,
    studentEmail: e.student.user.email,
    docLabel: `${e.student.docType} ${e.student.docNumber}`,
    diplomaId: e.diploma.id,
    diplomaTitle: e.diploma.title,
    origin: e.applicationId ? "postulacion" : "manual",
    applicationCode: e.application?.code ?? null,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
  }));

  const diplomaOptions: DiplomaOption[] = diplomas.map((d) => ({ id: d.id, title: d.title }));

  return (
    <MatriculasView
      rows={rows}
      diplomas={diplomaOptions}
      perms={{ canWrite: me.permissions.has("enrollments.write") }}
    />
  );
}
