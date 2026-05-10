/*
RU: Этот файл нужен для списка этикеток в админке. На экране видны этикетки и форма добавления. Здесь можно создать, изменить или удалить этикетку.
FR: Ce fichier sert a la liste des etiquettes dans l'admin. A l'ecran, on voit les etiquettes et le formulaire d'ajout. Ici, on peut creer, modifier ou supprimer une etiquette.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../admin-copy";
import { AdminTagsPage } from "../AdminCatalogPages";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.tags,
};

export default function TagsPage() {
  return <AdminTagsPage />;
}
