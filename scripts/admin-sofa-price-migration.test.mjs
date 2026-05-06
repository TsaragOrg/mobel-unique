import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260506000100_admin_sofa_price.sql";

describe("PLAN-0065 admin sofa price migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("adds nullable cents-backed sofa price columns", () => {
    expect(sql).toContain("add column if not exists price_cents integer");
    expect(sql).toContain(
      "add column if not exists price_currency text not null default 'EUR'",
    );
  });

  it("keeps price values positive and EUR-only", () => {
    expect(sql).toContain("sofas_positive_price_cents");
    expect(sql).toContain("price_cents is null or price_cents > 0");
    expect(sql).toContain("sofas_price_currency_eur");
    expect(sql).toContain("price_currency = 'EUR'");
  });

  it("exposes price fields through the public catalog sofa view", () => {
    expect(sql).toContain("create or replace view public.public_catalog_sofas");
    expect(sql).toMatch(/s\.created_at,\s*s\.price_cents,\s*s\.price_currency/s);
  });
});
