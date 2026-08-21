"use client";

import { useEffect, useState, useTransition } from "react";
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

/* Pasos que se muestran mientras corre la acción. La acción es una sola
   llamada al servidor; los dos primeros pasos avanzan con un temporizador y
   el último queda "en curso" hasta que llega la respuesta. */
const STEPS = [
  { key: "account", label: "Creando la cuenta del estudiante" },
  { key: "enroll", label: "Registrando la matrícula en el diplomado" },
  { key: "mail", label: "Enviando credenciales de acceso al correo" },
] as const;

function useFakeProgress(active: boolean): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);
  return active ? step : 0;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="enr__copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* sin portapapeles: el valor sigue visible */
        }
      }}
      aria-label="Copiar contraseña"
    >
      <Icon name={copied ? "check" : "card"} size={14} />
      {copied ? "Copiada" : "Copiar"}
    </button>
  );
}

export function EnrollPanel({ applicationId, status, canEnroll, existing }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<EnrollOutcome | null>(null);
  const step = useFakeProgress(pending);

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

  /* ── En curso ── */
  if (pending) {
    return (
      <section className="ps-card enr" aria-busy="true" aria-live="polite">
        <h2 className="ps-card__title">Matrícula</h2>
        <p className="enr__lead">Matriculando y enviando credenciales de acceso…</p>
        <ol className="enr__steps">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "todo";
            return (
              <li key={s.key} className={`enr__step is-${state}`}>
                <span className="enr__dot">
                  {state === "done" ? (
                    <Icon name="check" size={13} />
                  ) : state === "active" ? (
                    <span className="enr__spin" />
                  ) : (
                    <span className="enr__idx">{i + 1}</span>
                  )}
                </span>
                <span>{s.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="enr__hint">No cierres esta página hasta que termine.</p>
      </section>
    );
  }

  /* ── Completada (ahora o antes) ── */
  if (existing || outcome) {
    return (
      <section className="ps-card enr">
        <h2 className="ps-card__title">Matrícula</h2>

        {outcome ? (
          <>
            <div className="enr__done">
              <span className="enr__done-icon">
                <Icon name="check" size={22} />
              </span>
              <div>
                <div className="enr__done-title">Matrícula completada</div>
                <div className="enr__done-sub">
                  Estudiante registrado en el diplomado con la cuenta{" "}
                  <b>{outcome.studentEmail}</b>.
                </div>
              </div>
            </div>

            <ul className="enr__result">
              <li className="is-ok">
                <Icon name="check" size={15} />
                <span>
                  {outcome.tempPassword
                    ? "Cuenta de estudiante creada"
                    : "El correo ya tenía cuenta; conserva su contraseña"}
                </span>
              </li>
              <li className="is-ok">
                <Icon name="check" size={15} />
                <span>Matrícula registrada</span>
              </li>
              <li className={outcome.emailSent ? "is-ok" : "is-warn"}>
                <Icon name={outcome.emailSent ? "check" : "alert"} size={15} />
                <span>
                  {outcome.emailSent
                    ? `Credenciales de acceso enviadas a ${outcome.studentEmail}`
                    : `No se pudo enviar el correo: ${
                        outcome.emailError ?? "error desconocido"
                      }. Comparte las credenciales manualmente.`}
                </span>
              </li>
            </ul>

            {outcome.tempPassword && (
              <div className="enr__creds">
                <div className="enr__creds-hd">
                  <Icon name="lock" size={15} />
                  Credenciales de acceso
                  <span className="enr__creds-note">Solo se muestran una vez</span>
                </div>
                <dl className="enr__creds-list">
                  <div>
                    <dt>Usuario</dt>
                    <dd>{outcome.studentEmail}</dd>
                  </div>
                  <div>
                    <dt>Contraseña temporal</dt>
                    <dd>
                      <code>{outcome.tempPassword}</code>
                      <CopyButton value={outcome.tempPassword} />
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </>
        ) : (
          <p className="ps-empty-note">
            Este postulante ya está matriculado (
            {existing ? (ENROLLMENT_STATUS_LABEL[existing.status] ?? existing.status) : ""}
            ).
          </p>
        )}

        <Link href="/matriculas" className="linkbtn">
          <Icon name="external" size={15} />
          Ver matrículas
        </Link>
      </section>
    );
  }

  /* ── Pendiente de matricular ── */
  return (
    <section className="ps-card enr">
      <h2 className="ps-card__title">Matrícula</h2>
      <p className="ps-empty-note">
        La postulación está admitida. Al matricular se crea la cuenta del
        estudiante (si no existe), se registra su matrícula y se le envían las
        credenciales de acceso a su correo.
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
        <button className="btn btn--primary" onClick={enroll}>
          <Icon name="award" size={16} />
          Matricular y enviar credenciales
        </button>
      )}
    </section>
  );
}
