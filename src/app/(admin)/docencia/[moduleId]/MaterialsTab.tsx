"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { deleteMaterial, moveMaterial, saveMaterial } from "./actions";
import type { MaterialRow } from "../types";

export function MaterialsTab({
  moduleId,
  materials,
}: {
  moduleId: string;
  materials: MaterialRow[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const add = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveMaterial(moduleId, { id: null, title, url });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setTitle("");
      setUrl("");
      router.refresh();
    });
  };

  const remove = (m: MaterialRow) => {
    if (!confirm(`¿Quitar el material "${m.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteMaterial(moduleId, m.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  const move = (m: MaterialRow, dir: "up" | "down") => {
    setError(null);
    startTransition(async () => {
      const res = await moveMaterial(moduleId, m.id, dir);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  return (
    <div className="dw-card">
      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>
        Materiales del módulo ({materials.length})
      </h2>

      <div className="dw-row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <label className="field" style={{ margin: 0, minWidth: 180 }}>
          <span className="field__label">Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Diapositivas sesión 1" aria-invalid={!!fieldErrors.title} />
          {fieldErrors.title && <span style={{ color: "#b91c1c", fontSize: 12 }}>{fieldErrors.title}</span>}
        </label>
        <label className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <span className="field__label">Enlace</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-invalid={!!fieldErrors.url} />
          {fieldErrors.url && <span style={{ color: "#b91c1c", fontSize: 12 }}>{fieldErrors.url}</span>}
        </label>
        <button className="btn btn--primary" onClick={add} disabled={pending}>
          <Icon name="plus" size={15} />
          Añadir
        </button>
      </div>
      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}

      {materials.length === 0 ? (
        <p className="dtable__muted">Aún no hay materiales publicados.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {materials.map((m, i) => (
            <li key={m.id} className="dw-row" style={{ justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="linkbtn">
                <Icon name="external" size={15} />
                {m.title}
              </a>
              <div className="dw-row">
                <button
                  className="iconbtn"
                  aria-label="Subir material"
                  disabled={pending || i === 0}
                  onClick={() => move(m, "up")}
                >
                  <Icon name="chevron-up" size={16} />
                </button>
                <button
                  className="iconbtn"
                  aria-label="Bajar material"
                  disabled={pending || i === materials.length - 1}
                  onClick={() => move(m, "down")}
                >
                  <Icon name="chevron-down" size={16} />
                </button>
                <button className="iconbtn" aria-label="Quitar material" disabled={pending} onClick={() => remove(m)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
