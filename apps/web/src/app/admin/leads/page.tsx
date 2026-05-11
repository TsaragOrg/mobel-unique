/*
RU: Этот файл нужен для страницы лидов в админке. На экране видно закрытый раздел со списком email после входа. Здесь можно открыть рабочий экран для поиска, просмотра заявок и удаления email.
FR: Ce fichier sert a la page des leads dans l'admin. A l'ecran, on voit une zone protegee avec la liste des emails apres l'entree. Ici on peut ouvrir l'ecran de recherche, voir les demandes et retirer un email.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../admin-copy";
import AdminSimulationLeadsDashboard from "./AdminSimulationLeadsDashboard";

// RU: Эти данные дают браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.leads,
};

export default function AdminLeadsPage() {
  return <AdminSimulationLeadsDashboard />;
}
