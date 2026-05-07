import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scriptSource = readFileSync(
  "scripts/seed-local-admin-fixtures.mjs",
  "utf8",
);
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
    expect(packageJson.scripts["supabase:reset"]).toContain(
      "pnpm seed:simulation-test:local-fixtures",
    );
    expect(packageJson.scripts["supabase:reset:db-only"]).toContain(
      "pnpm supabase:realtime:local-compat",
    );
  });

  it("seeds public simulation fixtures from local admin fixture storage after reset", () => {
    expect(packageJson.scripts["seed:simulation-test"]).toBe(
      "node scripts/seed-simulation-test-data.mjs",
    );
    expect(
      packageJson.scripts["seed:simulation-test:local-fixtures"],
    ).toContain("pnpm seed:simulation-test --");
    expect(
      packageJson.scripts["seed:simulation-test:local-fixtures"],
    ).toContain(
      "local-admin-fixtures/mobel-local/sofas/mobel-sofa-01/published/beige-dotted/position-1.png",
    );
    expect(
      packageJson.scripts["seed:simulation-test:local-fixtures"],
    ).toContain(
      "local-admin-fixtures/mobel-local/sofas/mobel-sofa-01/published/grey-soft/position-1.png",
    );
    expect(
      packageJson.scripts["seed:simulation-test:local-fixtures"],
    ).toContain(
      "local-admin-fixtures/mobel-local/fabrics/beige-textured/swatch.png",
    );
    expect(
      packageJson.scripts["seed:simulation-test:local-fixtures"],
    ).toContain(
      "local-admin-fixtures/mobel-local/fabrics/beige-textured/ai-reference.jpg",
    );
  });

  it("keeps the seed local-only and writes the required catalog assets", () => {
    expect(scriptSource).toContain("Refusing to seed non-local Supabase URL");
    expect(scriptSource).toContain("catalog-public-assets");
    expect(scriptSource).toContain("catalog-private-assets");
    expect(scriptSource).toContain("generateImageVariants");
    expect(scriptSource).toContain("storage_asset_variants");
    expect(scriptSource).toContain("fabric_swatch_public");
    expect(scriptSource).toContain("fabric_ai_reference");
    expect(scriptSource).toContain("sofa_source_photo");
    expect(scriptSource).toContain("generateDeterministicFixtureImage");
  });

  it("documents the fixture contract and provides enough sample data", () => {
    expect(fixtureReadme).toContain("at least 3 fabrics");
    expect(fixtureReadme).toContain("5 sofas");
    expect(fixtureReadme).toContain("published, draft, and archived");
    expect(fixtureReadme).toContain("source-only");
    expect(fixtureReadme).toContain("no source or render images");
    expect(fixtureReadme).toContain("PNG, JPEG, and WebP");
    expect(manifestExample.fabrics).toHaveLength(3);
    expect(manifestExample.sofas).toHaveLength(5);

    expect(
      new Set(manifestExample.sofas.map((sofa) => sofa.lifecycle_state)),
    ).toEqual(new Set(["published", "draft", "archived"]));
    expect(
      new Set(manifestExample.sofas.map((sofa) => sofa.render_coverage)),
    ).toEqual(new Set(["complete", "source-only", "none"]));
    expect(
      manifestExample.sofas.some((sofa) =>
        sofa.visual_positions.some((position) => position.skip_source_photo),
      ),
    ).toBe(true);

    for (const fabric of manifestExample.fabrics) {
      expect(fabric.swatch_image).toMatch(/^images\/fabrics\//);
      expect(fabric.ai_reference_image).toMatch(/^images\/fabrics\//);
    }

    for (const sofa of manifestExample.sofas) {
      expect(sofa.visual_positions.length).toBeGreaterThanOrEqual(
        sofa.render_coverage === "none" ? 1 : 2,
      );
      expect(sofa.fabric_slugs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("documents that reset seeds local admin fixtures automatically", () => {
    expect(localSupabaseGuide).toContain("pnpm supabase:reset");
    expect(localSupabaseGuide).toContain("seed:local:admin-fixtures");
    expect(localSupabaseGuide).toContain("seed:simulation-test:local-fixtures");
    expect(localSupabaseGuide).toContain("published, draft, and archived");
    expect(localSupabaseGuide).toContain("deterministic local fixture images");
    expect(localSupabaseGuide).toContain("fixtures/local-admin-catalog");
  });
});
