"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { setDiplomaStatus, createDiploma, deleteDiploma } from "./actions";
import type { ActionResult, DiplomaPerms, DiplomaRow, DiplomaStatus } from "./types";

const STATUS_META: Record<
  DiplomaStatus,
  { label: string; badge: string }
> = {
  published: { label: "Publicado", badge: "badge--green" },
  draft: { label: "Borrador", badge: "badge--neutral" },
  closed: { label: "Cerrado", badge: "badge--amber" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DiplomasView({
  rows,
  perms,
}: {
  rows: DiplomaRow[];
  perms: DiplomaPerms;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const changeStatus = (id: string, status: DiplomaStatus) => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await setDiplomaStatus(id, status);
      setBusyId(null);
      if (!res.ok) setError(res.error);
    });
  };

  const published = rows.filter((r) => r.status === "published").length;

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Diplomados</h1>
          <span className="page__sub">
            {rows.length} programa{rows.length === 1 ? "" : "s"} · {published}{" "}
            publicado{published === 1 ? "" : "s"}
          </span>
        </div>
        {perms.canWrite && (
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={16} />
            Nuevo diplomado
          </button>
        )}
      </div>

      {error && (
        <div className="banner" role="alert" style={{ borderColor: "#f5c2c7" }}>
          <span className="banner__icon" style={{ color: "#d93025" }}>
            <Icon name="alert" size={18} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="cloud" size={40} />
            <h3>Aún no hay diplomados</h3>
            <p>
              Ejecuta <code>npx tsx prisma/seed-diplomas.ts</code> para cargar el
              diplomado de ejemplo.
            </p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th className="dtable__num">Módulos</th>
                  <th className="dtable__num">Horas</th>
                  <th>Estado</th>
                  <th>Actualizado</th>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  const isBusy = pending && busyId === r.id;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.title}</div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>
                          {r.code} · {r.subtitle ?? "Diplomado"}
                        </div>
                      </td>
                      <td className="dtable__num">{r.moduleCount}</td>
                      <td className="dtable__num">{r.totalHours} h</td>
                      <td>
                        <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                      <td className="dtable__muted">{fmtDate(r.updatedAt)}</td>
                      <td className="dtable__settings">
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          {r.status === "published" && (
                            <Link
                              className="linkbtn"
                              href={`/diplomado/${r.slug}`}
                              target="_blank"
                            >
                              <Icon name="external" size={15} />
                              Ver
                            </Link>
                          )}
                          {perms.canWrite && (
                            <Link className="linkbtn" href={`/diplomados/${r.id}`}>
                              <Icon name="settings" size={15} />
                              Editar
                            </Link>
                          )}
                          {perms.canWrite &&
                            (r.status === "published" ? (
                              <button
                                className="btn btn--ghost"
                                disabled={isBusy}
                                onClick={() => changeStatus(r.id, "draft")}
                              >
                                {isBusy ? "…" : "Ocultar"}
                              </button>
                            ) : (
                              <button
                                className="btn btn--primary"
                                disabled={isBusy}
                                onClick={() => changeStatus(r.id, "published")}
                              >
                                {isBusy ? "…" : "Publicar"}
                              </button>
                            ))}
                          {perms.canWrite && r.applicationCount === 0 && (
                            <button
                              className="btn btn--ghost"
                              disabled={isBusy}
                              onClick={() => {
                                if (confirm(`¿Eliminar "${r.title}"? Esta acción no se puede deshacer.`)) {
                                  setBusyId(r.id);
                                  startTransition(async () => {
                                    const res = await deleteDiploma(r.id);
                                    setBusyId(null);
                                    if (!res.ok) setError(res.error);
                                  });
                                }
                              }}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateDiplomaModal
          onClose={() => setShowCreate(false)}
          onSubmit={createDiploma}
        />
      )}
    </div>
  );
}

function slugFromTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function CreateDiplomaModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; slug: string; code: string }) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [topError, setTopError] = useState<string | null>(null);

  const valid = title.trim().length >= 3 && slug.length >= 2 && code.trim().length >= 2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setTopError(null);
    setFieldErrors({});
    const res = await onSubmit({ title: title.trim(), slug, code: code.trim().toUpperCase() });
    if (!res.ok) {
      setTopError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setSubmitting(false);
      return;
    }
    router.push(`/diplomados/${res.data!.id}`);
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <h2>Nuevo diplomado</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="modal__body">
          <p className="modal__intro">
            Se crea como borrador. Completa el contenido en el editor antes de publicarlo.
          </p>
          {topError && (
            <div className="login__error" role="alert" style={{ marginBottom: 16 }}>
              <Icon name="info" size={16} />
              <span>{topError}</span>
            </div>
          )}
          <label className="field">
            <span className="field__label">Título<span className="field__req">*</span></span>
            <input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!touchedSlug) setSlug(slugFromTitle(e.target.value));
              }}
              placeholder="p. ej. Gestión Pública"
              aria-invalid={!!fieldErrors.title}
            />
            {err("title")}
          </label>
          <label className="field">
            <span className="field__label">Slug (URL pública)<span className="field__req">*</span></span>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(slugFromTitle(e.target.value));
                setTouchedSlug(true);
              }}
              placeholder="gestion-publica"
              aria-invalid={!!fieldErrors.slug}
            />
            {err("slug")}
          </label>
          <label className="field">
            <span className="field__label">Código<span className="field__req">*</span></span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DGP"
              aria-invalid={!!fieldErrors.code}
            />
            {err("code")}
          </label>
        </div>
        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid || submitting}>
            {submitting ? "Creando…" : "Crear y editar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
