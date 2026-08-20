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

// Posición de cada estado en el flujo, para poder ordenar por estado.
const STATUS_ORDER = Object.fromEntries(
  APPLICATION_STATUS.map((s, i) => [s.value, i]),
) as Record<ApplicationStatus, number>;

const PAGE_SIZES = [10, 25, 50, 100];

type SortKey =
  | "code"
  | "fullName"
  | "diplomaTitle"
  | "docCount"
  | "status"
  | "createdAt";
type SortDir = "asc" | "desc";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SortTh({
  k,
  sortKey,
  sortDir,
  onSort,
  className,
  children,
}: {
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      className={className}
      aria-sort={
        sortKey === k
          ? sortDir === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <button type="button" className="ps-sortbtn" onClick={() => onSort(k)}>
        {children}
        {sortKey === k && (
          <Icon name={sortDir === "asc" ? "chevron-up" : "chevron-down"} size={13} />
        )}
      </button>
    </th>
  );
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
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
        r.phone.toLowerCase().includes(needle) ||
        r.diplomaTitle.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, q]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "docCount":
          return (a.docCount - b.docCount) * dir;
        case "status":
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
        case "createdAt":
          return a.createdAt.localeCompare(b.createdAt) * dir;
        default:
          return a[sortKey].localeCompare(b[sortKey], "es") * dir;
      }
    });
  }, [filtered, sortKey, sortDir]);

  // Paginación sobre el resultado filtrado+ordenado. `page` se fija a 1 al
  // cambiar filtro/búsqueda/tamaño; el clamp cubre el caso de quedarse corto.
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageStart = (curPage - 1) * pageSize;
  const paged = sorted.slice(pageStart, pageStart + pageSize);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Fecha y n° de documentos suelen consultarse de mayor a menor.
      setSortDir(key === "createdAt" || key === "docCount" ? "desc" : "asc");
    }
    setPage(1);
  };

  const exportCsv = () => {
    const header = [
      "Código",
      "Postulante",
      "Tipo doc",
      "N° documento",
      "Email",
      "Teléfono",
      "Diplomado",
      "Documentos",
      "Estado",
      "Recibida",
    ];
    const lines = sorted.map((r) => [
      r.code,
      r.fullName,
      r.docType,
      r.docNumber,
      r.email,
      r.phone,
      r.diplomaTitle,
      String(r.docCount),
      STATUS_META[r.status].label,
      fmtDate(r.createdAt),
    ]);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    // BOM + separador ";" para que Excel (config. regional es-PE) lo abra bien.
    const csv =
      String.fromCharCode(0xfeff) +
      [header, ...lines].map((l) => l.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `postulaciones-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortProps = { sortKey, sortDir, onSort: toggleSort };

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Postulaciones</h1>
          <span className="page__sub">
            {rows.length} {rows.length === 1 ? "postulación" : "postulaciones"} ·{" "}
            {counts["pending"] ?? 0} pendiente{counts["pending"] === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={exportCsv}
          disabled={sorted.length === 0}
          title="Exporta el listado filtrado a CSV"
        >
          <Icon name="download" size={16} />
          Exportar CSV
        </button>
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
            onClick={() => {
              setFilter("all");
              setPage(1);
            }}
          >
            Todas <span>{counts.all ?? 0}</span>
          </button>
          {APPLICATION_STATUS.map((s) => (
            <button
              key={s.value}
              className={`ps-chip${filter === s.value ? " is-active" : ""}`}
              onClick={() => {
                setFilter(s.value);
                setPage(1);
              }}
            >
              {s.label} <span>{counts[s.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="ps-adm-search">
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, documento, código…"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
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
                  <SortTh k="code" {...sortProps}>Código</SortTh>
                  <SortTh k="fullName" {...sortProps}>Postulante</SortTh>
                  <SortTh k="diplomaTitle" {...sortProps}>Diplomado</SortTh>
                  <SortTh k="docCount" className="dtable__num" {...sortProps}>
                    Docs
                  </SortTh>
                  <SortTh k="status" {...sortProps}>Estado</SortTh>
                  <SortTh k="createdAt" {...sortProps}>Recibida</SortTh>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => {
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
                          {r.phone ? ` · ${r.phone}` : ""}
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

          <div className="tablefoot">
            <span>
              {sorted.length === rows.length
                ? `${rows.length} ${rows.length === 1 ? "postulación" : "postulaciones"}`
                : `${sorted.length} de ${rows.length} postulaciones`}
            </span>
            <div className="ps-pager">
              <label className="ps-pager__size">
                Filas por página:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {pageStart + 1}–{Math.min(pageStart + pageSize, sorted.length)} de{" "}
                {sorted.length}
              </span>
              <div className="ps-pager__nav">
                <button
                  type="button"
                  className="ps-pager__btn"
                  onClick={() => setPage(curPage - 1)}
                  disabled={curPage <= 1}
                  aria-label="Página anterior"
                >
                  <Icon name="chevron-right" size={16} className="ps-pager__left" />
                </button>
                <button
                  type="button"
                  className="ps-pager__btn"
                  onClick={() => setPage(curPage + 1)}
                  disabled={curPage >= totalPages}
                  aria-label="Página siguiente"
                >
                  <Icon name="chevron-right" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
