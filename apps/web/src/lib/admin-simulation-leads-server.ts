import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  formatSimulationLeadStatusLabel,
  resolveAdminSimulationLeadDateBounds,
  type AdminSimulationLeadJobRecord,
  type AdminSimulationLeadListQuery,
  type AdminSimulationLeadRecord,
  type AdminSimulationLeadsStore,
} from "./admin-simulation-leads";
import { hashSimulationRateLimitSubject } from "./simulation-rate-limit";
import {
  decryptSimulationEmailAddress,
  encryptSimulationEmailAddress,
  hashSimulationEmailAddress,
  normalizeSimulationEmailAddress,
} from "./simulation-email-identity";

type SupabaseAdminLeadsClient = SupabaseClient | any;

interface CreateSupabaseAdminSimulationLeadsStoreOptions {
  client?: SupabaseAdminLeadsClient;
  emailEncryptionSecret?: string;
  emailHashSecret?: string;
  now?: () => Date;
  rateLimitSalt?: string;
}

interface LeadRpcRow {
  out_email_address_encrypted: string;
  out_last_simulation_at: string;
  out_lead_id: string;
  out_matching_job_count: number;
}

interface LeadJobRpcRow {
  out_fabric_name: string;
  out_prepared_render_cell_id: string | null;
  out_prepared_sofa_asset_id: string | null;
  out_simulation_date: string;
  out_sofa_name: string;
  out_status: string;
  out_visual_position_label: string | null;
}

export const encryptSimulationLeadEmail = encryptSimulationEmailAddress;
export const decryptSimulationLeadEmail = decryptSimulationEmailAddress;
export const hashSimulationLeadEmail = hashSimulationEmailAddress;

export function createSupabaseAdminSimulationLeadsStore(
  options: CreateSupabaseAdminSimulationLeadsStoreOptions = {},
): AdminSimulationLeadsStore {
  const client = options.client ?? createServiceRoleClient();
  const emailEncryptionSecret =
    options.emailEncryptionSecret ??
    requiredEnv("SIMULATION_EMAIL_ENCRYPTION_SECRET");
  const emailHashSecret =
    options.emailHashSecret ?? requiredEnv("SIMULATION_EMAIL_HASH_SECRET");
  const rateLimitSalt =
    options.rateLimitSalt ?? requiredEnv("SIMULATION_RATE_LIMIT_SUBJECT_SALT");
  const now = options.now ?? (() => new Date());

  return {
    async deleteLead(leadId) {
      const lead = await loadLeadIdentity(client, leadId);

      if (!lead) {
        return { deleted: true };
      }

      const email = normalizeSimulationEmailAddress(
        decryptSimulationLeadEmail(
          lead.email_address_encrypted,
          emailEncryptionSecret,
        ),
      );
      const emailNormalizedHash = hashSimulationLeadEmail(
        email,
        emailHashSecret,
      );
      const authUserIds = await listCandidateAuthUserIds(
        client,
        emailNormalizedHash,
      );

      for (const authUserId of authUserIds) {
        const hasOtherReferences = await authUserHasOtherReferences(
          client,
          authUserId,
          emailNormalizedHash,
        );

        if (!hasOtherReferences) {
          await deleteTransientAuthUser(client, authUserId);
        }
      }

      const { error } = await client.rpc(
        "admin_delete_simulation_lead_identity",
        {
          p_email_normalized_hash: emailNormalizedHash,
          p_lead_id: leadId,
          p_rate_limit_subject_hash: hashSimulationRateLimitSubject(
            email,
            rateLimitSalt,
          ),
        },
      );

      if (error) {
        throw error;
      }

      return { deleted: true };
    },
    async listLeadJobs(leadId, query) {
      const lead = await loadLeadIdentity(client, leadId);

      if (!lead) {
        return null;
      }

      const email = decryptSimulationLeadEmail(
        lead.email_address_encrypted,
        emailEncryptionSecret,
      );
      const bounds = resolveAdminSimulationLeadDateBounds(query, now());
      const { data, error } = await client.rpc(
        "admin_list_simulation_lead_jobs",
        {
          p_from: bounds.from ?? null,
          p_lead_id: leadId,
          p_to: bounds.to ?? null,
        },
      );

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as LeadJobRpcRow[];
      const jobs = rows.map(shapeLeadJobRow);

      return {
        email,
        jobs,
        matchingJobCount: jobs.length,
      };
    },
    async listLeads(query) {
      const bounds = resolveAdminSimulationLeadDateBounds(query, now());
      const emailHash = query.email
        ? hashSimulationLeadEmail(
            normalizeSimulationEmailAddress(query.email),
            emailHashSecret,
          )
        : null;
      const { data, error } = await client.rpc("admin_list_simulation_leads", {
        p_cursor_last_simulation_at: query.cursor?.lastSimulationAt ?? null,
        p_cursor_lead_id: query.cursor?.id ?? null,
        p_email_normalized_hash: emailHash,
        p_from: bounds.from ?? null,
        p_limit: query.limit,
        p_sort: query.sort,
        p_to: bounds.to ?? null,
      });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as LeadRpcRow[];
      const leads = rows.map((row): AdminSimulationLeadRecord => {
        return {
          email: decryptSimulationLeadEmail(
            row.out_email_address_encrypted,
            emailEncryptionSecret,
          ),
          lastSimulationAt: row.out_last_simulation_at,
          leadId: row.out_lead_id,
          matchingJobCount: row.out_matching_job_count,
        };
      });

      return {
        leads,
        nextCursor:
          leads.length === query.limit
            ? {
                id: leads[leads.length - 1].leadId,
                lastSimulationAt: leads[leads.length - 1].lastSimulationAt,
              }
            : null,
      };
    },
  };
}

export function buildAdminSimulationLeadPreviewUrl(input: {
  preparedRenderCellId: string | null;
  preparedSofaAssetId: string | null;
}): string | null {
  if (!input.preparedSofaAssetId) {
    return null;
  }

  return `/api/admin/storage-assets/${encodeURIComponent(
    input.preparedSofaAssetId,
  )}/preview?variant=medium`;
}

function shapeLeadJobRow(row: LeadJobRpcRow): AdminSimulationLeadJobRecord {
  return {
    fabricName: row.out_fabric_name,
    previewImageUrl: buildAdminSimulationLeadPreviewUrl({
      preparedRenderCellId: row.out_prepared_render_cell_id,
      preparedSofaAssetId: row.out_prepared_sofa_asset_id,
    }),
    simulationDate: row.out_simulation_date,
    sofaName: row.out_sofa_name,
    statusLabel: formatSimulationLeadStatusLabel(row.out_status),
    visualPositionLabel: row.out_visual_position_label,
  };
}

async function loadLeadIdentity(
  client: SupabaseAdminLeadsClient,
  leadId: string,
): Promise<{
  email_address_encrypted: string;
  email_normalized_hash: string;
} | null> {
  const { data, error } = await client
    .from("simulation_leads")
    .select("email_address_encrypted,email_normalized_hash")
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function listCandidateAuthUserIds(
  client: SupabaseAdminLeadsClient,
  emailNormalizedHash: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("simulation_sessions")
    .select("auth_user_id")
    .eq("email_normalized_hash", emailNormalizedHash)
    .not("auth_user_id", "is", null);

  if (error) {
    throw error;
  }

  return [
    ...new Set(
      ((data ?? []) as Array<{ auth_user_id?: string | null }>)
        .map((row) => row.auth_user_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

async function authUserHasOtherReferences(
  client: SupabaseAdminLeadsClient,
  authUserId: string,
  deletedEmailHash: string,
) {
  const { data, error } = await client
    .from("simulation_sessions")
    .select("id")
    .eq("auth_user_id", authUserId)
    .neq("email_normalized_hash", deletedEmailHash)
    .limit(1);

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

async function deleteTransientAuthUser(
  client: SupabaseAdminLeadsClient,
  authUserId: string,
) {
  const { error } = await client.auth.admin.deleteUser(authUserId);

  if (!error) {
    return;
  }

  const status =
    typeof error === "object" && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  if (status === 404 || message.toLowerCase().includes("not found")) {
    return;
  }

  throw error;
}

function createServiceRoleClient(): SupabaseAdminLeadsClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function requiredEnv(primaryName: string, fallbackName?: string) {
  const value =
    process.env[primaryName] ?? (fallbackName ? process.env[fallbackName] : "");

  if (!value) {
    throw new Error(`${primaryName} is required.`);
  }

  return value;
}
