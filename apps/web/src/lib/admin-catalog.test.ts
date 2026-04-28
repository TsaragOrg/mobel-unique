import { describe, expect, it } from "vitest";
import {
  buildPublicTagSlug,
  shapeFabricResponse,
  shapeSofaResponse,
  validateFabricCreatePayload,
  validateFabricPatchPayload,
  validateSofaFabricMutationPayload,
  validateSofaCreatePayload,
  validateSofaPatchPayload,
  validateTagMutationPayload,
  validateUploadCreatePayload,
} from "./admin-catalog";

const sofaRecord = {
  archived_at: null,
  created_at: "2026-04-28T10:00:00.000Z",
  depth_cm: 95,
  footprint_measurements: {
    width_cm: 220,
  },
  footprint_type: "straight",
  height_cm: 82,
  id: "00000000-0000-4000-8000-000000000101",
  internal_name: "Internal sofa",
  lifecycle_state: "draft",
  manual_public_order: 2,
  provider_key: "must-not-leak",
  public_description: "Public description",
  public_name: "Public sofa",
  public_slug: "public-sofa",
  raw_private_path: "catalog-private-assets/source.png",
  service_role_key: "must-not-leak",
  shopify_order_url: "https://shopify.example/products/public-sofa",
  sql: "select * from private_table",
  tags: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      public_label: "Convertible",
      slug: "convertible",
    },
  ],
  updated_at: "2026-04-28T10:05:00.000Z",
  length_cm: 220,
};

const swatchAsset = {
  asset_kind: "fabric_swatch_public",
  bucket_id: "catalog-public-assets",
  byte_size: 1200,
  content_type: "image/png",
  height_px: 256,
  id: "00000000-0000-4000-8000-000000000901",
  lifecycle_state: "active",
  object_path: "fabrics/fabric-id/swatches/swatch.png",
  provider_key: "must-not-leak",
  raw_private_path: "catalog-private-assets/private.png",
  service_role_key: "must-not-leak",
  visibility: "public",
  width_px: 256,
};

const aiReferenceAsset = {
  asset_kind: "fabric_ai_reference",
  bucket_id: "catalog-private-assets",
  byte_size: 2200,
  content_type: "image/jpeg",
  height_px: 1200,
  id: "00000000-0000-4000-8000-000000000902",
  lifecycle_state: "active",
  object_path: "fabrics/fabric-id/ai-reference/reference.jpg",
  provider_key: "must-not-leak",
  raw_private_path: "catalog-private-assets/reference.jpg",
  service_role_key: "must-not-leak",
  visibility: "private",
  width_px: 1600,
};

const fabricRecord = {
  ai_reference_asset: aiReferenceAsset,
  ai_reference_asset_id: aiReferenceAsset.id,
  archived_at: null,
  created_at: "2026-04-28T10:00:00.000Z",
  id: "00000000-0000-4000-8000-000000000903",
  internal_name: "Internal fabric",
  is_premium: true,
  lifecycle_state: "active",
  public_name: "Boucle ivoire",
  swatch_asset: swatchAsset,
  swatch_asset_id: swatchAsset.id,
  updated_at: "2026-04-28T10:05:00.000Z",
};

describe("admin catalog validation", () => {
  it("validates a draft sofa create payload", () => {
    const result = validateSofaCreatePayload({
      depth_cm: 95,
      height_cm: 82,
      internal_name: "  Internal sofa  ",
      length_cm: 220,
      manual_public_order: 1,
      public_name: "  Public sofa  ",
      tag_ids: ["00000000-0000-4000-8000-000000000201"],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        depth_cm: 95,
        height_cm: 82,
        internal_name: "Internal sofa",
        length_cm: 220,
        manual_public_order: 1,
        public_name: "Public sofa",
        tag_ids: ["00000000-0000-4000-8000-000000000201"],
      },
    });
  });

  it("rejects draft sofa create payloads without an internal name", () => {
    const result = validateSofaCreatePayload({
      public_name: "Public sofa",
    });

    expect(result).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: {
          fields: ["internal_name"],
        },
      },
      ok: false,
      status: 422,
    });
  });

  it("rejects forbidden admin and ecommerce fields", () => {
    const createResult = validateSofaCreatePayload({
      admin_notes: "private",
      checkout: true,
      created_by: "admin-user",
      internal_name: "Internal sofa",
      price: 1200,
      stock: 3,
    });
    const patchResult = validateSofaPatchPayload({
      dimension_visibility: "hidden",
      internal_name: "Updated sofa",
      published_by: "admin-user",
    });

    expect(createResult).toMatchObject({
      error: {
        code: "UNSUPPORTED_FIELD",
        details: {
          fields: ["admin_notes", "checkout", "created_by", "price", "stock"],
        },
      },
      ok: false,
      status: 400,
    });
    expect(patchResult).toMatchObject({
      error: {
        code: "UNSUPPORTED_FIELD",
        details: {
          fields: ["dimension_visibility", "published_by"],
        },
      },
      ok: false,
      status: 400,
    });
  });

  it("validates tag labels and generates customer-facing slugs", () => {
    const result = validateTagMutationPayload({
      public_label: "  Cuir épais & bleu  ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        public_label: "Cuir épais & bleu",
        slug: "cuir-epais-bleu",
      },
    });
    expect(buildPublicTagSlug("%%%")).toBe("tag");
  });

  it("validates fabric create and patch payloads", () => {
    const createResult = validateFabricCreatePayload({
      ai_reference_asset_id: aiReferenceAsset.id,
      internal_name: "  Internal fabric  ",
      is_premium: true,
      public_name: "  Boucle ivoire  ",
      swatch_asset_id: swatchAsset.id,
    });
    const patchResult = validateFabricPatchPayload({
      is_premium: false,
      public_name: "  Boucle naturel  ",
    });

    expect(createResult).toEqual({
      ok: true,
      value: {
        ai_reference_asset_id: aiReferenceAsset.id,
        internal_name: "Internal fabric",
        is_premium: true,
        public_name: "Boucle ivoire",
        swatch_asset_id: swatchAsset.id,
      },
    });
    expect(patchResult).toEqual({
      ok: true,
      value: {
        is_premium: false,
        public_name: "Boucle naturel",
      },
    });
  });

  it("rejects invalid fabric, upload, and assignment payloads", () => {
    expect(
      validateFabricCreatePayload({
        admin_notes: "private",
        internal_name: "",
        price: 100,
      }),
    ).toMatchObject({
      error: {
        code: "UNSUPPORTED_FIELD",
        details: {
          fields: ["admin_notes", "price"],
        },
      },
      ok: false,
      status: 400,
    });
    expect(
      validateUploadCreatePayload({
        byte_size: 1000,
        content_type: "application/pdf",
        purpose: "fabric_swatch",
      }),
    ).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: {
          fields: ["content_type"],
        },
      },
      ok: false,
      status: 422,
    });
    expect(
      validateSofaFabricMutationPayload({
        public_order: -1,
      }),
    ).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: {
          fields: ["public_order"],
        },
      },
      ok: false,
      status: 422,
    });
  });
});

describe("admin catalog response shaping", () => {
  it("returns only admin-safe sofa fields", () => {
    const response = shapeSofaResponse(sofaRecord);
    const serialized = JSON.stringify(response);

    expect(response).toEqual({
      created_at: "2026-04-28T10:00:00.000Z",
      depth_cm: 95,
      footprint_measurements: {
        width_cm: 220,
      },
      footprint_type: "straight",
      height_cm: 82,
      id: "00000000-0000-4000-8000-000000000101",
      internal_name: "Internal sofa",
      lifecycle_state: "draft",
      manual_public_order: 2,
      public_description: "Public description",
      public_name: "Public sofa",
      public_slug: "public-sofa",
      shopify_order_url: "https://shopify.example/products/public-sofa",
      tags: [
        {
          id: "00000000-0000-4000-8000-000000000201",
          public_label: "Convertible",
          slug: "convertible",
        },
      ],
      updated_at: "2026-04-28T10:05:00.000Z",
      length_cm: 220,
    });
    expect(serialized).not.toContain("service_role");
    expect(serialized).not.toContain("catalog-private-assets");
    expect(serialized).not.toContain("provider_key");
    expect(serialized).not.toContain("private_table");
  });

  it("returns only admin-safe fabric and asset fields", () => {
    const response = shapeFabricResponse(fabricRecord);
    const serialized = JSON.stringify(response);

    expect(response).toEqual({
      ai_reference_asset: {
        asset_kind: "fabric_ai_reference",
        byte_size: 2200,
        content_type: "image/jpeg",
        height_px: 1200,
        id: aiReferenceAsset.id,
        lifecycle_state: "active",
        visibility: "private",
        width_px: 1600,
      },
      ai_reference_asset_id: aiReferenceAsset.id,
      archived_at: null,
      created_at: "2026-04-28T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000903",
      internal_name: "Internal fabric",
      is_premium: true,
      lifecycle_state: "active",
      public_name: "Boucle ivoire",
      swatch_asset: {
        asset_kind: "fabric_swatch_public",
        byte_size: 1200,
        content_type: "image/png",
        height_px: 256,
        id: swatchAsset.id,
        lifecycle_state: "active",
        visibility: "public",
        width_px: 256,
      },
      swatch_asset_id: swatchAsset.id,
      updated_at: "2026-04-28T10:05:00.000Z",
    });
    expect(serialized).not.toContain("service_role");
    expect(serialized).not.toContain("object_path");
    expect(serialized).not.toContain("catalog-private-assets");
    expect(serialized).not.toContain("provider_key");
  });
});
