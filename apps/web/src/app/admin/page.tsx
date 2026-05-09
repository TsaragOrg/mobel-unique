/*
RU: Этот файл нужен для главной страницы админки. На экране видно проверку доступа, отказ или рабочую панель. Здесь можно открыть разделы каталога после входа.
FR: Ce fichier sert a la page principale de l'admin. A l'ecran, on voit le controle d'acces, un refus ou le panneau de travail. Ici, on peut ouvrir les zones du catalogue apres l'entree.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "./admin-copy";
import AdminDashboard from "./AdminDashboard";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: ADMIN_COPY.catalog.metadataTitles.dashboard
};

export default function AdminPage() {
  return <AdminDashboard />;
}
