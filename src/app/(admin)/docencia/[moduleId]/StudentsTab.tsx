"use client";

import type { RosterStudent } from "@/lib/teaching";
import { weightedAverage } from "@/lib/teaching-client";
import type { AssessmentRow, GradeCell, SessionRow, SubmissionInfo } from "../types";

export function StudentsTab({
  roster,
  sessions,
  assessments,
  grades,
  submissions,
}: {
  roster: RosterStudent[];
  sessions: SessionRow[];
  assessments: AssessmentRow[];
  grades: Record<string, GradeCell>;
  submissions: SubmissionInfo[];
}) {
  const submittable = assessments.filter((a) => a.allowsSubmission);

  return (
    <div className="dw-card" style={{ overflowX: "auto" }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>
        Estudiantes ({roster.length})
      </h2>
      {roster.length === 0 ? (
        <p className="dtable__muted">No hay matrículas activas en este diplomado.</p>
      ) : (
        <table className="dw-gradetable">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Asistencia</th>
              <th>Promedio</th>
              {submittable.length > 0 && <th>Entregas</th>}
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => {
              // % de asistencia: presente + tardanza sobre sesiones con registro para el alumno
              let attended = 0;
              let recorded = 0;
              for (const s of sessions) {
                const st = s.attendance[r.enrollmentId];
                if (!st) continue;
                recorded += 1;
                if (st === "presente" || st === "tardanza") attended += 1;
              }
              const pct = recorded === 0 ? null : Math.round((attended / recorded) * 100);

              const avg = weightedAverage(
                assessments.map((a) => ({
                  weight: a.weight,
                  score: grades[`${r.enrollmentId}:${a.id}`]?.score ?? null,
                })),
              );

              const delivered = submittable.filter((a) =>
                submissions.some(
                  (s) => s.assessmentId === a.id && s.enrollmentId === r.enrollmentId,
                ),
              ).length;

              return (
                <tr key={r.enrollmentId}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div className="dtable__muted" style={{ fontSize: 12 }}>{r.email}</div>
                  </td>
                  <td>{pct === null ? "—" : `${pct}% (${attended}/${recorded})`}</td>
                  <td className="dw-avg">{avg === null ? "—" : avg.toFixed(2)}</td>
                  {submittable.length > 0 && (
                    <td>{delivered}/{submittable.length}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
