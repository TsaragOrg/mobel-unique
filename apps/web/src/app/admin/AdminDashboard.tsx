/*
RU: Этот файл нужен для первого экрана админки. Пользователь видит проверку доступа, сообщение отказа или рабочую панель. Здесь можно открыть разделы каталога и выйти из админки.
FR: Ce fichier sert au premier ecran admin. L'utilisateur voit le controle d'acces, un refus ou le panneau de travail. Ici il peut ouvrir les zones du catalogue et sortir de l'admin.
*/

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import { ADMIN_COPY } from "./admin-copy";
import { AdminPageHeader, AdminShell } from "./AdminShell";

type DashboardState = "checking" | "forbidden" | "ready";
type AdminActionIconName =
  | "analytics"
  | "sofas"
  | "new-sofa"
  | "fabrics"
  | "tags";

export interface AdminDashboardDependencies {
  clearTrustedDevice(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  redirect(path: string): void;
  refreshAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  verifyAdminSession(accessToken: string): Promise<{
    ok: boolean;
    status: number;
  }>;
}

export default function AdminDashboard({
  dependencies,
}: {
  dependencies?: AdminDashboardDependencies;
}) {
  // RU: Эта связь меняет адрес страницы внутри админки.
  // FR: Ce lien change l'adresse de la page dans l'admin.
  const router = useRouter();
  // RU: Эти действия берутся из настоящего сайта, если тест не передал свои.
  // FR: Ces actions viennent du vrai site si le test n'en donne pas.
  const defaultDependencies = useMemo(
    () => createDefaultDependencies((path) => router.replace(path)),
    [router],
  );
  // RU: Этот набор действий используется для проверки доступа и выхода.
  // FR: Ce groupe d'actions sert au controle d'acces et a la sortie.
  const activeDependencies = dependencies ?? defaultDependencies;
  // RU: Эта отметка решает, какой экран показать сейчас.
  // FR: Cette valeur decide quel ecran afficher maintenant.
  const [dashboardState, setDashboardState] =
    useState<DashboardState>("checking");

  // RU: Этот блок сам проверяет доступ при открытии страницы.
  // FR: Ce bloc verifie seul l'acces quand la page s'ouvre.
  useEffect(() => {
    let isCurrent = true;

    async function validateAdminSession() {
      let accessToken: string | null;

      try {
        accessToken = await activeDependencies.getAccessToken();
      } catch {
        activeDependencies.redirect("/admin/login");
        return;
      }

      if (!accessToken) {
        await activeDependencies.clearTrustedDevice();
        activeDependencies.redirect("/admin/login");
        return;
      }

      let response = await activeDependencies.verifyAdminSession(accessToken);

      if (response.status === 401) {
        const refreshedAccessToken =
          await activeDependencies.refreshAccessToken();

        if (refreshedAccessToken) {
          response =
            await activeDependencies.verifyAdminSession(refreshedAccessToken);
        }
      }

      if (!isCurrent) {
        return;
      }

      if (response.ok) {
        setDashboardState("ready");
        return;
      }

      await activeDependencies.signOut();
      await activeDependencies.clearTrustedDevice();

      if (response.status === 403) {
        setDashboardState("forbidden");
        return;
      }

      activeDependencies.redirect("/admin/login");
    }

    void validateAdminSession();

    return () => {
      isCurrent = false;
    };
  }, [activeDependencies]);

  // RU: Это действие очищает доверенное устройство и возвращает к входу.
  // FR: Cette action efface l'appareil de confiance et ramene a l'entree.
  async function handleLogout() {
    await activeDependencies.clearTrustedDevice();
    await activeDependencies.signOut();
    activeDependencies.redirect("/admin/login");
  }

  if (dashboardState === "checking") {
    // RU: Этот экран показывается, пока доступ еще проверяется.
    // FR: Cet ecran apparait pendant le controle d'acces.
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section className="admin-auth-card" aria-live="polite">
          <p className="admin-status-text" role="status">
            {ADMIN_COPY.auth.checkingSession}
          </p>
        </section>
      </AdminShell>
    );
  }

  if (dashboardState === "forbidden") {
    // RU: Этот экран сообщает, что у аккаунта нет доступа к админке.
    // FR: Cet ecran indique que le compte n'a pas acces a l'admin.
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section
          className="admin-auth-card"
          aria-labelledby="admin-denied-title"
        >
          <AdminPageHeader
            description={ADMIN_COPY.auth.deniedDescription}
            eyebrow={ADMIN_COPY.auth.deniedEyebrow}
            title={ADMIN_COPY.auth.deniedTitle}
            titleId="admin-denied-title"
          />
          <button
            className="admin-primary-button"
            onClick={handleLogout}
            type="button"
          >
            {ADMIN_COPY.auth.returnToSignIn}
          </button>
        </section>
      </AdminShell>
    );
  }

  // RU: Главная рабочая зона ведет в разделы каталога.
  // FR: La zone de travail principale ouvre les zones du catalogue.
  return (
    <AdminShell>
      <section className="admin-dashboard" aria-labelledby="admin-title">
        <AdminPageHeader
          actions={
            <button
              className="admin-secondary-button"
              onClick={handleLogout}
              type="button"
            >
              {ADMIN_COPY.dashboard.signOut}
            </button>
          }
          description={ADMIN_COPY.dashboard.description}
          eyebrow={ADMIN_COPY.dashboard.eyebrow}
          title={ADMIN_COPY.dashboard.title}
          titleId="admin-title"
        />
        {/* RU: Эти карточки открывают основные разделы админского каталога.
            FR: Ces cartes ouvrent les zones principales du catalogue admin. */}
        <nav
          className="admin-action-grid"
          aria-label={ADMIN_COPY.dashboard.actionsAriaLabel}
        >
          <Link
            aria-label={ADMIN_COPY.dashboard.actions.analytics.label}
            className="admin-action-card"
            href="/admin/analytics"
          >
            <span className="admin-action-card-top">
              <span className="admin-action-kicker">
                {ADMIN_COPY.dashboard.actions.analytics.kicker}
              </span>
              <AdminActionIcon name="analytics" />
            </span>
            <strong>{ADMIN_COPY.dashboard.actions.analytics.label}</strong>
            <span aria-hidden="true">
              {ADMIN_COPY.dashboard.actions.analytics.description}
            </span>
          </Link>
          <Link
            aria-label={ADMIN_COPY.dashboard.actions.sofas.label}
            className="admin-action-card"
            href="/admin/sofas"
          >
            <span className="admin-action-card-top">
              <span className="admin-action-kicker">
                {ADMIN_COPY.dashboard.actions.sofas.kicker}
              </span>
              <AdminActionIcon name="sofas" />
            </span>
            <strong>{ADMIN_COPY.dashboard.actions.sofas.label}</strong>
            <span aria-hidden="true">
              {ADMIN_COPY.dashboard.actions.sofas.description}
            </span>
          </Link>
          <Link
            aria-label={ADMIN_COPY.dashboard.actions.newSofa.label}
            className="admin-action-card"
            href="/admin/sofas/new"
          >
            <span className="admin-action-card-top">
              <span className="admin-action-kicker">
                {ADMIN_COPY.dashboard.actions.newSofa.kicker}
              </span>
              <AdminActionIcon name="new-sofa" />
            </span>
            <strong>{ADMIN_COPY.dashboard.actions.newSofa.label}</strong>
            <span aria-hidden="true">
              {ADMIN_COPY.dashboard.actions.newSofa.description}
            </span>
          </Link>
          <Link
            aria-label={ADMIN_COPY.dashboard.actions.fabrics.label}
            className="admin-action-card"
            href="/admin/fabrics"
          >
            <span className="admin-action-card-top">
              <span className="admin-action-kicker">
                {ADMIN_COPY.dashboard.actions.fabrics.kicker}
              </span>
              <AdminActionIcon name="fabrics" />
            </span>
            <strong>{ADMIN_COPY.dashboard.actions.fabrics.label}</strong>
            <span aria-hidden="true">
              {ADMIN_COPY.dashboard.actions.fabrics.description}
            </span>
          </Link>
          <Link
            aria-label={ADMIN_COPY.dashboard.actions.tags.label}
            className="admin-action-card"
            href="/admin/tags"
          >
            <span className="admin-action-card-top">
              <span className="admin-action-kicker">
                {ADMIN_COPY.dashboard.actions.tags.kicker}
              </span>
              <AdminActionIcon name="tags" />
            </span>
            <strong>{ADMIN_COPY.dashboard.actions.tags.label}</strong>
            <span aria-hidden="true">
              {ADMIN_COPY.dashboard.actions.tags.description}
            </span>
          </Link>
        </nav>
      </section>
    </AdminShell>
  );
}

function AdminActionIcon({ name }: { name: AdminActionIconName }) {
  if (name === "analytics") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="admin-action-icon">
        <path d="M6 25h20" />
        <path d="M10 25V14" />
        <path d="M16 25V8" />
        <path d="M22 25V18" />
        <path d="M7 9c4 2 7 2 10 0 3-2 5-2 8 1" />
      </svg>
    );
  }

  if (name === "sofas") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="admin-action-icon">
        <path d="M8 16h16a4 4 0 0 1 4 4v5H4v-5a4 4 0 0 1 4-4Z" />
        <path d="M9 16v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
        <path d="M7 25v3" />
        <path d="M25 25v3" />
      </svg>
    );
  }

  if (name === "new-sofa") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="admin-action-icon">
        <path d="M7 18h13a4 4 0 0 1 4 4v4H4v-4a4 4 0 0 1 3-4Z" />
        <path d="M8 18v-3a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v3" />
        <path d="M7 26v2" />
        <path d="M22 26v2" />
        <path d="M25 5v8" />
        <path d="M21 9h8" />
      </svg>
    );
  }

  if (name === "fabrics") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="admin-action-icon">
        <path d="M8 5h16a3 3 0 0 1 3 3v19H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" />
        <path d="M11 5v22" />
        <path d="M18 5v22" />
        <path d="M5 13c4-2 7 2 11 0 4-2 7 2 11 0" />
        <path d="M5 21c4-2 7 2 11 0 4-2 7 2 11 0" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="admin-action-icon">
      <path d="M6 6h9l11 11-9 9L6 15V6Z" />
      <circle cx="12" cy="12" r="2" />
      <path d="M14 12h9" />
      <path d="M23 12c3 0 4 2 4 4" />
    </svg>
  );
}

// RU: Эти действия связывают экран с Supabase и серверной проверкой.
// FR: Ces actions relient l'ecran a Supabase et au controle serveur.
function createDefaultDependencies(
  redirect: (path: string) => void,
): AdminDashboardDependencies {
  return {
    async clearTrustedDevice() {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    },
    async getAccessToken() {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();

      return data.session?.access_token ?? null;
    },
    redirect,
    async refreshAccessToken() {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        return null;
      }

      return data.session?.access_token ?? null;
    },
    async signOut() {
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut();
    },
    async verifyAdminSession(accessToken) {
      return fetch("/api/admin/session", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },
  };
}
