"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { APPLICATION_STATUS } from "@/lib/applications";
import { saveReviewNote, setApplicationStatus } from "../actions";
import type { ApplicationStatus } from "../types";

export function ReviewPanel({
  id,
  canWrite,
  status,
  note,
  reviewedBy,
  reviewedAtLabel,
}: {
  id: string;
  canWrite: boolean;
  status: ApplicationStatus;
  note: string;
  reviewedBy: string | null;
  reviewedAtLabel: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [curStatus, setCurStatus] = useState<ApplicationStatus>(status);
  const [curNote, setCurNote] = useState(note);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const meta = APPLICATION_STATUS.find((s) => s.value === curStatus)!;

  if (!canWrite) {
    return (
      <section className="ps-card">
        <h2 className="ps-card__title">Revisión</h2>
        <p className="ps-review-status">
          Estado: <span className={`badge ${meta.badge}`}>{meta.label}</span>
        </p>
        {note ? (
          <p className="ps-review-note-ro">{note}</p>
        ) : (
          <p className="ps-empty-note">Sin nota de revisión.</p>
        )}
        {reviewedBy && (
          <p className="ps-review-by">
            Revisado por {reviewedBy}
            {reviewedAtLabel ? ` · ${reviewedAtLabel}` : ""}
          </p>
        )}
      </section>
    );
  }

  const changeStatus = (next: ApplicationStatus) => {
    setCurStatus(next);
    setMsg(null);
    startTransition(async () => {
      const res = await setApplicationStatus(id, next);
      setMsg(
        res.ok
          ? { ok: true, text: "Estado actualizado." }
          : { ok: false, text: res.error },
      );
    });
  };

  const saveNote = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveReviewNote(id, curNote);
      setMsg(
        res.ok
          ? { ok: true, text: "Nota guardada." }
          : { ok: false, text: res.error },
      );
    });
  };

  return (
    <section className="ps-card">
      <h2 className="ps-card__title">Revisión</h2>

      <label className="ps-review-field">
        <span>Estado de la postulación</span>
        <select
          value={curStatus}
          disabled={pending}
          onChange={(e) => changeStatus(e.target.value as ApplicationStatus)}
        >
          {APPLICATION_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="ps-review-field">
        <span>Nota interna de revisión</span>
        <textarea
          rows={4}
          value={curNote}
          disabled={pending}
          onChange={(e) => setCurNote(e.target.value)}
          placeholder="Observaciones internas (no visibles al postulante)."
        />
      </label>

      <button
        className="btn btn--primary"
        disabled={pending}
        onClick={saveNote}
      >
        {pending ? "Guardando…" : "Guardar nota"}
      </button>

      {msg && (
        <p className={`ps-review-msg${msg.ok ? " is-ok" : " is-err"}`}>
          <Icon name={msg.ok ? "check" : "alert"} size={14} />
          {msg.text}
        </p>
      )}

      {reviewedBy && (
        <p className="ps-review-by">
          Última revisión: {reviewedBy}
          {reviewedAtLabel ? ` · ${reviewedAtLabel}` : ""}
        </p>
      )}
    </section>
  );
}
