"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ADMIN_SIMULATION_ANALYTICS_QUERY,
  type AdminSimulationAnalytics,
  type AdminSimulationAnalyticsPeriod,
  type AdminSimulationAnalyticsQuery,
  type AdminSimulationAnalyticsSort,
} from "../../lib/admin-simulation-analytics";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import {
  formatAdminApiErrorMessage,
  formatAdminErrorMessage,
} from "./admin-error-messages";
import { ADMIN_COPY, ADMIN_LOCALE } from "./admin-copy";
import { AdminPageHeader, AdminShell } from "./AdminShell";

type AnalyticsPageState = "checking" | "forbidden" | "ready";

export interface AdminSimulationAnalyticsPageDependencies {
  clearTrustedDevice(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getSimulationAnalytics(
    accessToken: string,
    query: AdminSimulationAnalyticsQuery,
  ): Promise<AdminSimulationAnalytics>;
  redirect(path: string): void;
  refreshAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  verifyAdminSession(accessToken: string): Promise<{
    ok: boolean;
    status: number;
  }>;
}

const PERIOD_OPTIONS: Array<{
  label: string;
  value: AdminSimulationAnalyticsPeriod;
}> = [
  {
    label: ADMIN_COPY.analytics.periods.last7Days,
    value: "7d",
  },
  {
    label: ADMIN_COPY.analytics.periods.last30Days,
    value: "30d",
  },
  {
    label: ADMIN_COPY.analytics.periods.allTime,
    value: "all",
  },
];

const SORT_OPTIONS: Array<{
  label: string;
  value: AdminSimulationAnalyticsSort;
}> = [
  {
    label: ADMIN_COPY.analytics.sorts.most,
    value: "most",
  },
  {
    label: ADMIN_COPY.analytics.sorts.least,
    value: "least",
  },
];

export default function AdminSimulationAnalyticsPage({
  dependencies,
}: {
  dependencies?: AdminSimulationAnalyticsPageDependencies;
}) {
  const router = useRouter();
  const defaultDependencies = useMemo(
    () => createDefaultDependencies((path) => router.replace(path)),
    [router],
  );
  const activeDependencies = dependencies ?? defaultDependencies;
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminSimulationAnalytics | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageState, setPageState] =
    useState<AnalyticsPageState>("checking");
  const [period, setPeriod] = useState<AdminSimulationAnalyticsPeriod>(
    DEFAULT_ADMIN_SIMULATION_ANALYTICS_QUERY.period,
  );
  const [sort, setSort] = useState<AdminSimulationAnalyticsSort>(
    DEFAULT_ADMIN_SIMULATION_ANALYTICS_QUERY.sort,
  );

  useEffect(() => {
    let isCurrent = true;

    async function validateAdminSession() {
      let currentAccessToken: string | null;

      try {
        currentAccessToken = await activeDependencies.getAccessToken();
      } catch {
        activeDependencies.redirect("/admin/login");
        return;
      }

      if (!currentAccessToken) {
        await activeDependencies.clearTrustedDevice();
        activeDependencies.redirect("/admin/login");
        return;
      }

      let response =
        await activeDependencies.verifyAdminSession(currentAccessToken);

      if (response.status === 401) {
        const refreshedAccessToken =
          await activeDependencies.refreshAccessToken();

        if (refreshedAccessToken) {
          currentAccessToken = refreshedAccessToken;
          response =
            await activeDependencies.verifyAdminSession(refreshedAccessToken);
        }
      }

      if (!isCurrent) {
        return;
      }

      if (response.ok) {
        setAccessToken(currentAccessToken);
        setPageState("ready");
        return;
      }

      await activeDependencies.signOut();
      await activeDependencies.clearTrustedDevice();

      if (response.status === 403) {
        setPageState("forbidden");
        return;
      }

      activeDependencies.redirect("/admin/login");
    }

    void validateAdminSession();

    return () => {
      isCurrent = false;
    };
  }, [activeDependencies]);

  useEffect(() => {
    if (pageState !== "ready" || !accessToken) {
      return;
    }

    const currentAccessToken = accessToken;
    let isCurrent = true;

    async function loadAnalytics() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextAnalytics =
          await activeDependencies.getSimulationAnalytics(currentAccessToken, {
            limit: DEFAULT_ADMIN_SIMULATION_ANALYTICS_QUERY.limit,
            period,
            sort,
          });

        if (isCurrent) {
          setAnalytics(nextAnalytics);
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(formatAdminErrorMessage(error));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, activeDependencies, pageState, period, sort]);

  if (pageState === "checking") {
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

  if (pageState === "forbidden") {
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
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <section className="admin-analytics-page" aria-labelledby="admin-title">
        <AdminPageHeader
          description={ADMIN_COPY.analytics.description}
          eyebrow={ADMIN_COPY.analytics.eyebrow}
          title={ADMIN_COPY.analytics.title}
          titleId="admin-title"
        />
        <div className="admin-analytics-toolbar">
          <AnalyticsSegmentedControl<AdminSimulationAnalyticsPeriod>
            label={ADMIN_COPY.analytics.labels.period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            value={period}
          />
          <AnalyticsSegmentedControl<AdminSimulationAnalyticsSort>
            label={ADMIN_COPY.analytics.labels.sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            value={sort}
          />
          {isLoading ? (
            <p className="admin-analytics-loading" role="status">
              {ADMIN_COPY.analytics.loading}
            </p>
          ) : null}
        </div>
        {errorMessage ? (
          <p className="admin-list-feedback" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {analytics ? (
          <AnalyticsContent analytics={analytics} />
        ) : !errorMessage ? (
          <p className="admin-list-feedback" role="status">
            {ADMIN_COPY.analytics.loading}
          </p>
        ) : null}
      </section>
    </AdminShell>
  );
}

function AnalyticsSegmentedControl<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange(value: TValue): void;
  options: Array<{
    label: string;
    value: TValue;
  }>;
  value: TValue;
}) {
  return (
    <div className="admin-analytics-control" aria-label={label}>
      <span>{label}</span>
      <div className="admin-analytics-control-buttons">
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            className={
              option.value === value
                ? "admin-analytics-control-button admin-analytics-control-button-active"
                : "admin-analytics-control-button"
            }
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnalyticsContent({
  analytics,
}: {
  analytics: AdminSimulationAnalytics;
}) {
  const isEmpty = analytics.summary.total_simulations === 0;

  return (
    <div className="admin-analytics-content">
      <section className="admin-analytics-summary" aria-label={ADMIN_COPY.analytics.labels.summary}>
        <MetricCard
          label={ADMIN_COPY.analytics.summary.total}
          value={analytics.summary.total_simulations}
        />
        <MetricCard
          label={ADMIN_COPY.analytics.summary.sofas}
          value={analytics.summary.unique_sofas}
        />
        <MetricCard
          label={ADMIN_COPY.analytics.summary.fabrics}
          value={analytics.summary.unique_fabrics}
        />
      </section>
      {isEmpty ? (
        <p className="admin-list-feedback">{ADMIN_COPY.analytics.empty}</p>
      ) : (
        <div className="admin-analytics-tables">
          <AnalyticsTable
            columns={[
              ADMIN_COPY.analytics.tableHeaders.sofa,
              ADMIN_COPY.analytics.tableHeaders.count,
              ADMIN_COPY.analytics.tableHeaders.topFabric,
            ]}
            rows={analytics.sofas.map((row) => [
              row.sofa_name,
              formatCount(row.simulation_count),
              row.top_fabric_name,
            ])}
            title={ADMIN_COPY.analytics.sections.sofas}
          />
          <AnalyticsTable
            columns={[
              ADMIN_COPY.analytics.tableHeaders.fabric,
              ADMIN_COPY.analytics.tableHeaders.count,
            ]}
            rows={analytics.fabrics.map((row) => [
              row.fabric_name,
              formatCount(row.simulation_count),
            ])}
            title={ADMIN_COPY.analytics.sections.fabrics}
          />
          <AnalyticsTable
            columns={[
              ADMIN_COPY.analytics.tableHeaders.sofa,
              ADMIN_COPY.analytics.tableHeaders.fabric,
              ADMIN_COPY.analytics.tableHeaders.count,
            ]}
            rows={analytics.combinations.map((row) => [
              row.sofa_name,
              row.fabric_name,
              formatCount(row.simulation_count),
            ])}
            title={ADMIN_COPY.analytics.sections.combinations}
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="admin-analytics-metric">
      <span>{label}</span>
      <strong>{formatCount(value)}</strong>
    </article>
  );
}

function AnalyticsTable({
  columns,
  rows,
  title,
}: {
  columns: string[];
  rows: string[][];
  title: string;
}) {
  return (
    <section className="admin-analytics-table-section" aria-labelledby={titleId(title)}>
      <h2 id={titleId(title)}>{title}</h2>
      <div className="admin-table-wrap">
        <table className="admin-table admin-analytics-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`}>
                    {cellIndex === 0 ? <strong>{cell}</strong> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function titleId(title: string) {
  return `admin-analytics-${title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat(ADMIN_LOCALE).format(value);
}

function createDefaultDependencies(
  redirect: (path: string) => void,
): AdminSimulationAnalyticsPageDependencies {
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
    async getSimulationAnalytics(accessToken, query) {
      const searchParams = new URLSearchParams({
        limit: String(query.limit),
        period: query.period,
        sort: query.sort,
      });
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/simulation-analytics?${searchParams.toString()}`,
      );

      return data as AdminSimulationAnalytics;
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
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },
  };
}

async function requestAdminJson(
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatAdminApiErrorMessage(body));
  }

  return body.data ?? {};
}
