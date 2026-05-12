import { describe, expect, it } from "vitest";
import {
  buildPublicStorageUrl,
  decodeCatalogCursor,
  encodeCatalogCursor,
  getPublicSofaDetail,
  listPublicCatalog,
  parseCatalogListQuery,
  type PublicCatalogStore,
} from "./public-catalog";

describe("public catalog helpers", () => {
  it("parses catalog list query parameters with unique safe tags", () => {
    const result = parseCatalogListQuery(
      new URL(
        "http://localhost/api/public/catalog?tag=corner&tag=corner&tag=3-seats&tag=bad/value&limit=200",
      ),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        cursor: null,
        limit: 48,
        tags: ["corner", "3-seats"],
      },
    });
  });

  it("rejects malformed catalog cursors", () => {
    const result = parseCatalogListQuery(
      new URL("http://localhost/api/public/catalog?cursor=not-a-cursor"),
    );

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: {
        code: "INVALID_CURSOR",
      },
    });
  });

  it("round-trips opaque catalog cursors", () => {
    const cursor = {
      created_at: "2026-04-28T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000401",
      manual_public_order: null,
    };

    const encoded = encodeCatalogCursor(cursor);

    expect(encoded).not.toContain(cursor.id);
    expect(decodeCatalogCursor(encoded)).toEqual(cursor);
  });

  it("builds stable public storage URLs without returning raw object paths", () => {
    expect(
      buildPublicStorageUrl(
        "http://127.0.0.1:54321/",
        "catalog/sofas/canape angle/front render.png",
      ),
    ).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/catalog-public-assets/catalog/sofas/canape%20angle/front%20render.png",
    );
  });

  it("shapes catalog cards with explicit medium render delivery fields", async () => {
    const result = await listPublicCatalog(createDeliveryStore(), {
      cursor: null,
      limit: 12,
      tags: [],
    });

    expect(result.items[0]).toMatchObject({
      default_render_medium_content_type: "image/jpeg",
      default_render_medium_height_px: 960,
      default_render_medium_width_px: 1280,
    });
    expect(result.items[0].default_render_medium_url).toContain(
      "front-medium.jpg",
    );
    expect(result.items[0].default_render_url).toBe(
      result.items[0].default_render_medium_url,
    );
    expect(JSON.stringify(result)).not.toContain("catalog-private-assets");
  });

  it("shapes catalog cards with embedded fabric preview data", async () => {
    const result = await listPublicCatalog(createDeliveryStore(), {
      cursor: null,
      limit: 12,
      tags: [],
    });

    expect(result.items[0].fabrics).toEqual([
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000501",
        public_name: "Fabric",
        public_order: 1,
        swatch_small_content_type: "image/jpeg",
        swatch_small_height_px: 48,
        swatch_small_width_px: 96,
        render_medium_content_type: "image/jpeg",
        render_medium_height_px: 960,
        render_medium_width_px: 1280,
      }),
    ]);
    expect(result.items[0].fabrics[0].swatch_small_url).toContain(
      "catalog/fabrics/fabric/swatch-small.jpg",
    );
    expect(result.items[0].fabrics[0].render_medium_url).toContain(
      "catalog/sofas/test/front-medium.jpg",
    );
    expect(JSON.stringify(result.items[0])).not.toContain(
      "catalog-private-assets",
    );
    expect(JSON.stringify(result.items[0])).not.toContain("object_path");
  });

  it("shapes sofa detail renders with explicit original delivery fields", async () => {
    const result = await getPublicSofaDetail(
      createDeliveryStore(),
      "canape-test",
    );

    expect(result.renders[0]).toMatchObject({
      render_medium_content_type: "image/jpeg",
      render_medium_height_px: 960,
      render_medium_width_px: 1280,
      render_original_content_type: "image/png",
      render_original_height_px: 1200,
      render_original_width_px: 1600,
    });
    expect(result.renders[0].render_medium_url).toContain("front-medium.jpg");
    expect(result.renders[0].render_original_url).toContain("front.png");
    expect(result.renders[0].render_original_url).not.toContain(
      "front-medium.jpg",
    );
    expect(result.renders[0].render_url).toBe(
      result.renders[0].render_original_url,
    );
  });

  it("shapes sofa detail fabrics with canonical and small swatch URLs", async () => {
    const result = await getPublicSofaDetail(
      createDeliveryStore(),
      "canape-test",
    );

    expect(result.fabrics[0]).toMatchObject({
      swatch_small_content_type: "image/jpeg",
      swatch_small_height_px: 48,
      swatch_small_width_px: 96,
    });
    expect(result.fabrics[0].swatch_url).toContain(
      "catalog/fabrics/fabric/swatch.png",
    );
    expect(result.fabrics[0].swatch_small_url).toContain(
      "catalog/fabrics/fabric/swatch-small.jpg",
    );
    expect(JSON.stringify(result.fabrics[0])).not.toContain(
      "catalog-private-assets",
    );
    expect(JSON.stringify(result.fabrics[0])).not.toContain("object_path");
  });
});

function createDeliveryStore(): PublicCatalogStore {
  return {
    publicAssetBaseUrl: "http://127.0.0.1:54321",
    async findUnavailableSofaBySlug() {
      return null;
    },
    async listPublicFabrics() {
      return [
        {
          id: "00000000-0000-4000-8000-000000000501",
          is_premium: false,
          public_name: "Fabric",
          public_order: 1,
          private_debug_path: "catalog-private-assets/fabric/swatch.png",
          public_swatch_small_content_type: "image/jpeg",
          public_swatch_small_height_px: 48,
          public_swatch_small_object_path:
            "catalog/fabrics/fabric/swatch-small.jpg",
          public_swatch_small_width_px: 96,
          public_swatch_object_path: "catalog/fabrics/fabric/swatch.png",
          sofa_id: "00000000-0000-4000-8000-000000000401",
        },
      ];
    },
    async listPublicRenderCells() {
      return [
        {
          fabric_id: "00000000-0000-4000-8000-000000000501",
          public_render_content_type: "image/jpeg",
          public_render_height_px: 960,
          public_render_object_path: "catalog/sofas/test/front-medium.jpg",
          public_render_width_px: 1280,
          render_cell_id: "00000000-0000-4000-8000-000000000701",
          render_medium_content_type: "image/jpeg",
          render_medium_height_px: 960,
          render_medium_object_path: "catalog/sofas/test/front-medium.jpg",
          render_medium_width_px: 1280,
          render_original_content_type: "image/png",
          render_original_height_px: 1200,
          render_original_object_path: "catalog/sofas/test/front.png",
          render_original_width_px: 1600,
          sofa_id: "00000000-0000-4000-8000-000000000401",
          visual_matrix_column_id: "00000000-0000-4000-8000-000000000601",
        },
      ];
    },
    async listPublicSofaTags() {
      return [];
    },
    async listPublicSofas() {
      return [
        {
          created_at: "2026-04-28T10:00:00.000Z",
          id: "00000000-0000-4000-8000-000000000401",
          public_name: "Canape test",
          public_slug: "canape-test",
        },
      ];
    },
    async listPublicVisualPositions() {
      return [
        {
          id: "00000000-0000-4000-8000-000000000601",
          public_label: "Front",
          sequence: 1,
          sofa_id: "00000000-0000-4000-8000-000000000401",
        },
      ];
    },
  };
}
