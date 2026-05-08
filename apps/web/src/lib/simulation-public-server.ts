// SPEC-0015 PLAN-0040 default dependency factories for the public
// simulation route handlers.
//
// Route.ts files call these factories to get the launch-window stub
// configuration plus the Supabase-backed implementations of the
// `SimulationJobReader` and `SimulationStorageSigner` interfaces.

import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { SimulationEnvironment } from "./simulation-access-token";
import type {
  SimulationCatalogStore,
  SimulationCreateJobStore,
  SimulationDimensionsStore,
  SimulationPublicCreateHandlerDeps,
  SimulationPublicDimensionsHandlerDeps,
  SimulationPublicEmailHandlerDeps,
  SimulationPublicRegenerationHandlerDeps,
  SimulationPublicRealtimeTokenHandlerDeps,
  SimulationPublicStatusHandlerDeps,
  SimulationProgressAccessReader,
  SimulationJobReader,
  SimulationJobView,
  SimulationRealtimeTokenIssuer,
  SimulationRegenerationStore,
  SimulationStorageSigner,
  SimulationStorageUploader,
} from "./simulation-public-route-handlers";
import {
  createSupabaseSimulationIdempotencyStore,
  type SimulationIdempotencyStore,
} from "./simulation-idempotency";
import {
  createSupabaseSimulationRateLimitStore,
  type SimulationRateLimitStore,
} from "./simulation-rate-limit";
import type {
  RoomGeometryMode,
  SimulationJobStatus,
} from "./simulation-public-api";

const DEFAULT_RATE_LIMIT_IP_PER_DAY = 3;
const DEFAULT_RATE_LIMIT_EMAIL_PER_DAY = 2;
const DEFAULT_CORNER_TAG_SLUG = "corner";
const DEFAULT_RETENTION_HOURS = 24;
const DEFAULT_REALTIME_TOKEN_TTL_SECONDS = 5 * 60;

const SIMULATION_PRIVATE_BUCKET = "simulation-private-artifacts";

export function createDefaultSimulationPublicEmailHandlerDeps(): SimulationPublicEmailHandlerDeps {
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    environment: readSimulationEnvironment(process.env.NEXT_PUBLIC_APP_ENV),
  };
}

export function createDefaultSimulationStatusHandlerDeps(): SimulationPublicStatusHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    jobReader: createSupabaseSimulationJobReader(client),
    storageSigner: createSupabaseSimulationStorageSigner(client),
  };
}

export function createDefaultSimulationRealtimeTokenHandlerDeps(): SimulationPublicRealtimeTokenHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    progressAccessReader: createSupabaseSimulationProgressAccessReader(client),
    realtimeTokenIssuer: createSupabaseSimulationRealtimeTokenIssuer(),
  };
}

export function createDefaultSimulationDimensionsHandlerDeps(): SimulationPublicDimensionsHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    jobReader: createSupabaseSimulationJobReader(client),
    dimensionsStore: createSupabaseSimulationDimensionsStore(client),
  };
}

export function createDefaultSimulationRegenerationHandlerDeps(): SimulationPublicRegenerationHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    jobReader: createSupabaseSimulationJobReader(client),
    regenerationStore: createSupabaseSimulationRegenerationStore(client),
  };
}

export function createSupabaseSimulationDimensionsStore(
  client: SupabaseClient,
): SimulationDimensionsStore {
  return {
    async submit({ jobId, suppliedDimensions }) {
      const { data, error } = await client.rpc(
        "submit_in_home_simulation_dimensions_dispatch_outbox",
        {
          p_job_id: jobId,
          p_supplied_dimensions: suppliedDimensions,
        },
      );
      if (error) {
        throw error;
      }
      if (typeof data !== "string" || data.length === 0) {
        throw new Error(
          "submit_in_home_simulation_dimensions_dispatch_outbox returned no checkpoint id",
        );
      }
      return { checkpointId: data };
    },
  };
}

export function createSupabaseSimulationRegenerationStore(
  client: SupabaseClient,
): SimulationRegenerationStore {
  return {
    async request({ jobId }) {
      const { data, error } = await client.rpc(
        "request_in_home_simulation_regeneration_dispatch_outbox",
        {
          p_job_id: jobId,
          p_supplied_dimensions: null,
        },
      );
      if (error) {
        throw error;
      }
      if (typeof data !== "string" || data.length === 0) {
        throw new Error(
          "request_in_home_simulation_regeneration_dispatch_outbox returned no checkpoint id",
        );
      }
      return { checkpointId: data };
    },
  };
}

export function createSupabaseSimulationProgressAccessReader(
  client: SupabaseClient,
): SimulationProgressAccessReader {
  return {
    async findOwnedProgressAccess({ jobId, accessTokenHash }) {
      const { data, error } = await client.rpc(
        "get_in_home_simulation_progress_access_for_visitor",
        {
          p_job_id: jobId,
          p_access_token_hash: accessTokenHash,
        },
      );
      if (error) {
        throw error;
      }
      const rows = data as Array<{
        out_job_id: string;
        out_simulation_session_id: string;
        out_retention_deadline: string;
      }> | null;
      if (!rows || rows.length === 0) {
        return null;
      }
      const row = rows[0];
      return {
        jobId: row.out_job_id,
        simulationSessionId: row.out_simulation_session_id,
        retentionDeadline: new Date(row.out_retention_deadline),
      };
    },
  };
}

export function createDefaultSimulationCreateHandlerDeps(): SimulationPublicCreateHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    rateLimitSalt: requiredEnv("SIMULATION_RATE_LIMIT_SUBJECT_SALT"),
    rateLimitIpPerDay: readPositiveInt(
      "SIMULATION_RATE_LIMIT_IP_PER_DAY",
      DEFAULT_RATE_LIMIT_IP_PER_DAY,
    ),
    rateLimitEmailPerDay: readPositiveInt(
      "SIMULATION_RATE_LIMIT_EMAIL_PER_DAY",
      DEFAULT_RATE_LIMIT_EMAIL_PER_DAY,
    ),
    cornerTagSlug:
      process.env.SIMULATION_CORNER_TAG_SLUG ?? DEFAULT_CORNER_TAG_SLUG,
    retentionHours: readPositiveInt(
      "SIMULATION_RETENTION_HOURS",
      DEFAULT_RETENTION_HOURS,
    ),
    rateLimitStore: createSupabaseSimulationRateLimitStore(client),
    idempotencyStore: createSupabaseSimulationIdempotencyStore(client),
    catalogStore: createSupabaseSimulationCatalogStore(client),
    storageUploader: createSupabaseSimulationStorageUploader(client),
    createJobStore: createSupabaseSimulationCreateJobStore(client),
    jobReader: createSupabaseSimulationJobReader(client),
  };
}

export function createSupabaseSimulationCatalogStore(
  client: SupabaseClient,
): SimulationCatalogStore {
  return {
    async resolveRoomGeometryMode({ sofaSlug, cornerTagSlug }) {
      const { data, error } = await client.rpc(
        "resolve_simulation_room_geometry_mode",
        {
          p_sofa_slug: sofaSlug,
          p_corner_tag_slug: cornerTagSlug,
        },
      );
      if (error) {
        throw error;
      }
      if (data === null || data === undefined) {
        return null;
      }
      if (data === "back_wall" || data === "corner") {
        return data;
      }
      throw new Error(
        `resolve_simulation_room_geometry_mode returned unexpected value: ${String(data)}`,
      );
    },
  };
}

export function createSupabaseSimulationStorageUploader(
  client: SupabaseClient,
  bucket: string = "simulation-private-artifacts",
): SimulationStorageUploader {
  return {
    async uploadRoomPhoto({ storagePath, bytes, contentType }) {
      const { error } = await client.storage
        .from(bucket)
        .upload(storagePath, bytes, {
          contentType,
          upsert: false,
        });
      if (error) {
        throw error;
      }
    },
    async deleteUploadedRoomPhoto({ storagePath }) {
      const { error } = await client.storage.from(bucket).remove([storagePath]);
      if (error) {
        throw error;
      }
    },
  };
}

export function createSupabaseSimulationCreateJobStore(
  client: SupabaseClient,
): SimulationCreateJobStore {
  return {
    async create(input) {
      const { data, error } = await client.rpc(
        "create_in_home_simulation_job_for_visitor_dispatch_outbox",
        {
          p_verification_request_id: input.verificationRequestId,
          p_sofa_slug: input.sofaSlug,
          p_fabric_id: input.fabricId,
          p_visual_position_id: input.visualPositionId,
          p_customer_room_original_path: input.customerRoomOriginalPath,
          p_room_geometry_mode: input.roomGeometryMode,
          p_job_id_override: input.jobIdOverride,
          p_retention_hours: input.retentionHours,
        },
      );
      if (error) {
        throw error;
      }
      const rows = data as Array<{
        out_job_id: string;
        out_status: SimulationJobStatus;
        out_created_at: string;
        out_retention_deadline: string;
        out_room_geometry_mode: RoomGeometryMode;
        out_storage_prefix: string;
      }> | null;
      if (!rows || rows.length === 0) {
        return { ok: false, reason: "triple_not_publishable" };
      }
      const row = rows[0];
      return {
        ok: true,
        jobId: row.out_job_id,
        status: row.out_status,
        createdAt: new Date(row.out_created_at),
        retentionDeadline: new Date(row.out_retention_deadline),
        storagePrefix: row.out_storage_prefix,
      };
    },
  };
}

export function createSupabaseSimulationRealtimeTokenIssuer(
  input: {
    jwtSecret?: string;
    now?: () => Date;
    ttlSeconds?: number;
  } = {},
): SimulationRealtimeTokenIssuer {
  const jwtSecret = input.jwtSecret ?? requiredEnv("SUPABASE_JWT_SECRET");
  const now = input.now ?? (() => new Date());
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_REALTIME_TOKEN_TTL_SECONDS;

  return {
    async issueProgressToken({
      jobId,
      simulationSessionId,
      retentionDeadline,
    }) {
      const issuedAt = now();
      const maxExpiryMs = Math.min(
        issuedAt.getTime() + ttlSeconds * 1000,
        retentionDeadline.getTime(),
      );
      const expiresAt = new Date(maxExpiryMs);
      const payload = {
        aud: "authenticated",
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: Math.floor(issuedAt.getTime() / 1000),
        role: "authenticated",
        sub: `simulation-progress:${jobId}`,
        simulation_progress: {
          simulation_job_id: jobId,
          simulation_session_id: simulationSessionId,
        },
      };
      return {
        token: signHs256Jwt(payload, jwtSecret),
        expiresAt,
      };
    },
  };
}

function signHs256Jwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function createSupabaseSimulationJobReader(
  client: SupabaseClient,
): SimulationJobReader {
  return {
    async findOwnedJob({ jobId, accessTokenHash }) {
      const { data, error } = await client.rpc(
        "get_in_home_simulation_job_for_visitor",
        {
          p_job_id: jobId,
          p_access_token_hash: accessTokenHash,
        },
      );
      if (error) {
        throw error;
      }
      const rows = data as Array<{
        out_job_id: string;
        out_status: SimulationJobStatus;
        out_room_geometry_mode: RoomGeometryMode;
        out_created_at: string;
        out_retention_deadline: string;
        out_storage_prefix: string;
        out_dimension_guide_overlay_path: string | null;
        out_generated_output_count: number;
        out_latest_generated_output_index: number | null;
        out_last_error_message: string | null;
        out_last_regeneration_error_message: string | null;
      }> | null;
      if (!rows || rows.length === 0) {
        return null;
      }
      const row = rows[0];
      const view: SimulationJobView = {
        jobId: row.out_job_id,
        status: row.out_status,
        roomGeometryMode: row.out_room_geometry_mode,
        createdAt: new Date(row.out_created_at),
        retentionDeadline: new Date(row.out_retention_deadline),
        storagePrefix: row.out_storage_prefix,
        dimensionGuideOverlayPath: row.out_dimension_guide_overlay_path,
        generatedOutputCount: row.out_generated_output_count,
        latestGeneratedOutputIndex: row.out_latest_generated_output_index,
        lastErrorMessage: row.out_last_error_message,
        lastRegenerationErrorMessage: row.out_last_regeneration_error_message,
      };
      return view;
    },
  };
}

export function createSupabaseSimulationStorageSigner(
  client: SupabaseClient,
  bucket: string = SIMULATION_PRIVATE_BUCKET,
): SimulationStorageSigner {
  return {
    async signObjectUrl({ storagePath, ttlSeconds }) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(storagePath, ttlSeconds);
      if (error || !data?.signedUrl) {
        throw error ?? new Error("createSignedUrl returned no signedUrl");
      }
      return data.signedUrl;
    },
  };
}

export function readSimulationEnvironment(
  value: string | undefined,
): SimulationEnvironment {
  if (value === "dev" || value === "prod") {
    return value;
  }
  return "local";
}

function createServiceRoleClient(): SupabaseClient {
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

function requiredEnv(primaryName: string, fallbackName?: string): string {
  const value =
    process.env[primaryName] ??
    (fallbackName ? process.env[fallbackName] : undefined);
  if (!value || value.length === 0) {
    throw new Error(`${primaryName} is required.`);
  }
  return value;
}
