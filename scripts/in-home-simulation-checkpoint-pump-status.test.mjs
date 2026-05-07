import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260507000400_in_home_simulation_checkpoint_pump_status.sql";

describe("PLAN-0068 in-home simulation checkpoint pump status migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates a service-role pump status helper", () => {
    expect(sql).toContain(
      "create or replace function public.in_home_simulation_checkpoint_pump_status"
    );
    expect(sql).toContain("p_max_active_checkpoints integer default 1");
    expect(sql).toContain("returns jsonb");
    expect(sql).toContain(
      "grant execute on function public.in_home_simulation_checkpoint_pump_status"
    );
    expect(sql).toContain("to service_role");
  });

  it("reports active capacity and cost-meter pause state", () => {
    expect(sql).toContain("public.simulation_cost_meter_paused()");
    expect(sql).toContain("active_checkpoint_count");
    expect(sql).toContain("claimable_checkpoint_count");
    expect(sql).toContain("'active_processing'");
    expect(sql).toContain("'available_slots'");
    expect(sql).toContain("'max_active_checkpoints'");
    expect(sql).toContain("'worker_paused'");
  });

  it("counts durable claimable checkpoints without relying on queue messages", () => {
    expect(sql).toContain("from public.in_home_simulation_checkpoints as c");
    expect(sql).toContain("join public.in_home_simulation_jobs as j");
    expect(sql).toContain("c.status in ('queued', 'retrying')");
    expect(sql).toContain("j.retention_deadline > now()");
    expect(sql).toContain("not exists");
    expect(sql).toContain("active.status = 'processing'");
    expect(sql).toContain("j.status in ('queued', 'room_prep_processing')");
    expect(sql).toContain(
      "j.status in ('placement_queued', 'placement_processing')"
    );
  });

  it("fails fast on invalid capacity configuration", () => {
    expect(sql).toContain("p_max_active_checkpoints is null");
    expect(sql).toContain("p_max_active_checkpoints <= 0");
    expect(sql).toContain("p_max_active_checkpoints must be positive");
  });
});
