"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { formatFullDate, formatRelative } from "@/lib/ui/dates";
import { useEscClose } from "@/lib/ui/useEscClose";
import { StatusBadge, SeverityTag } from "./IncidentsClient";
import {
  addComment,
  assignIncident,
  changeStatus,
  deleteIncident,
  getIncidentDetail,
  setSeverity,
} from "./actions";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type IncidentDetail,
  type IncidentStatusKey,
  type PermFlags,
  type Person,
} from "./types";

type Props = {
  code: string;
  assignees: Person[];
  perms: PermFlags;
  onClose: () => void;
};

export function IncidentDrawer({ code, assignees, perms, onClose }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [statusDraft, setStatusDraft] = useState<IncidentStatusKey | "">("");
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEscClose(true, onClose, busy);

  const load = useCallback(async () => {
    const res = await getIncidentDetail(code);
    if (res.ok && res.data) {
      setDetail(res.data);
      setStatusDraft(res.data.status);
      setError(null);
    } else if (!res.ok) {
      setError(res.error);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "No se pudo completar la acción.");
      } else {
        await load();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const onApplyStatus = () => {
    if (!detail || !statusDraft || statusDraft === detail.status) return;
    const value = statusDraft;
    void run(async () => {
      const r = await changeStatus(detail.id, value, note);
      if (r.ok) setNote("");
      return r;
    });
  };

  const onAssign = (assigneeId: string) => {
    if (!detail) return;
    void run(() => assignIncident(detail.id, assigneeId || null));
  };

  const onSeverity = (value: string) => {
    if (!detail) return;
    void run(() => setSeverity(detail.id, value));
  };

  const onComment = () => {
    if (!detail || !comment.trim()) return;
    void run(async () => {
      const r = await addComment(detail.id, comment, internal);
      if (r.ok) setComment("");
      return r;
    });
  };

  const onDelete = () => {
    if (!detail) return;
    void run(async () => {
      const r = await deleteIncident(detail.id);
      if (r.ok) onClose();
      return r;
    });
  };

  return (
    <div className="drawer-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="drawer drawer--wide"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__head">
          <div>
            <div className="drawer__eyebrow">{code}</div>
            <h2>{detail?.title ?? "Cargando…"}</h2>
            {detail && (
              <div className="inc-head-tags">
                <StatusBadge status={detail.status} />
                <SeverityTag severity={detail.severity} />
              </div>
            )}
          </div>
          <button
            className="iconbtn"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={busy}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {error && (
          <div className="drawer__error" role="alert">
            <Icon name="info" size={16} />
            <span>{error}</span>
          </div>
        )}

        {!detail ? (
          <div className="dsec drawer__loading">Cargando incidente…</div>
        ) : (
          <>
            {/* Management controls */}
            {perms.canWrite && (
              <div className="dsec inc-controls">
                <div className="dsec__hd">
                  <h3>Gestión</h3>
                </div>

                <label className="field__label">Estado</label>
                <div className="inc-statusrow">
                  <select
                    className="inc-select inc-select--grow"
                    value={statusDraft}
                    onChange={(e) =>
                      setStatusDraft(e.target.value as IncidentStatusKey)
                    }
                    disabled={busy}
                  >
                    {INCIDENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn--primary"
                    onClick={onApplyStatus}
                    disabled={busy || statusDraft === detail.status}
                  >
                    Aplicar
                  </button>
                </div>
                <input
                  className="inc-note"
                  type="text"
                  placeholder="Nota del cambio (opcional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy}
                />

                <div className="inc-controls__grid">
                  <div>
                    <label className="field__label">Asignado a</label>
                    <select
                      className="inc-select"
                      value={detail.assignee?.id ?? ""}
                      onChange={(e) => onAssign(e.target.value)}
                      disabled={busy}
                    >
                      <option value="">Sin asignar</option>
                      {/* Keep the current assignee selectable even if suspended
                          (not in the active-users list), so it isn't shown as
                          "Sin asignar" or accidentally unassigned on save. */}
                      {detail.assignee &&
                        !assignees.some((a) => a.id === detail.assignee!.id) && (
                          <option value={detail.assignee.id}>
                            {detail.assignee.name} (suspendido)
                          </option>
                        )}
                      {assignees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field__label">Severidad</label>
                    <select
                      className="inc-select"
                      value={detail.severity}
                      onChange={(e) => onSeverity(e.target.value)}
                      disabled={busy}
                    >
                      {INCIDENT_SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {SEVERITY_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="dsec">
              <div className="dsec__hd">
                <h3>Detalle</h3>
              </div>
              <p className="drawer__desc">{detail.description}</p>
            </div>

            <div className="dsec">
              <div className="drow">
                <span className="drow__icon">
                  <Icon name="tag" size={18} />
                </span>
                <span className="drow__l">Categoría</span>
                <span className="drow__v">{detail.categoryName ?? "—"}</span>
              </div>
              <div className="drow">
                <span className="drow__icon">
                  <Icon name="user" size={18} />
                </span>
                <span className="drow__l">Reportante</span>
                <span className="drow__v">{detail.reporter?.name ?? "—"}</span>
              </div>
              {detail.locationText && (
                <div className="drow">
                  <span className="drow__icon">
                    <Icon name="info" size={18} />
                  </span>
                  <span className="drow__l">Ubicación</span>
                  <span className="drow__v">{detail.locationText}</span>
                </div>
              )}
              <div className="drow">
                <span className="drow__icon">
                  <Icon name="calendar" size={18} />
                </span>
                <span className="drow__l">Creado</span>
                <span className="drow__v">{formatFullDate(detail.createdAt)}</span>
              </div>
              {detail.resolvedAt && (
                <div className="drow">
                  <span className="drow__icon">
                    <Icon name="check" size={18} />
                  </span>
                  <span className="drow__l">Resuelto</span>
                  <span className="drow__v">{formatFullDate(detail.resolvedAt)}</span>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="dsec">
              <div className="dsec__hd">
                <h3>Historial</h3>
              </div>
              {detail.timeline.length === 0 ? (
                <p className="drawer__empty">Sin actividad todavía.</p>
              ) : (
                <ul className="inc-timeline">
                  {detail.timeline.map((t) => (
                    <li key={t.id} className="inc-tl">
                      <span
                        className={`inc-tl__dot inc-tl__dot--${t.kind}`}
                        aria-hidden="true"
                      >
                        <Icon
                          name={t.kind === "status" ? "check" : "mail"}
                          size={13}
                        />
                      </span>
                      <div className="inc-tl__body">
                        {t.kind === "status" ? (
                          <div className="inc-tl__title">
                            {STATUS_LABEL[t.from]} → {STATUS_LABEL[t.to]}
                          </div>
                        ) : (
                          <div className="inc-tl__title">
                            {t.body}
                            {t.internal && (
                              <span className="inc-tl__tag">Interno</span>
                            )}
                          </div>
                        )}
                        {t.kind === "status" && t.note && (
                          <div className="inc-tl__note">{t.note}</div>
                        )}
                        <div className="inc-tl__meta">
                          {(t.kind === "status" ? t.by : t.author) ?? "Sistema"} ·{" "}
                          {formatRelative(t.at)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Comment composer */}
              {perms.canWrite && (
                <div className="inc-composer">
                  <textarea
                    placeholder="Agregar un comentario…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={busy}
                    rows={2}
                  />
                  <div className="inc-composer__foot">
                    <label className="inc-checkbox">
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(e) => setInternal(e.target.checked)}
                        disabled={busy}
                      />
                      Nota interna
                    </label>
                    <button
                      className="btn btn--primary"
                      onClick={onComment}
                      disabled={busy || !comment.trim()}
                    >
                      Comentar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Danger zone */}
            {perms.canDelete && (
              <div className="dsec inc-danger">
                {confirmDelete ? (
                  <div className="inc-danger__confirm">
                    <span>¿Eliminar este incidente de forma permanente?</span>
                    <div className="inc-danger__actions">
                      <button
                        className="btn btn--ghost"
                        onClick={() => setConfirmDelete(false)}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button
                        className="btn btn--danger"
                        onClick={onDelete}
                        disabled={busy}
                      >
                        {busy ? "Eliminando…" : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="linkbtn linkbtn--danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Icon name="trash" size={16} />
                    Eliminar incidente
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
