import type { Metadata } from "next";

import { PublicSimulationContinuation } from "./PublicSimulationContinuation";

export const metadata: Metadata = {
  description:
    "Suivez la progression de votre simulation MÖBEL UNIQUE et visualisez votre canapé chez vous dès qu'il est prêt.",
  title: "MÖBEL UNIQUE | Ma simulation"
};

interface SimulationContinuationRouteProps {
  params: Promise<{
    simulation_job_id: string;
  }>;
}

export default async function SimulationContinuationPage({
  params
}: SimulationContinuationRouteProps) {
  const { simulation_job_id } = await params;
  return <PublicSimulationContinuation jobId={simulation_job_id} />;
}
