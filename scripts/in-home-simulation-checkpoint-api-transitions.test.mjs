import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260507000600_in_home_simulation_checkpoint_api_transitions.sql";

describe("PLAN-0068 in-home simulation checkpoint API transitions", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("adds a create-job RPC wrapper that enqueues the initial durable checkpoint in the same transaction", () => {
    expect(sql).toContain(
      "create or replace function public.create_in_home_simulation_job_for_visitor_checkpoint_pump"
    );
    expect(sql).toContain("public.create_in_home_simulation_job_for_visitor(");
    expect(sql).toContain("public.enqueue_in_home_simulation_checkpoint(");
    expect(sql).toContain("'room_validation'");
    expect(sql).toContain("'room_validation'");
    expect(sql).toContain("1,");
    expect(sql).toContain("4");
  });

  it("adds a dimensions transition RPC that queues placement_generation without pgmq", () => {
    expect(sql).toContain(
      "create or replace function public.submit_in_home_simulation_dimensions_checkpoint_pump"
    );
    expect(sql).toContain("returns uuid");
    expect(sql).toContain("status = 'placement_queued'");
    expect(sql).toContain("'placement_generation'");
    expect(sql).not.toContain("pgmq.send");
  });

  it("adds a regeneration transition RPC that reserves the next output and queues placement_generation", () => {
    expect(sql).toContain(
      "create or replace function public.request_in_home_simulation_regeneration_checkpoint_pump"
    );
    expect(sql).toContain("next_index := job_record.generated_output_count");
    expect(sql).toContain("reserved_generation_index = next_index");
    expect(sql).toContain("p_generation_index => next_index");
  });

  it("grants the checkpoint-pump API RPCs to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.create_in_home_simulation_job_for_visitor_checkpoint_pump"
    );
    expect(sql).toContain(
      "grant execute on function public.submit_in_home_simulation_dimensions_checkpoint_pump"
    );
    expect(sql).toContain(
      "grant execute on function public.request_in_home_simulation_regeneration_checkpoint_pump"
    );
  });
});
