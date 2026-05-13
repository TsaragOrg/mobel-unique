// SPEC-0015 PLAN-0040 simulation rate-limit helper.
//
// The public upload route handler enforces two daily caps before
// creating a job: 3 simulations per IP and 2 simulations per
// verified email subject. Counters live in `simulation_rate_limits`
// keyed by (subject_kind, subject_value_hash, window_start). The
// atomic increment lives in the SQL RPC
// `increment_simulation_rate_limit` so the SELECT-then-UPDATE race
// at the window boundary is closed.

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitSubjectKind = "ip" | "verification_subject";

export interface SimulationRateLimitStore {
  increment(input: {
    subjectKind: RateLimitSubjectKind;
    subjectValueHash: string;
    windowStart: Date;
    cap: number;
  }): Promise<{ count: number; allowed: boolean }>;
}

export interface CheckSimulationRateLimitsInput {
  ip: string;
  verificationSubject: string;
  ipCap: number;
  emailCap: number;
  salt: string;
  store: SimulationRateLimitStore;
  now?: () => Date;
}

export type SimulationRateLimitDecision =
  | { allowed: true }
  | { allowed: false; tripped: RateLimitSubjectKind; count: number };

export function hashSimulationRateLimitSubject(
  value: string,
  salt: string
): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

export function currentSimulationRateLimitWindowStart(now: Date): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

export async function checkSimulationRateLimits(
  input: CheckSimulationRateLimitsInput
): Promise<SimulationRateLimitDecision> {
  const now = (input.now ?? defaultNow)();
  const windowStart = currentSimulationRateLimitWindowStart(now);

  const ipResult = await input.store.increment({
    subjectKind: "ip",
    subjectValueHash: hashSimulationRateLimitSubject(input.ip, input.salt),
    windowStart,
    cap: input.ipCap
  });
  if (!ipResult.allowed) {
    return { allowed: false, tripped: "ip", count: ipResult.count };
  }

  const emailResult = await input.store.increment({
    subjectKind: "verification_subject",
    subjectValueHash: hashSimulationRateLimitSubject(
      input.verificationSubject,
      input.salt
    ),
    windowStart,
    cap: input.emailCap
  });
  if (!emailResult.allowed) {
    return {
      allowed: false,
      tripped: "verification_subject",
      count: emailResult.count
    };
  }

  return { allowed: true };
}

export function createSupabaseSimulationRateLimitStore(
  client: SupabaseClient
): SimulationRateLimitStore {
  return {
    async increment(input) {
      const { data, error } = await client.rpc(
        "increment_simulation_rate_limit",
        {
          p_subject_kind: input.subjectKind,
          p_subject_value_hash: input.subjectValueHash,
          p_window_start: input.windowStart.toISOString(),
          p_cap: input.cap
        }
      );
      if (error) {
        throw error;
      }
      const rows = data as Array<{ count: number; allowed: boolean }> | null;
      if (!rows || rows.length === 0) {
        throw new Error(
          "increment_simulation_rate_limit returned no rows"
        );
      }
      return { count: rows[0].count, allowed: rows[0].allowed };
    }
  };
}

function defaultNow(): Date {
  return new Date();
}
