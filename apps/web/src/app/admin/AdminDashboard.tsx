"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";

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
      <main className="shell admin-shell">
        <section className="panel admin-panel" aria-live="polite">
          <p role="status">Checking admin session.</p>
        </section>
      </main>
    );
  }

  if (dashboardState === "forbidden") {
    return (
      <main className="shell admin-shell">
        <section
          className="panel admin-panel"
          aria-labelledby="admin-denied-title"
        >
          <p className="eyebrow">Mobel Unique</p>
          <h1 id="admin-denied-title">Admin access unavailable</h1>
          <p>This account is not authorized for the admin area.</p>
          <button onClick={handleLogout} type="button">
            Return to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="shell admin-shell">
      <section className="panel admin-panel" aria-labelledby="admin-title">
        <p className="eyebrow">Mobel Unique</p>
        <h1 id="admin-title">Admin dashboard</h1>
        <nav className="admin-actions" aria-label="Catalog actions">
          <Link className="button-link" href="/admin/sofas">
            Sofas
          </Link>
          <Link className="button-link" href="/admin/sofas/new">
            New sofa
          </Link>
          <Link className="button-link" href="/admin/fabrics">
            Fabrics
          </Link>
          <Link className="button-link" href="/admin/tags">
            Tags
          </Link>
        </nav>
        <button onClick={handleLogout} type="button">
          Sign out
        </button>
      </section>
    </main>
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
