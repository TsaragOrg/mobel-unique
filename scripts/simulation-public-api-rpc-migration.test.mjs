import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RATE_LIMIT_PATH =
  "supabase/migrations/20260502000900_simulation_rate_limit_increment.sql";
const IDEMPOTENCY_PATH =
  "supabase/migrations/20260502001000_simulation_idempotency_key_acquire.sql";

describe("SPEC-0015 PLAN-0040 rate-limit increment RPC", () => {
  const sql = readFileSync(RATE_LIMIT_PATH, "utf8");

  it("creates the increment_simulation_rate_limit function", () => {
    expect(sql).toContain(
      "create or replace function public.increment_simulation_rate_limit"
    );
    expect(sql).toContain("returns table (count integer, allowed boolean)");
    expect(sql).toContain("security definer");
  });

  it("validates subject_kind is ip or email", () => {
    expect(sql).toContain(
      "if p_subject_kind is null or p_subject_kind not in ('ip', 'email') then"
    );
  });

  it("rejects null or empty subject value hash", () => {
    expect(sql).toContain(
      "if p_subject_value_hash is null or length(btrim(p_subject_value_hash)) = 0 then"
    );
  });

  it("rejects null or negative cap", () => {
    expect(sql).toContain(
      "if p_cap is null or p_cap < 0 then"
    );
  });

  it("upserts and increments the count atomically", () => {
    expect(sql).toContain(
      "insert into public.simulation_rate_limits as srl"
    );
    expect(sql).toContain(
      "on conflict (subject_kind, subject_value_hash, window_start)"
    );
    expect(sql).toContain("do update set count = srl.count + 1");
  });

  it("returns count and allowed flag", () => {
    expect(sql).toContain("count := current_count");
    expect(sql).toContain("allowed := current_count <= p_cap");
  });

  it("grants execute to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.increment_simulation_rate_limit(text, text, timestamptz, integer)"
    );
    expect(sql).toContain("to service_role");
  });
});

describe("SPEC-0015 PLAN-0040 idempotency-key acquire RPC", () => {
  const sql = readFileSync(IDEMPOTENCY_PATH, "utf8");

  it("creates acquire_simulation_idempotency_key with the expected return shape", () => {
    expect(sql).toContain(
      "create or replace function public.acquire_simulation_idempotency_key"
    );
    expect(sql).toContain(
      "returns table (acquired boolean, simulation_job_id uuid)"
    );
  });

  it("uses on conflict do nothing for the acquire path", () => {
    expect(sql).toContain(
      "insert into public.simulation_idempotency_keys (key_hash)"
    );
    expect(sql).toContain("on conflict (key_hash) do nothing");
  });

  it("returns acquired=true when the row was inserted", () => {
    expect(sql).toContain("get diagnostics inserted_count = row_count");
    expect(sql).toContain("if inserted_count > 0 then");
    expect(sql).toContain("acquired := true");
  });

  it("falls back to selecting the existing simulation_job_id on conflict", () => {
    expect(sql).toContain(
      "select sik.simulation_job_id into existing_simulation_job_id"
    );
    expect(sql).toContain("where sik.key_hash = p_key_hash");
    expect(sql).toContain("acquired := false");
  });

  it("creates finalize_simulation_idempotency_key with both arguments", () => {
    expect(sql).toContain(
      "create or replace function public.finalize_simulation_idempotency_key"
    );
    expect(sql).toContain("p_key_hash text");
    expect(sql).toContain("p_simulation_job_id uuid");
  });

  it("finalize updates the row with the persisted job id", () => {
    expect(sql).toContain(
      "update public.simulation_idempotency_keys"
    );
    expect(sql).toContain(
      "set simulation_job_id = p_simulation_job_id"
    );
    expect(sql).toContain("where key_hash = p_key_hash");
  });

  it("finalize raises when the row is missing", () => {
    expect(sql).toContain("get diagnostics matched = row_count");
    expect(sql).toContain("if matched = 0 then");
    expect(sql).toContain(
      "raise exception 'simulation_idempotency_keys row not found"
    );
  });

  it("grants execute on both helpers to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.acquire_simulation_idempotency_key(text)"
    );
    expect(sql).toContain(
      "grant execute on function public.finalize_simulation_idempotency_key(text, uuid)"
    );
  });
});
