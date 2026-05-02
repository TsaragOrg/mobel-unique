import type { Metadata } from "next";

import { PublicSimulationEmailGate } from "./PublicSimulationEmailGate";

export const metadata: Metadata = {
  description:
    "Vérifiez votre adresse e-mail pour accéder à la simulation MÖBEL UNIQUE et visualiser un canapé chez vous.",
  title: "MÖBEL UNIQUE | Vérification"
};

interface SimulationEmailGateRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SimulationEmailGatePage({
  params
}: SimulationEmailGateRouteProps) {
  const { slug } = await params;
  return <PublicSimulationEmailGate slug={slug} />;
}
