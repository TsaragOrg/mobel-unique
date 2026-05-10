/*
RU: Этот файл нужен для изменения одной ткани в админке. На экране видны данные выбранной ткани и форма. Здесь можно открыть запись по ее номеру из адреса.
FR: Ce fichier sert a modifier un tissu dans l'admin. A l'ecran, on voit les donnees du tissu choisi et le formulaire. Ici, on peut ouvrir la fiche avec son numero dans l'adresse.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../../admin-copy";
import { AdminFabricEditPage } from "../../AdminCatalogPages";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.editFabric,
};

interface FabricEditRouteProps {
  params: Promise<{
    fabric_id: string;
  }>;
}

export default async function FabricEditRoute({
  params,
}: FabricEditRouteProps) {
  const { fabric_id: fabricId } = await params;

  return <AdminFabricEditPage fabricId={fabricId} />;
}
