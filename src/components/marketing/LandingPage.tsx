"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/admin/Icon";
import { Robot3D } from "@/components/Robot3D";
import { THEME_KEY } from "@/lib/ui/theme";
import type { DiplomaCard } from "@/lib/diplomas";
import "./landing.css";

/* ────────────────────────────────────────────────────────────────
   CONTENIDO EDITABLE
   Ajusta libremente estos arreglos: nombres de programas, cifras,
   fechas y datos de contacto son marcadores realistas que la
   Escuela de Posgrado debe confirmar.
   ──────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#programas", label: "Programas" },
  { href: "#diplomados", label: "Diplomados" },
  { href: "#ventajas", label: "Por qué elegirnos" },
  { href: "#admision", label: "Admisión" },
  { href: "#contacto", label: "Contacto" },
];

type Program = {
  icon: IconName;
  title: string;
  level: string;
  meta: string;
  desc: string;
};

const PROGRAMS: Program[] = [
  {
    icon: "cloud",
    title: "Ingeniería de Sistemas e Informática",
    level: "Maestría",
    meta: "2 años · Semipresencial",
    desc: "Arquitectura de software, ciencia de datos e inteligencia artificial aplicada a la industria.",
  },
  {
    icon: "sparkle",
    title: "Ingeniería Ambiental",
    level: "Maestría",
    meta: "2 años · Presencial",
    desc: "Gestión sostenible de ecosistemas amazónicos y evaluación de impacto ambiental.",
  },
  {
    icon: "rules",
    title: "Ingeniería Civil",
    level: "Maestría",
    meta: "2 años · Semipresencial",
    desc: "Estructuras, geotecnia e infraestructura resiliente para el desarrollo regional.",
  },
  {
    icon: "chart",
    title: "Gestión de Proyectos",
    level: "Maestría",
    meta: "18 meses · Semipresencial",
    desc: "Dirección de proyectos bajo estándares internacionales y buenas prácticas del PMI.",
  },
  {
    icon: "shield",
    title: "Ciencias e Ingeniería",
    level: "Doctorado",
    meta: "3 años · Presencial",
    desc: "Formación de investigadores con producción científica indexada y de alto impacto.",
  },
  {
    icon: "folder",
    title: "Ciencia de Datos",
    level: "Diplomado",
    meta: "6 meses · Virtual",
    desc: "Analítica, visualización y machine learning con un enfoque práctico y aplicado.",
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

const STEPS: { title: string; desc: string }[] = [
  { title: "Inscripción", desc: "Completa tu ficha y sube tus documentos en línea." },
  { title: "Evaluación", desc: "Revisión de expediente y entrevista personal." },
  { title: "Resultados", desc: "Publicación de admitidos en el portal institucional." },
  { title: "Matrícula", desc: "Reserva tu vacante y accede al campus del posgrado." },
];

export function LandingPage({ diplomas = [] }: { diplomas?: DiplomaCard[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
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
    setDark(next === "dark");
  };

  return (
    <div className="lp">
      {/* ─────────── Navegación ─────────── */}
      <header className="lp-nav">
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
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="lp-nav__link">
                {l.label}
              </a>
            ))}
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
            <source media="(max-width: 1703px)" srcSet="/banner/1703.webp" />
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

      {/* ─────────── Programas ─────────── */}
      <section className="lp-section" id="programas">
        <div className="lp-section__head">
          <span className="lp-kicker">Oferta académica</span>
          <h2>Programas de posgrado</h2>
          <p>
            Maestrías, doctorado y diplomados diseñados junto al sector
            productivo y la comunidad científica de la región.
          </p>
        </div>

        <div className="lp-programs">
          {PROGRAMS.map((p) => (
            <article key={p.title} className="lp-program">
              <span className="lp-program__icon">
                <Icon name={p.icon} size={24} />
              </span>
              <span className="lp-program__level">{p.level}</span>
              <h3 className="lp-program__title">{p.title}</h3>
              <p className="lp-program__meta">{p.meta}</p>
              <p className="lp-program__desc">{p.desc}</p>
              <a href="#admision" className="lp-program__link">
                Ver detalles
                <Icon name="chevron-right" size={16} />
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* ─────────── Diplomados (datos reales de la BD) ─────────── */}
      {diplomas.length > 0 && (
        <section className="lp-section" id="diplomados">
          <div className="lp-section__head">
            <span className="lp-kicker">Formación continua</span>
            <h2>Diplomados de posgrado</h2>
            <p>
              Programas modulares de especialización, con certificación por
              módulo y modalidad flexible para profesionales que trabajan.
            </p>
          </div>

          <div className="lp-dips">
            {diplomas.map((d) => (
              <article key={d.slug} className="lp-dip">
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

      {/* ─────────── Ventajas ─────────── */}
      <section className="lp-section lp-section--soft" id="ventajas">
        <div className="lp-section__head">
          <span className="lp-kicker">Por qué elegirnos</span>
          <h2>Una formación de posgrado con respaldo</h2>
          <p>
            Aprende de investigadores activos, con recursos y convenios que
            potencian tu desarrollo profesional.
          </p>
        </div>

        <div className="lp-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-feature">
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
        <div className="lp-section__head">
          <span className="lp-kicker">Admisión</span>
          <h2>Cuatro pasos para postular</h2>
          <p>
            El proceso es completamente en línea. Prepara tus documentos y sigue
            estos pasos.
          </p>
        </div>

        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="lp-step">
              <span className="lp-step__num">{i + 1}</span>
              <h3 className="lp-step__title">{s.title}</h3>
              <p className="lp-step__desc">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ─────────── CTA final ─────────── */}
      <section className="lp-cta">
        <div className="lp-cta__inner">
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
    </div>
  );
}
