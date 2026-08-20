"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import type { RosterStudent } from "@/lib/teaching";
import { weightedAverage } from "@/lib/teaching-client";
import { fmtCalDate } from "@/lib/teaching-client";
import { deleteAssessment, saveAssessment, saveGrade } from "./actions";
import type { AssessmentKind, AssessmentRow, GradeCell } from "../types";

const KIND_LABEL: Record<AssessmentKind, string> = {
  tarea: "Tarea",
  trabajo: "Trabajo",
  examen: "Examen",
  participacion: "Participación",
};

function AssessmentForm({
  moduleId,
  initial,
  onDone,
}: {
  moduleId: string;
  initial: AssessmentRow | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<AssessmentKind>(initial?.kind ?? "tarea");
  const [weight, setWeight] = useState(initial?.weight ?? 20);
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");
  const [allowsSubmission, setAllowsSubmission] = useState(initial?.allowsSubmission ?? false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveAssessment(moduleId, {
        id: initial?.id ?? null,
        title,
        description,
        kind,
        weight: Number(weight),
        dueDate,
        allowsSubmission,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      onDone();
    });
  };

  const err = (k: string) =>
    fieldErrors[k] ? <span className="form-error">{fieldErrors[k]}</span> : null;

  return (
    <div className="dw-grid" style={{ marginTop: 10 }}>
      <label className="field" style={{ gridColumn: "1 / -1", margin: 0 }}>
        <span className="field__label">Título</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Trabajo final del módulo" aria-invalid={!!fieldErrors.title} />
        {err("title")}
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Tipo</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
          {Object.entries(KIND_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Peso (%)</span>
        <input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} aria-invalid={!!fieldErrors.weight} />
        {err("weight")}
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Fecha límite</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={!!fieldErrors.dueDate} />
        {err("dueDate")}
      </label>
      <label className="field" style={{ margin: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={allowsSubmission}
          onChange={(e) => setAllowsSubmission(e.target.checked)}
          style={{ width: "auto" }}
        />
        <span className="field__label" style={{ margin: 0 }}>Acepta entrega en línea</span>
      </label>
      <label className="field" style={{ gridColumn: "1 / -1", margin: 0 }}>
        <span className="field__label">Descripción / indicaciones</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="dw-row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
        {error && <span className="form-error">{error}</span>}
        <button className="btn btn--ghost" onClick={onDone} disabled={pending}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : initial ? "Guardar" : "Crear evaluación"}
        </button>
      </div>
    </div>
  );
}

function GradeInput({
  moduleId,
  assessmentId,
  enrollmentId,
  cell,
  onError,
}: {
  moduleId: string;
  assessmentId: string;
  enrollmentId: string;
  cell: GradeCell | undefined;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(cell?.score?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [bad, setBad] = useState(false);

  const commit = () => {
    const trimmed = value.trim();
    const score = trimmed === "" ? null : Number(trimmed);
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 20)) {
      setBad(true);
      return;
    }
    setBad(false);
    const prev = cell?.score ?? null;
    if (score === prev) return;
    startTransition(async () => {
      const res = await saveGrade(moduleId, assessmentId, enrollmentId, score, cell?.feedback ?? "");
      if (!res.ok) {
        setBad(true);
        onError(res.error);
      } else {
        onError(null);
      }
      router.refresh();
    });
  };

  return (
    <input
      type="number"
      min={0}
      max={20}
      step={0.01}
      value={value}
      disabled={pending}
      aria-invalid={bad}
      title={cell?.feedback ?? undefined}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function GradesTab({
  moduleId,
  roster,
  assessments,
  grades,
}: {
  moduleId: string;
  roster: RosterStudent[];
  assessments: AssessmentRow[];
  grades: Record<string, GradeCell>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const totalWeight = assessments.reduce((s, a) => s + a.weight, 0);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  const remove = (a: AssessmentRow) => {
    if (!confirm(`¿Eliminar "${a.title}" y todas sus notas y entregas?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAssessment(moduleId, a.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="dw-card">
        <div className="dw-row" style={{ justifyContent: "space-between" }}>
          <h2 className="dw-cardtitle">Evaluaciones ({assessments.length})</h2>
          {editing === null && (
            <button className="btn btn--primary" onClick={() => setEditing("new")}>
              <Icon name="plus" size={15} />
              Nueva evaluación
            </button>
          )}
        </div>
        {totalWeight !== 100 && assessments.length > 0 && (
          <p className="dw-note">
            La suma de pesos es {totalWeight}% (se recomienda 100%). El promedio se
            calcula sobre lo calificado.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
        {editing === "new" && (
          <AssessmentForm moduleId={moduleId} initial={null} onDone={done} />
        )}
        {assessments.map((a) =>
          editing === a.id ? (
            <AssessmentForm key={a.id} moduleId={moduleId} initial={a} onDone={done} />
          ) : (
            <div key={a.id} className="dw-row" style={{ justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <div>
                <div style={{ fontWeight: 500 }}>{a.title}</div>
                <div className="dtable__muted" style={{ fontSize: 12 }}>
                  {KIND_LABEL[a.kind]} · {a.weight}%
                  {a.dueDate ? ` · vence ${fmtCalDate(a.dueDate)}` : ""}
                  {a.allowsSubmission ? " · acepta entrega" : ""}
                </div>
              </div>
              {editing === null && (
                <div className="dw-row">
                  <button className="btn btn--ghost" onClick={() => setEditing(a.id)}>Editar</button>
                  <button className="iconbtn" aria-label="Eliminar evaluación" disabled={pending} onClick={() => remove(a)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {assessments.length > 0 && (
        <div className="dw-card" style={{ overflowX: "auto" }}>
          <h2 className="dw-cardtitle">Notas (0–20)</h2>
          {gradeError && <p className="form-error">{gradeError}</p>}
          <table className="dw-gradetable">
            <thead>
              <tr>
                <th>Estudiante</th>
                {assessments.map((a) => (
                  <th key={a.id} title={a.title}>
                    <span className="dw-colname">{a.title}</span>
                    <div className="dtable__muted" style={{ fontWeight: 400, fontSize: 11 }}>{a.weight}%</div>
                  </th>
                ))}
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => {
                const avg = weightedAverage(
                  assessments.map((a) => ({
                    weight: a.weight,
                    score: grades[`${r.enrollmentId}:${a.id}`]?.score ?? null,
                  })),
                );
                return (
                  <tr key={r.enrollmentId}>
                    <td>{r.name}</td>
                    {assessments.map((a) => {
                      const cellKey = `${r.enrollmentId}:${a.id}`;
                      return (
                        <td key={a.id}>
                          <GradeInput
                            key={`${cellKey}:${grades[cellKey]?.score ?? ""}`}
                            moduleId={moduleId}
                            assessmentId={a.id}
                            enrollmentId={r.enrollmentId}
                            cell={grades[cellKey]}
                            onError={setGradeError}
                          />
                        </td>
                      );
                    })}
                    <td className="dw-avg">{avg === null ? "—" : avg.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
