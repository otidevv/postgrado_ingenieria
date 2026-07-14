"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/admin/Icon";
import { HologramMap } from "@/components/HologramMap";
import { Robot3D } from "@/components/Robot3D";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { THEME_KEY } from "@/lib/ui/theme";
import type { DiplomaCard } from "@/lib/diplomas";
import "./landing.css";

/* ────────────────────────────────────────────────────────────────
   CONTENIDO EDITABLE
   Ajusta libremente estos arreglos: nombres de programas, cifras,
   fechas y datos de contacto son marcadores realistas que la
   Escuela de Posgrado debe confirmar.
   ──────────────────────────────────────────────────────────────── */

/* En el mismo orden que las secciones de la página: así el resaltado
   del scrollspy avanza siempre hacia adelante al bajar. */
const NAV_LINKS = [
  { href: "#diplomados", label: "Diplomados" },
  { href: "#programas", label: "Programas" },
  { href: "#ventajas", label: "Por qué elegirnos" },
  { href: "#admision", label: "Admisión" },
  { href: "#contacto", label: "Contacto" },
];

type Program = {
  icon: IconName;
  title: string;
  level?: string;
  meta?: string;
  desc: string;
};

const PROGRAMS: Program[] = [
  {
    icon: "settings",
    title: "Ingeniería Agroindustrial",
    desc: "Programas orientados a la innovación de procesos productivos, la transformación agroindustrial y el aprovechamiento sostenible de los recursos naturales.",
  },
  {
    icon: "shield",
    title: "Ingeniería Forestal y Medio Ambiente",
    desc: "Programas enfocados en la gestión sostenible de los recursos forestales, la conservación ambiental y el desarrollo territorial.",
  },
  {
    icon: "cloud",
    title: "Ingeniería de Sistemas e Informática",
    desc: "Programas dirigidos a la transformación digital, el desarrollo tecnológico y la innovación en sistemas de información.",
  },
];

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "sparkle",
    title: "Investigación aplicada",
    desc: "Líneas de investigación orientadas a los retos de la Amazonía y del sector productivo.",
  },
  {
    icon: "users",
    title: "Plana docente doctoral",
    desc: "Docentes con grado de doctor y experiencia profesional vigente en su especialidad.",
  },
  {
    icon: "tag",
    title: "Becas y convenios",
    desc: "Descuentos, becas por desempeño y convenios con instituciones aliadas nacionales.",
  },
  {
    icon: "calendar",
    title: "Modalidad flexible",
    desc: "Clases semipresenciales y virtuales compatibles con tu vida laboral.",
  },
];

/* Herramientas que usa la Escuela en formación y gestión. Lista editable:
   iconos en /public/logos/tools (Simple Icons, CC0). Confirmar con la
   oficina qué herramientas de IA se muestran. */
const TOOLS: { name: string; file: string }[] = [
  { name: "Google Meet", file: "googlemeet.svg" },
  { name: "Google Classroom", file: "googleclassroom.svg" },
  { name: "Google Drive", file: "googledrive.svg" },
  { name: "Gmail", file: "gmail.svg" },
  { name: "Google Calendar", file: "googlecalendar.svg" },
  { name: "Google Docs", file: "googledocs.svg" },
  { name: "Gemini", file: "googlegemini.svg" },
  { name: "Claude", file: "claude.svg" },
];

const STEPS: { title: string; desc: string }[] = [
  { title: "Inscripción", desc: "Completa tu ficha y sube tus documentos en línea." },
  { title: "Evaluación", desc: "Revisión de expediente y entrevista personal." },
  { title: "Resultados", desc: "Publicación de admitidos en el portal institucional." },
  { title: "Matrícula", desc: "Reserva tu vacante y accede al campus del posgrado." },
];

export function LandingPage({ diplomas = [] }: { diplomas?: DiplomaCard[] }) {
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

  /* Scrollspy: resalta en el nav la sección visible (franja central del
     viewport). Orientación constante sin ruido. */
  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
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
  }, []);

  /* Menú móvil: Escape lo cierra. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* Reveal al hacer scroll: los [data-reveal] aparecen al entrar en
     pantalla, con escalonado dentro de cada [data-reveal-group]. Respeta
     prefers-reduced-motion; sin JS el CSS no oculta nada (ver landing.css). */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(".lp [data-reveal]"),
    );
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    document
      .querySelectorAll<HTMLElement>(".lp [data-reveal-group]")
      .forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          (child as HTMLElement).style.transitionDelay = `${i * 0.07}s`;
        });
      });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.classList.add("is-in");
          // El retraso del escalonado solo vale para la entrada: se limpia
          // al terminar para no retrasar las transiciones de hover.
          if (el.style.transitionDelay) {
            el.addEventListener(
              "transitionend",
              () => {
                el.style.transitionDelay = "";
              },
              { once: true },
            );
          }
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

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

  return (
    <div className="lp">
      {/* ─────────── Navegación ─────────── */}
      <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-nav__inner">
          <a href="#top" className="lp-brand">
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
          </a>

          <nav className="lp-nav__links" aria-label="Principal">
            {NAV_LINKS.map((l) => {
              const isActive = activeSection === l.href.slice(1);
              return (
                <a
                  key={l.href}
                  href={l.href}
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
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="lp-nav__mobile-link"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
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

      {/* ─────────── Hero (banner institucional a todo el ancho) ─────────── */}
      <section className="lp-hero" id="top">
        {/* El "stage" toma el alto de la imagen; la tarjeta se superpone dentro. */}
        <div className="lp-hero__stage">
          <figure className="lp-hero__banner">
          {/* Art direction: cada tamaño está compuesto para un ancho de ventana
              distinto (más angosto = más alto). El navegador elige el primero
              cuyo `media` coincida; el <img> es el respaldo para pantallas grandes. */}
          <picture>
            <source media="(max-width: 1216px)" srcSet="/banner/1216.webp" />
            <source media="(max-width: 1763px)" srcSet="/banner/1763.webp" />
            <source media="(max-width: 1920px)" srcSet="/banner/1920.webp" />
            <source media="(max-width: 2560px)" srcSet="/banner/2560.webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/banner/3000.webp"
              alt="Posgrado en Ingeniería · Universidad Nacional Amazónica de Madre de Dios"
              width={4224}
              height={992}
            />
          </picture>
        </figure>

        <div className="lp-hero__inner">
          <aside className="lp-hero__card" aria-label="Próxima admisión">
            <div className="lp-adm">
              <div className="lp-adm__head">
                <span className="lp-adm__badge">Proceso vigente</span>
                <span className="lp-adm__cycle">2026-II</span>
              </div>
              <h3 className="lp-adm__title">Admisión al Posgrado de Ingeniería</h3>
              <ul className="lp-adm__list">
                <li>
                  <Icon name="calendar" size={18} />
                  <span>
                    <b>Inscripciones</b> hasta el 30 de agosto
                  </span>
                </li>
                <li>
                  <Icon name="rules" size={18} />
                  <span>
                    <b>Examen</b> 07 de septiembre
                  </span>
                </li>
                <li>
                  <Icon name="check" size={18} />
                  <span>
                    <b>Inicio de clases</b> octubre
                  </span>
                </li>
              </ul>
              <a href="#admision" className="lp-btn lp-btn--primary lp-btn--full">
                Ver proceso de admisión
              </a>
            </div>
          </aside>
        </div>
        </div>
      </section>

      {/* ─────────── Herramientas (carrusel de marcas) ─────────── */}
      <section className="lp-tools" aria-label="Herramientas que usa la Escuela">
        <p className="lp-tools__label" data-reveal>
          Formación y gestión con Google Workspace e IA
        </p>
        <div className="lp-tools__marquee">
          <ul className="lp-tools__track">
            {TOOLS.map((t) => (
              <li key={t.name} className="lp-tools__item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/logos/tools/${t.file}`}
                  alt=""
                  width={22}
                  height={22}
                  loading="lazy"
                />
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
          {/* Pista duplicada para el bucle continuo (solo visual) */}
          <ul className="lp-tools__track" aria-hidden="true">
            {TOOLS.map((t) => (
              <li key={t.name} className="lp-tools__item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/logos/tools/${t.file}`}
                  alt=""
                  width={22}
                  height={22}
                  loading="lazy"
                />
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─────────── Diplomados (datos reales de la BD) ─────────── */}
      {diplomas.length > 0 && (
        <section className="lp-section" id="diplomados">
          <div className="lp-section__head" data-reveal>
            <span className="lp-kicker">Formación continua</span>
            <h2>Diplomados de posgrado</h2>
            <p>
              Programas modulares de especialización, con certificación por
              módulo y modalidad flexible para profesionales que trabajan.
            </p>
          </div>

          <div className="lp-dips" data-reveal-group>
            {diplomas.map((d) => (
              <article key={d.slug} className="lp-dip" data-reveal>
                <div className="lp-dip__top">
                  <span className="lp-dip__tag">{d.subtitle ?? "Diplomado"}</span>
                  {d.admissionLabel && (
                    <span className="lp-dip__adm">{d.admissionLabel}</span>
                  )}
                </div>
                <h3 className="lp-dip__title">{d.title}</h3>
                <p className="lp-dip__summary">{d.summary}</p>
                <ul className="lp-dip__meta">
                  <li>
                    <Icon name="folder" size={15} />
                    {d.moduleCount} módulos
                  </li>
                  <li>
                    <Icon name="clock" size={15} />
                    {d.totalHours} horas
                  </li>
                  <li>
                    <Icon name="check" size={15} />
                    {d.credits} créditos
                  </li>
                  <li>
                    <Icon name="device" size={15} />
                    {d.modality}
                  </li>
                </ul>
                <Link
                  href={`/diplomado/${d.slug}`}
                  className="lp-btn lp-btn--primary lp-dip__cta"
                >
                  Ver diplomado
                  <Icon name="chevron-right" size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ─────────── Programas ─────────── */}
      <section className="lp-section" id="programas">
        <div className="lp-section__head" data-reveal>
          <span className="lp-kicker">Oferta académica</span>
          <h2>Programas de posgrado</h2>
          <p>
            Maestrías, doctorado y diplomados diseñados junto al sector
            productivo y la comunidad científica de la región.
          </p>
        </div>

        <div className="lp-programs" data-reveal-group>
          {PROGRAMS.map((p) => (
            <article key={p.title} className="lp-program" data-reveal>
              <span className="lp-program__icon">
                <Icon name={p.icon} size={24} />
              </span>
              {p.level && (
                <span className="lp-program__level">{p.level}</span>
              )}
              <h3 className="lp-program__title">{p.title}</h3>
              {p.meta && <p className="lp-program__meta">{p.meta}</p>}
              <p className="lp-program__desc">{p.desc}</p>
              <a href="#admision" className="lp-program__link">
                Ver detalles
                <Icon name="chevron-right" size={16} />
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* ─────────── Ventajas ─────────── */}
      <section className="lp-section lp-section--soft" id="ventajas">
        <div className="lp-section__head" data-reveal>
          <span className="lp-kicker">Por qué elegirnos</span>
          <h2>Una formación de posgrado con respaldo</h2>
          <p>
            Aprende de investigadores activos, con recursos y convenios que
            potencian tu desarrollo profesional.
          </p>
        </div>

        <div className="lp-features" data-reveal-group>
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-feature" data-reveal>
              <span className="lp-feature__icon">
                <Icon name={f.icon} size={22} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── Admisión ─────────── */}
      <section className="lp-section" id="admision">
        <div className="lp-section__head" data-reveal>
          <span className="lp-kicker">Admisión</span>
          <h2>Cuatro pasos para postular</h2>
          <p>
            El proceso es completamente en línea. Prepara tus documentos y sigue
            estos pasos.
          </p>
        </div>

        <ol className="lp-steps" data-reveal-group>
          {STEPS.map((s, i) => (
            <li key={s.title} className="lp-step" data-reveal>
              <span className="lp-step__num">{i + 1}</span>
              <h3 className="lp-step__title">{s.title}</h3>
              <p className="lp-step__desc">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ─────────── CTA final ─────────── */}
      <section className="lp-cta">
        <div className="lp-cta__inner" data-reveal>
          {/* Mapa holograma decorativo (puntos), marcador en Puerto Maldonado */}
          <HologramMap className="lp-cta__map" />
          <h2>¿Listo para dar el siguiente paso en tu carrera?</h2>
          <p>
            Postula al proceso de admisión 2026-II o accede al portal académico
            con tu cuenta institucional.
          </p>
          <div className="lp-cta__actions">
            <a href="#admision" className="lp-btn lp-btn--light lp-btn--lg">
              Postular ahora
              <Icon name="chevron-right" size={18} />
            </a>
            <Link href="/login" className="lp-btn lp-btn--outline lp-btn--lg">
              <Icon name="lock" size={18} />
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer className="lp-footer" id="contacto">
        <div className="lp-footer__inner">
          <div className="lp-footer__brand">
            <div className="lp-brand">
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
                <span className="lp-brand__sub">Escuela de Posgrado</span>
              </span>
            </div>
            <p className="lp-footer__desc">
              Universidad Nacional Amazónica de Madre de Dios. Formación de
              posgrado en ingeniería al servicio del desarrollo de la Amazonía
              peruana.
            </p>
          </div>

          <div className="lp-footer__col">
            <h4>Explorar</h4>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
            <Link href="/login">Portal académico</Link>
          </div>

          <div className="lp-footer__col">
            <h4>Contacto</h4>
            <a href="mailto:posgrado.ingenieria@unamad.edu.pe">
              <Icon name="mail" size={15} />
              posgrado.ingenieria@unamad.edu.pe
            </a>
            <span className="lp-footer__line">
              <Icon name="home" size={15} />
              Ciudad Universitaria, Puerto Maldonado
            </span>
            <span className="lp-footer__line">
              <Icon name="clock" size={15} />
              Lun–Vie, 8:00 – 16:00
            </span>
          </div>
        </div>

        <div className="lp-footer__bar">
          <span>
            © 2026 UNAMAD · Oficina de Tecnologías de la Información
          </span>
          <div className="lp-footer__legal">
            <a href="#top">Términos del servicio</a>
            <span aria-hidden="true">·</span>
            <a href="#top">Política de privacidad</a>
          </div>
        </div>
      </footer>

      {/* Robot 3D caminante (decoración flotante, esquina inferior izquierda) */}
      <Robot3D className="lp-robot" />

      {/* Botón flotante de WhatsApp — esquina inferior derecha */}
      <WhatsAppButton />
    </div>
  );
}
