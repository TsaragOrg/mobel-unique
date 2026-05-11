import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260507000300_in_home_simulation_checkpoint_claims.sql";

describe("PLAN-0068 in-home simulation checkpoint claim RPC migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates a helper to make one checkpoint claimable", () => {
    expect(sql).toContain("create or replace function public.enqueue_in_home_simulation_checkpoint");
    expect(sql).toContain("p_simulation_job_id uuid");
    expect(sql).toContain("p_checkpoint_key public.simulation_checkpoint_key");
    expect(sql).toContain("p_generation_index integer default null");
    expect(sql).toContain("insert into public.in_home_simulation_checkpoints");
    expect(sql).toContain("on conflict");
    expect(sql).toContain("public.record_in_home_simulation_progress");
  });

  it("creates a global checkpoint claim RPC with capacity protection", () => {
    expect(sql).toContain("create or replace function public.claim_in_home_simulation_checkpoint");
    expect(sql).toContain("p_worker_identifier text");
    expect(sql).toContain("p_claim_ttl_seconds integer default 180");
    expect(sql).toContain("p_max_active_checkpoints integer default 1");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("hashtextextended('in_home_simulation_checkpoint_capacity'");
    expect(sql).toContain("public.simulation_cost_meter_paused()");
    expect(sql).toContain("active_checkpoint_count");
    expect(sql).toContain("public.in_home_simulation_checkpoints.claim_expires_at > now()");
    expect(sql).toContain("for update skip locked");
  });

  it("leaves checkpoints queued and recoverable when the cost meter is paused", () => {
    const globalFn = sql.slice(
      sql.indexOf(
        "create or replace function public.claim_in_home_simulation_checkpoint",
      ),
      sql.indexOf(
        "create or replace function public.claim_specific_in_home_simulation_checkpoint",
      ),
    );
    expect(globalFn).toContain(
      "from public.claim_specific_in_home_simulation_checkpoint",
    );

    const fn = sql.slice(
      sql.indexOf(
        "create or replace function public.claim_specific_in_home_simulation_checkpoint",
      ),
      sql.indexOf(
        "create or replace function public.release_in_home_simulation_checkpoint_claim",
      ),
    );
    const pauseIndex = fn.indexOf("if public.simulation_cost_meter_paused() then");
    const candidateSelectIndex = fn.indexOf("select c.id");
    const checkpointUpdateIndex = fn.indexOf(
      "update public.in_home_simulation_checkpoints as c",
    );
    const jobUpdateIndex = fn.indexOf("update public.in_home_simulation_jobs as j");

    expect(pauseIndex).toBeGreaterThan(-1);
    expect(candidateSelectIndex).toBeGreaterThan(pauseIndex);
    expect(checkpointUpdateIndex).toBeGreaterThan(pauseIndex);
    expect(jobUpdateIndex).toBeGreaterThan(pauseIndex);
    expect(fn).not.toContain("when public.simulation_cost_meter_paused()");
    expect(fn).not.toContain("'failed'::public.simulation_checkpoint_status");
  });

  it("creates a specific checkpoint claim RPC for queue-message wakeups", () => {
    expect(sql).toContain("create or replace function public.claim_specific_in_home_simulation_checkpoint");
    expect(sql).toContain("p_simulation_job_id uuid");
    expect(sql).toContain("p_checkpoint_key public.simulation_checkpoint_key");
    expect(sql).toContain("or c.in_home_simulation_job_id = p_simulation_job_id");
    expect(sql).toContain("or c.checkpoint_key = p_checkpoint_key");
  });

  it("returns the generic worker fields needed by checkpoint mode", () => {
    expect(sql).toContain("returns table (");
    expect(sql).toContain("checkpoint_id uuid");
    expect(sql).toContain("job_id uuid");
    expect(sql).toContain("checkpoint_key public.simulation_checkpoint_key");
    expect(sql).toContain("attempt_number integer");
    expect(sql).toContain("storage_prefix text");
    expect(sql).toContain("customer_room_original_path text");
    expect(sql).toContain("room_cleaned_path text");
    expect(sql).toContain("supplied_dimensions jsonb");
    expect(sql).toContain("reserved_generation_index integer");
  });

  it("updates checkpoint and job claim state atomically", () => {
    expect(sql).toContain("update public.in_home_simulation_checkpoints as c");
    expect(sql).toContain("status = 'processing'");
    expect(sql).toContain("attempt_number = case");
    expect(sql).toContain("when c.status = 'retrying'");
    expect(sql).toContain("update public.in_home_simulation_jobs as j");
    expect(sql).toContain("current_checkpoint = claimed.checkpoint_key");
    expect(sql).toContain("current_checkpoint_status = 'processing'");
    expect(sql).toContain("public.record_in_home_simulation_progress");
  });

  it("creates a release RPC for retryable and terminal checkpoint failures", () => {
    expect(sql).toContain("create or replace function public.release_in_home_simulation_checkpoint_claim");
    expect(sql).toContain("p_checkpoint_id uuid");
    expect(sql).toContain("p_retryable boolean default true");
    expect(sql).toContain("checkpoint_record.attempt_number < checkpoint_record.max_attempts");
    expect(sql).toContain("next_checkpoint_status");
    expect(sql).toContain("next_job_status");
    expect(sql).toContain("last_regeneration_error_message");
    expect(sql).toContain("generated_output_count > 0");
  });

  it("grants all checkpoint helpers to service_role only", () => {
    expect(sql).toContain("grant execute on function public.enqueue_in_home_simulation_checkpoint");
    expect(sql).toContain("grant execute on function public.claim_in_home_simulation_checkpoint");
    expect(sql).toContain("grant execute on function public.claim_specific_in_home_simulation_checkpoint");
    expect(sql).toContain("grant execute on function public.release_in_home_simulation_checkpoint_claim");
    expect(sql).toContain("to service_role");
  });
});
