"use client";

import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import type { AulaDiploma } from "./page";

export function AulaHome({ rows }: { rows: AulaDiploma[] }) {
  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Mi aula</h1>
          <span className="page__sub">
            {rows.length} diplomado{rows.length === 1 ? "" : "s"} en curso
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="apps" size={40} />
            <h3>Sin matrículas activas</h3>
            <p>Cuando tu matrícula esté activa, tus cursos aparecerán aquí.</p>
          </div>
        </div>
      ) : (
        rows.map((d) => (
          <div key={d.enrollmentId} className="tablewrap" style={{ marginBottom: 16 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{d.diplomaTitle}</h2>
            </div>
            <div className="tablewrap__scroll">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Módulo</th>
                    <th>Docente</th>
                    <th className="dtable__settings">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {d.modules.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>Módulo {m.order}</div>
                      </td>
                      <td className="dtable__muted">{m.teacherLabel ?? "Por asignar"}</td>
                      <td className="dtable__settings">
                        <Link className="btn btn--primary" href={`/aula/modulo/${m.id}`}>
                          Entrar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
