"use client";

import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import type { TeachingModuleRow } from "./page";

export function DocenciaHome({ rows }: { rows: TeachingModuleRow[] }) {
  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Mi docencia</h1>
          <span className="page__sub">
            {rows.length} módulo{rows.length === 1 ? "" : "s"} a tu cargo
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="rules" size={40} />
            <h3>Sin módulos asignados</h3>
            <p>Cuando la coordinación te asigne un módulo, aparecerá aquí.</p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Diplomado</th>
                  <th className="dtable__num">Estudiantes</th>
                  <th className="dtable__num">Sesiones</th>
                  <th className="dtable__num">Evaluaciones</th>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div className="dtable__muted" style={{ fontSize: 12 }}>
                        {m.code} · Módulo {m.order}
                      </div>
                    </td>
                    <td>{m.diplomaTitle}</td>
                    <td className="dtable__num">{m.studentCount}</td>
                    <td className="dtable__num">{m.sessionCount}</td>
                    <td className="dtable__num">{m.assessmentCount}</td>
                    <td className="dtable__settings">
                      <Link className="btn btn--primary" href={`/docencia/${m.id}`}>
                        Gestionar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
