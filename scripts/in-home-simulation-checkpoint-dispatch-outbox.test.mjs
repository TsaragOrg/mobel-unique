import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260508000200_in_home_simulation_checkpoint_dispatch_outbox.sql";

describe("PLAN-0068 in-home simulation checkpoint dispatch outbox migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates a service-role-only transactional dispatch outbox", () => {
    expect(sql).toContain(
      "create table if not exists public.in_home_simulation_checkpoint_dispatch_outbox"
    );
    expect(sql).toContain("checkpoint_id uuid not null references public.in_home_simulation_checkpoints");
    expect(sql).toContain("status text not null default 'pending'");
    expect(sql).toContain("attempt_count integer not null default 0");
    expect(sql).toContain("next_attempt_at timestamptz not null default now()");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table public.in_home_simulation_checkpoint_dispatch_outbox");
    expect(sql).toContain("to service_role");
  });

  it("keeps one dispatch intent per checkpoint and makes insertion idempotent", () => {
    expect(sql).toContain(
      "ihs_dispatch_checkpoint_unique_idx"
    );
    expect(sql).toContain("(checkpoint_id)");
    expect(sql).toContain(
      "create or replace function public.enqueue_in_home_simulation_checkpoint_dispatch"
    );
    expect(sql).toContain("on conflict (checkpoint_id) do update");
    expect(sql).toContain("reason = excluded.reason");
  });

  it("replaces checkpoint enqueueing so claimable worker checkpoints write the outbox in the same transaction", () => {
    expect(sql).toContain(
      "create or replace function public.enqueue_in_home_simulation_checkpoint"
    );
    expect(sql).toContain("insert into public.in_home_simulation_checkpoints");
    expect(sql).toContain(
      "perform public.enqueue_in_home_simulation_checkpoint_dispatch"
    );
    expect(sql).toContain("'checkpoint_enqueued'");
    expect(sql).toContain(
      "public.is_in_home_simulation_worker_checkpoint_key(p_checkpoint_key)"
    );
  });

  it("adds dispatcher claim, success, retry, and stale-lock backstop RPCs", () => {
    expect(sql).toContain(
      "create or replace function public.claim_in_home_simulation_checkpoint_dispatches"
    );
    expect(sql).toContain("for update of d skip locked");
    expect(sql).toContain("status = 'dispatching'");
    expect(sql).toContain(
      "create or replace function public.mark_in_home_simulation_checkpoint_dispatch_dispatched"
    );
    expect(sql).toContain(
      "create or replace function public.mark_in_home_simulation_checkpoint_dispatch_retryable"
    );
    expect(sql).toContain(
      "create or replace function public.requeue_stale_in_home_simulation_checkpoint_dispatches"
    );
    expect(sql).toContain(
      "create or replace function public.recover_stale_in_home_simulation_checkpoints"
    );
    expect(sql).toContain("Checkpoint claim expired before completion; returning to dispatch.");
    expect(sql).toContain(
      "perform public.enqueue_in_home_simulation_checkpoint_dispatch"
    );
  });

  it("leaves dispatch rows pending without consuming attempts when cost-meter is paused", () => {
    const fn = sql.slice(
      sql.indexOf(
        "create or replace function public.claim_in_home_simulation_checkpoint_dispatches",
      ),
      sql.indexOf(
        "create or replace function public.mark_in_home_simulation_checkpoint_dispatch_dispatched",
      ),
    );
    const pauseIndex = fn.indexOf("if public.simulation_cost_meter_paused() then");
    const candidatesIndex = fn.indexOf("with candidates as");
    const dispatchingUpdateIndex = fn.indexOf("status = 'dispatching'");
    const attemptIncrementIndex = fn.indexOf(
      "attempt_count = d.attempt_count + 1",
    );

    expect(pauseIndex).toBeGreaterThan(-1);
    expect(candidatesIndex).toBeGreaterThan(pauseIndex);
    expect(dispatchingUpdateIndex).toBeGreaterThan(pauseIndex);
    expect(attemptIncrementIndex).toBeGreaterThan(pauseIndex);
    expect(fn).not.toContain("when public.simulation_cost_meter_paused()");
    expect(fn).not.toContain("status = 'failed'");
  });

  it("exposes dispatch-outbox API RPC names for public simulation handlers", () => {
    expect(sql).toContain(
      "create or replace function public.create_in_home_simulation_job_for_visitor_dispatch_outbox"
    );
    expect(sql).toContain(
      "create or replace function public.submit_in_home_simulation_dimensions_dispatch_outbox"
    );
    expect(sql).toContain(
      "create or replace function public.request_in_home_simulation_regeneration_dispatch_outbox"
    );
    expect(sql).not.toContain("pgmq.send");
  });
});
