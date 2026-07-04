"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { APPLICATION_STATUS } from "@/lib/applications";
import { setApplicationStatus } from "./actions";
import type { ApplicationPerms, ApplicationRow, ApplicationStatus } from "./types";
import "./postulaciones.css";

const STATUS_META = Object.fromEntries(
  APPLICATION_STATUS.map((s) => [s.value, s]),
) as Record<ApplicationStatus, (typeof APPLICATION_STATUS)[number]>;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PostulacionesView({
  rows,
  perms,
}: {
  rows: ApplicationRow[];
  perms: ApplicationPerms;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("all");
  const [q, setQ] = useState("");

  const changeStatus = (id: string, status: ApplicationStatus) => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await setApplicationStatus(id, status);
      setBusyId(null);
      if (!res.ok) setError(res.error);
    });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!needle) return true;
      return (
        r.fullName.toLowerCase().includes(needle) ||
        r.docNumber.toLowerCase().includes(needle) ||
        r.code.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle) ||
        r.diplomaTitle.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Postulaciones</h1>
          <span className="page__sub">
            {rows.length} postulación{rows.length === 1 ? "" : "es"} ·{" "}
            {counts["pending"] ?? 0} pendiente{counts["pending"] === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {error && (
        <div className="banner" role="alert" style={{ borderColor: "#f5c2c7" }}>
          <span className="banner__icon" style={{ color: "#d93025" }}>
            <Icon name="alert" size={18} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="ps-adm-toolbar">
        <div className="ps-adm-chips">
          <button
            className={`ps-chip${filter === "all" ? " is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Todas <span>{counts.all ?? 0}</span>
          </button>
          {APPLICATION_STATUS.map((s) => (
            <button
              key={s.value}
              className={`ps-chip${filter === s.value ? " is-active" : ""}`}
              onClick={() => setFilter(s.value)}
            >
              {s.label} <span>{counts[s.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="ps-adm-search">
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, documento, código…"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="inbox" size={40} />
            <h3>Sin postulaciones</h3>
            <p>
              {rows.length === 0
                ? "Aún no se ha registrado ninguna postulación."
                : "No hay resultados para el filtro o la búsqueda actual."}
            </p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Postulante</th>
                  <th>Diplomado</th>
                  <th className="dtable__num">Docs</th>
                  <th>Estado</th>
                  <th>Recibida</th>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  const isBusy = pending && busyId === r.id;
                  return (
                    <tr key={r.id}>
                      <td>
                        <code style={{ fontSize: 12.5 }}>{r.code}</code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.fullName}</div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>
                          {r.docType} {r.docNumber} · {r.email}
                        </div>
                      </td>
                      <td className="dtable__muted">{r.diplomaTitle}</td>
                      <td className="dtable__num">{r.docCount}</td>
                      <td>
                        {perms.canWrite ? (
                          <select
                            className="ps-status-select"
                            value={r.status}
                            disabled={isBusy}
                            onChange={(e) =>
                              changeStatus(r.id, e.target.value as ApplicationStatus)
                            }
                          >
                            {APPLICATION_STATUS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge ${meta.badge}`}>{meta.label}</span>
                        )}
                      </td>
                      <td className="dtable__muted">{fmtDate(r.createdAt)}</td>
                      <td className="dtable__settings">
                        <Link className="linkbtn" href={`/postulaciones/${r.id}`}>
                          <Icon name="external" size={15} />
                          Ver
                        </Link>
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
