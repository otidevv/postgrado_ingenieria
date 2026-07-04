"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { THEME_KEY, isTheme, resolveTheme, type Theme } from "@/lib/ui/theme";

const OPTIONS: { value: Theme; label: string; icon: IconName }[] = [
  { value: "light", label: "Claro", icon: "sun" },
  { value: "dark", label: "Oscuro", icon: "moon" },
  { value: "system", label: "Sistema", icon: "device" },
];

function apply(theme: Theme) {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate from storage on mount (server can't know the client preference).
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (isTheme(stored)) setTheme(stored);
    setMounted(true);
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => apply("system");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (value: Theme) => {
    setTheme(value);
    localStorage.setItem(THEME_KEY, value);
    apply(value);
    setOpen(false);
  };

  // Until mounted we don't know the resolved palette; default keeps SSR stable.
  const resolved = mounted ? resolveTheme(theme) : "light";

  return (
    <div className="topbar__action-wrap" ref={ref}>
      <button
        className="iconbtn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cambiar tema"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Tema"
      >
        <Icon name={resolved === "dark" ? "moon" : "sun"} size={20} />
      </button>
      {open && (
        <div className="popover popover--theme" role="menu">
          <div className="popover__head">
            <b>Tema</b>
          </div>
          <div className="theme-menu">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                role="menuitemradio"
                aria-checked={theme === o.value}
                className={`theme-opt ${theme === o.value ? "is-active" : ""}`}
                onClick={() => choose(o.value)}
              >
                <Icon name={o.icon} size={18} />
                <span>{o.label}</span>
                {theme === o.value && (
                  <Icon name="check" size={16} className="theme-opt__check" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
