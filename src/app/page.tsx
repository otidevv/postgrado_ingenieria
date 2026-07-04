import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";
import { getPublishedDiplomas } from "@/lib/diplomas";

export const metadata: Metadata = {
  title: "Escuela de Posgrado de Ingeniería · UNAMAD",
  description:
    "Programas de maestría, doctorado y diplomados en ingeniería de la Universidad Nacional Amazónica de Madre de Dios. Investigación aplicada para el desarrollo de la Amazonía.",
};

export default async function Page() {
  const diplomas = await getPublishedDiplomas();
  return <LandingPage diplomas={diplomas} />;
}
