"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import type { RosterStudent } from "@/lib/teaching";
import { deleteSession, saveAttendance, saveSession } from "./actions";
import type { AttendanceStatus, SessionRow } from "../types";

const STATUSES: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "presente", label: "Presente" },
  { value: "tardanza", label: "Tardanza" },
  { value: "falta", label: "Falta" },
  { value: "justificada", label: "Justificada" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function SessionForm({
  moduleId,
  initial,
  onDone,
}: {
  moduleId: string;
  initial: SessionRow | null;
  onDone: () => void;
}) {
  const [date, setDate] = useState(initial ? toDateInput(initial.date) : "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveSession(moduleId, {
        id: initial?.id ?? null,
        date,
        topic,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      onDone();
    });
  };

  return (
    <div className="dw-row" style={{ alignItems: "flex-end", marginTop: 8 }}>
      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">Fecha</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!fieldErrors.date} />
        {fieldErrors.date && <span className="form-error">{fieldErrors.date}</span>}
      </label>
      <label className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
        <span className="field__label">Tema de la sesión</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="p. ej. Introducción a redes"
          aria-invalid={!!fieldErrors.topic}
        />
        {fieldErrors.topic && <span className="form-error">{fieldErrors.topic}</span>}
      </label>
      <button className="btn btn--primary" onClick={save} disabled={pending}>
        {pending ? "Guardando…" : initial ? "Guardar" : "Crear sesión"}
      </button>
      <button className="btn btn--ghost" onClick={onDone} disabled={pending}>
        Cancelar
      </button>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

function AttendanceEditor({
  moduleId,
  session,
  roster,
}: {
  moduleId: string;
  session: SessionRow;
  roster: RosterStudent[];
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(session.attendance);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAll = (status: AttendanceStatus) => {
    setMarks(Object.fromEntries(roster.map((r) => [r.enrollmentId, status])));
    setMsg(null);
  };

  const save = () => {
    setError(null);
    setMsg(null);
    const records = Object.entries(marks).map(([enrollmentId, status]) => ({
      enrollmentId,
      status,
    }));
    startTransition(async () => {
      const res = await saveAttendance(moduleId, session.id, records);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMsg("Asistencia guardada ✓");
      router.refresh();
    });
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div className="dw-row" style={{ marginBottom: 8 }}>
        <button className="btn btn--ghost" onClick={() => setAll("presente")}>
          Marcar todos presentes
        </button>
      </div>
      <table className="dw-attend">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>Asistencia</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.enrollmentId}>
              <td>
                <div>{r.name}</div>
                <div className="dtable__muted" style={{ fontSize: 12 }}>{r.email}</div>
              </td>
              <td>
                <select
                  data-status={marks[r.enrollmentId] ?? ""}
                  value={marks[r.enrollmentId] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as AttendanceStatus | "";
                    setMarks((m) => {
                      const next = { ...m };
                      if (v === "") delete next[r.enrollmentId];
                      else next[r.enrollmentId] = v;
                      return next;
                    });
                    setMsg(null);
                  }}
                >
                  <option value="">— Sin registrar —</option>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dw-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        {msg && <span className="badge badge--green">{msg}</span>}
        {error && <span className="form-error">{error}</span>}
        <button className="btn btn--primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar asistencia"}
        </button>
      </div>
    </div>
  );
}

export function SessionsTab({
  moduleId,
  roster,
  sessions,
}: {
  moduleId: string;
  roster: RosterStudent[];
  sessions: SessionRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  const remove = (s: SessionRow) => {
    if (!confirm(`¿Eliminar la sesión "${s.topic}" y su asistencia?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSession(moduleId, s.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="dw-toolbar">
        <h2 className="dw-cardtitle">Sesiones ({sessions.length})</h2>
        {editing === null && (
          <button className="btn btn--primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={15} />
            Nueva sesión
          </button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      {editing === "new" && (
        <div className="dw-card">
          <SessionForm moduleId={moduleId} initial={null} onDone={done} />
        </div>
      )}

      {sessions.length === 0 && editing === null && (
        <div className="dw-card">
          <p className="dtable__muted">
            Aún no hay sesiones. Crea la primera para poder pasar lista.
          </p>
        </div>
      )}

      {sessions.map((s) => {
        const isOpen = openId === s.id;
        const registered = Object.keys(s.attendance).length;
        return (
          <div key={s.id} className="dw-card">
            <div className="dw-row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 500 }}>
                  Sesión {s.order} · {s.topic}
                </div>
                <div className="dtable__muted" style={{ fontSize: 12 }}>
                  {fmtDate(s.date)} · asistencia registrada: {registered}/{roster.length}
                </div>
              </div>
              <div className="dw-row">
                <button
                  className="btn btn--ghost"
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                >
                  {isOpen ? "Cerrar lista" : "Pasar lista"}
                </button>
                <button className="btn btn--ghost" onClick={() => setEditing(s.id)}>
                  Editar
                </button>
                <button
                  className="iconbtn"
                  aria-label="Eliminar sesión"
                  disabled={pending}
                  onClick={() => remove(s)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
            {editing === s.id && (
              <SessionForm moduleId={moduleId} initial={s} onDone={done} />
            )}
            {isOpen && (
              <AttendanceEditor
                key={JSON.stringify(s.attendance)}
                moduleId={moduleId}
                session={s}
                roster={roster}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
