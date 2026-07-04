"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/admin/Icon";

type Tab = { id: string; label: string };

export function DiplomaTabs({
  tabs,
  applyHref = "/login",
  applyLabel = "Postular",
}: {
  tabs: Tab[];
  applyHref?: string;
  applyLabel?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      // La sección se marca activa cuando su parte superior entra bajo la barra.
      { rootMargin: "-140px 0px -70% 0px", threshold: 0 },
    );
    for (const t of tabs) {
      const el = document.getElementById(t.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [tabs]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <nav className="dp-tabs" aria-label="Secciones del diplomado">
      <div className="dp-tabs__inner">
        <div className="dp-tabs__list">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`dp-tab ${active === t.id ? "is-active" : ""}`}
              aria-current={active === t.id ? "true" : undefined}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link href={applyHref} className="dp-tabs__apply">
          {applyLabel}
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
    </nav>
  );
}
