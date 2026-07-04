import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { getPublishedDiplomaBySlug } from "@/lib/diplomas";
import { PostularForm } from "./PostularForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublishedDiplomaBySlug(slug);
  return {
    title: d
      ? `Postular · Diplomado en ${d.title} · UNAMAD`
      : "Postulación · UNAMAD",
  };
}

export default async function PostularPage({ params }: Params) {
  const { slug } = await params;
  const d = await getPublishedDiplomaBySlug(slug);
  if (!d) notFound();

  return (
    <div className="ps">
      <header className="ps-nav">
        <div className="ps-nav__inner">
          <Link href="/" className="ps-brand">
            <span className="ps-brand__mark">U</span>
            <span className="ps-brand__text">
              <span className="ps-brand__name">UNAMAD</span>
              <span className="ps-brand__sub">Escuela de Posgrado</span>
            </span>
          </Link>
          <Link href={`/diplomado/${slug}`} className="ps-nav__back">
            <Icon name="chevron-right" size={16} className="ps-nav__back-ic" />
            Volver al diplomado
          </Link>
        </div>
      </header>

      <div className="ps-hero">
        <div className="ps-hero__inner">
          <span className="ps-eyebrow">Proceso de admisión</span>
          <h1>Postular al Diplomado en {d.title}</h1>
          <p>
            Completa tus datos y adjunta la documentación requerida. Al finalizar
            recibirás un código de seguimiento para tu postulación.
          </p>
          <ul className="ps-hero__meta">
            <li>
              <Icon name="folder" size={16} /> {d.modules.length} módulos
            </li>
            <li>
              <Icon name="clock" size={16} /> {d.totalHours} horas · {d.credits} créditos
            </li>
            <li>
              <Icon name="device" size={16} /> {d.modality}
            </li>
          </ul>
        </div>
      </div>

      <main className="ps-main">
        <PostularForm slug={slug} diplomaTitle={d.title} modality={d.modality} />
      </main>
    </div>
  );
}
