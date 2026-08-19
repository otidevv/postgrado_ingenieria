"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { createTeacher, setTeacherActive, updateTeacherProfile } from "./actions";
import { TeacherModal } from "./TeacherModal";
import type { TeacherPerms, TeacherRow } from "./types";

export function DocentesView({ rows, perms }: { rows: TeacherRow[]; perms: TeacherPerms }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "create" | TeacherRow>("closed");

  const toggleActive = (t: TeacherRow) => {
    setError(null);
    setBusyId(t.id);
    startTransition(async () => {
      const res = await setTeacherActive(t.id, !t.active);
      setBusyId(null);
      if (!res.ok) setError(res.error);
    });
  };

  const activos = rows.filter((r) => r.active).length;

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Docentes</h1>
          <span className="page__sub">
            {rows.length} docente{rows.length === 1 ? "" : "s"} · {activos} activo{activos === 1 ? "" : "s"}
          </span>
        </div>
        {perms.canWrite && (
          <button className="btn btn--primary" onClick={() => setModal("create")}>
            <Icon name="plus" size={16} />
            Nuevo docente
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
            <Icon name="user" size={40} />
            <h3>Aún no hay docentes</h3>
            <p>Crea el primer docente para poder asignarlo a los módulos de un diplomado.</p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Docente</th>
                  <th>Especialidad</th>
                  <th className="dtable__num">Módulos</th>
                  <th>Estado</th>
                  <th className="dtable__settings">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const isBusy = pending && busyId === t.id;
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {t.academicDegree} {t.name}
                        </div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>{t.email}</div>
                      </td>
                      <td className="dtable__muted">{t.specialty ?? "—"}</td>
                      <td className="dtable__num">{t.moduleCount}</td>
                      <td>
                        <span className={`badge ${t.active ? "badge--green" : "badge--neutral"}`}>
                          {t.active ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      <td className="dtable__settings">
                        {perms.canWrite && (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button className="btn btn--ghost" onClick={() => setModal(t)}>
                              Editar
                            </button>
                            <button
                              className="btn btn--ghost"
                              disabled={isBusy}
                              onClick={() => toggleActive(t)}
                            >
                              {isBusy ? "…" : t.active ? "Suspender" : "Reactivar"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal !== "closed" && (
        <TeacherModal
          initial={modal === "create" ? null : modal}
          onClose={() => setModal("closed")}
          onCreate={createTeacher}
          onUpdate={updateTeacherProfile}
        />
      )}
    </div>
  );
}
