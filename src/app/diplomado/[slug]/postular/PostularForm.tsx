"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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

  // ── Autocompletado por DNI (consulta a la API institucional vía /api/dni) ──
  const [docType, setDocType] = useState("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [dniLookup, setDniLookup] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    message?: string;
  }>({ status: "idle" });
  const [pendingDni, setPendingDni] = useState<{
    dni: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: string;
    address: string;
  } | null>(null);
  const lastDni = useRef("");
  const [showErrorModal, setShowErrorModal] = useState(false);

  async function lookupDni(value: string) {
    if (docType !== "DNI" || !/^\d{8}$/.test(value)) return;
    if (lastDni.current === value && dniLookup.status === "ok") return;
    lastDni.current = value;
    setDniLookup({ status: "loading" });
    try {
      const res = await fetch(`/api/dni/${value}`);
      const data = await res.json();
      if (!res.ok) {
        setDniLookup({
          status: "error",
          message: data?.error ?? "No se pudo consultar el DNI.",
        });
        return;
      }
      // Autocompleta los campos y muestra un modal informativo.
      if (data.firstName) setFirstName(data.firstName);
      if (data.lastName) setLastName(data.lastName);
      if (data.birthDate) setBirthDate(data.birthDate);
      if (data.gender) setGender(data.gender);
      if (data.address) setAddress(data.address);
      setPendingDni({
        dni: value,
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        birthDate: data.birthDate ?? "",
        gender: data.gender ?? "",
        address: data.address ?? "",
      });
      setDniLookup({ status: "idle" });
    } catch {
      setDniLookup({
        status: "error",
        message: "No se pudo conectar con el servicio de consulta.",
      });
    }
  }

  function dismissDni() {
    setPendingDni(null);
    setDniLookup({
      status: "ok",
      message: "Datos autocompletados desde tu DNI.",
    });
  }

  // Abre un modal cuando el envío falla con un error de negocio/servidor.
  useEffect(() => {
    if (state.status === "error" && state.modal) setShowErrorModal(true);
  }, [state]);

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
    <>
    <form action={formAction} className="ps-form" noValidate>
      <input type="hidden" name="slug" value={slug} />

      {state.status === "error" && !state.modal && (
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
            <select
              name="docType"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={cls("docType")}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            {err("docType")}
          </label>
          <div className="ps-field">
            <span className="ps-label">Número de documento *</span>
            <div className="ps-dni-row">
              <input
                name="docNumber"
                aria-label="Número de documento"
                value={docNumber}
                onChange={(e) => {
                  const v =
                    docType === "DNI"
                      ? e.target.value.replace(/\D/g, "").slice(0, 8)
                      : e.target.value;
                  setDocNumber(v);
                  if (docType === "DNI" && /^\d{8}$/.test(v)) void lookupDni(v);
                }}
                inputMode={docType === "DNI" ? "numeric" : "text"}
                autoComplete="off"
                className={cls("docNumber")}
                placeholder="Ej. 71234567"
              />
              {docType === "DNI" && (
                <button
                  type="button"
                  className="ps-dni-btn"
                  onClick={() => void lookupDni(docNumber)}
                  disabled={
                    !/^\d{8}$/.test(docNumber) || dniLookup.status === "loading"
                  }
                >
                  {dniLookup.status === "loading" ? "Buscando…" : "Autocompletar"}
                </button>
              )}
            </div>
            {docType === "DNI" && dniLookup.status !== "idle" && (
              <span className={`ps-dni-msg ps-dni-msg--${dniLookup.status}`}>
                {dniLookup.status === "loading"
                  ? "Consultando datos del DNI…"
                  : dniLookup.message}
              </span>
            )}
            {err("docNumber")}
          </div>
          <label className="ps-field">
            <span className="ps-label">Nombres *</span>
            <input
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={cls("firstName")}
              autoComplete="given-name"
            />
            {err("firstName")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Apellidos *</span>
            <input
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={cls("lastName")}
              autoComplete="family-name"
            />
            {err("lastName")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Fecha de nacimiento</span>
            <input
              type="date"
              name="birthDate"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={cls("birthDate")}
            />
          </label>
          <label className="ps-field">
            <span className="ps-label">Sexo</span>
            <select
              name="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={cls("gender")}
            >
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
            <input
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={cls("address")}
              autoComplete="street-address"
            />
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
    {pendingDni && <DniModal data={pendingDni} onClose={dismissDni} />}
    {showErrorModal && state.status === "error" && (
      <ErrorModal
        message={state.message}
        onClose={() => setShowErrorModal(false)}
      />
    )}
    </>
  );
}

/** Modal informativo: avisa que los datos se autocompletaron desde el DNI. */
function DniModal({
  data,
  onClose,
}: {
  data: {
    dni: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: string;
    address: string;
  };
  onClose: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const genderLabel = GENDERS.find((g) => g.value === data.gender)?.label ?? "—";
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
  };

  const rows: { label: string; value: string }[] = [
    { label: "Nombres", value: data.firstName },
    { label: "Apellidos", value: data.lastName },
    {
      label: "Fecha de nacimiento",
      value: data.birthDate ? fmtDate(data.birthDate) : "—",
    },
    { label: "Sexo", value: genderLabel },
    { label: "Dirección", value: data.address },
  ];

  return (
    <div
      className="ps-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ps-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ps-dni-modal-title"
      >
        <div className="ps-modal__head">
          <span className="ps-modal__icon">
            <Icon name="check" size={24} />
          </span>
          <div className="ps-modal__heading">
            <h3 id="ps-dni-modal-title" className="ps-modal__title">
              ¡Datos autocompletados!
            </h3>
            <p className="ps-modal__sub">DNI {data.dni}</p>
          </div>
          <button
            type="button"
            className="ps-modal__x"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="ps-modal__msg">
          Completamos tus datos personales a partir de tu DNI. Por favor,
          <b> revísalos</b> y corrige lo que haga falta antes de enviar tu
          postulación.
        </p>

        <dl className="ps-modal__list">
          {rows.map((r) => (
            <div key={r.label} className="ps-modal__row">
              <dt>{r.label}</dt>
              <dd>{r.value || "—"}</dd>
            </div>
          ))}
        </dl>

        <div className="ps-modal__actions">
          <button
            type="button"
            ref={okRef}
            className="ps-btn ps-btn--primary"
            onClick={onClose}
          >
            <Icon name="check" size={16} />
            Entendido, revisar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de error de envío (postulación duplicada, servicio no disponible, etc.). */
function ErrorModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="ps-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ps-modal__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ps-error-modal-title"
      >
        <div className="ps-modal__head">
          <span className="ps-modal__icon ps-modal__icon--error">
            <Icon name="alert" size={24} />
          </span>
          <div className="ps-modal__heading">
            <h3 id="ps-error-modal-title" className="ps-modal__title">
              No se pudo enviar
            </h3>
            <p className="ps-modal__sub">
              Revisa la información e inténtalo de nuevo
            </p>
          </div>
          <button
            type="button"
            className="ps-modal__x"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="ps-modal__msg ps-modal__msg--pad">{message}</p>

        <div className="ps-modal__actions">
          <button
            type="button"
            ref={okRef}
            className="ps-btn ps-btn--primary"
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
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
