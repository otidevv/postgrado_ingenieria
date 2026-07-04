"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import {
  ACADEMIC_DEGREES,
  ACCEPT_ATTR,
  DOC_TYPES,
  DOCUMENT_SLOTS,
  GENDERS,
  INITIAL_SUBMIT_STATE,
  MAX_FILE_BYTES,
  fmtBytes,
} from "@/lib/applications";
import { submitApplication } from "./actions";
import "./postular.css";

export function PostularForm({
  slug,
  diplomaTitle,
  modality,
}: {
  slug: string;
  diplomaTitle: string;
  modality: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitApplication,
    INITIAL_SUBMIT_STATE,
  );

  const fe = state.status === "error" ? state.fieldErrors ?? {} : {};
  const err = (name: string) =>
    fe[name] ? <span className="ps-err">{fe[name]}</span> : null;
  const cls = (name: string) => `ps-input${fe[name] ? " is-invalid" : ""}`;

  if (state.status === "success") {
    return (
      <div className="ps-done">
        <span className="ps-done__icon">
          <Icon name="check" size={34} />
        </span>
        <h2>¡Postulación registrada!</h2>
        <p>
          Recibimos tu postulación al <b>Diplomado en {diplomaTitle}</b>. Guarda
          tu código de seguimiento:
        </p>
        <div className="ps-code">{state.code}</div>
        <p className="ps-done__note">
          Nuestro equipo de la Escuela de Posgrado revisará tus documentos y se
          comunicará contigo al correo registrado. Si necesitas asistencia,
          menciona tu código de seguimiento.
        </p>
        <div className="ps-done__actions">
          <Link href={`/diplomado/${slug}`} className="ps-btn ps-btn--primary">
            Volver al diplomado
          </Link>
          <Link href="/" className="ps-btn ps-btn--ghost">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="ps-form" noValidate>
      <input type="hidden" name="slug" value={slug} />

      {state.status === "error" && (
        <div className="ps-alert" role="alert">
          <Icon name="alert" size={18} />
          <span>{state.message}</span>
        </div>
      )}

      {/* ── Datos personales ── */}
      <fieldset className="ps-sect">
        <legend>1. Datos personales</legend>
        <div className="ps-grid">
          <label className="ps-field">
            <span className="ps-label">Tipo de documento *</span>
            <select name="docType" defaultValue="DNI" className={cls("docType")}>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            {err("docType")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Número de documento *</span>
            <input
              name="docNumber"
              inputMode="text"
              autoComplete="off"
              className={cls("docNumber")}
              placeholder="Ej. 71234567"
            />
            {err("docNumber")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Nombres *</span>
            <input name="firstName" className={cls("firstName")} autoComplete="given-name" />
            {err("firstName")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Apellidos *</span>
            <input name="lastName" className={cls("lastName")} autoComplete="family-name" />
            {err("lastName")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Fecha de nacimiento</span>
            <input type="date" name="birthDate" className={cls("birthDate")} />
          </label>
          <label className="ps-field">
            <span className="ps-label">Sexo</span>
            <select name="gender" defaultValue="" className={cls("gender")}>
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      {/* ── Contacto ── */}
      <fieldset className="ps-sect">
        <legend>2. Contacto</legend>
        <div className="ps-grid">
          <label className="ps-field">
            <span className="ps-label">Correo electrónico *</span>
            <input
              type="email"
              name="email"
              className={cls("email")}
              autoComplete="email"
              placeholder="nombre@correo.com"
            />
            {err("email")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Celular / teléfono *</span>
            <input
              name="phone"
              className={cls("phone")}
              autoComplete="tel"
              placeholder="Ej. 987654321"
            />
            {err("phone")}
          </label>
          <label className="ps-field ps-field--wide">
            <span className="ps-label">Dirección</span>
            <input name="address" className={cls("address")} autoComplete="street-address" />
          </label>
          <label className="ps-field">
            <span className="ps-label">Región</span>
            <input name="region" className={cls("region")} placeholder="Madre de Dios" />
          </label>
          <label className="ps-field">
            <span className="ps-label">Provincia</span>
            <input name="province" className={cls("province")} placeholder="Tambopata" />
          </label>
          <label className="ps-field">
            <span className="ps-label">Distrito</span>
            <input name="district" className={cls("district")} placeholder="Puerto Maldonado" />
          </label>
        </div>
      </fieldset>

      {/* ── Formación y experiencia ── */}
      <fieldset className="ps-sect">
        <legend>3. Formación y experiencia</legend>
        <div className="ps-grid">
          <label className="ps-field">
            <span className="ps-label">Grado académico *</span>
            <select name="academicDegree" defaultValue="" className={cls("academicDegree")}>
              <option value="">Selecciona…</option>
              {ACADEMIC_DEGREES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {err("academicDegree")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Profesión / especialidad</span>
            <input name="profession" className={cls("profession")} />
          </label>
          <label className="ps-field ps-field--wide">
            <span className="ps-label">Universidad o institución de procedencia</span>
            <input name="university" className={cls("university")} />
          </label>
          <label className="ps-field">
            <span className="ps-label">Centro laboral</span>
            <input name="employer" className={cls("employer")} />
          </label>
          <label className="ps-field">
            <span className="ps-label">Cargo</span>
            <input name="position" className={cls("position")} />
          </label>
        </div>
      </fieldset>

      {/* ── Preferencias ── */}
      <fieldset className="ps-sect">
        <legend>4. Preferencias</legend>
        <div className="ps-grid">
          <label className="ps-field">
            <span className="ps-label">Modalidad de preferencia</span>
            <input
              name="modality"
              className={cls("modality")}
              defaultValue={modality}
            />
          </label>
          <label className="ps-field ps-field--full">
            <span className="ps-label">Carta de intención / motivación</span>
            <textarea
              name="motivation"
              rows={4}
              className={cls("motivation")}
              placeholder="Cuéntanos brevemente por qué deseas llevar este diplomado."
            />
          </label>
        </div>
      </fieldset>

      {/* ── Documentos ── */}
      <fieldset className="ps-sect">
        <legend>5. Documentos</legend>
        <p className="ps-hint">
          Formatos permitidos: PDF, JPG, PNG o WEBP · máximo {fmtBytes(MAX_FILE_BYTES)}{" "}
          por archivo.
        </p>
        <div className="ps-docs">
          {DOCUMENT_SLOTS.map((slot) => (
            <FileField
              key={slot.kind}
              name={slot.kind}
              label={slot.label + (slot.required ? " *" : "")}
              hint={slot.hint}
              error={fe[slot.kind]}
            />
          ))}
        </div>
      </fieldset>

      {/* ── Consentimiento ── */}
      <label className={`ps-consent${fe.consent ? " is-invalid" : ""}`}>
        <input type="checkbox" name="consent" value="yes" />
        <span>
          Autorizo a la Escuela de Posgrado de la UNAMAD a tratar mis datos
          personales y documentos con fines del proceso de admisión, conforme a
          la Ley N° 29733 de Protección de Datos Personales. *
        </span>
      </label>
      {err("consent")}

      <div className="ps-submit">
        <button type="submit" className="ps-btn ps-btn--primary ps-btn--lg" disabled={pending}>
          {pending ? "Enviando…" : "Enviar postulación"}
          {!pending && <Icon name="chevron-right" size={18} />}
        </button>
        <p className="ps-required-note">* Campos obligatorios</p>
      </div>
    </form>
  );
}

/** Campo de archivo con vista del nombre/tamaño seleccionado y validación en vivo. */
function FileField({
  name,
  label,
  hint,
  error,
}: {
  name: string;
  label: string;
  hint: string;
  error?: string;
}) {
  const [info, setInfo] = useState<{ name: string; size: number } | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const shown = localErr ?? error;

  return (
    <div className={`ps-doc${shown ? " is-invalid" : ""}`}>
      <div className="ps-doc__head">
        <span className="ps-doc__label">{label}</span>
        {info && (
          <span className="ps-doc__file">
            <Icon name="check" size={14} /> {info.name} · {fmtBytes(info.size)}
          </span>
        )}
      </div>
      <p className="ps-doc__hint">{hint}</p>
      <label className="ps-doc__drop">
        <Icon name="download" size={18} />
        <span>{info ? "Cambiar archivo" : "Seleccionar archivo"}</span>
        <input
          type="file"
          name={name}
          accept={ACCEPT_ATTR}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) {
              setInfo(null);
              setLocalErr(null);
              return;
            }
            if (f.size > MAX_FILE_BYTES) {
              setLocalErr(`El archivo supera el máximo de ${fmtBytes(MAX_FILE_BYTES)}.`);
              setInfo(null);
              e.target.value = "";
              return;
            }
            setLocalErr(null);
            setInfo({ name: f.name, size: f.size });
          }}
        />
      </label>
      {shown && <span className="ps-err">{shown}</span>}
    </div>
  );
}
