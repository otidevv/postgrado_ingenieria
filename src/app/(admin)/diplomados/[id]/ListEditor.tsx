"use client";

import { Icon } from "@/components/admin/Icon";

export function ListEditor({
  items,
  onChange,
  disabled,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const setAt = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => onChange(items.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="edlist">
      {items.map((item, i) => (
        <div key={i} className="edlist__row">
          <input
            value={item}
            onChange={(e) => setAt(i, e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
          />
          {!disabled && (
            <>
              <button type="button" className="iconbtn" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                <Icon name="chevron-up" size={16} />
              </button>
              <button type="button" className="iconbtn" aria-label="Bajar" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                <Icon name="chevron-down" size={16} />
              </button>
              <button type="button" className="iconbtn" aria-label="Quitar" onClick={() => removeAt(i)}>
                <Icon name="trash" size={16} />
              </button>
            </>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="btn btn--ghost" onClick={() => onChange([...items, ""])}>
          <Icon name="plus" size={15} />
          Añadir
        </button>
      )}
    </div>
  );
}
