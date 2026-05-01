import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scriptSource = readFileSync("scripts/seed-local-admin-fixtures.mjs", "utf8");
const fixtureReadme = readFileSync(
  "fixtures/local-admin-catalog/README.md",
  "utf8",
);
const manifestExample = JSON.parse(
  readFileSync("fixtures/local-admin-catalog/manifest.example.json", "utf8"),
);
const localSupabaseGuide = readFileSync(
  "docs/local-supabase-worker-development.md",
  "utf8",
);

describe("local admin fixture seed workflow", () => {
  it("runs the admin fixture seed after the standard local Supabase reset", () => {
    expect(packageJson.scripts["seed:local:admin-fixtures"]).toBe(
      "node scripts/seed-local-admin-fixtures.mjs",
    );
    expect(packageJson.scripts["supabase:realtime:local-compat"]).toBe(
      "node scripts/ensure-local-realtime-compat.mjs",
    );
    expect(packageJson.scripts["supabase:reset"]).toContain(
      "pnpm supabase:realtime:local-compat",
    );
    expect(packageJson.scripts["supabase:reset"]).toContain(
      "pnpm seed:local:admin-fixtures",
    );
    expect(packageJson.scripts["supabase:reset:db-only"]).toContain(
      "pnpm supabase:realtime:local-compat",
    );
  });

  it("keeps the seed local-only and writes the required catalog assets", () => {
    expect(scriptSource).toContain("Refusing to seed non-local Supabase URL");
    expect(scriptSource).toContain("catalog-public-assets");
    expect(scriptSource).toContain("catalog-private-assets");
    expect(scriptSource).toContain("fabric_swatch_public");
    expect(scriptSource).toContain("fabric_ai_reference");
    expect(scriptSource).toContain("sofa_source_photo");
  });

  it("documents the fixture contract and provides enough sample data", () => {
    expect(fixtureReadme).toContain("at least 3 fabrics");
    expect(fixtureReadme).toContain("at least 2 sofas");
    expect(fixtureReadme).toContain("PNG, JPEG, and WebP");
    expect(manifestExample.fabrics).toHaveLength(3);
    expect(manifestExample.sofas).toHaveLength(2);

    for (const fabric of manifestExample.fabrics) {
      expect(fabric.swatch_image).toMatch(/^images\/fabrics\//);
      expect(fabric.ai_reference_image).toMatch(/^images\/fabrics\//);
    }

    for (const sofa of manifestExample.sofas) {
      expect(sofa.visual_positions.length).toBeGreaterThanOrEqual(2);
      expect(sofa.fabric_slugs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("documents that reset seeds local admin fixtures automatically", () => {
    expect(localSupabaseGuide).toContain("pnpm supabase:reset");
    expect(localSupabaseGuide).toContain("seed:local:admin-fixtures");
    expect(localSupabaseGuide).toContain("fixtures/local-admin-catalog");
  });
});
