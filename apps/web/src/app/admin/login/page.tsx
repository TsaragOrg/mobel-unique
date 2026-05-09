/*
RU: Этот файл нужен для страницы входа в админку. На экране видны заголовок, короткое описание и форма входа. Здесь можно начать безопасный вход в рабочую зону.
FR: Ce fichier sert a la page d'entree admin. A l'ecran, on voit le titre, un court texte et le formulaire d'entree. Ici, on peut commencer l'entree securisee dans l'espace de travail.
*/

import type { Metadata } from "next";
import { ADMIN_COPY } from "../admin-copy";
import { AdminPageHeader, AdminShell } from "../AdminShell";
import AdminLoginForm from "./AdminLoginForm";

// RU: Эти данные говорят браузеру название страницы и закрывают ее от поиска.
// FR: Ces donnees donnent le nom de la page au navigateur et la ferment aux moteurs de recherche.
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: ADMIN_COPY.catalog.metadataTitles.login
};

export default function AdminLoginPage() {
  return (
    <AdminShell showNavigation={false} variant="auth">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <AdminPageHeader
          description={ADMIN_COPY.login.description}
          eyebrow={ADMIN_COPY.login.eyebrow}
          title={ADMIN_COPY.login.title}
          titleId="admin-login-title"
        />
        <AdminLoginForm />
      </section>
    </AdminShell>
  );
}
