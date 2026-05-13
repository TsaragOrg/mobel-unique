import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  backfillCatalogImageVariants,
  formatBackfillFailure,
  parseBackfillArgs,
  resolveBackfillConnection,
} from "./backfill-catalog-image-variants.mjs";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function createFakeSupabase({ assets, links = [], variantAssets = [] } = {}) {
  const requests = [];
  const storedLinks = [...links];
  const storedVariantAssets = [...variantAssets];

  const fetchImpl = async (url, init = {}) => {
    const requestUrl = String(url);
    const method = init.method ?? "GET";
    requests.push({
      body: init.body,
      headers: init.headers,
      method,
      url: requestUrl,
    });

    if (
      requestUrl.includes("/rest/v1/storage_assets?") &&
      requestUrl.includes("asset_kind=in.")
    ) {
      const limit = Number(
        requestUrl.match(/[?&]limit=([^&]+)/)?.[1] ?? assets.length,
      );
      const offset = Number(requestUrl.match(/[?&]offset=([^&]+)/)?.[1] ?? 0);
      const requestedAssetKinds = requestUrl
        .match(/asset_kind=in\.\(([^)]*)\)/)?.[1]
        ?.split(",");
      const matchingAssets = requestedAssetKinds
        ? assets.filter((asset) =>
            requestedAssetKinds.includes(asset.asset_kind),
          )
        : assets;

      if (requestUrl.includes("id=eq.")) {
        const assetId = decodeURIComponent(
          requestUrl.match(/id=eq\.([^&]+)/)?.[1] ?? "",
        );
        return json(matchingAssets.filter((asset) => asset.id === assetId));
      }

      return json(matchingAssets.slice(offset, offset + limit));
    }

    if (
      requestUrl.includes("/rest/v1/storage_assets?") &&
      requestUrl.includes("id=in.")
    ) {
      return json(storedVariantAssets);
    }

    if (
      requestUrl.includes("/rest/v1/storage_asset_variants?") &&
      method === "GET"
    ) {
      const originalAssetId = decodeURIComponent(
        requestUrl.match(/original_asset_id=eq\.([^&]+)/)?.[1] ?? "",
      );
      return json(
        storedLinks.filter(
          (link) => link.original_asset_id === originalAssetId,
        ),
      );
    }

    if (requestUrl.includes("/storage/v1/object/") && method === "GET") {
      return new Response(PNG_BYTES, {
        headers: {
          "Content-Type": "image/png",
        },
      });
    }

    if (requestUrl.includes("/storage/v1/object/") && method === "POST") {
      return json({
        Key: requestUrl.split("/storage/v1/object/")[1],
      });
    }

    if (requestUrl.includes("/rest/v1/storage_assets") && method === "POST") {
      const body = JSON.parse(init.body);
      storedVariantAssets.push(...body);
      return json(body);
    }

    if (
      requestUrl.includes("/rest/v1/storage_asset_variants") &&
      method === "POST"
    ) {
      const body = JSON.parse(init.body);
      storedLinks.push(...body);
      return json(body);
    }

    return json({}, 404);
  };

  return {
    fetchImpl,
    requests,
    storedLinks,
    storedVariantAssets,
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function createAsset(overrides = {}) {
  return {
    asset_kind: "sofa_source_photo",
    bucket_id: "catalog-private-assets",
    content_type: "image/png",
    height_px: 1000,
    id: "00000000-0000-4000-8000-000000000101",
    lifecycle_state: "active",
    object_path: "source/original.png",
    visibility: "private",
    width_px: 1600,
    ...overrides,
  };
}

async function fakeGenerateVariants(input = {}) {
  const variantKinds = input.variantKinds ?? ["small", "medium"];
  const variants = {
    medium: {
      bytes: new Uint8Array([2, 2, 2]),
      contentType: "image/jpeg",
      heightPx: 800,
      widthPx: 1280,
    },
    small: {
      bytes: new Uint8Array([1, 1, 1]),
      contentType: "image/jpeg",
      heightPx: 200,
      widthPx: 320,
    },
    swatch_small: {
      bytes: new Uint8Array([3, 3, 3]),
      contentType: "image/png",
      heightPx: 96,
      widthPx: 96,
    },
  };

  return Object.fromEntries(
    variantKinds.map((variantKind) => [variantKind, variants[variantKind]]),
  );
}

describe("catalog image variant backfill script", () => {
  it("parses dry-run, limit, and selected asset options", () => {
    expect(
      parseBackfillArgs([
        "--",
        "--dry-run",
        "--environment",
        "dev",
        "--page-size",
        "25",
        "--scope",
        "swatches",
        "--limit",
        "5",
        "--asset-id",
        "00000000-0000-4000-8000-000000000101",
      ]),
    ).toMatchObject({
      assetId: "00000000-0000-4000-8000-000000000101",
      dryRun: true,
      environment: "dev",
      limit: 5,
      pageSize: 25,
      scope: "swatches",
    });
  });

  it("rejects unknown backfill scopes", () => {
    expect(() => parseBackfillArgs(["--scope", "everything"])).toThrow(
      "--scope must be all, renders, or swatches",
    );
  });

  it("resolves DEV credentials from DEV-only variables", () => {
    expect(
      resolveBackfillConnection({
        env: {
          SUPABASE_DEV_SERVICE_ROLE_KEY: "dev-service-role",
          SUPABASE_DEV_URL: "https://dev-project.supabase.co",
          SUPABASE_PROD_SERVICE_ROLE_KEY: "prod-service-role",
          SUPABASE_PROD_URL: "https://prod-project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "generic-service-role",
          SUPABASE_URL: "https://generic.supabase.co",
        },
        options: parseBackfillArgs(["--environment", "dev"]),
      }),
    ).toEqual({
      environment: "dev",
      serviceRoleKey: "dev-service-role",
      supabaseUrl: "https://dev-project.supabase.co",
    });
  });

  it("requires an explicit confirmation before writing to PROD", () => {
    expect(() =>
      resolveBackfillConnection({
        env: {
          SUPABASE_PROD_SERVICE_ROLE_KEY: "prod-service-role",
          SUPABASE_PROD_URL: "https://prod-project.supabase.co",
        },
        options: parseBackfillArgs(["--environment", "prod"]),
      }),
    ).toThrow("--confirm-prod is required");

    expect(() =>
      resolveBackfillConnection({
        env: {
          SUPABASE_PROD_SERVICE_ROLE_KEY: "prod-service-role",
          SUPABASE_PROD_URL: "https://prod-project.supabase.co",
        },
        options: parseBackfillArgs(["--environment", "prod", "--dry-run"]),
      }),
    ).not.toThrow();
  });

  it("reports missing variants without writing anything during dry-run", async () => {
    const fake = createFakeSupabase({
      assets: [createAsset()],
    });

    const result = await backfillCatalogImageVariants({
      dryRun: true,
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(result).toMatchObject({
      assetsScanned: 1,
      variantsCreated: 0,
      variantsPlanned: 2,
    });
    expect(fake.requests.some((request) => request.method === "POST")).toBe(
      false,
    );
  });

  it("plans one swatch small variant for public fabric swatches during dry-run", async () => {
    const swatchAsset = createAsset({
      asset_kind: "fabric_swatch_public",
      bucket_id: "catalog-public-assets",
      object_path: "fabrics/boucle/swatch.png",
      visibility: "public",
    });
    const fake = createFakeSupabase({
      assets: [swatchAsset],
    });

    const result = await backfillCatalogImageVariants({
      dryRun: true,
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(result).toMatchObject({
      assetsScanned: 1,
      variantsCreated: 0,
      variantsPlanned: 1,
    });
    expect(
      fake.requests.some((request) =>
        request.url.includes("fabric_swatch_public"),
      ),
    ).toBe(true);
    expect(fake.requests.some((request) => request.method === "POST")).toBe(
      false,
    );
  });

  it("can scope a dry-run to public fabric swatches only", async () => {
    const renderAsset = createAsset({
      id: "00000000-0000-4000-8000-000000000101",
    });
    const swatchAsset = createAsset({
      asset_kind: "fabric_swatch_public",
      bucket_id: "catalog-public-assets",
      id: "00000000-0000-4000-8000-000000000102",
      object_path: "fabrics/boucle/swatch.png",
      visibility: "public",
    });
    const fake = createFakeSupabase({
      assets: [renderAsset, swatchAsset],
    });

    const result = await backfillCatalogImageVariants({
      dryRun: true,
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      scope: "swatches",
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(result).toMatchObject({
      assetsScanned: 1,
      variantsPlanned: 1,
    });
    expect(fake.requests[0].url).toContain(
      "asset_kind=in.(fabric_swatch_public)",
    );
    expect(fake.requests[0].url).not.toContain("published_sofa_render");
  });

  it("skips assets that already have small and medium variant links", async () => {
    const original = createAsset();
    const fake = createFakeSupabase({
      assets: [original],
      links: [
        {
          original_asset_id: original.id,
          variant_asset_id: "00000000-0000-4000-8000-000000000201",
          variant_kind: "small",
        },
        {
          original_asset_id: original.id,
          variant_asset_id: "00000000-0000-4000-8000-000000000202",
          variant_kind: "medium",
        },
      ],
    });

    const result = await backfillCatalogImageVariants({
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(result).toMatchObject({
      assetsSkipped: 1,
      variantsCreated: 0,
    });
    expect(
      fake.requests.some((request) =>
        request.url.includes("/storage/v1/object/catalog-private-assets/"),
      ),
    ).toBe(false);
  });

  it("backfills only the selected asset and preserves public/private buckets", async () => {
    const privateAsset = createAsset({
      id: "00000000-0000-4000-8000-000000000101",
      object_path: "private/original.png",
    });
    const publicAsset = createAsset({
      asset_kind: "published_sofa_render",
      bucket_id: "catalog-public-assets",
      id: "00000000-0000-4000-8000-000000000102",
      object_path: "public/original.png",
      visibility: "public",
    });
    const fake = createFakeSupabase({
      assets: [privateAsset, publicAsset],
    });
    let nextId = 300;

    const result = await backfillCatalogImageVariants({
      assetId: publicAsset.id,
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      idGenerator: () =>
        `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(result).toMatchObject({
      assetsScanned: 1,
      variantsCreated: 2,
    });
    expect(fake.storedVariantAssets).toHaveLength(2);
    expect(fake.storedVariantAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          asset_kind: "published_sofa_render_variant",
          bucket_id: "catalog-public-assets",
          visibility: "public",
        }),
      ]),
    );
    expect(
      fake.storedVariantAssets.some(
        (asset) => asset.bucket_id === "catalog-private-assets",
      ),
    ).toBe(false);
    expect(
      fake.storedLinks.some((link) => link.variant_kind === "swatch_small"),
    ).toBe(false);
  });

  it("adds long-lived cache metadata only to public Storage variant uploads", async () => {
    const privateAsset = createAsset({
      id: "00000000-0000-4000-8000-000000000101",
      object_path: "private/original.png",
    });
    const publicAsset = createAsset({
      asset_kind: "published_sofa_render",
      bucket_id: "catalog-public-assets",
      id: "00000000-0000-4000-8000-000000000102",
      object_path: "public/original.png",
      visibility: "public",
    });
    const fake = createFakeSupabase({
      assets: [privateAsset, publicAsset],
    });
    let nextId = 300;

    await backfillCatalogImageVariants({
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      idGenerator: () =>
        `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    const publicUploadRequests = fake.requests.filter(
      (request) =>
        request.method === "POST" &&
        request.url.includes("/storage/v1/object/catalog-public-assets/"),
    );
    const privateUploadRequests = fake.requests.filter(
      (request) =>
        request.method === "POST" &&
        request.url.includes("/storage/v1/object/catalog-private-assets/"),
    );

    expect(publicUploadRequests).toHaveLength(2);
    expect(privateUploadRequests).toHaveLength(2);
    expect(
      publicUploadRequests.every(
        (request) =>
          request.headers?.["cache-control"] === "max-age=31536000",
      ),
    ).toBe(true);
    expect(
      privateUploadRequests.some(
        (request) =>
          request.headers?.["cache-control"] === "max-age=31536000",
      ),
    ).toBe(false);
  });

  it("creates only a swatch small variant for public fabric swatches", async () => {
    const swatchAsset = createAsset({
      asset_kind: "fabric_swatch_public",
      bucket_id: "catalog-public-assets",
      object_path: "fabrics/boucle/swatch.png",
      visibility: "public",
    });
    const fake = createFakeSupabase({
      assets: [swatchAsset],
    });
    let nextId = 300;

    const result = await backfillCatalogImageVariants({
      assetId: swatchAsset.id,
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      idGenerator: () =>
        `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(result).toMatchObject({
      assetsScanned: 1,
      variantsCreated: 1,
    });
    expect(fake.storedLinks).toEqual([
      expect.objectContaining({
        original_asset_id: swatchAsset.id,
        variant_kind: "swatch_small",
      }),
    ]);
    expect(fake.storedVariantAssets).toEqual([
      expect.objectContaining({
        asset_kind: "fabric_swatch_public_variant",
        bucket_id: "catalog-public-assets",
        object_path: expect.stringContaining("/swatch_small/"),
        visibility: "public",
      }),
    ]);
  });

  it("paginates candidate assets so later missing variants are reachable", async () => {
    const firstAsset = createAsset({
      id: "00000000-0000-4000-8000-000000000101",
    });
    const secondAsset = createAsset({
      id: "00000000-0000-4000-8000-000000000102",
      object_path: "source/second.png",
    });
    const fake = createFakeSupabase({
      assets: [firstAsset, secondAsset],
      links: [
        {
          original_asset_id: firstAsset.id,
          variant_asset_id: "00000000-0000-4000-8000-000000000201",
          variant_kind: "small",
        },
        {
          original_asset_id: firstAsset.id,
          variant_asset_id: "00000000-0000-4000-8000-000000000202",
          variant_kind: "medium",
        },
      ],
    });
    let nextId = 300;

    const result = await backfillCatalogImageVariants({
      fetchImpl: fake.fetchImpl,
      generateVariants: fakeGenerateVariants,
      idGenerator: () =>
        `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      pageSize: 1,
      serviceRoleKey: "service-role",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(result).toMatchObject({
      assetsScanned: 2,
      assetsSkipped: 1,
      variantsCreated: 2,
    });
    expect(fake.storedLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          original_asset_id: secondAsset.id,
          variant_kind: "small",
        }),
        expect.objectContaining({
          original_asset_id: secondAsset.id,
          variant_kind: "medium",
        }),
      ]),
    );
  });

  it("redacts service credentials from failure output", () => {
    expect(
      formatBackfillFailure(
        new Error("request failed for service-role-secret"),
        "service-role-secret",
      ),
    ).toBe(
      "FAIL catalog image variant backfill: request failed for [redacted]",
    );
  });

  it("wires explicit local, DEV, and PROD batch commands", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["catalog:variants:backfill:local"]).toContain(
      "--environment local",
    );
    expect(
      packageJson.scripts["catalog:variants:backfill:dev:dry-run"],
    ).toContain("--environment dev --dry-run");
    expect(packageJson.scripts["catalog:variants:backfill:dev"]).toContain(
      "--environment dev",
    );
    expect(
      packageJson.scripts["catalog:variants:backfill:prod:dry-run"],
    ).toContain("--environment prod --dry-run");
    expect(packageJson.scripts["catalog:variants:backfill:prod"]).toContain(
      "--environment prod --confirm-prod",
    );
    expect(
      packageJson.scripts["catalog:swatches:backfill:dev:dry-run"],
    ).toContain("--environment dev --scope swatches --page-size 25 --dry-run");
    expect(packageJson.scripts["catalog:swatches:backfill:dev"]).toContain(
      "--environment dev --scope swatches --page-size 25",
    );
    expect(
      packageJson.scripts["catalog:swatches:backfill:prod:dry-run"],
    ).toContain("--environment prod --scope swatches --page-size 25 --dry-run");
    expect(packageJson.scripts["catalog:swatches:backfill:prod"]).toContain(
      "--environment prod --scope swatches --page-size 25 --confirm-prod",
    );
  });
});
