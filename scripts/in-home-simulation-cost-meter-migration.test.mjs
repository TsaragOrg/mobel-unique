import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAUSE_PATH =
  "supabase/migrations/20260502000500_in_home_simulation_claim_pauses_on_cost_meter.sql";
const PURGE_PATH =
  "supabase/migrations/20260502000600_in_home_simulation_purge_extension.sql";
const RECORD_CHARGE_FIX_PATH =
  "supabase/migrations/20260508000100_fix_simulation_cost_meter_record_charge_ambiguity.sql";

describe("SPEC-0015 claim RPCs short-circuit on cost-meter pause", () => {
  const sql = readFileSync(PAUSE_PATH, "utf8");

  it("creates the simulation_cost_meter_paused() helper", () => {
    expect(sql).toContain(
      "create or replace function public.simulation_cost_meter_paused()",
    );
    expect(sql).toContain("returns boolean");
    expect(sql).toContain("worker_paused = true");
    expect(sql).toContain("(now() at time zone 'utc')::date");
  });

  it("grants execute on the helper to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.simulation_cost_meter_paused() to service_role",
    );
  });

  it("calls the helper from claim_in_home_simulation_room_prep_job", () => {
    const fn = sql.slice(
      sql.indexOf(
        "create or replace function public.claim_in_home_simulation_room_prep_job",
      ),
      sql.indexOf(
        "create or replace function public.claim_specific_in_home_simulation_room_prep_job",
      ),
    );
    expect(fn).toContain("if public.simulation_cost_meter_paused() then");
    expect(fn).toContain("return;");
  });

  it("calls the helper from claim_specific_in_home_simulation_room_prep_job", () => {
    const fn = sql.slice(
      sql.indexOf(
        "create or replace function public.claim_specific_in_home_simulation_room_prep_job",
      ),
      sql.indexOf(
        "create or replace function public.claim_specific_in_home_simulation_placement_job",
      ),
    );
    expect(fn).toContain("if public.simulation_cost_meter_paused() then");
    expect(fn).toContain("return;");
  });

  it("calls the helper from claim_specific_in_home_simulation_placement_job", () => {
    const fn = sql.slice(
      sql.indexOf(
        "create or replace function public.claim_specific_in_home_simulation_placement_job",
      ),
    );
    expect(fn).toContain("if public.simulation_cost_meter_paused() then");
    expect(fn).toContain("return;");
  });

  it("preserves room_geometry_mode coalesce in both Stage 1 functions", () => {
    const occurrences = sql.match(
      /coalesce\(j\.room_geometry_mode, 'back_wall'::public\.room_geometry_mode\)/g,
    );
    expect(occurrences?.length ?? 0).toBe(2);
  });
});

describe("SPEC-0015 purge extension", () => {
  const sql = readFileSync(PURGE_PATH, "utf8");

  it("deletes simulation_idempotency_keys for the purged job", () => {
    expect(sql).toContain(
      "create or replace function public.mark_in_home_simulation_job_purged",
    );
    expect(sql).toContain("delete from public.simulation_idempotency_keys");
    expect(sql).toContain(
      "where simulation_job_id = mark_in_home_simulation_job_purged.job_id",
    );
  });

  it("preserves the existing artifact-clearing update on in_home_simulation_jobs", () => {
    expect(sql).toContain("status = 'expired'");
    expect(sql).toContain("customer_room_original_path = null");
    expect(sql).toContain("room_cleaned_path = null");
    expect(sql).toContain("dimension_guide_overlay_path = null");
  });

  it("ships the cleanup_simulation_rate_limit_windows helper with a 48h default", () => {
    expect(sql).toContain(
      "create or replace function public.cleanup_simulation_rate_limit_windows",
    );
    expect(sql).toContain("older_than_hours integer default 48");
    expect(sql).toContain("delete from public.simulation_rate_limits");
    expect(sql).toContain("where window_start < cutoff");
  });

  it("ships the cleanup_simulation_idempotency_keys helper", () => {
    expect(sql).toContain(
      "create or replace function public.cleanup_simulation_idempotency_keys()",
    );
    expect(sql).toContain("delete from public.simulation_idempotency_keys");
    expect(sql).toContain("where expires_at < now()");
  });

  it("grants execute on both cleanup helpers to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.cleanup_simulation_rate_limit_windows(integer)",
    );
    expect(sql).toContain(
      "grant execute on function public.cleanup_simulation_idempotency_keys()",
    );
  });
});

describe("SPEC-0015 cost-meter record-charge ambiguity fix", () => {
  const sql = readFileSync(RECORD_CHARGE_FIX_PATH, "utf8");
  const executableSql = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("replaces the record-charge RPC with a conflict target that cannot collide with the output column", () => {
    expect(sql).toContain(
      "create or replace function public.simulation_cost_meter_record_charge",
    );
    expect(sql).toContain(
      "on conflict on constraint simulation_cost_meter_pkey do update",
    );
    expect(executableSql).not.toContain("on conflict (cost_date)");
  });

  it("keeps returned cost_date separate from the output variable until assignment", () => {
    expect(sql).toContain("charged_cost_date date;");
    expect(sql).toContain("charged_cost_date,");
    expect(sql).toContain("cost_date := charged_cost_date;");
  });
});
