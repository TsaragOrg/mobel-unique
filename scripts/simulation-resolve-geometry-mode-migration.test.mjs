import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH =
  "supabase/migrations/20260502001300_resolve_simulation_room_geometry_mode.sql";

describe("SPEC-0015 PLAN-0040 resolve room geometry mode RPC", () => {
  const sql = readFileSync(PATH, "utf8");

  it("creates resolve_simulation_room_geometry_mode with the expected signature", () => {
    expect(sql).toContain(
      "create or replace function public.resolve_simulation_room_geometry_mode"
    );
    expect(sql).toContain("p_sofa_slug text");
    expect(sql).toContain("p_corner_tag_slug text");
    expect(sql).toContain("returns public.room_geometry_mode");
  });

  it("runs as security definer with the correct search_path", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, extensions");
  });

  it("rejects null or empty sofa slug and corner tag slug", () => {
    expect(sql).toContain(
      "if p_sofa_slug is null or length(btrim(p_sofa_slug)) = 0 then"
    );
    expect(sql).toContain(
      "if p_corner_tag_slug is null or length(btrim(p_corner_tag_slug)) = 0 then"
    );
  });

  it("filters sofas on public_slug and published lifecycle state", () => {
    expect(sql).toContain("from public.sofas");
    expect(sql).toContain("where public_slug = p_sofa_slug");
    expect(sql).toContain("and lifecycle_state = 'published'");
  });

  it("returns null when the sofa is not publishable", () => {
    expect(sql).toContain(
      "if resolved_sofa_id is null then"
    );
    expect(sql).toContain("return null;");
  });

  it("checks corner tag membership via sofa_tags + public_tags", () => {
    expect(sql).toContain("from public.sofa_tags st");
    expect(sql).toContain(
      "join public.public_tags pt on pt.id = st.tag_id"
    );
    expect(sql).toContain("and pt.slug = p_corner_tag_slug");
  });

  it("returns the corresponding enum value", () => {
    expect(sql).toContain(
      "return 'corner'::public.room_geometry_mode;"
    );
    expect(sql).toContain(
      "return 'back_wall'::public.room_geometry_mode;"
    );
  });

  it("grants execute on the two-arg signature to service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.resolve_simulation_room_geometry_mode(text, text)"
    );
    expect(sql).toContain("to service_role");
  });
});
