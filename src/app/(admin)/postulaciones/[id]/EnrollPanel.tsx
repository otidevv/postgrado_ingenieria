"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { enrollFromApplication } from "../../matriculas/actions";
import type { EnrollOutcome } from "../../matriculas/types";

type Props = {
  applicationId: string;
  status: string; // ApplicationStatus
  canEnroll: boolean; // enrollments.write
  existing: { id: string; status: string } | null; // matrícula ya creada
};

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  active: "matrícula activa",
  withdrawn: "matrícula retirada",
  completed: "matrícula concluida",
};

export function EnrollPanel({ applicationId, status, canEnroll, existing }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<EnrollOutcome | null>(null);

  if (status !== "accepted") return null;

  const enroll = () => {
    setError(null);
    startTransition(async () => {
      const res = await enrollFromApplication(applicationId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOutcome(res.data!);
    });
  };

  return (
    <section className="ps-card">
      <h2 className="ps-card__title">Matrícula</h2>

      {existing || outcome ? (
        <>
          <p className="ps-empty-note">
            {outcome
              ? "Matrícula creada correctamente."
              : `Este postulante ya está matriculado. (${
                  existing ? (ENROLLMENT_STATUS_LABEL[existing.status] ?? existing.status) : ""
                })`}
          </p>
          {outcome?.tempPassword && (
            <div className="banner">
              <span className="banner__icon">
                <Icon name="lock" size={18} />
              </span>
              <p>
                Cuenta: <b>{outcome.studentEmail}</b>
                <br />
                Contraseña temporal: <code>{outcome.tempPassword}</code>
                <br />
                Guárdala ahora — no se volverá a mostrar.
              </p>
            </div>
          )}
          <Link href="/matriculas" className="linkbtn">
            <Icon name="external" size={15} />
            Ver matrículas
          </Link>
        </>
      ) : (
        <>
          <p className="ps-empty-note">
            La postulación está aceptada. Al matricular se crea la cuenta del
            estudiante (si no existe) y su matrícula en el diplomado.
          </p>
          {error && (
            <div className="banner" role="alert" style={{ borderColor: "#f5c2c7", marginBottom: 10 }}>
              <span className="banner__icon" style={{ color: "#d93025" }}>
                <Icon name="alert" size={18} />
              </span>
              <p>{error}</p>
            </div>
          )}
          {canEnroll && (
            <button className="btn btn--primary" disabled={pending} onClick={enroll}>
              {pending ? "Matriculando…" : "Matricular"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
