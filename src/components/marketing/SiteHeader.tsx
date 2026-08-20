"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { THEME_KEY } from "@/lib/ui/theme";
import "./landing.css";

/* En el mismo orden que las secciones de la landing: así el resaltado
   del scrollspy avanza siempre hacia adelante al bajar. */
export const NAV_LINKS = [
  { href: "#diplomados", label: "Diplomados" },
  { href: "#programas", label: "Programas" },
  { href: "#ventajas", label: "Por qué elegirnos" },
  { href: "#admision", label: "Admisión" },
  { href: "#contacto", label: "Contacto" },
];

/* Header público compartido (landing, diplomado, postulación).
   En la home los enlaces son anclas con scrollspy; en las demás rutas
   navegan a la sección correspondiente de la home (/#seccion). */
export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);

  /* Tema actual leído de <html data-theme> como "external store": se
     re-renderiza solo cuando el atributo cambia. */
  const dark = useSyncExternalStore(
    (onChange) => {
      const obs = new MutationObserver(onChange);
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => obs.disconnect();
    },
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );

  /* Nav condensado con HISTÉRESIS: se compacta pasados 32px y solo se
     expande de vuelta bajo 6px. La zona muerta (26px) supera el cambio de
     alto del nav (10px): así el ajuste de scroll-anchoring del navegador
     no puede re-cruzar el umbral y provocar un bucle de temblor al llegar
     arriba. */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let current = false;
    const onScroll = () => {
      const y = window.scrollY;
      const next = current ? y > 6 : y > 32;
      if (next !== current) {
        current = next;
        setScrolled(next);
      }
    };
    // Estado inicial (p. ej. carga con ancla), fuera del cuerpo del efecto.
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  /* Scrollspy (solo en la home): resalta en el nav la sección visible
     (franja central del viewport). Orientación constante sin ruido. */
  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
    if (!isHome) return;
    const sections = NAV_LINKS.map((l) =>
      document.getElementById(l.href.slice(1)),
    ).filter((s): s is HTMLElement => s !== null);
    if (!sections.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [isHome]);

  /* Menú móvil: Escape lo cierra. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const toggleTheme = () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* almacenamiento no disponible */
    }
    /* `dark` se actualiza solo vía el MutationObserver de arriba. */
  };

  /* Fuera de la home las anclas apuntan a la home (/#seccion). */
  const sectionHref = (hash: string) => (isHome ? hash : `/${hash}`);

  /* Sección activa del nav — mismo sistema en todas las vistas:
     en la home la decide el scrollspy; en las rutas de diplomado
     (ficha y postulación) es "diplomados", la sección de origen. */
  const activeId = isHome
    ? activeSection
    : pathname.startsWith("/diplomado")
      ? "diplomados"
      : "";

  return (
    <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="lp-nav__inner">
        <Link href={isHome ? "#top" : "/"} className="lp-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/logo_unamad.png"
            alt="Escudo de la Universidad Nacional Amazónica de Madre de Dios"
            className="lp-brand__logo"
            width={44}
            height={44}
          />
          <span className="lp-brand__text">
            <span className="lp-brand__name">UNAMAD</span>
            <span className="lp-brand__sub">Escuela de Posgrado · Ingeniería</span>
          </span>
        </Link>

        <nav className="lp-nav__links" aria-label="Principal">
          {NAV_LINKS.map((l) => {
            const isActive = activeId === l.href.slice(1);
            return (
              <a
                key={l.href}
                href={sectionHref(l.href)}
                className={`lp-nav__link${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "true" : undefined}
              >
                {l.label}
              </a>
            );
          })}
        </nav>

        <div className="lp-nav__actions">
          <button
            className="lp-icon-btn"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            title="Cambiar tema"
          >
            <Icon name={dark ? "moon" : "sun"} size={20} />
          </button>
          <Link href="/login" className="lp-btn lp-btn--primary lp-nav__login">
            <Icon name="lock" size={16} />
            Iniciar sesión
          </Link>
          <button
            className="lp-icon-btn lp-nav__burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={22} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="lp-nav__mobile" aria-label="Menú móvil">
          {NAV_LINKS.map((l) => {
            const isActive = activeId === l.href.slice(1);
            return (
              <a
                key={l.href}
                href={sectionHref(l.href)}
                className={`lp-nav__mobile-link${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            );
          })}
          <Link
            href="/login"
            className="lp-btn lp-btn--primary lp-btn--full"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="lock" size={16} />
            Iniciar sesión
          </Link>
        </nav>
      )}
    </header>
  );
}
