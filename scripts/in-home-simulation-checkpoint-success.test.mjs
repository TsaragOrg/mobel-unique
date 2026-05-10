import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260507000500_in_home_simulation_checkpoint_success.sql";

describe("PLAN-0068 in-home simulation checkpoint success migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates a service-role checkpoint success RPC", () => {
    expect(sql).toContain(
      "create or replace function public.complete_in_home_simulation_checkpoint_claim"
    );
    expect(sql).toContain("p_checkpoint_id uuid");
    expect(sql).toContain("p_worker_identifier text");
    expect(sql).toContain(
      "p_next_checkpoint_key public.simulation_checkpoint_key default null"
    );
    expect(sql).toContain("returns jsonb");
    expect(sql).toContain(
      "grant execute on function public.complete_in_home_simulation_checkpoint_claim"
    );
    expect(sql).toContain("to service_role");
  });

  it("only completes a checkpoint claimed by the same worker", () => {
    expect(sql).toContain("where id = p_checkpoint_id");
    expect(sql).toContain("and status = 'processing'");
    expect(sql).toContain("and claimed_by = p_worker_identifier");
    expect(sql).toContain("for update");
    expect(sql).toContain("is not processing or is claimed by another worker");
  });

  it("marks the current checkpoint succeeded and clears claim state", () => {
    expect(sql).toContain("status = 'succeeded'");
    expect(sql).toContain("claimed_by = null");
    expect(sql).toContain("claimed_at = null");
    expect(sql).toContain("claim_expires_at = null");
    expect(sql).toContain("completed_at = now()");
    expect(sql).toContain("current_checkpoint_status = 'succeeded'");
  });

  it("publishes safe progress and optionally enqueues the next checkpoint", () => {
    expect(sql).toContain("public.record_in_home_simulation_progress");
    expect(sql).toContain("if p_next_checkpoint_key is not null then");
    expect(sql).toContain("public.enqueue_in_home_simulation_checkpoint");
    expect(sql).toContain(
      "public.in_home_simulation_checkpoint_job_status(p_next_checkpoint_key)"
    );
    expect(sql).toContain("'next_checkpoint_id'");
  });

  it("validates the optional generation index", () => {
    expect(sql).toContain("p_next_generation_index not in (0, 1, 2)");
    expect(sql).toContain(
      "p_next_generation_index must be 0, 1, 2, or null"
    );
  });
});
