// SPEC-0015 PLAN-0040 default dependency factories for the public
// simulation route handlers.
//
// Route.ts files call these factories to get the launch-window stub
// configuration plus the Supabase-backed implementations of the
// `SimulationJobReader` and `SimulationStorageSigner` interfaces.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { SimulationEnvironment } from "./simulation-access-token";
import type {
  SimulationDimensionsStore,
  SimulationPublicDimensionsHandlerDeps,
  SimulationPublicEmailHandlerDeps,
  SimulationPublicRegenerationHandlerDeps,
  SimulationPublicStatusHandlerDeps,
  SimulationJobReader,
  SimulationJobView,
  SimulationRegenerationStore,
  SimulationStorageSigner
} from "./simulation-public-route-handlers";
import type {
  RoomGeometryMode,
  SimulationJobStatus
} from "./simulation-public-api";

const SIMULATION_PRIVATE_BUCKET = "simulation-private-artifacts";
const DEFAULT_SIMULATION_QUEUE_NAME = "local_in_home_simulation_jobs";

export function createDefaultSimulationPublicEmailHandlerDeps(): SimulationPublicEmailHandlerDeps {
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    environment: readSimulationEnvironment(process.env.NEXT_PUBLIC_APP_ENV)
  };
}

export function createDefaultSimulationStatusHandlerDeps(): SimulationPublicStatusHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    jobReader: createSupabaseSimulationJobReader(client),
    storageSigner: createSupabaseSimulationStorageSigner(client)
  };
}

export function createDefaultSimulationDimensionsHandlerDeps(): SimulationPublicDimensionsHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    jobReader: createSupabaseSimulationJobReader(client),
    dimensionsStore: createSupabaseSimulationDimensionsStore(client),
    queueName: readSimulationQueueName()
  };
}

export function createDefaultSimulationRegenerationHandlerDeps(): SimulationPublicRegenerationHandlerDeps {
  const client = createServiceRoleClient();
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    jobReader: createSupabaseSimulationJobReader(client),
    regenerationStore: createSupabaseSimulationRegenerationStore(client),
    queueName: readSimulationQueueName()
  };
}

export function createSupabaseSimulationDimensionsStore(
  client: SupabaseClient
): SimulationDimensionsStore {
  return {
    async submit({ jobId, suppliedDimensions, queueName }) {
      const { data, error } = await client.rpc(
        "submit_in_home_simulation_dimensions",
        {
          job_id: jobId,
          supplied_dimensions: suppliedDimensions,
          queue_name: queueName
        }
      );
      if (error) {
        throw error;
      }
      const msgId = typeof data === "number" ? data : Number(data);
      if (!Number.isFinite(msgId)) {
        throw new Error(
          "submit_in_home_simulation_dimensions returned a non-numeric msg_id"
        );
      }
      return { msgId };
    }
  };
}

export function createSupabaseSimulationRegenerationStore(
  client: SupabaseClient
): SimulationRegenerationStore {
  return {
    async request({ jobId, queueName }) {
      const { data, error } = await client.rpc(
        "request_in_home_simulation_regeneration",
        {
          job_id: jobId,
          supplied_dimensions: null,
          queue_name: queueName
        }
      );
      if (error) {
        throw error;
      }
      const msgId = typeof data === "number" ? data : Number(data);
      if (!Number.isFinite(msgId)) {
        throw new Error(
          "request_in_home_simulation_regeneration returned a non-numeric msg_id"
        );
      }
      return { msgId };
    }
  };
}

function readSimulationQueueName(): string {
  return (
    process.env.SIMULATION_QUEUE_NAME ??
    process.env.IN_HOME_SIMULATION_QUEUE_NAME ??
    DEFAULT_SIMULATION_QUEUE_NAME
  );
}

export function createSupabaseSimulationJobReader(
  client: SupabaseClient
): SimulationJobReader {
  return {
    async findOwnedJob({ jobId, accessTokenHash }) {
      const { data, error } = await client.rpc(
        "get_in_home_simulation_job_for_visitor",
        {
          p_job_id: jobId,
          p_access_token_hash: accessTokenHash
        }
      );
      if (error) {
        throw error;
      }
      const rows = data as
        | Array<{
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
          }>
        | null;
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
        lastRegenerationErrorMessage: row.out_last_regeneration_error_message
      };
      return view;
    }
  };
}

export function createSupabaseSimulationStorageSigner(
  client: SupabaseClient,
  bucket: string = SIMULATION_PRIVATE_BUCKET
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
    }
  };
}

export function readSimulationEnvironment(
  value: string | undefined
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
        persistSession: false
      }
    }
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
