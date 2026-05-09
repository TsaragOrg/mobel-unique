/*
RU: Этот файл нужен для списка канапе в админке. На экране видны записи, фильтры и ссылка на создание. Здесь можно открыть канапе или начать новую запись.
FR: Ce fichier sert a la liste des canapes dans l'admin. A l'ecran, on voit les fiches, les filtres et le lien de creation. Ici, on peut ouvrir un canape ou commencer une nouvelle fiche.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../admin-copy";
import { AdminSofasPage } from "../AdminCatalogPages";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.sofas,
};

export default function SofasPage() {
  return <AdminSofasPage />;
}
