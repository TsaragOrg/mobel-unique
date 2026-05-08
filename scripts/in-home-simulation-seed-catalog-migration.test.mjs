import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SEED_PATH =
  "supabase/migrations/20260502000800_seed_simulation_test_catalog.sql";
const SCRIPT_PATH = "scripts/seed-simulation-test-data.mjs";

describe("SPEC-0015 simulation test catalog seed migration", () => {
  const sql = readFileSync(SEED_PATH, "utf8");

  it("declares the seed function with a corner_tag_slug argument", () => {
    expect(sql).toContain(
      "create or replace function public.seed_simulation_test_catalog"
    );
    expect(sql).toContain("corner_tag_slug text default 'corner'");
    expect(sql).toContain("returns void");
  });

  it("upserts both deterministic sofa ids in the published lifecycle", () => {
    expect(sql).toContain("'00000000-0000-4000-8000-0000000505f1'");
    expect(sql).toContain("'00000000-0000-4000-8000-0000000505f2'");
    expect(sql).toContain("insert into public.sofas");
    expect(sql).toContain("'published'");
  });

  it("links the corner sofa to a tag whose slug equals corner_tag_slug", () => {
    expect(sql).toContain("insert into public.public_tags");
    expect(sql).toContain("v_corner_tag_id, 'Corner', corner_tag_slug");
    expect(sql).toContain("insert into public.sofa_tags");
    expect(sql).toContain("v_corner_sofa_id, v_corner_tag_id");
  });

  it("creates a shared fabric with swatch + ai-reference assets", () => {
    expect(sql).toContain("insert into public.fabrics");
    expect(sql).toContain("swatch_asset_id, ai_reference_asset_id");
  });

  it("creates one visual matrix column per sofa with sequence 1", () => {
    const occurrences = sql.match(
      /insert into public\.visual_matrix_columns/g
    );
    expect(occurrences?.length ?? 0).toBe(1);
    expect(sql).toContain("v_straight_visual_id, v_straight_sofa_id, 1");
    expect(sql).toContain("v_corner_visual_id, v_corner_sofa_id, 1");
  });

  it("declares only syntactically valid deterministic UUID constants", () => {
    const uuidConstantPattern = /constant uuid := '([^']+)'/g;
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const constants = [...sql.matchAll(uuidConstantPattern)].map(
      (match) => match[1]
    );

    expect(constants.length).toBeGreaterThan(0);
    expect(constants.filter((value) => !uuidPattern.test(value))).toEqual([]);
  });

  it("creates render cells with current_public_asset_id pointing at the seeded renders", () => {
    expect(sql).toContain("insert into public.sofa_render_cells");
    expect(sql).toContain("straight_render_asset_id");
    expect(sql).toContain("corner_render_asset_id");
    expect(sql).toContain("'manual_upload'");
  });

  it("creates private prepared sofa assets required by simulation job creation", () => {
    expect(sql).toContain("prepared_sofa_private");
    expect(sql).toContain("v_straight_prepared_sofa_asset_id");
    expect(sql).toContain("v_corner_prepared_sofa_asset_id");
    expect(sql).toContain("current_private_asset_id = excluded.current_private_asset_id");
  });

  it("uses on conflict do nothing or do update for idempotency", () => {
    expect(sql).toContain("on conflict (id) do nothing");
    expect(sql).toContain("on conflict (sofa_id, tag_id) do nothing");
    expect(sql).toContain(
      "on conflict (sofa_id, fabric_id) do nothing"
    );
    expect(sql).toContain(
      "on conflict (sofa_id, fabric_id, visual_matrix_column_id) do update"
    );
  });

  it("grants execute on the function to service_role only", () => {
    expect(sql).toContain(
      "grant execute on function public.seed_simulation_test_catalog(text) to service_role"
    );
  });
});

describe("scripts/seed-simulation-test-data.mjs", () => {
  const script = readFileSync(SCRIPT_PATH, "utf8");

  it("requires SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(script).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(script).toContain("is required");
  });

  it("refuses non-local Supabase URLs unless explicitly opted in", () => {
    expect(script).toContain("SIMULATION_TEST_SEED_ALLOW_NON_LOCAL");
    expect(script).toContain("Refusing to seed non-local Supabase URL");
  });

  it("posts to the seed_simulation_test_catalog RPC with corner_tag_slug", () => {
    expect(script).toContain(
      'callRpc("seed_simulation_test_catalog"'
    );
    expect(script).toContain("corner_tag_slug: cornerTag");
  });

  it("copies source sofa renders into original and medium public targets", () => {
    expect(script).toContain("seed/simulation-test/sofa-straight-render.png");
    expect(script).toContain(
      "seed/simulation-test/sofa-straight-render-medium.png"
    );
    expect(script).toContain("seed/simulation-test/sofa-straight-prepared.png");
    expect(script).toContain("seed/simulation-test/sofa-corner-render.png");
    expect(script).toContain(
      "seed/simulation-test/sofa-corner-render-medium.png"
    );
    expect(script).toContain("seed/simulation-test/sofa-corner-prepared.png");
  });

  it("defaults the corner tag slug to 'corner'", () => {
    expect(script).toContain('args["corner-tag"] ?? "corner"');
  });
});
