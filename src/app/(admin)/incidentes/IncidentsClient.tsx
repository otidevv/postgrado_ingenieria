"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { initialsFor, avatarColor } from "@/lib/ui/avatar";
import { formatRelative } from "@/lib/ui/dates";
import { IncidentDrawer } from "./IncidentDrawer";
import {
  INCIDENT_STATUSES,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  STATUS_LABEL,
  STATUS_TOKEN,
  type CategoryOption,
  type IncidentRow,
  type IncidentSeverityKey,
  type IncidentStatusKey,
  type PermFlags,
  type Person,
} from "./types";
import "./incidents.css";

type Props = {
  rows: IncidentRow[];
  categories: CategoryOption[];
  assignees: Person[];
  perms: PermFlags;
};

type StatusFilter = IncidentStatusKey | "all";

export function IncidentsClient({ rows, categories, assignees, perms }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<IncidentSeverityKey | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of INCIDENT_STATUSES) c[s] = 0;
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severity !== "all" && r.severity !== severity) return false;
      if (category !== "all" && r.categoryName !== category) return false;
      if (q) {
        const hay =
          `${r.code} ${r.title} ${r.reporterName ?? ""} ${r.assignee?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, severity, category, query]);

  const hasFilters =
    severity !== "all" || category !== "all" || query.trim() !== "";

  const tabs: StatusFilter[] = ["all", ...INCIDENT_STATUSES];

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Incidentes</h1>
          <span className="page__sub">
            {rows.length} {rows.length === 1 ? "reporte" : "reportes"}
          </span>
        </div>
      </div>

      {/* Status tabs */}
      <div className="page__tabs inc-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={`tab ${statusFilter === t ? "is-active" : ""}`}
            onClick={() => setStatusFilter(t)}
          >
            {t === "all" ? "Todos" : STATUS_LABEL[t]}
            <span className="tab__count">{counts[t] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="filterbar">
        <div className="inc-search">
          <Icon name="search" size={18} className="inc-search__icon" />
          <input
            type="text"
            placeholder="Buscar por código, título o persona"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="topbar__search-clear"
              onClick={() => setQuery("")}
              aria-label="Borrar búsqueda"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        <select
          className="inc-select"
          value={severity}
          onChange={(e) =>
            setSeverity(e.target.value as IncidentSeverityKey | "all")
          }
          aria-label="Filtrar por severidad"
        >
          <option value="all">Toda severidad</option>
          {(Object.keys(SEVERITY_LABEL) as IncidentSeverityKey[]).map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          className="inc-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filtrar por categoría"
        >
          <option value="all">Toda categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            className="filterbar__clear"
            onClick={() => {
              setSeverity("all");
              setCategory("all");
              setQuery("");
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="tablewrap">
        <div className="tablewrap__scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th className="dtable__num">Código</th>
                <th>Título</th>
                <th>Categoría</th>
                <th>Severidad</th>
                <th>Estado</th>
                <th>Asignado</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="dtable__empty">
                  <td colSpan={7}>
                    <div className="empty">
                      <Icon name="inbox" size={40} />
                      <h3>Sin incidentes</h3>
                      <p>
                        {rows.length === 0
                          ? "Aún no se han registrado incidentes."
                          : "Ningún incidente coincide con los filtros."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} onClick={() => setOpenCode(r.code)}>
                    <td className="dtable__num">
                      <span className="inc-code">{r.code}</span>
                    </td>
                    <td>
                      <button
                        className="rowlink"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenCode(r.code);
                        }}
                      >
                        {r.title}
                      </button>
                    </td>
                    <td className="dtable__muted">{r.categoryName ?? "—"}</td>
                    <td>
                      <SeverityTag severity={r.severity} />
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      {r.assignee ? (
                        <span className="inc-assignee">
                          <span
                            className="avatar avatar--sm"
                            style={{ background: avatarColor(r.assignee.id) }}
                          >
                            {initialsFor(r.assignee.name)}
                          </span>
                          <span className="inc-assignee__name">
                            {r.assignee.name}
                          </span>
                        </span>
                      ) : (
                        <span className="dtable__muted">Sin asignar</span>
                      )}
                    </td>
                    <td className="dtable__muted">{formatRelative(r.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="tablefoot">
          <span>
            {filtered.length} de {rows.length} incidentes
          </span>
        </div>
      </div>

      {openCode && (
        <IncidentDrawer
          code={openCode}
          assignees={assignees}
          perms={perms}
          onClose={() => setOpenCode(null)}
        />
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: IncidentStatusKey }) {
  const token = STATUS_TOKEN[status];
  return (
    <span
      className="badge inc-badge"
      style={{
        background: `var(--st-${token}-bg)`,
        color: `var(--st-${token}-fg)`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: IncidentSeverityKey }) {
  return (
    <span className="sev-tag">
      <span className="sev-tag__dot" style={{ background: SEVERITY_COLOR[severity] }} />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
