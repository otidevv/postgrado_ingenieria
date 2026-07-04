import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { Icon } from "@/components/admin/Icon";
import { APPLICATION_STATUS, GENDERS, fmtBytes } from "@/lib/applications";
import { ReviewPanel } from "./ReviewPanel";
import "../postulaciones.css";

export const metadata = { title: "Detalle de postulación · UNAMAD Admin" };
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="ps-dl__row">
      <dt>{label}</dt>
      <dd>{value && value.trim() ? value : "—"}</dd>
    </div>
  );
}

export default async function Page({ params }: Params) {
  const me = await requirePermission("applications.read");
  const { id } = await params;

  const a = await prisma.diplomaApplication.findUnique({
    where: { id },
    include: {
      diploma: { select: { title: true, slug: true, code: true } },
      documents: { orderBy: { createdAt: "asc" } },
      reviewedBy: { select: { name: true } },
    },
  });
  if (!a) notFound();

  const canWrite = me.permissions.has("applications.write");
  const statusMeta = APPLICATION_STATUS.find((s) => s.value === a.status)!;
  const genderLabel = GENDERS.find((g) => g.value === a.gender)?.label ?? a.gender;

  return (
    <div className="page">
      <div className="ps-detail-top">
        <Link href="/postulaciones" className="linkbtn">
          <Icon name="chevron-right" size={15} className="ps-back-ic" />
          Postulaciones
        </Link>
      </div>

      <div className="page__head">
        <div className="page__title">
          <h1>
            {a.firstName} {a.lastName}
          </h1>
          <span className="page__sub">
            <code>{a.code}</code> · {a.diploma.title}
          </span>
        </div>
        <span className={`badge ${statusMeta.badge}`}>{statusMeta.label}</span>
      </div>

      <div className="ps-detail-grid">
        <div className="ps-detail-main">
          <section className="ps-card">
            <h2 className="ps-card__title">Datos personales</h2>
            <dl className="ps-dl">
              <Row label="Nombres" value={a.firstName} />
              <Row label="Apellidos" value={a.lastName} />
              <Row label="Documento" value={`${a.docType} ${a.docNumber}`} />
              <Row label="Fecha de nacimiento" value={fmtDate(a.birthDate)} />
              <Row label="Sexo" value={genderLabel} />
            </dl>
          </section>

          <section className="ps-card">
            <h2 className="ps-card__title">Contacto</h2>
            <dl className="ps-dl">
              <Row label="Correo" value={a.email} />
              <Row label="Teléfono" value={a.phone} />
              <Row label="Dirección" value={a.address} />
              <Row label="Región" value={a.region} />
              <Row label="Provincia" value={a.province} />
              <Row label="Distrito" value={a.district} />
            </dl>
          </section>

          <section className="ps-card">
            <h2 className="ps-card__title">Formación y experiencia</h2>
            <dl className="ps-dl">
              <Row label="Grado académico" value={a.academicDegree} />
              <Row label="Profesión" value={a.profession} />
              <Row label="Universidad" value={a.university} />
              <Row label="Centro laboral" value={a.employer} />
              <Row label="Cargo" value={a.position} />
              <Row label="Modalidad de preferencia" value={a.modality} />
            </dl>
          </section>

          {a.motivation && (
            <section className="ps-card">
              <h2 className="ps-card__title">Carta de intención</h2>
              <p className="ps-motivation">{a.motivation}</p>
            </section>
          )}
        </div>

        <aside className="ps-detail-side">
          <section className="ps-card">
            <h2 className="ps-card__title">Documentos ({a.documents.length})</h2>
            {a.documents.length === 0 ? (
              <p className="ps-empty-note">Sin documentos adjuntos.</p>
            ) : (
              <ul className="ps-doclist">
                {a.documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={`/api/postulaciones/doc/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ps-doclink"
                    >
                      <Icon name="download" size={16} />
                      <span className="ps-doclink__body">
                        <span className="ps-doclink__label">{doc.label}</span>
                        <span className="ps-doclink__meta">
                          {doc.fileName} · {fmtBytes(doc.sizeBytes)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ReviewPanel
            id={a.id}
            canWrite={canWrite}
            status={a.status}
            note={a.reviewNote ?? ""}
            reviewedBy={a.reviewedBy?.name ?? null}
            reviewedAtLabel={a.reviewedAt ? fmtDateTime(a.reviewedAt) : null}
          />

          <section className="ps-card ps-card--muted">
            <div className="ps-meta-line">
              <span>Recibida</span>
              <b>{fmtDateTime(a.createdAt)}</b>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
