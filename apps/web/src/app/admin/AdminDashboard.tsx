"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import { AdminPageHeader, AdminShell } from "./AdminShell";

type DashboardState = "checking" | "forbidden" | "ready";

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
  const router = useRouter();
  const defaultDependencies = useMemo(
    () => createDefaultDependencies((path) => router.replace(path)),
    [router],
  );
  const activeDependencies = dependencies ?? defaultDependencies;
  const [dashboardState, setDashboardState] =
    useState<DashboardState>("checking");

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

  async function handleLogout() {
    await activeDependencies.clearTrustedDevice();
    await activeDependencies.signOut();
    activeDependencies.redirect("/admin/login");
  }

  if (dashboardState === "checking") {
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section className="admin-auth-card" aria-live="polite">
          <p className="admin-status-text" role="status">
            Checking admin session.
          </p>
        </section>
      </AdminShell>
    );
  }

  if (dashboardState === "forbidden") {
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section
          className="admin-auth-card"
          aria-labelledby="admin-denied-title"
        >
          <AdminPageHeader
            description="This account is not authorized for the admin area."
            eyebrow="Secure workspace"
            title="Admin access unavailable"
            titleId="admin-denied-title"
          />
          <button
            className="admin-primary-button"
            onClick={handleLogout}
            type="button"
          >
            Return to sign in
          </button>
        </section>
      </AdminShell>
    );
  }

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
              Sign out
            </button>
          }
          description="Manage catalog content, fabrics, tags, and visual readiness from one workspace."
          eyebrow="Workspace"
          title="Admin dashboard"
          titleId="admin-title"
        />
        <nav className="admin-action-grid" aria-label="Catalog actions">
          <Link
            aria-label="Sofas"
            className="admin-action-card"
            href="/admin/sofas"
          >
            <span className="admin-action-kicker">Catalog</span>
            <strong>Sofas</strong>
            <span aria-hidden="true">
              Manage sofa entries, dimensions, and publishing state.
            </span>
          </Link>
          <Link
            aria-label="New sofa"
            className="admin-action-card"
            href="/admin/sofas/new"
          >
            <span className="admin-action-kicker">Create</span>
            <strong>New sofa</strong>
            <span aria-hidden="true">Start a new sofa catalog record.</span>
          </Link>
          <Link
            aria-label="Fabrics"
            className="admin-action-card"
            href="/admin/fabrics"
          >
            <span className="admin-action-kicker">Materials</span>
            <strong>Fabrics</strong>
            <span aria-hidden="true">
              Maintain swatches, references, and ordering.
            </span>
          </Link>
          <Link
            aria-label="Tags"
            className="admin-action-card"
            href="/admin/tags"
          >
            <span className="admin-action-kicker">Taxonomy</span>
            <strong>Tags</strong>
            <span aria-hidden="true">Organize public catalog filters.</span>
          </Link>
        </nav>
      </section>
    </AdminShell>
  );
}

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
