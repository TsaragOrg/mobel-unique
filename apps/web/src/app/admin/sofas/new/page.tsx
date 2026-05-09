/*
RU: Этот файл нужен для создания канапе в админке. На экране видна форма новой записи. Здесь можно заполнить данные и создать черновик.
FR: Ce fichier sert a creer un canape dans l'admin. A l'ecran, on voit le formulaire de nouvelle fiche. Ici, on peut remplir les donnees et creer un brouillon.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../../admin-copy";
import { AdminSofaCreatePage } from "../../AdminCatalogPages";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.newSofa,
};

export default function NewSofaPage() {
  return <AdminSofaCreatePage />;
}
