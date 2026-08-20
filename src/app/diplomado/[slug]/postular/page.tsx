import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { getPublishedDiplomaBySlug } from "@/lib/diplomas";
import { PostularForm } from "./PostularForm";
import { Robot3D } from "@/components/Robot3D";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { WhatsAppButton } from "@/components/WhatsAppButton";

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
      {/* Header público compartido (el mismo de la landing) */}
      <SiteHeader />

      <div className="ps-hero">
        <div className="ps-hero__inner">
          <Link href={`/diplomado/${slug}`} className="ps-back">
            <Icon name="chevron-right" size={16} className="ps-back__ic" />
            Volver al diplomado
          </Link>
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
        <PostularForm
          slug={slug}
          diplomaTitle={d.title}
          modality={d.modality}
          totalHours={d.totalHours}
          credits={d.credits}
          modulesCount={d.modules.length}
        />
      </main>

      {/* Personaje 3D flotante — esquina inferior izquierda */}
      <Robot3D className="ps-robot" />

      {/* Botón flotante de WhatsApp — esquina inferior derecha */}
      <WhatsAppButton />
    </div>
  );
}
