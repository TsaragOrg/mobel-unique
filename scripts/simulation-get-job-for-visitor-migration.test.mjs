import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH =
  "supabase/migrations/20260502001200_get_in_home_simulation_job_for_visitor.sql";

describe("SPEC-0015 PLAN-0040 owned-job read RPC", () => {
  const sql = readFileSync(PATH, "utf8");

  it("creates get_in_home_simulation_job_for_visitor with the expected signature", () => {
    expect(sql).toContain(
      "create or replace function public.get_in_home_simulation_job_for_visitor"
    );
    expect(sql).toContain("p_job_id uuid");
    expect(sql).toContain("p_access_token_hash text");
  });

  it("returns the eleven-column status payload", () => {
    expect(sql).toContain("out_job_id uuid");
    expect(sql).toContain("out_status public.simulation_job_status");
    expect(sql).toContain("out_room_geometry_mode public.room_geometry_mode");
    expect(sql).toContain("out_created_at timestamptz");
    expect(sql).toContain("out_retention_deadline timestamptz");
    expect(sql).toContain("out_storage_prefix text");
    expect(sql).toContain("out_dimension_guide_overlay_path text");
    expect(sql).toContain("out_generated_output_count integer");
    expect(sql).toContain("out_latest_generated_output_index integer");
    expect(sql).toContain("out_last_error_message text");
    expect(sql).toContain("out_last_regeneration_error_message text");
  });

  it("runs as security definer with the correct search_path", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, extensions");
  });

  it("joins jobs to sessions and filters on access_token_hash", () => {
    expect(sql).toContain("from public.in_home_simulation_jobs j");
    expect(sql).toContain(
      "join public.simulation_sessions s on s.id = j.simulation_session_id"
    );
    expect(sql).toContain("where j.id = p_job_id");
    expect(sql).toContain("and s.access_token_hash = p_access_token_hash");
    expect(sql).toContain("limit 1");
  });

  it("grants execute on the two-arg signature to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.get_in_home_simulation_job_for_visitor(uuid, text)"
    );
    expect(sql).toContain("to service_role");
  });
});
