"use client";

import { useState, useTransition } from "react";
import { updateDiplomaMetrics } from "./actions";
import type { EditorDiploma, MetricsInput } from "./types";

const FIELDS: Array<{ key: keyof MetricsInput; label: string }> = [
  { key: "totalHours", label: "Horas totales" },
  { key: "credits", label: "Créditos" },
  { key: "weeksPerModule", label: "Semanas por módulo" },
  { key: "minEnrollment", label: "Matrícula mínima (alumnos)" },
  { key: "enrollmentFee", label: "Matrícula (S/)" },
  { key: "moduleFee", label: "Costo por módulo (S/)" },
  { key: "certificationFee", label: "Certificación (S/)" },
];

export function MetricsSection({ diploma, canWrite }: { diploma: EditorDiploma; canWrite: boolean }) {
  const [form, setForm] = useState<MetricsInput>({
    totalHours: diploma.totalHours,
    credits: diploma.credits,
    weeksPerModule: diploma.weeksPerModule,
    minEnrollment: diploma.minEnrollment,
    enrollmentFee: diploma.enrollmentFee,
    moduleFee: diploma.moduleFee,
    certificationFee: diploma.certificationFee,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await updateDiplomaMetrics(diploma.id, form);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setSaved(true);
    });
  };

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Costos y métricas</h2>
      </div>
      <div className="edsec__grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span className="field__label">{f.label}</span>
            <input
              type="number"
              min={0}
              value={form[f.key]}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, [f.key]: Number(e.target.value) }));
                setSaved(false);
              }}
              disabled={!canWrite}
              aria-invalid={!!fieldErrors[f.key]}
            />
            {fieldErrors[f.key] && (
              <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[f.key]}</span>
            )}
          </label>
        ))}
      </div>
      {canWrite && (
        <div className="edsec__foot">
          {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
          {saved && !error && <span className="edsec__saved">Guardado ✓</span>}
          <button className="btn btn--primary" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar costos y métricas"}
          </button>
        </div>
      )}
    </section>
  );
}
