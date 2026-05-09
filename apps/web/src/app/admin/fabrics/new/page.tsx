/*
RU: Этот файл нужен для создания ткани в админке. На экране видна форма новой ткани. Здесь можно добавить названия и изображения.
FR: Ce fichier sert a creer un tissu dans l'admin. A l'ecran, on voit le formulaire de nouveau tissu. Ici, on peut ajouter les noms et les images.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../../admin-copy";
import { AdminFabricCreatePage } from "../../AdminCatalogPages";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.newFabric,
};

export default function NewFabricPage() {
  return <AdminFabricCreatePage />;
}
