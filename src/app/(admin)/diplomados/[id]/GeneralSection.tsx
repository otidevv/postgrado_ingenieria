"use client";

import { useState, useTransition } from "react";
import { updateDiplomaGeneral } from "./actions";
import type { EditorDiploma, GeneralInput } from "./types";

export function GeneralSection({ diploma, canWrite }: { diploma: EditorDiploma; canWrite: boolean }) {
  const [form, setForm] = useState<GeneralInput>({
    title: diploma.title,
    slug: diploma.slug,
    code: diploma.code,
    subtitle: diploma.subtitle ?? "",
    faculty: diploma.faculty,
    summary: diploma.summary,
    description: diploma.description,
    objective: diploma.objective,
    modality: diploma.modality,
    schedule: diploma.schedule,
    admissionLabel: diploma.admissionLabel ?? "",
    featured: diploma.featured,
    order: diploma.order,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const set = <K extends keyof GeneralInput>(k: K, v: GeneralInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await updateDiplomaGeneral(diploma.id, form);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setSaved(true);
    });
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Datos generales</h2>
      </div>
      <div className="edsec__grid">
        <label className="field field--full">
          <span className="field__label">Título</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.title} />
          {err("title")}
        </label>
        <label className="field">
          <span className="field__label">Slug (URL)</span>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.slug} />
          {err("slug")}
        </label>
        <label className="field">
          <span className="field__label">Código</span>
          <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} disabled={!canWrite} aria-invalid={!!fieldErrors.code} />
          {err("code")}
        </label>
        <label className="field">
          <span className="field__label">Subtítulo</span>
          <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} disabled={!canWrite} placeholder="Diplomado de Posgrado" />
        </label>
        <label className="field">
          <span className="field__label">Facultad</span>
          <input value={form.faculty} onChange={(e) => set("faculty", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.faculty} />
          {err("faculty")}
        </label>
        <label className="field">
          <span className="field__label">Modalidad</span>
          <input value={form.modality} onChange={(e) => set("modality", e.target.value)} disabled={!canWrite} placeholder="Semipresencial · Google Meet" aria-invalid={!!fieldErrors.modality} />
          {err("modality")}
        </label>
        <label className="field">
          <span className="field__label">Horario</span>
          <input value={form.schedule} onChange={(e) => set("schedule", e.target.value)} disabled={!canWrite} placeholder="Viernes y sábado" aria-invalid={!!fieldErrors.schedule} />
          {err("schedule")}
        </label>
        <label className="field">
          <span className="field__label">Etiqueta de admisión</span>
          <input value={form.admissionLabel} onChange={(e) => set("admissionLabel", e.target.value)} disabled={!canWrite} placeholder="Admisión 2026-II" />
        </label>
        <label className="field">
          <span className="field__label">Orden</span>
          <input
            type="number"
            min={0}
            value={form.order}
            onChange={(e) => set("order", Number(e.target.value))}
            disabled={!canWrite}
            aria-invalid={!!fieldErrors.order}
          />
          {err("order")}
        </label>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => set("featured", e.target.checked)}
            disabled={!canWrite}
            style={{ width: "auto" }}
          />
          <span className="field__label" style={{ margin: 0 }}>Destacado en la portada</span>
        </label>
        <label className="field field--full">
          <span className="field__label">Resumen (tarjetas)</span>
          <textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.summary} />
          {err("summary")}
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción (fundamentación)</span>
          <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.description} />
          {err("description")}
        </label>
        <label className="field field--full">
          <span className="field__label">Objetivo general</span>
          <textarea rows={3} value={form.objective} onChange={(e) => set("objective", e.target.value)} disabled={!canWrite} aria-invalid={!!fieldErrors.objective} />
          {err("objective")}
        </label>
      </div>
      {canWrite && (
        <div className="edsec__foot">
          {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
          {saved && !error && <span className="edsec__saved">Guardado ✓</span>}
          <button className="btn btn--primary" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar datos generales"}
          </button>
        </div>
      )}
    </section>
  );
}
