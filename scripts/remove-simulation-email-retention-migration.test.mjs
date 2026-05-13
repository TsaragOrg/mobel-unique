import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260512000100_remove_simulation_email_retention.sql";
const sql = readFileSync(migrationPath, "utf8");

function functionDefinition(name) {
  const marker = `create or replace function public.${name}`;
  const start = sql.indexOf(marker);
  expect(start, `${name} function exists`).toBeGreaterThanOrEqual(0);
  const bodyStart = sql.indexOf("as $$", start);
  const bodyEnd = sql.indexOf("$$;", bodyStart + 5);
  expect(bodyStart, `${name} body starts`).toBeGreaterThanOrEqual(0);
  expect(bodyEnd, `${name} body ends`).toBeGreaterThan(bodyStart);
  return sql.slice(start, bodyEnd);
}

describe("PLAN-0081 remove simulation email retention migration", () => {
  it("adds short-lived verification subject columns instead of encrypted email storage", () => {
    expect(sql).toContain(
      "add column if not exists verification_subject_hash text",
    );
    expect(sql).toContain("email_address_encrypted = null");
    expect(sql).toContain("email_normalized_hash = null");

    const createRequest = functionDefinition(
      "create_public_simulation_email_verification_request",
    );
    expect(createRequest).toContain("p_verification_subject_hash text");
    expect(createRequest).toContain("verification_subject_hash");
    expect(createRequest).not.toContain("p_email_address_encrypted");
    expect(createRequest).not.toContain("p_optional_commercial_decision");
  });

  it("creates verified sessions with the short-lived subject and no consent records", () => {
    const verifySession = functionDefinition(
      "verify_public_simulation_auth_otp_session",
    );
    expect(verifySession).toContain("p_verification_subject_hash text");
    expect(verifySession).toContain(
      "request_row.verification_subject_hash is distinct from",
    );
    expect(verifySession).toContain("verification_subject_hash");
    expect(verifySession).toContain("required_email_consent_record_id");
    expect(verifySession).toContain("null");
    expect(verifySession).not.toContain("commercial_contact_optional");
  });

  it("removes retained simulation lead storage and RPCs", () => {
    for (const fn of [
      "record_simulation_lead_for_job",
      "admin_list_simulation_leads",
      "admin_list_simulation_lead_jobs",
      "admin_delete_simulation_lead_identity",
    ]) {
      expect(sql).toContain(`drop function if exists public.${fn}`);
    }

    expect(sql).toContain("drop table if exists public.simulation_lead_jobs");
    expect(sql).toContain("drop table if exists public.simulation_leads");
    expect(functionDefinition("create_in_home_simulation_job_for_visitor_dispatch_outbox"))
      .not.toContain("record_simulation_lead_for_job");
  });

  it("removes optional commercial contact rows and old email rate-limit rows", () => {
    expect(sql).toContain("consent_type = 'commercial_contact_optional'");
    expect(sql).toContain("delete from public.simulation_rate_limits");
    expect(sql).toContain("where subject_kind = 'email'");
    expect(sql).toContain(
      "check (subject_kind in ('ip', 'verification_subject'))",
    );

    const increment = functionDefinition("increment_simulation_rate_limit");
    expect(increment).toContain("'verification_subject'");
    expect(increment).not.toContain("p_subject_kind must be ip or email");
  });

  it("purges expired identity subjects and returns transient Auth cleanup candidates", () => {
    const purge = functionDefinition("purge_public_simulation_email_handoffs");
    expect(purge).toContain("verification_subject_hash = null");
    expect(purge).toContain("email_address_encrypted = null");
    expect(purge).toContain("email_normalized_hash = null");
    expect(purge).toContain("auth_cleanup_candidates");
    expect(purge).toContain("out_auth_user_id uuid");
  });
});
