import type { Metadata } from "next";
import { PublicSofaDetailPage } from "./PublicSofaDetailPage";

export const metadata: Metadata = {
  description:
    "Choisissez le tissu et la vue d'un canapé MÖBEL UNIQUE avant de lancer une simulation assistée par IA dans votre pièce.",
  title: "MÖBEL UNIQUE | Canapé à simuler",
};

interface SofaDetailRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SofaDetailPage({ params }: SofaDetailRouteProps) {
  const { slug } = await params;

  return <PublicSofaDetailPage slug={slug} />;
}
