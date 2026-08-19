import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getAulaModule } from "@/lib/aula";
import { weightedAverage } from "@/lib/teaching-client";
import { Icon } from "@/components/admin/Icon";
import { AulaModule, type AulaData } from "./AulaModule";
import "../../aula.css";
import "../../../usuarios/users.css";

export const metadata = { title: "Módulo · Mi aula · UNAMAD" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ moduleId: string }> }) {
  const me = await requirePermission("aula.view");
  const { moduleId } = await params;

  const aula = await getAulaModule(moduleId, me.id);
  if (!aula) redirect("/403");
  const { module: mod, enrollmentId } = aula;

  const [sessions, assessments, materials, grades, submissions] = await Promise.all([
    prisma.moduleSession.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
      include: { attendance: { where: { enrollmentId } } },
    }),
    prisma.assessment.findMany({ where: { moduleId }, orderBy: { createdAt: "asc" } }),
    prisma.moduleMaterial.findMany({ where: { moduleId }, orderBy: { order: "asc" } }),
    prisma.grade.findMany({ where: { enrollmentId, assessment: { moduleId } } }),
    prisma.submission.findMany({ where: { enrollmentId, assessment: { moduleId } } }),
  ]);

  const gradeByAssessment = new Map(grades.map((g) => [g.assessmentId, g]));
  const subByAssessment = new Map(submissions.map((s) => [s.assessmentId, s]));

  const data: AulaData = {
    moduleId: mod.id,
    moduleName: mod.name,
    diplomaTitle: mod.diploma.title,
    sessions: sessions.map((s) => ({
      order: s.order,
      date: s.date.toISOString(),
      topic: s.topic,
      status: s.attendance[0]?.status ?? null,
    })),
    materials: materials.map((m) => ({ id: m.id, title: m.title, url: m.url })),
    assessments: assessments.map((a) => {
      const g = gradeByAssessment.get(a.id);
      const s = subByAssessment.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        kind: a.kind,
        weight: a.weight,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        allowsSubmission: a.allowsSubmission,
        score: g ? Number(g.score) : null,
        feedback: g?.feedback ?? null,
        submission: s
          ? {
              id: s.id,
              fileName: s.fileName,
              linkUrl: s.linkUrl,
              submittedAt: s.submittedAt.toISOString(),
            }
          : null,
      };
    }),
  };

  const average = weightedAverage(
    data.assessments.map((a) => ({ weight: a.weight, score: a.score })),
  );

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>{mod.name}</h1>
          <span className="page__sub">
            {mod.diploma.title} · Módulo {mod.order}
            {average !== null ? ` · Promedio: ${average.toFixed(2)}` : ""}
          </span>
        </div>
        <Link className="linkbtn" href="/aula">
          <Icon name="chevron-right" size={15} />
          Mi aula
        </Link>
      </div>
      <AulaModule data={data} average={average} />
    </div>
  );
}
