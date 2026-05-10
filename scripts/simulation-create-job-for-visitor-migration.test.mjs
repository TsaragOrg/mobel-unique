import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH =
  "supabase/migrations/20260502001100_create_in_home_simulation_job_for_visitor.sql";
const PLAN_0074_PATH =
  "supabase/migrations/20260509000400_public_simulation_supabase_auth_otp.sql";
const PLAN_0074_CRON_PATH =
  "supabase/migrations/20260509000500_public_simulation_identity_purge_cron.sql";

describe("SPEC-0015 PLAN-0040 production create-job RPC", () => {
  const sql = readFileSync(PATH, "utf8").replace(/\r\n/g, "\n");

  it("creates create_in_home_simulation_job_for_visitor with the expected signature", () => {
    expect(sql).toContain(
      "create or replace function public.create_in_home_simulation_job_for_visitor"
    );
    expect(sql).toContain("p_verification_request_id text");
    expect(sql).toContain("p_sofa_slug text");
    expect(sql).toContain("p_fabric_id uuid");
    expect(sql).toContain("p_visual_position_id uuid");
    expect(sql).toContain("p_customer_room_original_path text");
    expect(sql).toContain("p_room_geometry_mode public.room_geometry_mode");
    expect(sql).toContain("p_job_id_override uuid default null");
    expect(sql).toContain("p_retention_hours integer default 24");
  });

  it("returns the expected six-column result shape", () => {
    expect(sql).toContain("out_job_id uuid");
    expect(sql).toContain("out_status public.simulation_job_status");
    expect(sql).toContain("out_created_at timestamptz");
    expect(sql).toContain("out_retention_deadline timestamptz");
    expect(sql).toContain("out_room_geometry_mode public.room_geometry_mode");
    expect(sql).toContain("out_storage_prefix text");
  });

  it("runs as security definer with the correct search_path", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, extensions");
  });

  it("validates every required input", () => {
    expect(sql).toContain(
      "if p_verification_request_id is null"
    );
    expect(sql).toContain("if p_sofa_slug is null");
    expect(sql).toContain("if p_fabric_id is null");
    expect(sql).toContain("if p_visual_position_id is null");
    expect(sql).toContain("if p_customer_room_original_path is null");
    expect(sql).toContain("if p_room_geometry_mode is null");
    expect(sql).toContain(
      "p_retention_hours must be a positive integer no greater than 24"
    );
  });

  it("resolves the publishable render cell from sofa_slug + fabric + visual position", () => {
    expect(sql).toContain("from public.sofa_render_cells rc");
    expect(sql).toContain("join public.sofas s on s.id = rc.sofa_id");
    expect(sql).toContain("where s.public_slug = p_sofa_slug");
    expect(sql).toContain("and s.lifecycle_state = 'published'");
    expect(sql).toContain("and rc.fabric_id = p_fabric_id");
    expect(sql).toContain("and rc.visual_matrix_column_id = p_visual_position_id");
    expect(sql).toContain("and rc.current_private_asset_id is not null");
    expect(sql).toContain("and rc.current_public_asset_id is not null");
  });

  it("returns zero rows instead of raising when the triple is not publishable", () => {
    expect(sql).toContain("if resolved_render_cell_id is null then");
    expect(sql).toMatch(/if resolved_render_cell_id is null then\s+return;/);
  });

  it("derives deterministic email_hash and access_token_hash from the verification request id", () => {
    expect(sql).toContain(
      "extensions.digest('email:' || p_verification_request_id, 'sha256')"
    );
    expect(sql).toContain(
      "extensions.digest('access_token:' || p_verification_request_id, 'sha256')"
    );
  });

  it("get-or-creates the email_verification_requests row keyed on the email hash", () => {
    expect(sql).toContain(
      "from public.email_verification_requests"
    );
    expect(sql).toContain("email_normalized_hash = email_hash");
    expect(sql).toContain(
      "insert into public.email_verification_requests"
    );
    expect(sql).toContain("'verified',");
  });

  it("get-or-creates the consent_records row for email_verification_required granted", () => {
    expect(sql).toContain(
      "and consent_type = 'email_verification_required'"
    );
    expect(sql).toContain("and decision = 'granted'");
    expect(sql).toContain(
      "'email_verification_required',"
    );
    expect(sql).toContain("'public-simulation-wizard'");
  });

  it("uses on-conflict-do-nothing on access_token_hash for idempotent session creation", () => {
    expect(sql).toContain("insert into public.simulation_sessions");
    expect(sql).toContain("on conflict (access_token_hash) do nothing");
    expect(sql).toContain(
      "where access_token_hash = derived_access_token_hash"
    );
  });

  it("links the consent record to the session id once both exist", () => {
    expect(sql).toContain("update public.consent_records");
    expect(sql).toContain(
      "set simulation_session_id = session_id"
    );
    expect(sql).toContain("simulation_session_id is null");
  });

  it("allows the caller to pre-allocate the job id via p_job_id_override", () => {
    expect(sql).toContain(
      "new_job_id := coalesce(p_job_id_override, extensions.gen_random_uuid())"
    );
  });

  it("uses simulations/{job_id} as the storage prefix", () => {
    expect(sql).toContain(
      "new_storage_prefix := 'simulations/' || new_job_id::text"
    );
  });

  it("inserts the job in queued status with the supplied retention window", () => {
    expect(sql).toContain("insert into public.in_home_simulation_jobs");
    expect(sql).toContain("'queued',");
    expect(sql).toContain("job_retention_deadline,");
  });

  it("bumps the session's initial_job_count after the job row is created", () => {
    expect(sql).toContain("update public.simulation_sessions");
    expect(sql).toContain(
      "set\n    initial_job_count = initial_job_count + 1"
    );
  });

  it("grants execute on the eight-arg signature to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.create_in_home_simulation_job_for_visitor("
    );
    expect(sql).toContain(
      "text, text, uuid, uuid, text, public.room_geometry_mode, uuid, integer"
    );
    expect(sql).toContain("to service_role");
  });
});

describe("SPEC-0015 PLAN-0074 Supabase Auth OTP create-job override", () => {
  const sql = readFileSync(PLAN_0074_PATH, "utf8").replace(/\r\n/g, "\n");

  it("adds Auth-backed verification and session metadata columns", () => {
    expect(sql).toContain("add column if not exists auth_user_id uuid");
    expect(sql).toContain(
      "alter column verification_code_hash drop not null"
    );
    expect(sql).toContain(
      "add column if not exists email_verification_request_id uuid"
    );
    expect(sql).toContain("email_purged_at timestamptz");
  });

  it("creates the request and session RPCs used by the web route handlers", () => {
    expect(sql).toContain(
      "create or replace function public.create_public_simulation_email_verification_request"
    );
    expect(sql).toContain(
      "create or replace function public.verify_public_simulation_auth_otp_session"
    );
    expect(sql).toContain("p_auth_user_id uuid");
    expect(sql).toContain("p_access_token_hash text");
  });

  it("records required consent before OTP delivery and keeps optional marketing consent separate", () => {
    expect(sql).toContain("'email_verification_required'");
    expect(sql).toContain("'commercial_contact_optional'");
    expect(sql).toContain("p_optional_commercial_decision");
    expect(sql).toContain("'public-simulation-email-gate'");
  });

  it("overrides create_in_home_simulation_job_for_visitor to require an existing verified session", () => {
    expect(sql).toContain(
      "create or replace function public.create_in_home_simulation_job_for_visitor"
    );
    expect(sql).toContain(
      "extensions.digest('access_token:' || p_verification_request_id, 'sha256')"
    );
    expect(sql).toContain("from public.simulation_sessions");
    expect(sql).toContain("and status = 'active'");
    expect(sql).toContain("and expires_at > now()");
    expect(sql).toContain("verified simulation session required");
    expect(sql).not.toContain(
      "extensions.digest('email:' || p_verification_request_id, 'sha256')"
    );
  });

  it("adds a service-role cleanup helper for encrypted email handoff purge", () => {
    expect(sql).toContain(
      "create or replace function public.purge_public_simulation_email_handoffs"
    );
    expect(sql).toContain("email_address_encrypted = null");
    expect(sql).toContain("email_purged_at = now()");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("auth_cleanup_candidates");
    expect(sql).toContain("other_request.email_purged_at is null");
    expect(sql).toContain("active_session.expires_at > now()");
  });
});

describe("SPEC-0015 PLAN-0074 public simulation identity purge cron", () => {
  const sql = readFileSync(PLAN_0074_CRON_PATH, "utf8").replace(/\r\n/g, "\n");

  it("schedules the purge function hourly through pg_cron and pg_net", () => {
    expect(sql).toContain("create extension if not exists pg_net");
    expect(sql).toContain("create extension if not exists pg_cron");
    expect(sql).toContain("public-simulation-identity-purge-runner");
    expect(sql).toContain("'17 * * * *'");
    expect(sql).toContain("net.http_post");
    expect(sql).toContain("'worker', 'in-home-simulation-purge'");
  });

  it("uses Vault function URL and invoke secret instead of committed secrets", () => {
    expect(sql).toContain("in_home_simulation_purge_function_url");
    expect(sql).toContain("in_home_simulation_purge_invoke_secret");
    expect(sql).toContain("'x-in-home-simulation-purge-secret'");
    expect(sql).toContain("secrets.invoke_secret");
  });
});
