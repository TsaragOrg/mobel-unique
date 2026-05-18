import { createClient } from "@supabase/supabase-js";

type SupabaseAnalyticsClient = any;

export const ADMIN_SIMULATION_ANALYTICS_PERIODS = [
  "7d",
  "30d",
  "all",
] as const;

export const ADMIN_SIMULATION_ANALYTICS_SORTS = ["most", "least"] as const;

export type AdminSimulationAnalyticsPeriod =
  (typeof ADMIN_SIMULATION_ANALYTICS_PERIODS)[number];

export type AdminSimulationAnalyticsSort =
  (typeof ADMIN_SIMULATION_ANALYTICS_SORTS)[number];

export interface AdminSimulationAnalyticsQuery {
  limit: number;
  period: AdminSimulationAnalyticsPeriod;
  sort: AdminSimulationAnalyticsSort;
}

export interface AdminSimulationAnalyticsSummary {
  total_simulations: number;
  unique_fabrics: number;
  unique_sofas: number;
}

export interface AdminSimulationSofaRankingRow {
  simulation_count: number;
  sofa_name: string;
  top_fabric_name: string;
}

export interface AdminSimulationFabricRankingRow {
  fabric_name: string;
  simulation_count: number;
}

export interface AdminSimulationCombinationRankingRow {
  fabric_name: string;
  simulation_count: number;
  sofa_name: string;
}

export interface AdminSimulationAnalytics {
  combinations: AdminSimulationCombinationRankingRow[];
  fabrics: AdminSimulationFabricRankingRow[];
  period: AdminSimulationAnalyticsPeriod;
  sofas: AdminSimulationSofaRankingRow[];
  sort: AdminSimulationAnalyticsSort;
  summary: AdminSimulationAnalyticsSummary;
}

export interface AdminSimulationAnalyticsJobRow {
  created_at: string;
  selected_fabric_id: string | null;
  selected_sofa_id: string | null;
  status?: string | null;
}

export interface AdminSimulationAnalyticsLabelRow {
  id: string;
  internal_name?: string | null;
  public_name?: string | null;
}

export interface AdminSimulationAnalyticsStore {
  getSimulationAnalytics(
    query: AdminSimulationAnalyticsQuery,
  ): Promise<AdminSimulationAnalytics>;
}

export const DEFAULT_ADMIN_SIMULATION_ANALYTICS_QUERY: AdminSimulationAnalyticsQuery =
  {
    limit: 10,
    period: "30d",
    sort: "most",
  };

const MAX_ANALYTICS_RANKING_LIMIT = 50;
const ARCHIVED_SOFA_LABEL = "Canapé archivé";
const ARCHIVED_FABRIC_LABEL = "Tissu archivé";

export function parseAdminSimulationAnalyticsQuery(
  searchParams: URLSearchParams,
):
  | {
      ok: true;
      value: AdminSimulationAnalyticsQuery;
    }
  | {
      error: {
        code: "VALIDATION_FAILED";
        message: string;
      };
      ok: false;
      status: 400;
    } {
  const period = searchParams.get("period")?.trim() || "30d";
  const sort = searchParams.get("sort")?.trim() || "most";
  const limit = searchParams.get("limit")?.trim();

  if (!isAdminSimulationAnalyticsPeriod(period)) {
    return validationFailure("Unsupported analytics period.");
  }

  if (!isAdminSimulationAnalyticsSort(sort)) {
    return validationFailure("Unsupported analytics sort.");
  }

  const parsedLimit = limit && /^\d+$/.test(limit)
    ? Number.parseInt(limit, 10)
    : DEFAULT_ADMIN_SIMULATION_ANALYTICS_QUERY.limit;

  if (
    (limit && !/^\d+$/.test(limit)) ||
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > MAX_ANALYTICS_RANKING_LIMIT
  ) {
    return validationFailure("Unsupported analytics limit.");
  }

  return {
    ok: true,
    value: {
      limit: parsedLimit,
      period,
      sort,
    },
  };
}

export function buildAdminSimulationAnalytics(input: {
  fabrics: AdminSimulationAnalyticsLabelRow[];
  jobs: AdminSimulationAnalyticsJobRow[];
  now?: Date;
  query?: Partial<AdminSimulationAnalyticsQuery>;
  sofas: AdminSimulationAnalyticsLabelRow[];
}): AdminSimulationAnalytics {
  const query = {
    ...DEFAULT_ADMIN_SIMULATION_ANALYTICS_QUERY,
    ...input.query,
  };
  const now = input.now ?? new Date();
  const since = getPeriodStart(query.period, now);
  const sofaLabels = new Map(
    input.sofas.map((sofa) => [
      sofa.id,
      readDisplayName(sofa, ARCHIVED_SOFA_LABEL),
    ]),
  );
  const fabricLabels = new Map(
    input.fabrics.map((fabric) => [
      fabric.id,
      readDisplayName(fabric, ARCHIVED_FABRIC_LABEL),
    ]),
  );
  const jobs = input.jobs.filter((job) => jobIsInsidePeriod(job, since));
  const sofaIds = new Set<string>();
  const fabricIds = new Set<string>();
  const sofaCounts = new Map<string, number>();
  const fabricCounts = new Map<string, number>();
  const combinationCounts = new Map<string, number>();
  const sofaFabricCounts = new Map<string, Map<string, number>>();

  for (const job of jobs) {
    const sofaId = job.selected_sofa_id;
    const fabricId = job.selected_fabric_id;

    if (sofaId) {
      sofaIds.add(sofaId);
      sofaCounts.set(sofaId, (sofaCounts.get(sofaId) ?? 0) + 1);
    }

    if (fabricId) {
      fabricIds.add(fabricId);
      fabricCounts.set(fabricId, (fabricCounts.get(fabricId) ?? 0) + 1);
    }

    if (sofaId && fabricId) {
      const combinationKey = `${sofaId}\u0000${fabricId}`;
      const fabricMap = sofaFabricCounts.get(sofaId) ?? new Map();

      combinationCounts.set(
        combinationKey,
        (combinationCounts.get(combinationKey) ?? 0) + 1,
      );
      fabricMap.set(fabricId, (fabricMap.get(fabricId) ?? 0) + 1);
      sofaFabricCounts.set(sofaId, fabricMap);
    }
  }

  const sofas = Array.from(sofaCounts.entries()).map(([sofaId, count]) => ({
    simulation_count: count,
    sofa_name: sofaLabels.get(sofaId) ?? ARCHIVED_SOFA_LABEL,
    top_fabric_name: resolveTopFabricName(
      sofaFabricCounts.get(sofaId),
      fabricLabels,
    ),
  }));
  const fabrics = Array.from(fabricCounts.entries()).map(
    ([fabricId, count]) => ({
      fabric_name: fabricLabels.get(fabricId) ?? ARCHIVED_FABRIC_LABEL,
      simulation_count: count,
    }),
  );
  const combinations = Array.from(combinationCounts.entries()).map(
    ([key, count]) => {
      const [sofaId, fabricId] = key.split("\u0000");

      return {
        fabric_name: fabricLabels.get(fabricId) ?? ARCHIVED_FABRIC_LABEL,
        simulation_count: count,
        sofa_name: sofaLabels.get(sofaId) ?? ARCHIVED_SOFA_LABEL,
      };
    },
  );

  return {
    combinations: sortRankingRows(combinations, query.sort, [
      "sofa_name",
      "fabric_name",
    ]).slice(0, query.limit),
    fabrics: sortRankingRows(fabrics, query.sort, ["fabric_name"]).slice(
      0,
      query.limit,
    ),
    period: query.period,
    sofas: sortRankingRows(sofas, query.sort, ["sofa_name"]).slice(
      0,
      query.limit,
    ),
    sort: query.sort,
    summary: {
      total_simulations: jobs.length,
      unique_fabrics: fabricIds.size,
      unique_sofas: sofaIds.size,
    },
  };
}

export function createSupabaseAdminSimulationAnalyticsStore(
  env: NodeJS.ProcessEnv = process.env,
): AdminSimulationAnalyticsStore {
  const supabaseUrl = requiredEnv(
    env,
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  );
  const serviceRoleKey = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as SupabaseAnalyticsClient;

  return {
    async getSimulationAnalytics(query) {
      const jobs = await fetchSimulationJobs(client, query);
      const sofaIds = uniqueNonEmptyIds(
        jobs.map((job) => job.selected_sofa_id),
      );
      const fabricIds = uniqueNonEmptyIds(
        jobs.map((job) => job.selected_fabric_id),
      );
      const [sofas, fabrics] = await Promise.all([
        fetchCatalogLabels(client, "sofas", sofaIds),
        fetchCatalogLabels(client, "fabrics", fabricIds),
      ]);

      return buildAdminSimulationAnalytics({
        fabrics,
        jobs,
        query,
        sofas,
      });
    },
  };
}

async function fetchSimulationJobs(
  client: SupabaseAnalyticsClient,
  query: AdminSimulationAnalyticsQuery,
): Promise<AdminSimulationAnalyticsJobRow[]> {
  let request = client
    .from("in_home_simulation_jobs")
    .select("created_at,selected_sofa_id,selected_fabric_id,status");
  const since = getPeriodStart(query.period, new Date());

  if (since) {
    request = request.gte("created_at", since.toISOString());
  }

  const { data, error } = await request;

  if (error) {
    throw new Error("ANALYTICS_UNAVAILABLE");
  }

  return Array.isArray(data)
    ? data.map((row) => shapeJobRow(row)).filter((row) => row !== null)
    : [];
}

async function fetchCatalogLabels(
  client: SupabaseAnalyticsClient,
  tableName: "fabrics" | "sofas",
  ids: string[],
): Promise<AdminSimulationAnalyticsLabelRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from(tableName)
    .select("id,public_name,internal_name")
    .in("id", ids);

  if (error) {
    throw new Error("ANALYTICS_UNAVAILABLE");
  }

  return Array.isArray(data)
    ? data.map((row) => shapeLabelRow(row)).filter((row) => row !== null)
    : [];
}

function validationFailure(message: string) {
  return {
    error: {
      code: "VALIDATION_FAILED" as const,
      message,
    },
    ok: false as const,
    status: 400 as const,
  };
}

function isAdminSimulationAnalyticsPeriod(
  value: string,
): value is AdminSimulationAnalyticsPeriod {
  return ADMIN_SIMULATION_ANALYTICS_PERIODS.includes(
    value as AdminSimulationAnalyticsPeriod,
  );
}

function isAdminSimulationAnalyticsSort(
  value: string,
): value is AdminSimulationAnalyticsSort {
  return ADMIN_SIMULATION_ANALYTICS_SORTS.includes(
    value as AdminSimulationAnalyticsSort,
  );
}

function getPeriodStart(
  period: AdminSimulationAnalyticsPeriod,
  now: Date,
): Date | null {
  if (period === "all") {
    return null;
  }

  const days = period === "7d" ? 7 : 30;

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function jobIsInsidePeriod(
  job: AdminSimulationAnalyticsJobRow,
  since: Date | null,
) {
  if (!since) {
    return true;
  }

  const createdAt = new Date(job.created_at);

  return !Number.isNaN(createdAt.getTime()) && createdAt >= since;
}

function uniqueNonEmptyIds(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

function readDisplayName(
  row: AdminSimulationAnalyticsLabelRow,
  fallback: string,
) {
  return row.public_name?.trim() || row.internal_name?.trim() || fallback;
}

function resolveTopFabricName(
  fabricCounts: Map<string, number> | undefined,
  fabricLabels: Map<string, string>,
) {
  if (!fabricCounts || fabricCounts.size === 0) {
    return ARCHIVED_FABRIC_LABEL;
  }

  const [topFabricId] = Array.from(fabricCounts.entries()).sort(
    ([leftId, leftCount], [rightId, rightCount]) => {
      if (leftCount !== rightCount) {
        return rightCount - leftCount;
      }

      return (
        fabricLabels.get(leftId) ?? ARCHIVED_FABRIC_LABEL
      ).localeCompare(fabricLabels.get(rightId) ?? ARCHIVED_FABRIC_LABEL);
    },
  )[0];

  return fabricLabels.get(topFabricId) ?? ARCHIVED_FABRIC_LABEL;
}

function sortRankingRows<T extends { simulation_count: number }>(
  rows: T[],
  sort: AdminSimulationAnalyticsSort,
  labelKeys: Array<keyof T>,
) {
  return rows.sort((left, right) => {
    const countComparison =
      sort === "most"
        ? right.simulation_count - left.simulation_count
        : left.simulation_count - right.simulation_count;

    if (countComparison !== 0) {
      return countComparison;
    }

    for (const key of labelKeys) {
      const labelComparison = String(left[key]).localeCompare(
        String(right[key]),
      );

      if (labelComparison !== 0) {
        return labelComparison;
      }
    }

    return 0;
  });
}

function shapeJobRow(value: unknown): AdminSimulationAnalyticsJobRow | null {
  const row = readObject(value);

  if (!row) {
    return null;
  }

  const createdAt = readString(row.created_at);

  if (!createdAt) {
    return null;
  }

  return {
    created_at: createdAt,
    selected_fabric_id: readNullableString(row.selected_fabric_id),
    selected_sofa_id: readNullableString(row.selected_sofa_id),
    status: readNullableString(row.status),
  };
}

function shapeLabelRow(value: unknown): AdminSimulationAnalyticsLabelRow | null {
  const row = readObject(value);
  const id = readString(row?.id);

  if (!id) {
    return null;
  }

  return {
    id,
    internal_name: readNullableString(row?.internal_name),
    public_name: readNullableString(row?.public_name),
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function requiredEnv(
  env: NodeJS.ProcessEnv,
  primaryName: string,
  fallbackName?: string,
) {
  const value = env[primaryName] ?? (fallbackName ? env[fallbackName] : null);

  if (!value) {
    throw new Error(`Missing required environment variable: ${primaryName}`);
  }

  return value;
}
