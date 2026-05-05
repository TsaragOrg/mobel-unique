// SPEC-0015 PLAN-0040 simulation idempotency helper.
//
// The public upload route handler must turn a duplicate
// `Idempotency-Key` header into the original simulation job id
// without creating a second job or a second storage object. The
// acquire/finalize split keeps the duplicate-detection path
// constant-time and races safely against a concurrent retry.

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SimulationIdempotencyAcquireResult {
  acquired: boolean;
  simulationJobId: string | null;
}

export interface SimulationIdempotencyStore {
  acquire(keyHash: string): Promise<SimulationIdempotencyAcquireResult>;
  finalize(keyHash: string, simulationJobId: string): Promise<void>;
}

export function hashSimulationIdempotencyKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function createSupabaseSimulationIdempotencyStore(
  client: SupabaseClient
): SimulationIdempotencyStore {
  return {
    async acquire(keyHash) {
      const { data, error } = await client.rpc(
        "acquire_simulation_idempotency_key",
        { p_key_hash: keyHash }
      );
      if (error) {
        throw error;
      }
      const rows = data as Array<{
        acquired: boolean;
        simulation_job_id: string | null;
      }> | null;
      if (!rows || rows.length === 0) {
        throw new Error(
          "acquire_simulation_idempotency_key returned no rows"
        );
      }
      return {
        acquired: rows[0].acquired,
        simulationJobId: rows[0].simulation_job_id
      };
    },
    async finalize(keyHash, simulationJobId) {
      const { error } = await client.rpc(
        "finalize_simulation_idempotency_key",
        {
          p_key_hash: keyHash,
          p_simulation_job_id: simulationJobId
        }
      );
      if (error) {
        throw error;
      }
    }
  };
}
