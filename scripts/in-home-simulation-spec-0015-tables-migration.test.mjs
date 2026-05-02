import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const IDEMPOTENCY_KEYS_PATH =
  "supabase/migrations/20260502000200_simulation_idempotency_keys.sql";
const RATE_LIMITS_PATH =
  "supabase/migrations/20260502000300_simulation_rate_limits.sql";
const COST_METER_PATH =
  "supabase/migrations/20260502000400_simulation_cost_meter.sql";

describe("SPEC-0015 simulation_idempotency_keys migration", () => {
  const sql = readFileSync(IDEMPOTENCY_KEYS_PATH, "utf8");

  it("creates the table with the expected primary key and timestamps", () => {
    expect(sql).toContain(
      "create table if not exists public.simulation_idempotency_keys"
    );
    expect(sql).toContain("key_hash text primary key");
    expect(sql).toContain(
      "simulation_job_id uuid references public.in_home_simulation_jobs"
    );
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain(
      "expires_at timestamptz not null default now() + interval '24 hours'"
    );
  });

  it("creates an index on expires_at for the purge sweep", () => {
    expect(sql).toContain(
      "simulation_idempotency_keys_expires_at_idx"
    );
  });

  it("enables RLS, denies anon/authenticated, allows service_role only", () => {
    expect(sql).toContain(
      "alter table public.simulation_idempotency_keys"
    );
    expect(sql).toContain("enable row level security");
    expect(sql).toContain(
      "revoke all on table public.simulation_idempotency_keys"
    );
    expect(sql).toContain(
      "grant all on table public.simulation_idempotency_keys"
    );
    expect(sql).toContain(
      "spec_0015_service_role_all_simulation_idempotency_keys"
    );
  });
});

describe("SPEC-0015 simulation_rate_limits migration", () => {
  const sql = readFileSync(RATE_LIMITS_PATH, "utf8");

  it("creates the table with a composite primary key", () => {
    expect(sql).toContain(
      "create table if not exists public.simulation_rate_limits"
    );
    expect(sql).toContain(
      "primary key (subject_kind, subject_value_hash, window_start)"
    );
  });

  it("constrains subject_kind to ip / email", () => {
    expect(sql).toContain(
      "check (subject_kind in ('ip', 'email'))"
    );
  });

  it("forbids negative counts", () => {
    expect(sql).toContain("check (count >= 0)");
  });

  it("creates an index on window_start for the cleanup sweep", () => {
    expect(sql).toContain("simulation_rate_limits_window_start_idx");
  });

  it("enables RLS for service_role only", () => {
    expect(sql).toContain(
      "spec_0015_service_role_all_simulation_rate_limits"
    );
  });
});

describe("SPEC-0015 simulation_cost_meter migration", () => {
  const sql = readFileSync(COST_METER_PATH, "utf8");

  it("creates a one-row-per-date table with paused flag and cents counter", () => {
    expect(sql).toContain(
      "create table if not exists public.simulation_cost_meter"
    );
    expect(sql).toContain("cost_date date primary key");
    expect(sql).toContain(
      "usd_cost_estimate_cents integer not null default 0"
    );
    expect(sql).toContain(
      "worker_paused boolean not null default false"
    );
  });

  it("forbids negative cents totals", () => {
    expect(sql).toContain(
      "check (usd_cost_estimate_cents >= 0)"
    );
  });

  it("enables RLS for service_role only", () => {
    expect(sql).toContain(
      "spec_0015_service_role_all_simulation_cost_meter"
    );
  });
});
