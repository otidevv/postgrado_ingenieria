import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getActiveRoster, getOwnedModule } from "@/lib/teaching";
import { Icon } from "@/components/admin/Icon";
import { ModuleWorkspace } from "./ModuleWorkspace";
import type {
  AssessmentRow,
  GradeCell,
  MaterialRow,
  SessionRow,
  SubmissionInfo,
} from "../types";
import "../docencia.css";
import "../../usuarios/users.css";

export const metadata = { title: "Módulo · Mi docencia · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ moduleId: string }> }) {
  const me = await requirePermission("teaching.manage");
  const { moduleId } = await params;

  const owned = await getOwnedModule(moduleId, me.id);
  if (!owned) redirect("/403");

  const [roster, sessions, assessments, materials, grades, submissions] = await Promise.all([
    getActiveRoster(owned.diplomaId),
    prisma.moduleSession.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
      include: { attendance: true },
    }),
    prisma.assessment.findMany({ where: { moduleId }, orderBy: { createdAt: "asc" } }),
    prisma.moduleMaterial.findMany({ where: { moduleId }, orderBy: { order: "asc" } }),
    prisma.grade.findMany({ where: { assessment: { moduleId } } }),
    prisma.submission.findMany({
      where: { assessment: { moduleId } },
      select: {
        enrollmentId: true,
        assessmentId: true,
        fileName: true,
        linkUrl: true,
        submittedAt: true,
      },
    }),
  ]);

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    topic: s.topic,
    order: s.order,
    attendance: Object.fromEntries(s.attendance.map((a) => [a.enrollmentId, a.status])),
  }));

  const assessmentRows: AssessmentRow[] = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    kind: a.kind,
    weight: a.weight,
    dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    allowsSubmission: a.allowsSubmission,
  }));

  const materialRows: MaterialRow[] = materials.map((m) => ({
    id: m.id,
    title: m.title,
    url: m.url,
    order: m.order,
  }));

  // "<enrollmentId>:<assessmentId>" → celda
  const gradeMap: Record<string, GradeCell> = {};
  for (const g of grades) {
    gradeMap[`${g.enrollmentId}:${g.assessmentId}`] = {
      score: Number(g.score),
      feedback: g.feedback,
    };
  }

  const submissionRows: SubmissionInfo[] = submissions.map((s) => ({
    enrollmentId: s.enrollmentId,
    assessmentId: s.assessmentId,
    fileName: s.fileName,
    linkUrl: s.linkUrl,
    submittedAt: s.submittedAt.toISOString(),
  }));

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>{owned.name}</h1>
          <span className="page__sub">
            {owned.code} · {owned.diploma.title} · {roster.length} estudiante
            {roster.length === 1 ? "" : "s"}
          </span>
        </div>
        <Link className="linkbtn" href="/docencia">
          <Icon name="chevron-right" size={15} />
          Mis módulos
        </Link>
      </div>

      <ModuleWorkspace
        moduleId={owned.id}
        roster={roster}
        sessions={sessionRows}
        assessments={assessmentRows}
        materials={materialRows}
        grades={gradeMap}
        submissions={submissionRows}
      />
    </div>
  );
}
