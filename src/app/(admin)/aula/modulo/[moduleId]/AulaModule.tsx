"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { submitWork } from "./actions";

export type AulaAssessment = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  weight: number;
  dueDate: string | null;
  allowsSubmission: boolean;
  score: number | null;
  feedback: string | null;
  submission: {
    id: string;
    fileName: string | null;
    linkUrl: string | null;
    submittedAt: string;
  } | null;
};

export type AulaData = {
  moduleId: string;
  moduleName: string;
  diplomaTitle: string;
  sessions: Array<{ order: number; date: string; topic: string; status: string | null }>;
  materials: Array<{ id: string; title: string; url: string }>;
  assessments: AulaAssessment[];
};

const TABS = [
  { id: "notas", label: "Notas" },
  { id: "asistencia", label: "Asistencia" },
  { id: "materiales", label: "Materiales" },
  { id: "trabajos", label: "Trabajos" },
] as const;

const ATT_LABEL: Record<string, string> = {
  presente: "Presente",
  tardanza: "Tardanza",
  falta: "Falta",
  justificada: "Justificada",
};

const KIND_LABEL: Record<string, string> = {
  tarea: "Tarea",
  trabajo: "Trabajo",
  examen: "Examen",
  participacion: "Participación",
};

function calDate(iso: string): string {
  return iso.slice(0, 10);
}

function isPastDue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  // Fin del día calendario en Lima (misma fórmula que el servidor).
  return Date.now() >= new Date(dueDate).getTime() + 29 * 3600 * 1000;
}

function SubmitForm({
  moduleId,
  assessment,
  onDone,
}: {
  moduleId: string;
  assessment: AulaAssessment;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    const fd = new FormData();
    const file = fileRef.current?.files?.[0];
    if (file) fd.set("file", file);
    fd.set("linkUrl", linkUrl);
    fd.set("comment", comment);
    startTransition(async () => {
      const res = await submitWork(moduleId, assessment.id, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
    });
  };

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 10 }}>
      <div className="dw-row" style={{ gap: 14, flexWrap: "wrap", display: "flex", alignItems: "flex-end" }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field__label">Archivo (PDF, Word o ZIP, máx. 10 MB)</span>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.zip" />
        </label>
        <label className="field" style={{ margin: 0, minWidth: 220, flex: 1 }}>
          <span className="field__label">…o enlace (Drive, GitHub, etc.)</span>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
        </label>
      </div>
      <label className="field" style={{ marginTop: 8 }}>
        <span className="field__label">Comentario (opcional)</span>
        <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      </label>
      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
      <button className="btn btn--primary" onClick={send} disabled={pending}>
        {pending ? "Enviando…" : assessment.submission ? "Reemplazar entrega" : "Enviar entrega"}
      </button>
    </div>
  );
}

export function AulaModule({ data, average }: { data: AulaData; average: number | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("notas");
  const [openForm, setOpenForm] = useState<string | null>(null);

  const attended = data.sessions.filter(
    (s) => s.status === "presente" || s.status === "tardanza",
  ).length;
  const recorded = data.sessions.filter((s) => s.status !== null).length;

  return (
    <div>
      <div className="au-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`au-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notas" && (
        <div className="au-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>Mis notas</h2>
          {data.assessments.length === 0 ? (
            <p className="dtable__muted">El docente aún no define evaluaciones.</p>
          ) : (
            <table className="au-table">
              <thead>
                <tr>
                  <th>Evaluación</th>
                  <th>Peso</th>
                  <th>Nota</th>
                  <th>Retroalimentación</th>
                </tr>
              </thead>
              <tbody>
                {data.assessments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.title}</div>
                      <div className="dtable__muted" style={{ fontSize: 12 }}>
                        {KIND_LABEL[a.kind] ?? a.kind}
                      </div>
                    </td>
                    <td>{a.weight}%</td>
                    <td className="au-badge-nota">
                      {a.score === null ? "—" : a.score.toFixed(2)}
                    </td>
                    <td className="dtable__muted">{a.feedback ?? "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600 }}>Promedio ponderado</td>
                  <td className="au-badge-nota" colSpan={2}>
                    {average === null ? "—" : average.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "asistencia" && (
        <div className="au-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>
            Mi asistencia
            {recorded > 0 && (
              <span className="dtable__muted" style={{ fontWeight: 400, fontSize: 13 }}>
                {" "}· {Math.round((attended / recorded) * 100)}% ({attended}/{recorded})
              </span>
            )}
          </h2>
          {data.sessions.length === 0 ? (
            <p className="dtable__muted">Aún no hay sesiones registradas.</p>
          ) : (
            <table className="au-table">
              <thead>
                <tr>
                  <th>Sesión</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.order}>
                    <td>Sesión {s.order} · {s.topic}</td>
                    <td className="dtable__muted">{calDate(s.date)}</td>
                    <td>{s.status ? ATT_LABEL[s.status] : "Sin registrar"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "materiales" && (
        <div className="au-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>Materiales</h2>
          {data.materials.length === 0 ? (
            <p className="dtable__muted">El docente aún no publica materiales.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.materials.map((m) => (
                <li key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="linkbtn">
                    <Icon name="external" size={15} />
                    {m.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "trabajos" && (
        <div>
          {data.assessments.filter((a) => a.allowsSubmission).length === 0 && (
            <div className="au-card">
              <p className="dtable__muted">No hay trabajos con entrega en línea.</p>
            </div>
          )}
          {data.assessments
            .filter((a) => a.allowsSubmission)
            .map((a) => {
              const pastDue = isPastDue(a.dueDate);
              const graded = a.score !== null;
              const canSubmit = !pastDue && !graded;
              return (
                <div key={a.id} className="au-card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.title}</div>
                      <div className="dtable__muted" style={{ fontSize: 12 }}>
                        {KIND_LABEL[a.kind] ?? a.kind} · {a.weight}%
                        {a.dueDate ? ` · vence ${calDate(a.dueDate)}` : ""}
                        {pastDue ? " · VENCIDO" : ""}
                        {graded ? ` · calificado: ${a.score!.toFixed(2)}` : ""}
                      </div>
                      {a.description && (
                        <p style={{ fontSize: 13, marginTop: 6 }}>{a.description}</p>
                      )}
                    </div>
                    <div>
                      {a.submission ? (
                        <span className="badge badge--green">Entregado</span>
                      ) : (
                        <span className="badge badge--neutral">Pendiente</span>
                      )}
                    </div>
                  </div>

                  {a.submission && (
                    <p style={{ fontSize: 13, marginTop: 8 }}>
                      Tu entrega ({a.submission.submittedAt.slice(0, 10)}):{" "}
                      {a.submission.fileName ? (
                        <a className="linkbtn" href={`/api/entregas/${a.submission.id}`}>
                          <Icon name="download" size={14} />
                          {a.submission.fileName}
                        </a>
                      ) : a.submission.linkUrl ? (
                        <a className="linkbtn" href={a.submission.linkUrl} target="_blank" rel="noopener noreferrer">
                          <Icon name="external" size={14} />
                          Ver enlace
                        </a>
                      ) : null}
                    </p>
                  )}

                  {canSubmit && openForm !== a.id && (
                    <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setOpenForm(a.id)}>
                      {a.submission ? "Reemplazar entrega" : "Enviar entrega"}
                    </button>
                  )}
                  {canSubmit && openForm === a.id && (
                    <SubmitForm
                      moduleId={data.moduleId}
                      assessment={a}
                      onDone={() => {
                        setOpenForm(null);
                        router.refresh();
                      }}
                    />
                  )}
                  {!canSubmit && (
                    <p className="dtable__muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                      {graded
                        ? "Ya calificado: la entrega no puede reemplazarse."
                        : "Fecha límite vencida: ya no se aceptan entregas."}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
