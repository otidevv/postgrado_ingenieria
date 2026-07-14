"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/Icon";

export type CourseModule = {
  id: string;
  order: number;
  code: string;
  name: string;
  totalHours: number;
  syncHours: number;
  asyncHours: number;
  credits: number;
  summary: string;
  topics: string[];
};

export function ModuleAccordion({ modules }: { modules: CourseModule[] }) {
  // Primer módulo abierto por defecto.
  const [openId, setOpenId] = useState<string | null>(modules[0]?.id ?? null);

  return (
    <div className="dp-curriculum" data-reveal>
      {modules.map((m) => {
        const isOpen = openId === m.id;
        return (
          <div key={m.id} className={`dp-course ${isOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="dp-course__row"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : m.id)}
            >
              <span className="dp-course__thumb">
                <span className="dp-course__thumb-num">{m.order}</span>
              </span>
              <span className="dp-course__info">
                <span className="dp-course__title">{m.name}</span>
                <span className="dp-course__meta">
                  Módulo {m.order} · {m.totalHours} horas · {m.credits} créditos
                </span>
              </span>
              <span className="dp-course__toggle">
                <span className="dp-course__toggle-txt">Detalles del módulo</span>
                <Icon name="chevron-down" size={18} />
              </span>
            </button>

            {/* Siempre montado: el alto se anima con grid-template-rows
                (0fr → 1fr), sin medir alturas. aria-hidden lo saca del
                árbol accesible cuando está plegado. */}
            <div className="dp-course__detailwrap" aria-hidden={!isOpen}>
              <div className="dp-course__detail">
                <p className="dp-course__summary">{m.summary}</p>
                {m.topics.length > 0 && (
                  <ul className="dp-course__topics">
                    {m.topics.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                )}
                <div className="dp-course__hours">
                  {m.syncHours} h sincrónicas · {m.asyncHours} h asincrónicas ·{" "}
                  {m.code}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
