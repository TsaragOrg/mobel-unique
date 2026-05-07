import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260507000700_in_home_simulation_realtime_access.sql";

describe("PLAN-0068 in-home simulation Realtime access RPC", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates a service-role RPC that resolves one owned progress subscription scope", () => {
    expect(sql).toContain(
      "create or replace function public.get_in_home_simulation_progress_access_for_visitor"
    );
    expect(sql).toContain("p_job_id uuid");
    expect(sql).toContain("p_access_token_hash text");
    expect(sql).toContain("out_simulation_session_id uuid");
    expect(sql).toContain("join public.simulation_sessions s");
    expect(sql).toContain("s.access_token_hash = p_access_token_hash");
  });

  it("returns only non-expired jobs and grants execute to service_role", () => {
    expect(sql).toContain("j.retention_deadline > now()");
    expect(sql).toContain(
      "grant execute on function public.get_in_home_simulation_progress_access_for_visitor(uuid, text)"
    );
    expect(sql).toContain("to service_role");
  });
});
