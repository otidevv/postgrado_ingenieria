"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import { createManualEnrollment, setEnrollmentStatus } from "./actions";
import { ManualEnrollModal } from "./ManualEnrollModal";
import type { DiplomaOption, EnrollPerms, EnrollmentRow, EnrollmentStatus } from "./types";

const STATUS_META: Record<EnrollmentStatus, { label: string; badge: string }> = {
  active: { label: "Activa", badge: "badge--green" },
  withdrawn: { label: "Retirada", badge: "badge--amber" },
  completed: { label: "Concluida", badge: "badge--neutral" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function MatriculasView({
  rows,
  diplomas,
  perms,
}: {
  rows: EnrollmentRow[];
  diplomas: DiplomaOption[];
  perms: EnrollPerms;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [fDiploma, setFDiploma] = useState("");
  const [fStatus, setFStatus] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (fDiploma === "" || r.diplomaId === fDiploma) &&
          (fStatus === "" || r.status === fStatus),
      ),
    [rows, fDiploma, fStatus],
  );

  const changeStatus = (id: string, status: EnrollmentStatus) => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await setEnrollmentStatus(id, status);
      setBusyId(null);
      if (!res.ok) setError(res.error);
    });
  };

  const activas = rows.filter((r) => r.status === "active").length;

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>Matrículas</h1>
          <span className="page__sub">
            {rows.length} matrícula{rows.length === 1 ? "" : "s"} · {activas} activa{activas === 1 ? "" : "s"}
          </span>
        </div>
        {perms.canWrite && (
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            <Icon name="plus" size={16} />
            Matrícula manual
          </button>
        )}
      </div>

      <div className="filterbar" style={{ marginBottom: 14 }}>
        <select className="selectctl" value={fDiploma} onChange={(e) => setFDiploma(e.target.value)}>
          <option value="">Todos los diplomados</option>
          {diplomas.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
        <select className="selectctl" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="withdrawn">Retirada</option>
          <option value="completed">Concluida</option>
        </select>
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          <span className="banner__icon">
            <Icon name="alert" size={18} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="tablewrap">
          <div className="empty">
            <Icon name="folder" size={40} />
            <h3>Sin matrículas</h3>
            <p>Matricula postulantes aceptados desde su postulación, o usa la matrícula manual.</p>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <div className="tablewrap__scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Documento</th>
                  <th>Diplomado</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Fecha</th>
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
                        <div style={{ fontWeight: 500 }}>{r.studentName}</div>
                        <div className="dtable__muted" style={{ fontSize: 12 }}>{r.studentEmail}</div>
                      </td>
                      <td className="dtable__muted dtable__nowrap">{r.docLabel}</td>
                      <td>{r.diplomaTitle}</td>
                      <td className="dtable__muted dtable__nowrap">
                        {r.origin === "postulacion" ? (r.applicationCode ?? "Postulación") : "Manual"}
                      </td>
                      <td>
                        <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                      <td className="dtable__muted dtable__nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="dtable__settings">
                        {perms.canWrite && (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            {r.status === "active" ? (
                              <>
                                <button className="btn btn--ghost btn--ghost-danger" disabled={isBusy} onClick={() => changeStatus(r.id, "withdrawn")}>
                                  {isBusy ? "…" : "Retirar"}
                                </button>
                                <button className="btn btn--ghost" disabled={isBusy} onClick={() => changeStatus(r.id, "completed")}>
                                  {isBusy ? "…" : "Concluir"}
                                </button>
                              </>
                            ) : (
                              <button className="btn btn--ghost" disabled={isBusy} onClick={() => changeStatus(r.id, "active")}>
                                {isBusy ? "…" : "Reactivar"}
                              </button>
                            )}
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

      {showModal && (
        <ManualEnrollModal
          diplomas={diplomas}
          onClose={() => setShowModal(false)}
          onSubmit={createManualEnrollment}
        />
      )}
    </div>
  );
}
