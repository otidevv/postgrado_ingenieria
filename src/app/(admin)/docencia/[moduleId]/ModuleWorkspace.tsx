"use client";

import { useState } from "react";
import type { RosterStudent } from "@/lib/teaching";
import type {
  AssessmentRow,
  GradeCell,
  MaterialRow,
  SessionRow,
  SubmissionInfo,
} from "../types";
import { SessionsTab } from "./SessionsTab";

export type WorkspaceProps = {
  moduleId: string;
  roster: RosterStudent[];
  sessions: SessionRow[];
  assessments: AssessmentRow[];
  materials: MaterialRow[];
  grades: Record<string, GradeCell>;
  submissions: SubmissionInfo[];
};

const TABS = [
  { id: "sesiones", label: "Sesiones y asistencia" },
  { id: "notas", label: "Evaluaciones y notas" },
  { id: "materiales", label: "Materiales" },
  { id: "estudiantes", label: "Estudiantes" },
] as const;

export function ModuleWorkspace(props: WorkspaceProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("sesiones");

  return (
    <div>
      <div className="dw-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`dw-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sesiones" && (
        <SessionsTab moduleId={props.moduleId} roster={props.roster} sessions={props.sessions} />
      )}
      {/* Pestañas de notas (T4), materiales y estudiantes (T5) se montan aquí */}
      {tab !== "sesiones" && (
        <div className="dw-card">
          <p className="dtable__muted">Disponible en la siguiente tarea del plan.</p>
        </div>
      )}
    </div>
  );
}
