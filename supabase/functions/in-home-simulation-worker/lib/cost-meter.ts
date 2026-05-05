// SPEC-0015 PLAN-0039 worker-side cost-meter helper.
//
// After each successful paid provider call the worker invokes
// `chargeForRole(client, role, capCents)` to record the fixed
// cents estimate and let the database flip
// `simulation_cost_meter.worker_paused = true` when today's total
// crosses the cap. Failures here are swallowed because cost
// telemetry must never block the validated v003 pipeline.
//
// The actual claim short-circuit lives inside the SQL claim RPCs
// (see migration `20260502000500`); the worker only contributes
// the running total.

export type ProviderRole =
  | "validation"
  | "cleaning"
  | "corners"
  | "placement"
  | "placement_measurement";

export const PROVIDER_ROLE_CHARGE_CENTS: Readonly<
  Record<ProviderRole, number>
> = {
  validation: 1,
  cleaning: 4,
  corners: 4,
  placement: 4,
  placement_measurement: 1
};

export const DEFAULT_DAILY_COST_CAP_USD = 50;

export function parseDailyCapCents(
  envValue: string | undefined | null
): number {
  if (envValue === undefined || envValue === null || envValue === "") {
    return DEFAULT_DAILY_COST_CAP_USD * 100;
  }
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_DAILY_COST_CAP_USD * 100;
  }
  return Math.round(parsed * 100);
}

export type CostMeterRecordResult = {
  cost_date: string;
  usd_cost_estimate_cents: number;
  worker_paused: boolean;
};

export interface CostMeterClient {
  recordCharge(
    chargeCents: number,
    capCents: number
  ): Promise<CostMeterRecordResult>;
}

export async function chargeForRole(
  client: CostMeterClient,
  role: ProviderRole,
  capCents: number,
  log: (message: string) => void = () => {}
): Promise<CostMeterRecordResult | null> {
  const charge = PROVIDER_ROLE_CHARGE_CENTS[role];
  try {
    return await client.recordCharge(charge, capCents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`cost_meter_charge_failed role=${role} error=${message}`);
    return null;
  }
}

export function makeSupabaseCostMeterClient(deps: {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
}): CostMeterClient {
  const { supabaseUrl, serviceRoleKey } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  return {
    async recordCharge(chargeCents, capCents) {
      const response = await fetchImpl(
        `${supabaseUrl}/rest/v1/rpc/simulation_cost_meter_record_charge`,
        {
          method: "POST",
          body: JSON.stringify({
            charge_cents: chargeCents,
            cap_cents: capCents
          }),
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            apikey: serviceRoleKey
          }
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `simulation_cost_meter_record_charge rpc failed: HTTP ${response.status} ${text}`
        );
      }
      const rows = (await response.json()) as
        | CostMeterRecordResult[]
        | null;
      if (!rows || rows.length === 0) {
        throw new Error(
          "simulation_cost_meter_record_charge returned no rows"
        );
      }
      return rows[0];
    }
  };
}
