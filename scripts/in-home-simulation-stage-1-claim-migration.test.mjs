import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260502000100_in_home_simulation_stage_1_claim_returns_geometry_mode.sql";

describe("Stage 1 claim RPC migration (PLAN-0038)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("drops claim_in_home_simulation_room_prep_job before re-creating it", () => {
    const dropIndex = sql.indexOf(
      "drop function if exists public.claim_in_home_simulation_room_prep_job(text, integer)"
    );
    const createIndex = sql.indexOf(
      "create or replace function public.claim_in_home_simulation_room_prep_job"
    );
    expect(dropIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(-1);
    expect(dropIndex).toBeLessThan(createIndex);
  });

  it("drops claim_specific_in_home_simulation_room_prep_job before re-creating it", () => {
    const dropIndex = sql.indexOf(
      "drop function if exists public.claim_specific_in_home_simulation_room_prep_job(uuid, text, integer)"
    );
    const createIndex = sql.indexOf(
      "create or replace function public.claim_specific_in_home_simulation_room_prep_job"
    );
    expect(dropIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(-1);
    expect(dropIndex).toBeLessThan(createIndex);
  });

  it("returns room_geometry_mode coalesced to back_wall in both functions", () => {
    const occurrences = sql.match(
      /coalesce\(j\.room_geometry_mode, 'back_wall'::public\.room_geometry_mode\)/g
    );
    expect(occurrences?.length ?? 0).toBe(2);
  });
});
