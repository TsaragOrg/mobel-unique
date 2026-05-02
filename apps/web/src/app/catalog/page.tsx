import type { Metadata } from "next";
import { PublicCatalogPage } from "./PublicCatalogPage";

export const metadata: Metadata = {
  description:
    "Parcourez les canapés MÖBEL UNIQUE publiés et choisissez un modèle à visualiser chez vous avec une simulation assistée par IA.",
  title: "MÖBEL UNIQUE | Catalogue de canapés à simuler",
};

export default function CatalogPage() {
  return <PublicCatalogPage />;
}
