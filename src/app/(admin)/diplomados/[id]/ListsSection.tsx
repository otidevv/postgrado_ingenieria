"use client";

import { useState, useTransition } from "react";
import { updateDiplomaLists } from "./actions";
import { ListEditor } from "./ListEditor";
import type { EditorDiploma, ListsInput } from "./types";

const GROUPS: Array<{ key: keyof ListsInput; title: string; placeholder: string }> = [
  { key: "objectives", title: "Objetivos específicos", placeholder: "Objetivo específico…" },
  { key: "requirements", title: "Requisitos del postulante", placeholder: "Requisito…" },
  { key: "graduateProfile", title: "Perfil del egresado", placeholder: "Competencia del egresado…" },
];

export function ListsSection({ diploma, canWrite }: { diploma: EditorDiploma; canWrite: boolean }) {
  const [form, setForm] = useState<ListsInput>({
    objectives: diploma.objectives,
    requirements: diploma.requirements,
    graduateProfile: diploma.graduateProfile,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateDiplomaLists(diploma.id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Listas del programa</h2>
      </div>
      {GROUPS.map((g) => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div className="field__label" style={{ marginBottom: 8 }}>{g.title}</div>
          <ListEditor
            items={form[g.key]}
            disabled={!canWrite}
            placeholder={g.placeholder}
            onChange={(items) => {
              setForm((f) => ({ ...f, [g.key]: items }));
              setSaved(false);
            }}
          />
        </div>
      ))}
      {canWrite && (
        <div className="edsec__foot">
          {error && <span className="form-error">{error}</span>}
          {saved && !error && <span className="edsec__saved">Guardado ✓</span>}
          <button className="btn btn--primary" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar listas"}
          </button>
        </div>
      )}
    </section>
  );
}
