"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/admin/Icon";
import { useEscClose } from "@/lib/ui/useEscClose";
import type { ActionResult, TeacherInput, TeacherProfileInput, TeacherRow } from "./types";

type Props = {
  /** null = crear; TeacherRow = editar perfil académico. */
  initial: TeacherRow | null;
  onClose: () => void;
  onCreate: (input: TeacherInput) => Promise<ActionResult<{ id: string }>>;
  onUpdate: (profileId: string, input: TeacherProfileInput) => Promise<ActionResult>;
};

const DEGREES = ["Mg.", "Dr.", "Ing.", "Lic.", "MSc.", "PhD."];

export function TeacherModal({ initial, onClose, onCreate, onUpdate }: Props) {
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [academicDegree, setAcademicDegree] = useState(initial?.academicDegree ?? "Mg.");
  const [specialty, setSpecialty] = useState(initial?.specialty ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [orcid, setOrcid] = useState(initial?.orcid ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [offerConvert, setOfferConvert] = useState(false);

  useEscClose(true, onClose, submitting);

  const valid = editing
    ? academicDegree.trim().length >= 2
    : name.trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(email) &&
      (offerConvert || password.length >= 6) &&
      academicDegree.trim().length >= 2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setTopError(null);
    setFieldErrors({});

    const profile: TeacherProfileInput = {
      academicDegree: academicDegree.trim(),
      specialty: specialty.trim() || undefined,
      bio: bio.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
      orcid: orcid.trim() || undefined,
    };

    const res = editing
      ? await onUpdate(initial.id, profile)
      : await onCreate({
          ...profile,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          convertExisting: offerConvert,
        });

    if (!res.ok) {
      if (res.error === "EXISTING_USER") {
        setOfferConvert(true);
        setTopError(
          "Este correo ya pertenece a un usuario del sistema. Si continúas, se le añadirá el rol Docente y su perfil académico (su contraseña actual no cambia).",
        );
      } else {
        setTopError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
      setSubmitting(false);
      return;
    }
    onClose();
  };

  const err = (key: string) =>
    fieldErrors[key] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[key]}</span>
    ) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <h2>{editing ? "Editar docente" : "Nuevo docente"}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="modal__body">
          {topError && (
            <div className="login__error" role="alert" style={{ marginBottom: 16 }}>
              <Icon name="info" size={16} />
              <span>{topError}</span>
            </div>
          )}

          {!editing && (
            <>
              <label className="field">
                <span className="field__label">
                  Nombre completo<span className="field__req">*</span>
                </span>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="p. ej. Nelly J. Ulloa Gallardo"
                  aria-invalid={!!fieldErrors.name}
                />
                {err("name")}
              </label>

              <label className="field">
                <span className="field__label">
                  Correo<span className="field__req">*</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setOfferConvert(false);
                  }}
                  placeholder="docente@unamad.edu.pe"
                  aria-invalid={!!fieldErrors.email}
                />
                {err("email")}
              </label>

              {!offerConvert && (
                <label className="field">
                  <span className="field__label">
                    Contraseña inicial<span className="field__req">*</span>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="mínimo 6 caracteres"
                    aria-invalid={!!fieldErrors.password}
                    autoComplete="new-password"
                  />
                  {err("password")}
                </label>
              )}
            </>
          )}

          <label className="field">
            <span className="field__label">
              Grado académico<span className="field__req">*</span>
            </span>
            <select
              value={academicDegree}
              onChange={(e) => setAcademicDegree(e.target.value)}
              aria-invalid={!!fieldErrors.academicDegree}
            >
              {DEGREES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {err("academicDegree")}
          </label>

          <label className="field">
            <span className="field__label">Especialidad</span>
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="p. ej. Redes y Seguridad"
            />
          </label>

          <label className="field">
            <span className="field__label">Reseña (bio)</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Trayectoria breve del docente"
            />
          </label>

          <label className="field">
            <span className="field__label">Foto (URL)</span>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
              aria-invalid={!!fieldErrors.photoUrl}
            />
            {err("photoUrl")}
          </label>

          <label className="field">
            <span className="field__label">ORCID</span>
            <input
              type="text"
              value={orcid}
              onChange={(e) => setOrcid(e.target.value)}
              placeholder="0000-0000-0000-0000"
            />
          </label>
        </div>
        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid || submitting}>
            {submitting
              ? "Guardando…"
              : editing
                ? "Guardar cambios"
                : offerConvert
                  ? "Convertir en docente"
                  : "Crear docente"}
          </button>
        </footer>
      </form>
    </div>
  );
}
