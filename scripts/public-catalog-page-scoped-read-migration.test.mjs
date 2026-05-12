import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PATH =
  "supabase/migrations/20260512000300_public_catalog_page_scoped_read.sql";

describe("PLAN-0086 public catalog page-scoped read RPC", () => {
  const sql = readFileSync(PATH, "utf8");

  it("creates the page-scoped public catalog card function", () => {
    expect(sql).toContain(
      "create or replace function public.list_public_catalog_cards",
    );
    expect(sql).toContain("p_limit integer");
    expect(sql).toContain("p_cursor_created_at timestamptz default null");
    expect(sql).toContain("p_cursor_id uuid default null");
    expect(sql).toContain("p_cursor_manual_public_order integer default null");
    expect(sql).toContain("p_tag_slugs text[] default array[]::text[]");
  });

  it("keeps execution visitor-safe", () => {
    expect(sql).toContain("stable");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = public, extensions");
    expect(sql).toContain(
      "grant execute on function public.list_public_catalog_cards",
    );
    expect(sql).toContain("to anon, authenticated");
    expect(sql).not.toContain("service_role");
    expect(sql).not.toContain("security definer");
  });

  it("caps page size and fetches one extra row for cursor detection", () => {
    expect(sql).toContain("least(greatest(coalesce(p_limit, 12), 1), 49)");
    expect(sql).toContain("limit bounded_limit");
  });

  it("applies tag AND filtering before pagination", () => {
    expect(sql).toContain("requested_tags");
    expect(sql).toContain("not exists");
    expect(sql).toContain("public.public_sofa_tags");
    expect(sql).toContain("tag.slug = requested_tag.slug");
  });

  it("applies the catalog sort cursor in SQL", () => {
    expect(sql).toContain("manual_public_order");
    expect(sql).toContain("created_at desc");
    expect(sql).toContain("candidate.id");
    expect(sql).toContain("p_cursor_created_at");
    expect(sql).toContain("p_cursor_id");
    expect(sql).toContain("sofa.created_at < p_cursor_created_at");
  });

  it("returns only card-scoped fabrics and default-position medium renders", () => {
    expect(sql).toContain("public.public_sofa_fabrics");
    expect(sql).toContain("public.public_sofa_visual_positions");
    expect(sql).toContain("public.public_sofa_render_cells");
    expect(sql).toContain("render_medium_object_path");
    expect(sql).toContain("public_swatch_small_object_path");
    expect(sql).not.toContain("render_original_object_path");
  });
});
