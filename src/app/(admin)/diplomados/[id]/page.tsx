import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { DiplomaEditor } from "./DiplomaEditor";
import type { EditorDiploma, EditorModule, TeacherOption } from "./types";
import "../../usuarios/users.css";
import "./editor.css";

export const metadata = { title: "Editar diplomado · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("diplomas.read");
  const { id } = await params;

  const d = await prisma.diploma.findUnique({
    where: { id },
    include: { modules: { orderBy: { order: "asc" } } },
  });
  if (!d) notFound();

  const teachers = await prisma.teacherProfile.findMany({
    where: { user: { active: true } },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const diploma: EditorDiploma = {
    id: d.id,
    slug: d.slug,
    code: d.code,
    title: d.title,
    subtitle: d.subtitle,
    faculty: d.faculty,
    summary: d.summary,
    description: d.description,
    objective: d.objective,
    status: d.status,
    modality: d.modality,
    schedule: d.schedule,
    admissionLabel: d.admissionLabel,
    featured: d.featured,
    order: d.order,
    totalHours: d.totalHours,
    credits: d.credits,
    weeksPerModule: d.weeksPerModule,
    minEnrollment: d.minEnrollment,
    enrollmentFee: d.enrollmentFee,
    moduleFee: d.moduleFee,
    certificationFee: d.certificationFee,
    objectives: d.objectives,
    requirements: d.requirements,
    graduateProfile: d.graduateProfile,
  };

  const modules: EditorModule[] = d.modules.map((m) => ({
    id: m.id,
    code: m.code,
    order: m.order,
    name: m.name,
    syncHours: m.syncHours,
    asyncHours: m.asyncHours,
    totalHours: m.totalHours,
    credits: m.credits,
    summary: m.summary,
    topics: m.topics,
    teacherId: m.teacherId,
  }));

  const teacherOptions: TeacherOption[] = teachers.map((t) => ({
    id: t.id,
    label: `${t.academicDegree} ${t.user.name}`,
  }));

  return (
    <DiplomaEditor
      diploma={diploma}
      modules={modules}
      teachers={teacherOptions}
      perms={{ canWrite: me.permissions.has("diplomas.write") }}
    />
  );
}
