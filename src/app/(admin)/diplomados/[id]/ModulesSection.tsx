"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { deleteModule, moveModule, saveModule } from "./actions";
import { ListEditor } from "./ListEditor";
import type { EditorModule, ModuleInput, TeacherOption } from "./types";

function toInput(m: EditorModule | null): ModuleInput {
  return m
    ? {
        id: m.id,
        code: m.code,
        name: m.name,
        summary: m.summary,
        syncHours: m.syncHours,
        asyncHours: m.asyncHours,
        credits: m.credits,
        topics: m.topics,
        teacherId: m.teacherId,
      }
    : {
        id: null,
        code: "",
        name: "",
        summary: "",
        syncHours: 0,
        asyncHours: 0,
        credits: 0,
        topics: [],
        teacherId: null,
      };
}

function ModuleForm({
  diplomaId,
  initial,
  teachers,
  onDone,
}: {
  diplomaId: string;
  initial: EditorModule | null;
  teachers: TeacherOption[];
  onDone: () => void;
}) {
  const [form, setForm] = useState<ModuleInput>(toInput(initial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const set = <K extends keyof ModuleInput>(k: K, v: ModuleInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveModule(diplomaId, form);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      onDone();
    });
  };

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{fieldErrors[k]}</span>
    ) : null;

  return (
    <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 14, marginTop: 6 }}>
      <div className="edsec__grid">
        <label className="field">
          <span className="field__label">Código</span>
          <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="DTIC-M1" aria-invalid={!!fieldErrors.code} />
          {err("code")}
        </label>
        <label className="field">
          <span className="field__label">Nombre</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Redes y Seguridad" aria-invalid={!!fieldErrors.name} />
          {err("name")}
        </label>
        <label className="field">
          <span className="field__label">Docente responsable</span>
          <select
            value={form.teacherId ?? ""}
            onChange={(e) => set("teacherId", e.target.value || null)}
          >
            <option value="">— Sin asignar —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Horas sincrónicas</span>
          <input type="number" min={0} value={form.syncHours} onChange={(e) => set("syncHours", Number(e.target.value))} aria-invalid={!!fieldErrors.syncHours} />
          {err("syncHours")}
        </label>
        <label className="field">
          <span className="field__label">Horas asincrónicas</span>
          <input type="number" min={0} value={form.asyncHours} onChange={(e) => set("asyncHours", Number(e.target.value))} aria-invalid={!!fieldErrors.asyncHours} />
          {err("asyncHours")}
        </label>
        <label className="field">
          <span className="field__label">Créditos</span>
          <input type="number" min={0} value={form.credits} onChange={(e) => set("credits", Number(e.target.value))} aria-invalid={!!fieldErrors.credits} />
          {err("credits")}
        </label>
        <label className="field field--full">
          <span className="field__label">Sumilla</span>
          <textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} aria-invalid={!!fieldErrors.summary} />
          {err("summary")}
        </label>
        <div className="field field--full">
          <span className="field__label">Temas principales</span>
          <ListEditor items={form.topics} onChange={(items) => set("topics", items)} placeholder="Tema…" />
        </div>
      </div>
      <div className="edsec__foot">
        {error && <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{error}</span>}
        <button className="btn btn--ghost" onClick={onDone} disabled={pending}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : initial ? "Guardar módulo" : "Crear módulo"}
        </button>
      </div>
    </div>
  );
}

export function ModulesSection({
  diplomaId,
  modules,
  teachers,
  canWrite,
}: {
  diplomaId: string;
  modules: EditorModule[];
  teachers: TeacherOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const teacherLabel = (id: string | null) =>
    id ? (teachers.find((t) => t.id === id)?.label ?? "Docente inactivo") : "Sin asignar";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error inesperado.");
      router.refresh();
    });
  };

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <section className="edsec">
      <div className="edsec__head">
        <h2>Módulos ({modules.length})</h2>
        {canWrite && editing === null && (
          <button className="btn btn--primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={15} />
            Añadir módulo
          </button>
        )}
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}

      {modules.map((m, i) => (
        <div key={m.id} style={{ borderTop: i > 0 ? "1px solid var(--border, #e5e7eb)" : "none", padding: "10px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="badge badge--neutral">{m.order}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 500 }}>{m.name}</div>
              <div className="dtable__muted" style={{ fontSize: 12 }}>
                {m.code} · {m.totalHours} h · {m.credits} créditos · {teacherLabel(m.teacherId)}
              </div>
            </div>
            {canWrite && editing === null && (
              <div style={{ display: "flex", gap: 6 }}>
                <button className="iconbtn" aria-label="Subir" disabled={pending || i === 0} onClick={() => run(() => moveModule(m.id, "up"))}>
                  <Icon name="chevron-up" size={16} />
                </button>
                <button className="iconbtn" aria-label="Bajar" disabled={pending || i === modules.length - 1} onClick={() => run(() => moveModule(m.id, "down"))}>
                  <Icon name="chevron-down" size={16} />
                </button>
                <button className="btn btn--ghost" onClick={() => setEditing(m.id)}>Editar</button>
                <button
                  className="iconbtn"
                  aria-label="Eliminar"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar el módulo "${m.name}"?`)) run(() => deleteModule(m.id));
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            )}
          </div>
          {editing === m.id && (
            <ModuleForm diplomaId={diplomaId} initial={m} teachers={teachers} onDone={done} />
          )}
        </div>
      ))}

      {modules.length === 0 && editing === null && (
        <p className="dtable__muted">Este diplomado aún no tiene módulos.</p>
      )}

      {editing === "new" && (
        <ModuleForm diplomaId={diplomaId} initial={null} teachers={teachers} onDone={done} />
      )}
    </section>
  );
}
