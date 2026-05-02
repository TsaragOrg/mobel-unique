import { describe, expect, it } from "vitest";

import {
  DEFAULT_DAILY_COST_CAP_USD,
  PROVIDER_ROLE_CHARGE_CENTS,
  chargeForRole,
  makeSupabaseCostMeterClient,
  parseDailyCapCents
} from "../supabase/functions/in-home-simulation-worker/lib/cost-meter.ts";

describe("PROVIDER_ROLE_CHARGE_CENTS", () => {
  it("covers every paid provider role with a non-negative integer", () => {
    const roles = ["validation", "cleaning", "corners", "placement", "placement_measurement"];
    for (const role of roles) {
      expect(role in PROVIDER_ROLE_CHARGE_CENTS).toBe(true);
      const cents = PROVIDER_ROLE_CHARGE_CENTS[role];
      expect(Number.isInteger(cents)).toBe(true);
      expect(cents).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("parseDailyCapCents", () => {
  it("returns the 50 USD default when the env value is empty/null/undefined", () => {
    expect(parseDailyCapCents(undefined)).toBe(DEFAULT_DAILY_COST_CAP_USD * 100);
    expect(parseDailyCapCents(null)).toBe(DEFAULT_DAILY_COST_CAP_USD * 100);
    expect(parseDailyCapCents("")).toBe(DEFAULT_DAILY_COST_CAP_USD * 100);
  });

  it("parses a numeric USD value into rounded cents", () => {
    expect(parseDailyCapCents("75")).toBe(7500);
    expect(parseDailyCapCents("0.5")).toBe(50);
    expect(parseDailyCapCents("100")).toBe(10000);
  });

  it("falls back to the default when the value is non-numeric or negative", () => {
    expect(parseDailyCapCents("abc")).toBe(DEFAULT_DAILY_COST_CAP_USD * 100);
    expect(parseDailyCapCents("-5")).toBe(DEFAULT_DAILY_COST_CAP_USD * 100);
  });
});

describe("chargeForRole", () => {
  it("charges the role-specific cents and returns the meter row", async () => {
    const calls = [];
    const client = {
      async recordCharge(chargeCents, capCents) {
        calls.push({ chargeCents, capCents });
        return {
          cost_date: "2026-05-02",
          usd_cost_estimate_cents: 4,
          worker_paused: false
        };
      }
    };
    const result = await chargeForRole(client, "cleaning", 5000);
    expect(calls).toEqual([{ chargeCents: 4, capCents: 5000 }]);
    expect(result?.worker_paused).toBe(false);
  });

  it("returns null and logs when the client throws", async () => {
    const logs = [];
    const client = {
      async recordCharge() {
        throw new Error("boom");
      }
    };
    const result = await chargeForRole(client, "placement", 5000, (message) =>
      logs.push(message)
    );
    expect(result).toBeNull();
    expect(logs[0]).toContain("cost_meter_charge_failed");
    expect(logs[0]).toContain("role=placement");
    expect(logs[0]).toContain("error=boom");
  });
});

describe("makeSupabaseCostMeterClient", () => {
  it("posts to the simulation_cost_meter_record_charge RPC with body and auth headers", async () => {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url, init };
      return new Response(
        JSON.stringify([
          {
            cost_date: "2026-05-02",
            usd_cost_estimate_cents: 8,
            worker_paused: false
          }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };
    const client = makeSupabaseCostMeterClient({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "sr-test",
      fetchImpl
    });
    const row = await client.recordCharge(4, 5000);
    expect(captured.url).toBe(
      "https://example.supabase.co/rest/v1/rpc/simulation_cost_meter_record_charge"
    );
    expect(captured.init.method).toBe("POST");
    expect(captured.init.headers.Authorization).toBe("Bearer sr-test");
    expect(captured.init.headers.apikey).toBe("sr-test");
    expect(JSON.parse(captured.init.body)).toEqual({
      charge_cents: 4,
      cap_cents: 5000
    });
    expect(row.usd_cost_estimate_cents).toBe(8);
  });

  it("throws when the RPC responds non-2xx", async () => {
    const fetchImpl = async () =>
      new Response("oops", { status: 500 });
    const client = makeSupabaseCostMeterClient({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "sr-test",
      fetchImpl
    });
    await expect(client.recordCharge(4, 5000)).rejects.toThrow(
      /simulation_cost_meter_record_charge rpc failed: HTTP 500/
    );
  });

  it("throws when the RPC returns no rows", async () => {
    const fetchImpl = async () =>
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    const client = makeSupabaseCostMeterClient({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "sr-test",
      fetchImpl
    });
    await expect(client.recordCharge(4, 5000)).rejects.toThrow(
      /returned no rows/
    );
  });
});
