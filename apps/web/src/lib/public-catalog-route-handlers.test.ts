import { describe, expect, it } from "vitest";
import {
  handleGetPublicSofaRequest,
  handleListPublicCatalogRequest,
  handleListPublicCatalogTagsRequest,
  type PublicCatalogStore,
} from "./public-catalog-route-handlers";

const sofas = [
  {
    created_at: "2026-04-28T10:00:00.000Z",
    depth_cm: 96,
    footprint_measurements: null,
    footprint_type: "rectangle",
    height_cm: 82,
    id: "00000000-0000-4000-8000-000000000401",
    length_cm: 240,
    manual_public_order: 2,
    public_description: "Un canapé modulable pour le salon.",
    public_name: "Canapé Rivoli",
    public_slug: "canape-rivoli",
    shopify_order_url: "https://shopify.example/products/canape-rivoli",
  },
  {
    created_at: "2026-04-29T10:00:00.000Z",
    depth_cm: 90,
    footprint_measurements: null,
    footprint_type: "rectangle",
    height_cm: 78,
    id: "00000000-0000-4000-8000-000000000402",
    length_cm: 210,
    manual_public_order: 1,
    public_description: "Une ligne compacte.",
    public_name: "Canapé Marais",
    public_slug: "canape-marais",
    shopify_order_url: "https://shopify.example/products/canape-marais",
  },
  {
    created_at: "2026-04-29T11:00:00.000Z",
    depth_cm: null,
    footprint_measurements: null,
    footprint_type: null,
    height_cm: null,
    id: "00000000-0000-4000-8000-000000000403",
    length_cm: null,
    manual_public_order: null,
    public_description: "Incomplete sofa should stay hidden.",
    public_name: "Canapé Incomplet",
    public_slug: "canape-incomplet",
    shopify_order_url: "https://shopify.example/products/canape-incomplet",
  },
];

const tags = [
  {
    public_label: "Angle",
    slug: "angle",
    sofa_id: sofas[0].id,
  },
  {
    public_label: "Convertible",
    slug: "convertible",
    sofa_id: sofas[0].id,
  },
  {
    public_label: "Compact",
    slug: "compact",
    sofa_id: sofas[1].id,
  },
  {
    public_label: "Hidden",
    slug: "hidden",
    sofa_id: sofas[2].id,
  },
];

const fabrics = [
  {
    id: "00000000-0000-4000-8000-000000000501",
    is_premium: false,
    public_name: "Bouclé ivoire",
    public_order: 1,
    public_swatch_height_px: 256,
    public_swatch_object_path: "catalog/fabrics/boucle-ivoire/swatch.png",
    public_swatch_width_px: 256,
    sofa_id: sofas[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    is_premium: true,
    public_name: "Velours sauge",
    public_order: 2,
    public_swatch_height_px: 256,
    public_swatch_object_path: "catalog/fabrics/velours-sauge/swatch.png",
    public_swatch_width_px: 256,
    sofa_id: sofas[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000503",
    is_premium: false,
    public_name: "Lin naturel",
    public_order: 1,
    public_swatch_height_px: 256,
    public_swatch_object_path: "catalog/fabrics/lin-naturel/swatch.png",
    public_swatch_width_px: 256,
    sofa_id: sofas[1].id,
  },
];

const visualPositions = [
  {
    id: "00000000-0000-4000-8000-000000000601",
    public_label: "Face",
    sequence: 1,
    sofa_id: sofas[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000602",
    public_label: "Angle",
    sequence: 2,
    sofa_id: sofas[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000603",
    public_label: "Face",
    sequence: 1,
    sofa_id: sofas[1].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000604",
    public_label: "Face",
    sequence: 1,
    sofa_id: sofas[2].id,
  },
];

const renderCells = [
  {
    fabric_id: fabrics[0].id,
    public_render_height_px: 1200,
    public_render_object_path: "catalog/sofas/canape-rivoli/boucle/front.png",
    public_render_width_px: 1600,
    render_cell_id: "00000000-0000-4000-8000-000000000701",
    sofa_id: sofas[0].id,
    visual_matrix_column_id: visualPositions[0].id,
  },
  {
    fabric_id: fabrics[0].id,
    public_render_height_px: 1200,
    public_render_object_path: "catalog/sofas/canape-rivoli/boucle/angle.png",
    public_render_width_px: 1600,
    render_cell_id: "00000000-0000-4000-8000-000000000702",
    sofa_id: sofas[0].id,
    visual_matrix_column_id: visualPositions[1].id,
  },
  {
    fabric_id: fabrics[1].id,
    public_render_height_px: 1200,
    public_render_object_path: "catalog/sofas/canape-rivoli/sauge/front.png",
    public_render_width_px: 1600,
    render_cell_id: "00000000-0000-4000-8000-000000000703",
    sofa_id: sofas[0].id,
    visual_matrix_column_id: visualPositions[0].id,
  },
  {
    fabric_id: fabrics[1].id,
    public_render_height_px: 1200,
    public_render_object_path: "catalog/sofas/canape-rivoli/sauge/angle.png",
    public_render_width_px: 1600,
    render_cell_id: "00000000-0000-4000-8000-000000000704",
    sofa_id: sofas[0].id,
    visual_matrix_column_id: visualPositions[1].id,
  },
  {
    fabric_id: fabrics[2].id,
    public_render_height_px: 1200,
    public_render_object_path: "catalog/sofas/canape-marais/lin/front.png",
    public_render_width_px: 1600,
    render_cell_id: "00000000-0000-4000-8000-000000000705",
    sofa_id: sofas[1].id,
    visual_matrix_column_id: visualPositions[2].id,
  },
];

function createFakeStore(): PublicCatalogStore {
  return {
    publicAssetBaseUrl: "http://127.0.0.1:54321",
    async findUnavailableSofaBySlug(publicSlug) {
      if (publicSlug === "ancien-canape") {
        return {
          first_published_at: "2026-04-27T10:00:00.000Z",
          id: "00000000-0000-4000-8000-000000000404",
          lifecycle_state: "archived",
          public_slug: publicSlug,
        };
      }

      return null;
    },
    async listPublicFabrics() {
      return fabrics;
    },
    async listPublicRenderCells() {
      return renderCells;
    },
    async listPublicSofaTags() {
      return tags;
    },
    async listPublicSofas() {
      return sofas;
    },
    async listPublicVisualPositions() {
      return visualPositions;
    },
  };
}

describe("public catalog route handlers", () => {
  it("returns only tags used by public-usable sofas", async () => {
    const response = await handleListPublicCatalogTagsRequest({
      createStore: createFakeStore,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        items: [
          {
            public_label: "Angle",
            slug: "angle",
          },
          {
            public_label: "Compact",
            slug: "compact",
          },
          {
            public_label: "Convertible",
            slug: "convertible",
          },
        ],
      },
      meta: {},
    });
  });

  it("lists public catalog items with tag AND filters", async () => {
    const response = await handleListPublicCatalogRequest({
      createStore: createFakeStore,
      request: new Request(
        "http://localhost/api/public/catalog?tag=angle&tag=convertible",
      ),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      default_fabric_id: fabrics[0].id,
      default_visual_position_id: visualPositions[0].id,
      public_name: "Canapé Rivoli",
      public_slug: "canape-rivoli",
      tags: [
        {
          public_label: "Angle",
          slug: "angle",
        },
        {
          public_label: "Convertible",
          slug: "convertible",
        },
      ],
    });
    expect(body.data.items[0].default_render_url).toContain(
      "/storage/v1/object/public/catalog-public-assets/",
    );
    expect(JSON.stringify(body)).not.toContain("internal_name");
    expect(JSON.stringify(body)).not.toContain("public_render_object_path");
    expect(JSON.stringify(body)).not.toContain("catalog-private-assets");
  });

  it("paginates catalog results with opaque cursors", async () => {
    const firstResponse = await handleListPublicCatalogRequest({
      createStore: createFakeStore,
      request: new Request("http://localhost/api/public/catalog?limit=1"),
    });
    const firstBody = await firstResponse.json();

    expect(firstBody.data.items).toHaveLength(1);
    expect(firstBody.data.items[0].public_slug).toBe("canape-marais");
    expect(firstBody.data.next_cursor).toEqual(expect.any(String));
    expect(firstBody.data.next_cursor).not.toContain("canape-marais");

    const secondResponse = await handleListPublicCatalogRequest({
      createStore: createFakeStore,
      request: new Request(
        `http://localhost/api/public/catalog?limit=1&cursor=${firstBody.data.next_cursor}`,
      ),
    });
    const secondBody = await secondResponse.json();

    expect(secondBody.data.items).toHaveLength(1);
    expect(secondBody.data.items[0].public_slug).toBe("canape-rivoli");
    expect(secondBody.data.items[0].id).not.toBe(firstBody.data.items[0].id);
  });

  it("returns public sofa detail state with defaults and complete render matrix", async () => {
    const response = await handleGetPublicSofaRequest({
      createStore: createFakeStore,
      publicSlug: "canape-rivoli",
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.defaults).toEqual({
      fabric_id: fabrics[0].id,
      visual_position_id: visualPositions[0].id,
    });
    expect(body.data.fabrics).toHaveLength(2);
    expect(body.data.visual_positions).toHaveLength(2);
    expect(body.data.renders).toHaveLength(4);
    expect(body.data.renders[0]).toMatchObject({
      fabric_id: fabrics[0].id,
      visual_position_id: visualPositions[0].id,
    });
    expect(body.data.renders[0].render_url).toContain(
      "/storage/v1/object/public/catalog-public-assets/",
    );
    expect(JSON.stringify(body)).not.toContain("render_cell_id");
    expect(JSON.stringify(body)).not.toContain("object_path");
    expect(JSON.stringify(body)).not.toContain("service_role");
  });

  it("maps unknown and unavailable sofa slugs safely", async () => {
    const missing = await handleGetPublicSofaRequest({
      createStore: createFakeStore,
      publicSlug: "missing",
    });

    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      error: {
        code: "SOFA_NOT_FOUND",
      },
    });

    const unavailable = await handleGetPublicSofaRequest({
      createStore: createFakeStore,
      publicSlug: "ancien-canape",
    });

    expect(unavailable.status).toBe(410);
    await expect(unavailable.json()).resolves.toMatchObject({
      error: {
        code: "SOFA_UNAVAILABLE",
      },
    });
  });
});
