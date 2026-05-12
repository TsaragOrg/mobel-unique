import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./spec-0012-public-catalog-smoke.mjs", import.meta.url),
);

function runSmoke(env, nodeArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...nodeArgs, scriptPath], {
      env: {
        ...process.env,
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("close", (status) => {
      resolve({ status, stderr, stdout });
    });
  });
}

function createFetchMock({
  emptyCatalog = false,
  missingCatalogFabrics = false,
  missingSmallSwatch = false,
} = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "mobel-spec-0012-fetch-mock-"));
  const mockPath = join(cwd, "fetch-mock.mjs");

  writeFileSync(
    mockPath,
    `
const emptyCatalog = ${JSON.stringify(emptyCatalog)};
const missingCatalogFabrics = ${JSON.stringify(missingCatalogFabrics)};
const missingSmallSwatch = ${JSON.stringify(missingSmallSwatch)};

globalThis.fetch = async (url) => {
  const requestUrl = String(url);

  if (requestUrl.endsWith("/api/public/catalog/tags")) {
    return json({
      data: {
        items: emptyCatalog ? [] : [
          {
            public_label: "Angle",
            slug: "angle"
          }
        ]
      },
      meta: {}
    });
  }

  if (requestUrl.includes("/api/public/catalog?limit=1&cursor=")) {
    return json({
      data: {
        items: [],
        next_cursor: null
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/public/catalog?limit=1")) {
    return json({
      data: {
        items: emptyCatalog ? [] : [
          {
            default_fabric_id: "00000000-0000-4000-8000-000000000501",
            default_render_medium_content_type: "image/jpeg",
            default_render_medium_height_px: 960,
            default_render_medium_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/catalog/sofas/rivoli/front-medium.jpg",
            default_render_medium_width_px: 1280,
            default_render_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/catalog/sofas/rivoli/front-medium.jpg",
            default_visual_position_id: "00000000-0000-4000-8000-000000000601",
            ...(missingCatalogFabrics ? {} : {
              fabrics: [
                {
                  id: "00000000-0000-4000-8000-000000000501",
                  is_premium: false,
                  public_name: "BouclГ© ivoire",
                  public_order: 1,
                  render_medium_content_type: "image/jpeg",
                  render_medium_height_px: 960,
                  render_medium_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/catalog/sofas/rivoli/front-medium.jpg",
                  render_medium_width_px: 1280,
                  swatch_small_content_type: "image/png",
                  swatch_small_height_px: 96,
                  swatch_small_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/variants/00000000-0000-4000-8000-000000000701/swatch_small/00000000-0000-4000-8000-000000000702.png",
                  swatch_small_width_px: 96
                }
              ]
            }),
            dimensions: {
              depth_cm: 96,
              footprint_measurements: null,
              footprint_type: "rectangle",
              height_cm: 82,
              length_cm: 240
            },
            id: "00000000-0000-4000-8000-000000000401",
            public_description: "Fixture",
            public_name: "Canapé Rivoli",
            public_slug: "canape-rivoli",
            shopify_order_url: "https://shopify.example/products/canape-rivoli",
            tags: [
              {
                public_label: "Angle",
                slug: "angle"
              }
            ]
          }
        ],
        next_cursor: null
      },
      meta: {}
    });
  }

  if (requestUrl.endsWith("/api/public/sofas/canape-rivoli")) {
    return json({
      data: {
        defaults: {
          fabric_id: "00000000-0000-4000-8000-000000000501",
          visual_position_id: "00000000-0000-4000-8000-000000000601"
        },
        fabrics: [
          {
            id: "00000000-0000-4000-8000-000000000501",
            is_premium: false,
            public_name: "Bouclé ivoire",
            public_order: 1,
            ...(missingSmallSwatch ? {} : {
              swatch_small_content_type: "image/png",
              swatch_small_height_px: 96,
              swatch_small_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/variants/00000000-0000-4000-8000-000000000701/swatch_small/00000000-0000-4000-8000-000000000702.png",
              swatch_small_width_px: 96
            }),
            swatch_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/catalog/fabrics/boucle/swatch.png"
          }
        ],
        renders: [
          {
            fabric_id: "00000000-0000-4000-8000-000000000501",
            height_px: 1200,
            render_original_content_type: "image/png",
            render_original_height_px: 1200,
            render_original_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/catalog/sofas/rivoli/front.png",
            render_original_width_px: 1600,
            render_url: "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/catalog/sofas/rivoli/front.png",
            visual_position_id: "00000000-0000-4000-8000-000000000601",
            width_px: 1600
          }
        ],
        sofa: {
          dimensions: {
            depth_cm: 96,
            footprint_measurements: null,
            footprint_type: "rectangle",
            height_cm: 82,
            length_cm: 240
          },
          id: "00000000-0000-4000-8000-000000000401",
          public_description: "Fixture",
          public_name: "Canapé Rivoli",
          public_slug: "canape-rivoli",
          shopify_order_url: "https://shopify.example/products/canape-rivoli",
          tags: [
            {
              public_label: "Angle",
              slug: "angle"
            }
          ]
        },
        visual_positions: [
          {
            id: "00000000-0000-4000-8000-000000000601",
            public_label: "Face",
            sequence: 1
          }
        ]
      },
      meta: {}
    });
  }

  return json({}, {
    status: 404
  });
};

function json(body, options = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: options.status ?? 200
  });
}
`,
  );

  return pathToFileURL(mockPath).href;
}

describe("SPEC-0012 public catalog smoke script", () => {
  it("skips clearly when local web is not reachable", async () => {
    const result = await runSmoke({
      SPEC_0012_PUBLIC_CATALOG_SMOKE_TIMEOUT_MS: "250",
      SPEC_0012_PUBLIC_CATALOG_SMOKE_WEB_URL: "http://127.0.0.1:1",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP SPEC-0012 public catalog smoke");
    expect(result.stdout).toContain("pnpm dev:web");
  });

  it("skips clearly when no public catalog fixture exists", async () => {
    const result = await runSmoke(
      {
        SPEC_0012_PUBLIC_CATALOG_SMOKE_WEB_URL: "http://127.0.0.1:3000",
      },
      ["--import", createFetchMock({ emptyCatalog: true })],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP SPEC-0012 public catalog smoke");
    expect(result.stdout).toContain("no published public-usable sofa fixture");
  });

  it("passes when the public catalog and detail reads succeed", async () => {
    const result = await runSmoke(
      {
        SPEC_0012_PUBLIC_CATALOG_SMOKE_WEB_URL: "http://127.0.0.1:3000",
      },
      ["--import", createFetchMock()],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS SPEC-0012 public catalog smoke");
    expect(result.stdout).toContain("medium catalog render");
    expect(result.stdout).toContain("original sofa detail render");
    expect(result.stdout).toContain("swatch_small fabric swatch");
    expect(result.stdout).toContain("canape-rivoli");
  });

  it("fails when catalog items do not expose card fabric preview data", async () => {
    const result = await runSmoke(
      {
        SPEC_0012_PUBLIC_CATALOG_SMOKE_WEB_URL: "http://127.0.0.1:3000",
      },
      ["--import", createFetchMock({ missingCatalogFabrics: true })],
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("catalog item is missing fabrics");
  });

  it("fails when sofa detail fabrics do not expose swatch small delivery", async () => {
    const result = await runSmoke(
      {
        SPEC_0012_PUBLIC_CATALOG_SMOKE_WEB_URL: "http://127.0.0.1:3000",
      },
      ["--import", createFetchMock({ missingSmallSwatch: true })],
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("swatch_small_url");
  });
});
