import type { Metadata } from "next";

import { PublicSimulationWizardEntry } from "./PublicSimulationWizardEntry";

export const metadata: Metadata = {
  description:
    "Téléchargez une photo de votre pièce pour visualiser un canapé MÖBEL UNIQUE chez vous, en quelques minutes.",
  title: "MÖBEL UNIQUE | Lancer ma simulation"
};

interface SimulationWizardRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SimulationWizardEntryPage({
  params
}: SimulationWizardRouteProps) {
  const { slug } = await params;
  return <PublicSimulationWizardEntry slug={slug} />;
}
