"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/admin/Icon";
import { useEscClose } from "@/lib/ui/useEscClose";
import type { ActionResult, DiplomaOption, EnrollOutcome, ManualEnrollInput } from "./types";

type Props = {
  diplomas: DiplomaOption[];
  onClose: () => void;
  onSubmit: (input: ManualEnrollInput) => Promise<ActionResult<EnrollOutcome>>;
};

export function ManualEnrollModal({ diplomas, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [docType, setDocType] = useState<ManualEnrollInput["docType"]>("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [diplomaId, setDiplomaId] = useState(diplomas[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [done, setDone] = useState<EnrollOutcome | null>(null);

  useEscClose(true, onClose, submitting);

  const valid =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    docNumber.trim().length >= 6 &&
    diplomaId !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setTopError(null);
    setFieldErrors({});
    const res = await onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      docType,
      docNumber: docNumber.trim(),
      phone: phone.trim() || undefined,
      diplomaId,
    });
    setSubmitting(false);
    if (!res.ok) {
      setTopError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }
    setDone(res.data!);
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <div className="modal-backdrop" onClick={done ? undefined : onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <h2>{done ? "Matrícula creada" : "Matrícula manual"}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </header>

        {done ? (
          <div className="modal__body">
            <p className="modal__intro">
              El estudiante <b>{done.studentEmail}</b> quedó matriculado.
            </p>
            {done.tempPassword ? (
              <div className="banner">
                <span className="banner__icon">
                  <Icon name="lock" size={18} />
                </span>
                <p>
                  Contraseña temporal: <code>{done.tempPassword}</code>
                  <br />
                  Guárdala ahora — no se volverá a mostrar.
                </p>
              </div>
            ) : (
              <p className="modal__intro">
                El correo ya tenía cuenta; su contraseña no cambió.
              </p>
            )}
            <footer className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Entendido
              </button>
            </footer>
          </div>
        ) : (
          <>
            <div className="modal__body">
              {topError && (
                <div className="login__error" role="alert" style={{ marginBottom: 16 }}>
                  <Icon name="info" size={16} />
                  <span>{topError}</span>
                </div>
              )}
              <label className="field">
                <span className="field__label">Nombre completo<span className="field__req">*</span></span>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
                {err("name")}
              </label>
              <label className="field">
                <span className="field__label">Correo<span className="field__req">*</span></span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email} />
                {err("email")}
              </label>
              <label className="field">
                <span className="field__label">Contraseña inicial (solo si el correo no tiene cuenta)</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                />
                {err("password")}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field__label">Tipo doc.</span>
                  <select value={docType} onChange={(e) => setDocType(e.target.value as ManualEnrollInput["docType"]) }>
                    <option value="DNI">DNI</option>
                    <option value="CE">CE</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Nº de documento<span className="field__req">*</span></span>
                  <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} aria-invalid={!!fieldErrors.docNumber} />
                  {err("docNumber")}
                </label>
              </div>
              <label className="field">
                <span className="field__label">Teléfono</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Diplomado<span className="field__req">*</span></span>
                <select value={diplomaId} onChange={(e) => setDiplomaId(e.target.value)} aria-invalid={!!fieldErrors.diplomaId}>
                  {diplomas.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
                {err("diplomaId")}
              </label>
            </div>
            <footer className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={!valid || submitting}>
                {submitting ? "Matriculando…" : "Matricular"}
              </button>
            </footer>
          </>
        )}
      </form>
    </div>
  );
}
