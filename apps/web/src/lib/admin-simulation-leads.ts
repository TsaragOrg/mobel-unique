export type AdminSimulationLeadSort = "newest" | "oldest";
export type AdminSimulationLeadRange = "day" | "week" | "month";

export interface AdminSimulationLeadCursor {
  id: string;
  lastSimulationAt: string;
}

export interface AdminSimulationLeadListQuery {
  cursor?: AdminSimulationLeadCursor;
  email?: string;
  from?: string;
  limit: number;
  range: AdminSimulationLeadRange | null;
  sort: AdminSimulationLeadSort;
  to?: string;
}

export interface AdminSimulationLeadJobsQuery {
  from?: string;
  range: AdminSimulationLeadRange | null;
  to?: string;
}

export interface AdminSimulationLeadRecord {
  email: string;
  lastSimulationAt: string;
  leadId: string;
  matchingJobCount: number;
}

export interface AdminSimulationLeadJobRecord {
  fabricName: string;
  previewImageUrl: string | null;
  simulationDate: string;
  sofaName: string;
  statusLabel: string;
  visualPositionLabel: string | null;
}

export interface AdminSimulationLeadListResult {
  leads: AdminSimulationLeadRecord[];
  nextCursor: AdminSimulationLeadCursor | null;
}

export interface AdminSimulationLeadJobsResult {
  email: string;
  jobs: AdminSimulationLeadJobRecord[];
  matchingJobCount: number;
}

export interface AdminSimulationLeadsStore {
  deleteLead(leadId: string): Promise<{ deleted: true }>;
  listLeadJobs(
    leadId: string,
    query: AdminSimulationLeadJobsQuery,
  ): Promise<AdminSimulationLeadJobsResult | null>;
  listLeads(
    query: AdminSimulationLeadListQuery,
  ): Promise<AdminSimulationLeadListResult>;
}

export type AdminSimulationLeadQueryParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      error: {
        code: "VALIDATION_FAILED";
        message: string;
      };
      ok: false;
      status: 400;
    };

export function parseAdminSimulationLeadListQuery(
  searchParams: URLSearchParams,
): AdminSimulationLeadQueryParseResult<AdminSimulationLeadListQuery> {
  const dateFilter = parseDateFilter(searchParams);

  if (!dateFilter.ok) {
    return dateFilter;
  }

  const sortRaw = searchParams.get("sort") ?? "newest";
  if (sortRaw !== "newest" && sortRaw !== "oldest") {
    return validationError("Sort is not supported.");
  }

  const limit = parseLimit(searchParams.get("limit"));
  if (!limit.ok) {
    return limit;
  }

  const cursor = parseCursor(searchParams.get("cursor"));
  if (!cursor.ok) {
    return cursor;
  }

  const email = normalizeAdminSimulationLeadEmail(
    searchParams.get("email") ?? "",
  );

  return {
    ok: true,
    value: {
      ...dateFilter.value,
      ...(cursor.value ? { cursor: cursor.value } : {}),
      ...(email ? { email } : {}),
      limit: limit.value,
      sort: sortRaw,
    },
  };
}

export function parseAdminSimulationLeadJobsQuery(
  searchParams: URLSearchParams,
): AdminSimulationLeadQueryParseResult<AdminSimulationLeadJobsQuery> {
  return parseDateFilter(searchParams);
}

export function normalizeAdminSimulationLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function encodeAdminSimulationLeadCursor(
  cursor: AdminSimulationLeadCursor | null,
): string | null {
  if (!cursor) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      id: cursor.id,
      t: cursor.lastSimulationAt,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeAdminSimulationLeadCursor(
  cursor: string,
): AdminSimulationLeadCursor | null {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      id?: unknown;
      t?: unknown;
    };

    if (typeof value.id !== "string" || typeof value.t !== "string") {
      return null;
    }

    return {
      id: value.id,
      lastSimulationAt: value.t,
    };
  } catch {
    return null;
  }
}

export function shapeAdminSimulationLeadResponse(
  lead: AdminSimulationLeadRecord,
) {
  return {
    email: lead.email,
    last_simulation_at: lead.lastSimulationAt,
    lead_id: lead.leadId,
    matching_job_count: lead.matchingJobCount,
  };
}

export function shapeAdminSimulationLeadJobResponse(
  job: AdminSimulationLeadJobRecord,
) {
  return {
    fabric_name: job.fabricName,
    preview_image_url: job.previewImageUrl,
    simulation_date: job.simulationDate,
    sofa_name: job.sofaName,
    status_label: job.statusLabel,
    visual_position_label: job.visualPositionLabel,
  };
}

export function formatSimulationLeadStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === "succeeded" || normalized === "completed") {
    return "Terminee";
  }

  if (normalized === "failed" || normalized === "expired") {
    return "Echec";
  }

  if (normalized.includes("processing")) {
    return "En cours";
  }

  if (normalized === "queued") {
    return "En file";
  }

  if (normalized === "awaiting_dimensions") {
    return "Dimensions attendues";
  }

  return "Statut inconnu";
}

export function resolveAdminSimulationLeadDateBounds(
  query: AdminSimulationLeadJobsQuery,
  now = new Date(),
) {
  if (query.range) {
    const to = now;
    const from = new Date(to);

    if (query.range === "day") {
      from.setUTCDate(from.getUTCDate() - 1);
    } else if (query.range === "week") {
      from.setUTCDate(from.getUTCDate() - 7);
    } else {
      from.setUTCMonth(from.getUTCMonth() - 1);
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  return {
    from: query.from,
    to: query.to,
  };
}

function parseDateFilter(
  searchParams: URLSearchParams,
): AdminSimulationLeadQueryParseResult<AdminSimulationLeadJobsQuery> {
  const rangeRaw = searchParams.get("range");
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");

  if (rangeRaw && !["day", "week", "month"].includes(rangeRaw)) {
    return validationError("Date range is not supported.");
  }

  if (rangeRaw && (fromRaw || toRaw)) {
    return validationError("Use either a preset range or custom dates.");
  }

  if (fromRaw && !isValidIsoDate(fromRaw)) {
    return validationError("Start date is invalid.");
  }

  if (toRaw && !isValidIsoDate(toRaw)) {
    return validationError("End date is invalid.");
  }

  return {
    ok: true,
    value: {
      ...(fromRaw ? { from: new Date(fromRaw).toISOString() } : {}),
      range: (rangeRaw as AdminSimulationLeadRange | null) ?? null,
      ...(toRaw ? { to: new Date(toRaw).toISOString() } : {}),
    },
  };
}

function parseLimit(
  input: string | null,
): AdminSimulationLeadQueryParseResult<number> {
  if (!input) {
    return {
      ok: true,
      value: 50,
    };
  }

  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    return validationError("Limit is invalid.");
  }

  return {
    ok: true,
    value: parsed,
  };
}

function parseCursor(
  input: string | null,
): AdminSimulationLeadQueryParseResult<AdminSimulationLeadCursor | null> {
  if (!input) {
    return {
      ok: true,
      value: null,
    };
  }

  const cursor = decodeAdminSimulationLeadCursor(input);

  if (!cursor || !isValidIsoDate(cursor.lastSimulationAt)) {
    return validationError("Cursor is invalid.");
  }

  return {
    ok: true,
    value: cursor,
  };
}

function isValidIsoDate(input: string): boolean {
  const date = new Date(input);

  return Number.isFinite(date.getTime());
}

function validationError(message: string) {
  return {
    error: {
      code: "VALIDATION_FAILED" as const,
      message,
    },
    ok: false as const,
    status: 400 as const,
  };
}
