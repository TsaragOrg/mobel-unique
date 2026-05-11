import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260507000200_in_home_simulation_checkpoint_pump_realtime.sql";

describe("PLAN-0068 in-home simulation checkpoint pump migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates checkpoint enum types", () => {
    expect(sql).toContain("create type public.simulation_checkpoint_key as enum");
    expect(sql).toContain("'room_validation'");
    expect(sql).toContain("'room_cleaning'");
    expect(sql).toContain("'room_corners'");
    expect(sql).toContain("'placement_generation'");
    expect(sql).toContain("'placement_measurement'");
    expect(sql).toContain("create type public.simulation_checkpoint_status as enum");
    expect(sql).toContain("'queued'");
    expect(sql).toContain("'processing'");
    expect(sql).toContain("'retrying'");
  });

  it("adds current checkpoint and progress columns to in_home_simulation_jobs", () => {
    expect(sql).toContain("alter table public.in_home_simulation_jobs");
    expect(sql).toContain("current_checkpoint public.simulation_checkpoint_key");
    expect(sql).toContain("current_checkpoint_status public.simulation_checkpoint_status");
    expect(sql).toContain("progress_step_key text");
    expect(sql).toContain("progress_step_ordinal integer");
    expect(sql).toContain("progress_total_steps integer");
    expect(sql).toContain("progress_updated_at timestamptz");
  });

  it("creates durable checkpoint attempts with claim metadata", () => {
    expect(sql).toContain("create table if not exists public.in_home_simulation_checkpoints");
    expect(sql).toContain("in_home_simulation_job_id uuid not null references public.in_home_simulation_jobs");
    expect(sql).toContain("checkpoint_key public.simulation_checkpoint_key not null");
    expect(sql).toContain("status public.simulation_checkpoint_status not null");
    expect(sql).toContain("attempt_number integer not null default 1");
    expect(sql).toContain("max_attempts integer not null default 3");
    expect(sql).toContain("claimed_by text");
    expect(sql).toContain("claim_expires_at timestamptz");
    expect(sql).toContain("safe_error_code text");
    expect(sql).toContain("safe_error_message text");
  });

  it("indexes claimable and expired checkpoint work", () => {
    expect(sql).toContain("in_home_simulation_checkpoints_claimable_idx");
    expect(sql).toContain("where status in ('queued', 'retrying')");
    expect(sql).toContain("in_home_simulation_checkpoints_claim_expires_idx");
    expect(sql).toContain("where status = 'processing'");
    expect(sql).toContain("in_home_simulation_checkpoints_active_unique_idx");
  });

  it("creates a visitor-safe public progress surface", () => {
    expect(sql).toContain("create table if not exists public.simulation_public_progress");
    expect(sql).toContain("simulation_job_id uuid primary key");
    expect(sql).toContain("simulation_session_id uuid not null references public.simulation_sessions");
    expect(sql).toContain("progress_step_key text");
    expect(sql).toContain("visitor_action_required boolean not null default false");
    expect(sql).toContain("guide_available boolean not null default false");
    expect(sql).toContain("latest_result_available boolean not null default false");
    expect(sql).toContain("regeneration_available boolean not null default false");
  });

  it("protects private checkpoint tables and scopes public progress reads", () => {
    expect(sql).toContain("alter table public.in_home_simulation_checkpoints");
    expect(sql).toContain("alter table public.simulation_public_progress");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table public.in_home_simulation_checkpoints");
    expect(sql).toContain("revoke all on table public.simulation_public_progress");
    expect(sql).toContain("spec_0068_service_role_all_in_home_simulation_checkpoints");
    expect(sql).toContain("spec_0068_service_role_all_simulation_public_progress");
    expect(sql).toContain("spec_0068_simulation_public_progress_select_own");
    expect(sql).toContain("auth.jwt()");
    expect(sql).toContain(
      "auth.jwt() -> 'simulation_progress' ->> 'simulation_job_id'"
    );
    expect(sql).toContain(
      "auth.jwt() -> 'simulation_progress' ->> 'simulation_session_id'"
    );
  });

  it("adds the public progress table to Supabase Realtime when the publication exists", () => {
    expect(sql).toContain("pg_publication");
    expect(sql).toContain("supabase_realtime");
    expect(sql).toContain("alter publication supabase_realtime add table public.simulation_public_progress");
  });

  it("creates a service-role helper to update job progress and public progress together", () => {
    expect(sql).toContain("create or replace function public.record_in_home_simulation_progress");
    expect(sql).toContain("update public.in_home_simulation_jobs");
    expect(sql).toContain("insert into public.simulation_public_progress");
    expect(sql).toContain("on conflict (simulation_job_id) do update");
    expect(sql).toContain("grant execute on function public.record_in_home_simulation_progress");
  });
});
