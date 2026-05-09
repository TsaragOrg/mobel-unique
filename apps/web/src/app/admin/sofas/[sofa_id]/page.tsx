/*
RU: Этот файл нужен для изменения одного канапе в админке. На экране видны данные выбранного канапе и рабочие разделы. Здесь можно открыть запись по ее номеру из адреса.
FR: Ce fichier sert a modifier un canape dans l'admin. A l'ecran, on voit les donnees du canape choisi et les zones de travail. Ici, on peut ouvrir la fiche avec son numero dans l'adresse.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../../admin-copy";
import { AdminSofaEditPage } from "../../AdminCatalogPages";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.editSofa,
};

interface SofaEditRouteProps {
  params: Promise<{
    sofa_id: string;
  }>;
}

export default async function SofaEditRoute({ params }: SofaEditRouteProps) {
  const { sofa_id: sofaId } = await params;

  return <AdminSofaEditPage sofaId={sofaId} />;
}
