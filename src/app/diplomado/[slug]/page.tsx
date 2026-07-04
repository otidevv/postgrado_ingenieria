import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/admin/Icon";
import { avatarColor, initialsFor } from "@/lib/ui/avatar";
import { getPublishedDiplomaBySlug } from "@/lib/diplomas";
import { DiplomaTabs } from "./DiplomaTabs";
import { ModuleAccordion } from "./ModuleAccordion";
import { Robot3D } from "@/components/Robot3D";
import { SakuraPetals } from "@/components/SakuraPetals";
import "./diploma.css";

// Ruta 100% dependiente de la BD: no intentar prerender/generación estática.
// Evita que Turbopack lance el worker de "static paths" (causa del crash
// "Jest worker encountered ... child process exceptions" + write EPIPE).
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublishedDiplomaBySlug(slug);
  if (!d) return { title: "Diplomado no encontrado · UNAMAD" };
  return {
    title: `Diplomado en ${d.title} · UNAMAD`,
    description: d.summary,
  };
}

const TABS = [
  { id: "acerca", label: "Acerca de" },
  { id: "plan", label: "Plan de estudios" },
  { id: "perfil", label: "Perfil y requisitos" },
  { id: "inversion", label: "Inversión" },
];

export default async function DiplomaPage({ params }: Params) {
  const { slug } = await params;
  const d = await getPublishedDiplomaBySlug(slug);
  if (!d) notFound();

  const moduleCount = d.modules.length;

  const STATS: { icon: IconName; v: string; l: string }[] = [
    { icon: "folder", v: `${moduleCount} módulos`, l: "Plan modular certificable" },
    { icon: "clock", v: `${d.credits} créditos`, l: `${d.totalHours} horas académicas` },
    { icon: "award", v: "Nivel posgrado", l: "Título o bachiller" },
    { icon: "calendar", v: `${d.weeksPerModule} semanas`, l: "por cada módulo" },
  ];

  return (
    <div className="dp">
      {/* Lluvia de pétalos de sakura al entrar al diplomado */}
      <SakuraPetals />

      {/* Header */}
      <header className="dp-nav">
        <div className="dp-nav__inner">
          <Link href="/" className="dp-brand">
            <span className="dp-brand__mark">U</span>
            <span className="dp-brand__text">
              <span className="dp-brand__name">UNAMAD</span>
              <span className="dp-brand__sub">Escuela de Posgrado</span>
            </span>
          </Link>
          <div className="dp-nav__actions">
            <Link href="/#diplomados" className="dp-nav__back">
              <Icon name="chevron-right" size={16} className="dp-nav__back-ic" />
              Todos los diplomados
            </Link>
            <Link href="/login" className="dp-btn dp-btn--primary">
              <Icon name="lock" size={16} />
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="dp-hero">
        <div className="dp-hero__inner">
          <div className="dp-hero__main">
            <nav className="dp-crumbs" aria-label="Ruta de navegación">
              <Link href="/">Inicio</Link>
              <span aria-hidden="true">›</span>
              <Link href="/#diplomados">Diplomados</Link>
              <span aria-hidden="true">›</span>
              <span className="dp-crumbs__current">{d.title}</span>
            </nav>
            <p className="dp-hero__eyebrow">{d.faculty}</p>
            <h1 className="dp-hero__title">
              {d.subtitle ?? "Diplomado de Posgrado"} en {d.title}
            </h1>
            <p className="dp-hero__desc">{d.summary}</p>

            <p className="dp-hero__meta">
              <Icon name="cloud" size={16} />
              Dictado en español · Modalidad {d.modality}
            </p>

            <div className="dp-hero__org">
              <span className="dp-hero__org-logo">U</span>
              <span className="dp-hero__org-txt">
                Organiza: <b>{d.faculty}</b>
              </span>
              <span className="dp-hero__chip">
                {d.subtitle ?? "Diplomado de Posgrado"}
              </span>
            </div>

            <div className="dp-hero__cta-row">
              <Link href={`/diplomado/${slug}/postular`} className="dp-cta-btn">
                <span className="dp-cta-btn__main">Postular ahora</span>
                {d.admissionLabel && (
                  <span className="dp-cta-btn__sub">{d.admissionLabel}</span>
                )}
              </Link>
              <a href="#plan" className="dp-cta-ghost">
                Ver plan de estudios
              </a>
            </div>

            <p className="dp-hero__note">
              <b>Certificación oficial UNAMAD</b> · se requiere un mínimo de{" "}
              {d.minEnrollment} matriculados para aperturar el programa.
            </p>
          </div>

          <div className="dp-hero__decor" aria-hidden="true">
            <svg viewBox="0 0 555 465" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#dp-decor-clip)">
                <path d="M219.118 125.669L163.127 0.0637756C49.9173 50.5296 -15.5504 170.484 3.25344 292.998C22.0573 415.512 120.486 510.312 243.619 524.503C366.753 538.695 484.165 468.77 530.345 353.745L402.727 302.509C379.637 360.022 320.931 394.984 259.364 387.889C197.797 380.793 148.583 333.393 139.181 272.136C129.779 210.879 162.513 150.901 219.118 125.669Z" fill="var(--cds-color-emphasis-primary-background-weak)"></path>
                <g opacity="0.15">
                  <path d="M350.275 333.136L420.757 405.051C471.927 354.9 492.599 281.339 475.043 211.875L377.417 236.548C386.196 271.28 375.86 308.061 350.275 333.136Z" fill="var(--cds-color-emphasis-neutral-background-default)"></path>
                </g>
                <g opacity="0.1">
                  <path d="M242.203 354.167L204.509 447.541C270.948 474.361 346.634 463.863 403.265 419.972L341.581 340.383C313.265 362.328 275.422 367.577 242.203 354.167Z" fill="var(--cds-color-emphasis-neutral-background-default)"></path>
                </g>
                <g opacity="0.4">
                  <path d="M190.959 317.713C201.45 331.623 215.404 342.54 231.43 349.375L192.337 441.043L190.837 440.397C159.414 426.691 132.048 405.107 111.394 377.721L190.959 317.713ZM112.797 377.915C133.402 404.951 160.61 426.236 191.81 439.727L230.12 349.896C214.623 343.104 201.09 332.516 190.768 319.109L112.797 377.915Z" fill="var(--cds-color-emphasis-neutral-background-default)"></path>
                </g>
                <g opacity="0.4">
                  <path d="M215.178 167.513C185.557 187.662 168.872 222.031 171.362 257.769L70.9103 264.765C65.9317 193.29 99.3021 124.552 158.543 84.2544L215.178 167.513ZM158.281 85.6468C100.124 125.631 67.2879 193.269 71.8421 263.698L170.303 256.839C168.185 221.438 184.667 187.487 213.794 167.255L158.281 85.6468Z" fill="var(--cds-color-emphasis-neutral-background-default)"></path>
                </g>
              </g>
              <defs>
                <clipPath id="dp-decor-clip">
                  <rect width="555" height="465" fill="white"></rect>
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      {/* Tarjeta de estadísticas flotante */}
      <div className="dp-statcard-band">
        <div className="dp-statcard">
          {STATS.map((s) => (
            <div key={s.v} className="dp-statcard__cell">
              <span className="dp-statcard__ic">
                <Icon name={s.icon} size={18} />
              </span>
              <div className="dp-statcard__txt">
                <div className="dp-statcard__v">{s.v}</div>
                <div className="dp-statcard__l">{s.l}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pestañas pegajosas */}
      <DiplomaTabs tabs={TABS} applyHref={`/diplomado/${slug}/postular`} />

      <main className="dp-main">
        {/* Acerca de */}
        <section id="acerca" className="dp-sec">
          <h2 className="dp-h2">Acerca del diplomado</h2>
          <p className="dp-prose">{d.description}</p>

          <div className="dp-callout">
            <span className="dp-callout__ic">
              <Icon name="sparkle" size={20} />
            </span>
            <div>
              <h3>Objetivo general</h3>
              <p>{d.objective}</p>
            </div>
          </div>

          {d.objectives.length > 0 && (
            <>
              <h3 className="dp-h3">Lo que aprenderás</h3>
              <ul className="dp-learn">
                {d.objectives.map((o, i) => (
                  <li key={i}>
                    <Icon name="check" size={16} />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Plan de estudios */}
        <section id="plan" className="dp-sec">
          <h2 className="dp-h2">Plan de estudios</h2>
          <p className="dp-sec__lead">
            {moduleCount} módulos · {d.totalHours} horas · {d.credits} créditos.
            Cada módulo dura {d.weeksPerModule} semanas, con clases{" "}
            {d.schedule.toLowerCase()}.
          </p>

          <div className="dp-plan">
            <div className="dp-plan__main">
              <ModuleAccordion
                modules={d.modules.map((m) => ({
                  id: m.id,
                  order: m.order,
                  code: m.code,
                  name: m.name,
                  totalHours: m.totalHours,
                  syncHours: m.syncHours,
                  asyncHours: m.asyncHours,
                  credits: m.credits,
                  summary: m.summary,
                  topics: m.topics,
                }))}
              />

              <div className="dp-cert">
                <span className="dp-cert__ic">
                  <Icon name="award" size={26} />
                </span>
                <div>
                  <h3>Obtén un diploma de posgrado</h3>
                  <p>
                    Certificación oficial de la UNAMAD y la Unidad de Posgrado de
                    la Facultad de Ingeniería. Agrega esta credencial a tu CV y
                    perfil profesional al concluir el plan de estudios.
                  </p>
                </div>
              </div>
            </div>

            <aside className="dp-plan__side">
              <div className="dp-side-card">
                {d.instructors.length > 0 && (
                  <>
                    <h3 className="dp-side__h">
                      {d.instructors.length === 1 ? "Instructor" : "Instructores"}
                    </h3>
                    <ul className="dp-inst">
                      {d.instructors.slice(0, 4).map((name) => (
                        <li key={name} className="dp-inst__item">
                          <span
                            className="dp-inst__avatar"
                            style={{ background: avatarColor(name) }}
                          >
                            {initialsFor(name)}
                          </span>
                          <span className="dp-inst__info">
                            <span className="dp-inst__name">{name}</span>
                            <span className="dp-inst__role">
                              Docente · Facultad de Ingeniería
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {d.instructors.length > 4 && (
                      <p className="dp-inst__more">
                        y {d.instructors.length - 4} docentes más
                      </p>
                    )}
                    <div className="dp-side__divider" />
                  </>
                )}

                <h3 className="dp-side__h">Ofrecido por</h3>
                <div className="dp-offered">
                  <span className="dp-offered__logo">U</span>
                  <div className="dp-offered__info">
                    <span className="dp-offered__name">UNAMAD</span>
                    <span className="dp-offered__sub">
                      Facultad de Ingeniería · Unidad de Posgrado
                    </span>
                    <Link href="/" className="dp-offered__link">
                      Conocer la Escuela de Posgrado
                    </Link>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Perfil y requisitos */}
        <section id="perfil" className="dp-sec">
          <div className="dp-cols">
            <div>
              <h2 className="dp-h2">Perfil del egresado</h2>
              <ul className="dp-list">
                {d.graduateProfile.map((g, i) => (
                  <li key={i}>
                    <Icon name="check" size={16} />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="dp-h2">Requisitos del postulante</h2>
              <ul className="dp-list">
                {d.requirements.map((r, i) => (
                  <li key={i}>
                    <Icon name="rules" size={16} />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Inversión */}
        <section id="inversion" className="dp-sec">
          <h2 className="dp-h2">Inversión</h2>
          <div className="dp-fees">
            <div className="dp-fee">
              <span className="dp-fee__label">Matrícula</span>
              <span className="dp-fee__value">{soles(d.enrollmentFee)}</span>
              <span className="dp-fee__note">Pago único al inicio</span>
            </div>
            <div className="dp-fee">
              <span className="dp-fee__label">Por módulo</span>
              <span className="dp-fee__value">{soles(d.moduleFee)}</span>
              <span className="dp-fee__note">{moduleCount} módulos en total</span>
            </div>
            <div className="dp-fee">
              <span className="dp-fee__label">Certificación</span>
              <span className="dp-fee__value">{soles(d.certificationFee)}</span>
              <span className="dp-fee__note">Por participante</span>
            </div>
          </div>
          <p className="dp-fees__foot">
            <Icon name="info" size={15} />
            Vacantes limitadas · se requiere un mínimo de {d.minEnrollment}{" "}
            matriculados para aperturar el programa.
          </p>
        </section>

        {/* CTA final */}
        <section className="dp-cta-final">
          <h2>¿Listo para postular al diplomado?</h2>
          <p>
            Completa tu inscripción en línea o accede al portal académico con tu
            cuenta institucional.
          </p>
          <div className="dp-cta-final__actions">
            <Link href={`/diplomado/${slug}/postular`} className="dp-btn dp-btn--light dp-btn--lg">
              Postular ahora
              <Icon name="chevron-right" size={18} />
            </Link>
            <Link href="/#diplomados" className="dp-btn dp-btn--outline dp-btn--lg">
              Ver otros diplomados
            </Link>
          </div>
        </section>
      </main>

      <footer className="dp-footer">
        <span>© 2026 UNAMAD · Facultad de Ingeniería · Unidad de Posgrado</span>
        <a href="mailto:posgrado.ingenieria@unamad.edu.pe">
          posgrado.ingenieria@unamad.edu.pe
        </a>
      </footer>

      {/* Personaje 3D flotante (three.js) — esquina inferior izquierda */}
      <Robot3D />
    </div>
  );
}
