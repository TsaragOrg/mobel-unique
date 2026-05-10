// SPEC-0015 PLAN-0040 default dependency factories for the public
// simulation route handlers.
//
// Route.ts files call these factories to get the Supabase-backed
// implementations of the public simulation interfaces.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { SimulationEnvironment } from "./simulation-access-token";
import type {
  SimulationCatalogStore,
  SimulationCreateJobStore,
  SimulationDimensionsStore,
  SimulationDispatchTrigger,
  SimulationEmailOtpProvider,
  SimulationEmailVerificationStore,
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
  SimulationSessionAccessReader,
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
const DEFAULT_DISPATCH_TRIGGER_TIMEOUT_MS = 5_000;
const DEFAULT_REALTIME_TOKEN_TTL_SECONDS = 5 * 60;
const EMAIL_ENCRYPTION_PREFIX = "v1";
const REQUIRED_EMAIL_CONSENT_WORDING_VERSION = "email-verification-v1";
const OPTIONAL_MARKETING_CONSENT_WORDING_VERSION = "commercial-contact-v1";
const PUBLIC_SIMULATION_AUTH_USER_METADATA = {
  public_simulation_transient: true,
  public_simulation_purpose: "in_home_simulation_email_otp",
};
const CONSENT_LOCALE = "fr-FR";

const SIMULATION_PRIVATE_BUCKET = "simulation-private-artifacts";

export function createDefaultSimulationPublicEmailHandlerDeps(): SimulationPublicEmailHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    environment: readSimulationEnvironment(process.env.NEXT_PUBLIC_APP_ENV),
    emailVerificationStore: createSupabaseSimulationEmailVerificationStore(
      client,
      {
        emailEncryptionSecret: requiredEnv(
          "SIMULATION_EMAIL_ENCRYPTION_SECRET",
        ),
        emailHashSecret: requiredEnv("SIMULATION_EMAIL_HASH_SECRET"),
      },
    ),
    otpProvider: createSupabaseSimulationEmailOtpProvider(client),
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
    dispatchTrigger: createSupabaseSimulationDispatchTrigger(),
    jobReader: createSupabaseSimulationJobReader(client),
    dimensionsStore: createSupabaseSimulationDimensionsStore(client),
  };
}

export function createDefaultSimulationRegenerationHandlerDeps(): SimulationPublicRegenerationHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    dispatchTrigger: createSupabaseSimulationDispatchTrigger(),
    jobReader: createSupabaseSimulationJobReader(client),
    regenerationStore: createSupabaseSimulationRegenerationStore(client),
  };
}

export function createSupabaseSimulationDispatchTrigger(
  input: {
    functionUrl?: string;
    invokeSecret?: string;
    timeoutMs?: number;
  } = {},
): SimulationDispatchTrigger {
  const functionUrl =
    input.functionUrl ?? requiredEnv("IN_HOME_SIMULATION_WORKER_FUNCTION_URL");
  const invokeSecret =
    input.invokeSecret ??
    requiredEnv("IN_HOME_SIMULATION_WORKER_INVOKE_SECRET");
  const timeoutMs =
    input.timeoutMs ??
    readPositiveInt(
      "IN_HOME_SIMULATION_DISPATCH_TRIGGER_TIMEOUT_MS",
      DEFAULT_DISPATCH_TRIGGER_TIMEOUT_MS,
    );

  return {
    async trigger({ checkpointId, jobId, reason }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response | null = null;
      let responseText = "";
      try {
        response = await fetch(functionUrl, {
          body: JSON.stringify({
            checkpoint_id: checkpointId,
            job_id: jobId,
            mode: "dispatch",
            reason,
            source: "public-api",
          }),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-in-home-simulation-worker-secret": invokeSecret,
          },
          method: "POST",
          signal: controller.signal,
        });
        responseText = await response.text();
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(
            `in-home simulation dispatch trigger timed out after ${timeoutMs}ms`,
          );
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response?.ok) {
        throw new Error(
          `in-home simulation dispatch trigger returned HTTP ${response?.status ?? "unknown"}: ${responseText}`,
        );
      }
    },
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
    dispatchTrigger: createSupabaseSimulationDispatchTrigger(),
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
    sessionAccessReader: createSupabaseSimulationSessionAccessReader(client),
  };
}

export function createSupabaseSimulationEmailOtpProvider(
  client: SupabaseClient,
): SimulationEmailOtpProvider {
  return {
    async sendOtp({ email }) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: PUBLIC_SIMULATION_AUTH_USER_METADATA,
        },
      });
      if (error) {
        return { ok: false };
      }
      return { ok: true };
    },
    async verifyOtp({ email, code }) {
      const { data, error } = await client.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) {
        return {
          ok: false,
          reason: classifyOtpProviderError(error),
        };
      }
      const authUserId = data.user?.id;
      if (!authUserId) {
        return { ok: false, reason: "provider_error" };
      }
      return { ok: true, authUserId };
    },
  };
}

export function createSupabaseSimulationEmailVerificationStore(
  client: SupabaseClient,
  config: {
    emailEncryptionSecret: string;
    emailHashSecret: string;
  },
): SimulationEmailVerificationStore {
  return {
    async createRequest({ email, consentMarketing, expiresAt }) {
      const normalizedEmail = normalizeEmailAddress(email);
      const { data, error } = await client.rpc(
        "create_public_simulation_email_verification_request",
        {
          p_email_address_encrypted: encryptEmailAddress(
            normalizedEmail,
            config.emailEncryptionSecret,
          ),
          p_email_normalized_hash: hashEmailAddress(
            normalizedEmail,
            config.emailHashSecret,
          ),
          p_required_wording_version: REQUIRED_EMAIL_CONSENT_WORDING_VERSION,
          p_required_locale: CONSENT_LOCALE,
          p_optional_commercial_decision: consentMarketing
            ? "granted"
            : "rejected",
          p_optional_wording_version:
            OPTIONAL_MARKETING_CONSENT_WORDING_VERSION,
          p_optional_locale: CONSENT_LOCALE,
          p_expires_at: expiresAt.toISOString(),
        },
      );
      if (error) {
        throw error;
      }
      const rows = data as Array<{
        out_verification_request_id: string;
        out_expires_at: string;
      }> | null;
      if (!rows || rows.length === 0) {
        throw new Error(
          "create_public_simulation_email_verification_request returned no rows",
        );
      }
      return {
        verificationRequestId: rows[0].out_verification_request_id,
        expiresAt: new Date(rows[0].out_expires_at),
      };
    },
    async findRequestForVerification({ verificationRequestId }) {
      const { data, error } = await client
        .from("email_verification_requests")
        .select(
          "id,email_address_encrypted,email_normalized_hash,expires_at,status",
        )
        .eq("id", verificationRequestId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      const row = data as {
        id: string;
        email_address_encrypted: string | null;
        email_normalized_hash: string;
        expires_at: string;
        status: string;
      } | null;
      if (!row || !row.email_address_encrypted) {
        return null;
      }
      if (row.status !== "code_sent" && row.status !== "verified") {
        return null;
      }
      return {
        verificationRequestId: row.id,
        email: decryptEmailAddress(
          row.email_address_encrypted,
          config.emailEncryptionSecret,
        ),
        emailNormalizedHash: row.email_normalized_hash,
        expiresAt: new Date(row.expires_at),
      };
    },
    async markSendFailed({ verificationRequestId }) {
      const { error } = await client
        .from("email_verification_requests")
        .update({ status: "send_failed" })
        .eq("id", verificationRequestId);
      if (error) {
        throw error;
      }
    },
    async markVerifiedAndCreateSession(input) {
      const { data, error } = await client.rpc(
        "verify_public_simulation_auth_otp_session",
        {
          p_verification_request_id: input.verificationRequestId,
          p_auth_user_id: input.authUserId,
          p_access_token_hash: input.accessTokenHash,
          p_session_expires_at: input.expiresAt.toISOString(),
        },
      );
      if (error) {
        throw error;
      }
      const rows = data as Array<{ out_simulation_session_id: string }> | null;
      if (!rows || rows.length === 0) {
        throw new Error(
          "verify_public_simulation_auth_otp_session returned no rows",
        );
      }
      return { simulationSessionId: rows[0].out_simulation_session_id };
    },
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

export function createSupabaseSimulationSessionAccessReader(
  client: SupabaseClient,
): SimulationSessionAccessReader {
  return {
    async findVerifiedSession({ accessTokenHash }) {
      const { data, error } = await client
        .from("simulation_sessions")
        .select("email_normalized_hash,status,expires_at")
        .eq("access_token_hash", accessTokenHash)
        .maybeSingle();
      if (error) {
        throw error;
      }
      const row = data as {
        email_normalized_hash: string;
        status: string;
        expires_at: string;
      } | null;
      if (!row || row.status !== "active") {
        return null;
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        return null;
      }
      return { emailNormalizedHash: row.email_normalized_hash };
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

function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

function hashEmailAddress(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email).digest("hex");
}

function encryptEmailAddress(email: string, secret: string): string {
  const key = deriveEncryptionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(email, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    EMAIL_ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptEmailAddress(encrypted: string, secret: string): string {
  const [version, ivRaw, tagRaw, ciphertextRaw] = encrypted.split(".");
  if (
    version !== EMAIL_ENCRYPTION_PREFIX ||
    !ivRaw ||
    !tagRaw ||
    !ciphertextRaw
  ) {
    throw new Error("Unsupported encrypted email payload");
  }
  const key = deriveEncryptionKey(secret);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function deriveEncryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function classifyOtpProviderError(
  error: unknown,
): "invalid" | "expired" | "rate_limited" | "provider_error" {
  const status =
    typeof error === "object" && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 429) {
    return "rate_limited";
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("expired")) {
    return "expired";
  }
  if (message.includes("invalid") || message.includes("token")) {
    return "invalid";
  }
  return "provider_error";
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
