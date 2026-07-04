"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { setDiplomaStatus } from "./actions";
import type { DiplomaPerms, DiplomaRow, DiplomaStatus } from "./types";

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
      </div>

      <div className="banner">
        <span className="banner__icon">
          <Icon name="info" size={18} />
        </span>
        <p>
          Publica u oculta cada diplomado para controlar su visibilidad en la
          web pública. La edición del contenido (módulos, costos, requisitos) se
          gestiona por ahora desde la semilla{" "}
          <code>prisma/seed-diplomas.ts</code>.
        </p>
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
    </div>
  );
}
