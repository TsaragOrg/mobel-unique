import { Blob as NodeBlob } from "node:buffer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMocks.createClient,
}));

import {
  buildPublicRenderAssetObjectPath,
  buildPublicTagSlug,
  createSupabaseAdminCatalogStore,
  isMissingFabricRenderJobRequestIdColumnError,
  shapeFabricRenderCandidateResponse,
  shapeFabricRenderJobResponse,
  shapeFabricResponse,
  shapeRenderCoverageResponse,
  shapeSofaResponse,
  shapeVisualMatrixColumnResponse,
  validateManualRenderMutationPayload,
  validateFabricRenderResumePayload,
  validateFabricRenderJobCreatePayload,
  validateFabricCreatePayload,
  validateFabricPatchPayload,
  validateSofaFabricMutationPayload,
  validateSofaCreatePayload,
  validateSofaPatchPayload,
  validateTagMutationPayload,
  validateUploadCreatePayload,
  validateVisualMatrixColumnCreatePayload,
  validateVisualMatrixColumnPatchPayload,
} from "./admin-catalog";

afterEach(() => {
  supabaseMocks.createClient.mockReset();
});

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
  price_cents: 129900,
  price_currency: "EUR",
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

const visualMatrixColumnRecord = {
  admin_label: "Front internal",
  created_at: "2026-04-28T10:00:00.000Z",
  current_source_photo: {
    asset: {
      ...aiReferenceAsset,
      asset_kind: "sofa_source_photo",
      id: "00000000-0000-4000-8000-000000000904",
      object_path: "sofas/private/source.png",
    },
    asset_id: "00000000-0000-4000-8000-000000000904",
    created_at: "2026-04-28T10:05:00.000Z",
    id: "00000000-0000-4000-8000-000000000905",
    original_fabric_id: fabricRecord.id,
    preview_url: "https://storage.example/signed/source-photo-preview",
    sofa_id: sofaRecord.id,
    updated_at: "2026-04-28T10:05:00.000Z",
    visual_matrix_column_id: "00000000-0000-4000-8000-000000000906",
  },
  current_source_photo_id: "00000000-0000-4000-8000-000000000905",
  deleted_at: null,
  id: "00000000-0000-4000-8000-000000000906",
  public_label: "Front",
  raw_private_path: "sofas/private/source.png",
  sequence: 1,
  service_role_key: "must-not-leak",
  sofa_id: sofaRecord.id,
  updated_at: "2026-04-28T10:05:00.000Z",
};

const fabricRenderJobRecord = {
  attempt_count: 0,
  completed_at: null,
  created_at: "2026-04-28T10:30:00.000Z",
  fabric_ai_reference_asset_id: aiReferenceAsset.id,
  fabric_id: fabricRecord.id,
  generation_mode: "initial",
  id: "00000000-0000-4000-8000-000000000907",
  last_error_message: "Safe provider error",
  max_attempts: 3,
  prompt_note: null,
  prompt_version: "v007",
  provider_key: "must-not-leak",
  queued_at: "2026-04-28T10:30:00.000Z",
  request_id: "00000000-0000-4000-8000-000000000917",
  refinement_source_asset_id: null,
  refine_prompt: null,
  render_cell_id: "00000000-0000-4000-8000-000000000908",
  service_role_key: "must-not-leak",
  sofa_id: sofaRecord.id,
  status: "queued",
  target_sofa_asset_id: "00000000-0000-4000-8000-000000000904",
  updated_at: "2026-04-28T10:30:00.000Z",
  visual_matrix_column_id: visualMatrixColumnRecord.id,
};

const fabricRenderCandidateRecord = {
  asset: {
    ...aiReferenceAsset,
    asset_kind: "fabric_render_candidate",
    byte_size: 2400,
    content_type: "image/png",
    height_px: 1200,
    id: "00000000-0000-4000-8000-000000000909",
    object_path:
      "renders/sofa-id/fabric-id/column-id/candidates/job-id/output.png",
    visibility: "private",
    width_px: 1600,
  },
  accepted_at: null,
  asset_id: "00000000-0000-4000-8000-000000000909",
  created_at: "2026-04-28T10:35:00.000Z",
  fabric_id: fabricRecord.id,
  generation_mode: "initial",
  id: "00000000-0000-4000-8000-000000000910",
  is_current: false,
  job_id: fabricRenderJobRecord.id,
  preview_url:
    "https://storage.example/signed/private-candidate-preview?token=short",
  prompt_version: "v007",
  provider_key: "must-not-leak",
  provider_model: "mock-fabric-render-v1",
  provider_name: "mock",
  raw_private_path: "catalog-private-assets/renders/private.png",
  render_cell_id: fabricRenderJobRecord.render_cell_id,
  service_role_key: "must-not-leak",
  sofa_id: sofaRecord.id,
  visual_matrix_column_id: visualMatrixColumnRecord.id,
};

describe("admin catalog validation", () => {
  it("keeps fabric render provider ownership out of the admin API", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/admin-catalog.ts"),
      "utf8",
    );

    expect(source).not.toContain("FABRIC_RENDER_PROVIDER");
    expect(source).not.toContain("FABRIC_RENDER_PROVIDER_MODEL");
    expect(source).not.toContain("resolveFabricRenderProviderConfig");
    expect(source).not.toContain("provider_model: providerModel");
    expect(source).not.toContain("provider_name: providerName");
    expect(source).not.toContain('.eq("provider_name"');
    expect(source).not.toContain('.eq("provider_model"');
  });

  it("creates request-scoped fabric render jobs and invokes the worker pump", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/admin-catalog.ts"),
      "utf8",
    );

    expect(source).toContain("const requestId = randomUUID()");
    expect(source).toContain("request_id: requestId");
    expect(source).toContain("invokeFabricRenderPump");
    expect(source).toContain("markFabricRenderRequestStartFailed");
    expect(source).toContain("markExpiredFabricRenderJobsForSofa");
    expect(source).toContain("Worker claim expired before manual resume");
    expect(source).toContain('mode: "pump"');
    expect(source).toContain("FABRIC_RENDER_WORKER_FUNCTION_URL");
    expect(source).toContain("FABRIC_RENDER_WORKER_INVOKE_SECRET");
    expect(source).not.toContain("fabric_render_admin_enqueue_job");
  });

  it("validates selected queued render cell resume payloads exclusively", () => {
    const renderCellId = "00000000-0000-4000-8000-000000000908";
    const requestId = "00000000-0000-4000-8000-000000000917";
    const sofaId = "00000000-0000-4000-8000-000000000101";

    const selectedCellResult = validateFabricRenderResumePayload({
      render_cell_id: renderCellId,
    });

    expect(selectedCellResult).toMatchObject({
      ok: true,
      value: {
        render_cell_id: renderCellId,
        request_id: null,
        sofa_id: null,
      },
    });

    for (const payload of [
      {
        render_cell_id: renderCellId,
        request_id: requestId,
      },
      {
        render_cell_id: renderCellId,
        sofa_id: sofaId,
      },
    ]) {
      const result = validateFabricRenderResumePayload(payload);

      expect(result).toMatchObject({
        error: {
          code: "VALIDATION_FAILED",
          details: {
            fields: expect.arrayContaining(Object.keys(payload)),
          },
        },
        ok: false,
        status: 422,
      });
    }
  });

  it("publishes public render originals and variants through one cleanup-aware flow", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/admin-catalog.ts"),
      "utf8",
    );

    expect(source).toContain("ensurePublicRenderAssetVariantsForPublication");
    expect(source).toContain("variant_object_paths");
    expect(source).toContain("variant_asset_ids");
    expect(source).toContain("removeUploadedPublicRenderCopies");
    expect(source).toContain("storage_asset_variants");
    expect(source).toContain("PUBLIC_CATALOG_IMAGE_CACHE_CONTROL_SECONDS");
    expect(source).toContain(
      "cacheControl: PUBLIC_CATALOG_IMAGE_CACHE_CONTROL_SECONDS",
    );
  });

  it("cleans public render originals and variants when unpublishing or archiving", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/admin-catalog.ts"),
      "utf8",
    );

    expect(source).toContain("collectPublicRenderAssetsForSofa");
    expect(source).toContain("deactivateAndRemovePublicRenderAssets");
    expect(source).toContain("admin_unpublish_sofa");
    expect(source).toContain("admin_archive_sofa");
  });

  it("creates or reuses swatch_small when completing fabric swatch uploads", async () => {
    const fakeSupabase = createFakeUploadSupabaseClient({
      variantLookup: {
        data: {
          variant_asset_id: "00000000-0000-4000-8000-000000000777",
        },
        error: null,
      },
    });
    supabaseMocks.createClient.mockReturnValue(fakeSupabase.client);
    const store = createSupabaseAdminCatalogStore(createStoreEnv());
    const upload = await store.createUpload({
      byte_size: 1200,
      content_type: "image/png",
      purpose: "fabric_swatch",
    });

    const result = await store.completeUpload(upload.upload_id as string);

    expect(result).toMatchObject({
      asset_kind: "fabric_swatch_public",
      visibility: "public",
    });
    expect(fakeSupabase.variantKinds).toEqual(["swatch_small"]);
  });

  it("returns long-lived cache metadata for public fabric swatch signed uploads only", async () => {
    const fakeSupabase = createFakeUploadSupabaseClient({
      variantLookup: {
        data: {
          variant_asset_id: "00000000-0000-4000-8000-000000000777",
        },
        error: null,
      },
    });
    supabaseMocks.createClient.mockReturnValue(fakeSupabase.client);
    const store = createSupabaseAdminCatalogStore(createStoreEnv());

    const swatchUpload = await store.createUpload({
      byte_size: 1200,
      content_type: "image/png",
      purpose: "fabric_swatch",
    });
    const aiReferenceUpload = await store.createUpload({
      byte_size: 1200,
      content_type: "image/png",
      purpose: "fabric_ai_reference",
    });

    expect(swatchUpload).toMatchObject({
      cache_control_seconds: "31536000",
    });
    expect(aiReferenceUpload).toMatchObject({
      cache_control_seconds: "3600",
    });
    expect(aiReferenceUpload).not.toMatchObject({
      cache_control_seconds: "31536000",
    });
  });

  it("fails safely when fabric swatch small variant creation fails", async () => {
    const fakeSupabase = createFakeUploadSupabaseClient({
      variantLookup: {
        data: null,
        error: {
          message: "variant lookup failed",
        },
      },
    });
    supabaseMocks.createClient.mockReturnValue(fakeSupabase.client);
    const store = createSupabaseAdminCatalogStore(createStoreEnv());
    const upload = await store.createUpload({
      byte_size: 1200,
      content_type: "image/png",
      purpose: "fabric_swatch",
    });

    const result = await store.completeUpload(upload.upload_id as string);

    expect(result).toMatchObject({
      code: "UPLOAD_VARIANTS_FAILED",
      status: 500,
    });
    expect(fakeSupabase.deletedAssetIds).toEqual([
      "00000000-0000-4000-8000-000000000601",
    ]);
  });

  it("keeps render upload variants limited to small and medium", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/admin-catalog.ts"),
      "utf8",
    );

    expect(source).toContain("CATALOG_RENDER_IMAGE_VARIANT_KINDS");
    expect(source).toContain("ensureFabricSwatchSmallVariant");
    expect(source).toContain("descriptor.purpose === \"fabric_swatch\"");
  });

  it("validates a draft sofa create payload", () => {
    const result = validateSofaCreatePayload({
      depth_cm: 95,
      height_cm: 82,
      internal_name: "  Internal sofa  ",
      length_cm: 220,
      manual_public_order: 1,
      price_cents: 129900,
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
        price_cents: 129900,
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

  it("rejects invalid sofa price cents", () => {
    for (const price_cents of [0, -1, 1299.5]) {
      expect(
        validateSofaCreatePayload({
          internal_name: "Internal sofa",
          price_cents,
        }),
      ).toMatchObject({
        error: {
          code: "VALIDATION_FAILED",
          details: {
            fields: ["price_cents"],
          },
        },
        ok: false,
        status: 422,
      });
    }
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

  it("validates visual matrix, source photo upload, and render job payloads", () => {
    expect(
      validateVisualMatrixColumnCreatePayload({
        admin_label: "  Front internal  ",
        public_label: null,
        sequence: 1,
      }),
    ).toEqual({
      ok: true,
      value: {
        admin_label: "Front internal",
        public_label: null,
        sequence: 1,
      },
    });
    expect(
      validateVisualMatrixColumnPatchPayload({
        admin_label: "  Front  ",
        source_original_fabric_id: fabricRecord.id,
      }),
    ).toEqual({
      ok: true,
      value: {
        admin_label: "Front",
        source_original_fabric_id: fabricRecord.id,
      },
    });
    expect(
      validateVisualMatrixColumnCreatePayload({
        sequence: 1,
        source_original_fabric_id: fabricRecord.id,
      }),
    ).toMatchObject({
      error: {
        code: "UNSUPPORTED_FIELD",
      },
      ok: false,
      status: 400,
    });
    expect(
      validateVisualMatrixColumnCreatePayload({
        sequence: 0,
        sql: "select 1",
      }),
    ).toMatchObject({
      error: {
        code: "UNSUPPORTED_FIELD",
      },
      ok: false,
      status: 400,
    });

    expect(
      validateUploadCreatePayload({
        byte_size: 1200,
        content_type: "image/png",
        original_fabric_id: fabricRecord.id,
        purpose: "sofa_source_photo",
        sofa_id: sofaRecord.id,
        visual_matrix_column_id: visualMatrixColumnRecord.id,
      }),
    ).toEqual({
      ok: true,
      value: {
        byte_size: 1200,
        content_type: "image/png",
        original_fabric_id: fabricRecord.id,
        purpose: "sofa_source_photo",
        sofa_id: sofaRecord.id,
        visual_matrix_column_id: visualMatrixColumnRecord.id,
      },
    });
    expect(
      validateUploadCreatePayload({
        byte_size: 1200,
        content_type: "image/png",
        purpose: "sofa_source_photo",
      }),
    ).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: {
          fields: ["sofa_id", "visual_matrix_column_id", "original_fabric_id"],
        },
      },
      ok: false,
      status: 422,
    });

    expect(
      validateFabricRenderJobCreatePayload({
        fabric_id: fabricRecord.id,
        generation_mode: "initial",
        prompt_note: "  Keep seams visible  ",
        sofa_id: sofaRecord.id,
        visual_matrix_column_id: visualMatrixColumnRecord.id,
      }),
    ).toEqual({
      ok: true,
      value: {
        fabric_id: fabricRecord.id,
        generation_mode: "initial",
        prompt_note: "Keep seams visible",
        sofa_id: sofaRecord.id,
        visual_matrix_column_id: visualMatrixColumnRecord.id,
      },
    });
    expect(
      validateFabricRenderJobCreatePayload({
        fabric_id: fabricRecord.id,
        generation_mode: "refine",
        prompt_note: null,
        refine_prompt: "  reduce wrinkles on the left arm  ",
        refinement_source_asset_id: fabricRenderCandidateRecord.asset_id,
        sofa_id: sofaRecord.id,
        visual_matrix_column_id: visualMatrixColumnRecord.id,
      }),
    ).toEqual({
      ok: true,
      value: {
        fabric_id: fabricRecord.id,
        generation_mode: "refine",
        prompt_note: null,
        refine_prompt: "reduce wrinkles on the left arm",
        refinement_source_asset_id: fabricRenderCandidateRecord.asset_id,
        sofa_id: sofaRecord.id,
        visual_matrix_column_id: visualMatrixColumnRecord.id,
      },
    });
    expect(
      validateFabricRenderJobCreatePayload({
        fabric_id: fabricRecord.id,
        generation_mode: "refine",
        prompt_note: "wrong place",
        refine_prompt: "try again",
        refinement_source_asset_id: fabricRenderCandidateRecord.asset_id,
        sofa_id: sofaRecord.id,
        visual_matrix_column_id: visualMatrixColumnRecord.id,
      }),
    ).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: {
          fields: ["prompt_note"],
        },
      },
      ok: false,
      status: 422,
    });
  });

  it("validates manual render upload and attachment payloads", () => {
    expect(
      validateUploadCreatePayload({
        byte_size: 1200,
        content_type: "image/png",
        purpose: "manual_render",
        render_cell_id: fabricRenderJobRecord.render_cell_id,
      }),
    ).toEqual({
      ok: true,
      value: {
        byte_size: 1200,
        content_type: "image/png",
        purpose: "manual_render",
        render_cell_id: fabricRenderJobRecord.render_cell_id,
      },
    });
    expect(
      validateUploadCreatePayload({
        byte_size: 1200,
        content_type: "image/png",
        purpose: "manual_render",
      }),
    ).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: {
          fields: ["render_cell_id"],
        },
      },
      ok: false,
      status: 422,
    });
    expect(
      validateManualRenderMutationPayload({
        asset_id: fabricRenderCandidateRecord.asset_id,
      }),
    ).toEqual({
      ok: true,
      value: {
        asset_id: fabricRenderCandidateRecord.asset_id,
      },
    });
  });

  it("validates upload content types by purpose", () => {
    for (const purpose of [
      "fabric_ai_reference",
      "sofa_source_photo",
      "manual_render",
    ] as const) {
      const payload: Record<string, unknown> = {
        byte_size: 1200,
        content_type: "image/webp",
        purpose,
      };

      if (purpose === "sofa_source_photo") {
        payload.original_fabric_id = fabricRecord.id;
        payload.sofa_id = sofaRecord.id;
        payload.visual_matrix_column_id = visualMatrixColumnRecord.id;
      }

      if (purpose === "manual_render") {
        payload.render_cell_id = fabricRenderJobRecord.render_cell_id;
      }

      const result = validateUploadCreatePayload(payload);

      expect(result).toMatchObject({
        error: {
          code: "VALIDATION_FAILED",
          details: {
            fields: ["content_type"],
          },
        },
        ok: false,
        status: 422,
      });
    }

    expect(
      validateUploadCreatePayload({
        byte_size: 1200,
        content_type: "image/webp",
        purpose: "fabric_swatch",
      }),
    ).toEqual({
      ok: true,
      value: {
        byte_size: 1200,
        content_type: "image/webp",
        purpose: "fabric_swatch",
      },
    });

    for (const contentType of ["image/jpeg", "image/png"] as const) {
      expect(
        validateUploadCreatePayload({
          byte_size: 1200,
          content_type: contentType,
          purpose: "manual_render",
          render_cell_id: fabricRenderJobRecord.render_cell_id,
        }),
      ).toEqual({
        ok: true,
        value: {
          byte_size: 1200,
          content_type: contentType,
          purpose: "manual_render",
          render_cell_id: fabricRenderJobRecord.render_cell_id,
        },
      });
    }
  });
});

describe("admin catalog response shaping", () => {
  it("detects local fabric render job schemas without request ids", () => {
    expect(
      isMissingFabricRenderJobRequestIdColumnError({
        code: "42703",
        message: "column fabric_render_jobs.request_id does not exist",
      }),
    ).toBe(true);

    expect(
      isMissingFabricRenderJobRequestIdColumnError({
        code: "42703",
        message: "column sofas.request_id does not exist",
      }),
    ).toBe(false);
  });

  it("returns only admin-safe sofa fields", () => {
    const response = shapeSofaResponse(sofaRecord);
    const serialized = JSON.stringify(response);

    expect(response).toEqual({
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
      price_cents: 129900,
      price_currency: "EUR",
      public_description: "Public description",
      public_name: "Public sofa",
      public_slug: "public-sofa",
      shopify_order_url: "https://shopify.example/products/public-sofa",
      source_photo_count: 0,
      source_photo_preview_asset_id: null,
      source_photo_preview_url: null,
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

  it("returns the source photo preview asset id for protected sofa list previews", () => {
    const previewAssetId = "00000000-0000-4000-8000-000000000904";
    const response = shapeSofaResponse({
      ...sofaRecord,
      source_photo_count: 1,
      source_photo_preview_asset_id: previewAssetId,
      source_photo_preview_url: null,
    });
    const serialized = JSON.stringify(response);

    expect(response.source_photo_preview_asset_id).toBe(previewAssetId);
    expect(serialized).not.toContain("catalog-private-assets");
    expect(serialized).not.toContain("service_role");
  });

  it("returns only admin-safe fabric and asset fields", () => {
    const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";

    try {
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
        swatch_preview_url:
          "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
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
      expect(
        shapeFabricResponse({ ...fabricRecord, swatch_asset: null }),
      ).toMatchObject({
        swatch_preview_url: null,
      });
      expect(serialized).not.toContain("service_role");
      expect(serialized).not.toContain("object_path");
      expect(serialized).not.toContain("catalog-private-assets");
      expect(serialized).not.toContain("provider_key");
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it("returns only admin-safe visual matrix, coverage, and job fields", () => {
    const columnResponse = shapeVisualMatrixColumnResponse(
      visualMatrixColumnRecord,
    );
    const jobResponse = shapeFabricRenderJobResponse(fabricRenderJobRecord);
    const coverageResponse = shapeRenderCoverageResponse({
      render_cells: [
        {
          blockers: ["ACTIVE_RENDER_JOB_EXISTS"],
          can_generate_initial: false,
          current_private_asset_id: "00000000-0000-4000-8000-000000000904",
          current_private_preview_url:
            "https://storage.example/current-private-preview",
          current_public_asset_id: null,
          fabric_id: fabricRecord.id,
          has_private_render: true,
          has_public_render: false,
          id: "00000000-0000-4000-8000-000000000908",
          candidate_count: 1,
          latest_job: fabricRenderJobRecord,
          object_path: "renders/private.png",
          sofa_id: sofaRecord.id,
          source_photo_id: "00000000-0000-4000-8000-000000000905",
          source_type: "source_photo",
          updated_at: "2026-04-28T10:30:00.000Z",
          visual_matrix_column_id: visualMatrixColumnRecord.id,
        },
      ],
      sofa_fabrics: [
        {
          assigned_at: "2026-04-28T10:05:00.000Z",
          fabric: fabricRecord,
          fabric_id: fabricRecord.id,
          public_order: 1,
          sofa_id: sofaRecord.id,
          updated_at: "2026-04-28T10:05:00.000Z",
        },
      ],
      sofa_id: sofaRecord.id,
      visual_matrix_columns: [visualMatrixColumnRecord],
    });
    const serialized = JSON.stringify({
      columnResponse,
      coverageResponse,
      jobResponse,
    });

    expect(columnResponse).toMatchObject({
      current_source_photo: {
        asset: {
          asset_kind: "sofa_source_photo",
          id: "00000000-0000-4000-8000-000000000904",
          visibility: "private",
        },
        preview_url: null,
      },
      id: visualMatrixColumnRecord.id,
      sequence: 1,
    });
    expect(jobResponse).toMatchObject({
      id: fabricRenderJobRecord.id,
      request_id: fabricRenderJobRecord.request_id,
      refinement_source_asset_id: null,
      refine_prompt: null,
      status: "queued",
    });
    expect(coverageResponse.render_cells[0]).toMatchObject({
      blockers: ["ACTIVE_RENDER_JOB_EXISTS"],
      candidate_count: 1,
      current_private_preview_url: null,
      latest_job: {
        id: fabricRenderJobRecord.id,
      },
    });
    expect(serialized).not.toContain("service_role");
    expect(serialized).not.toContain("signed/source-photo-preview");
    expect(serialized).not.toContain("object_path");
    expect(serialized).not.toContain("catalog-private-assets");
    expect(serialized).not.toContain("provider_key");
  });

  it("keeps render coverage cells scoped to current fabrics and columns", () => {
    const staleColumnId = "00000000-0000-4000-8000-000000000998";
    const removedFabricId = "00000000-0000-4000-8000-000000000999";
    const coverageResponse = shapeRenderCoverageResponse({
      render_cells: [
        {
          blockers: [],
          can_generate_initial: false,
          current_private_asset_id: "00000000-0000-4000-8000-000000000904",
          current_public_asset_id: null,
          fabric_id: fabricRecord.id,
          has_private_render: true,
          has_public_render: false,
          id: "00000000-0000-4000-8000-000000000908",
          candidate_count: 0,
          latest_job: null,
          sofa_id: sofaRecord.id,
          source_photo_id: "00000000-0000-4000-8000-000000000905",
          source_type: "source_photo",
          updated_at: "2026-04-28T10:30:00.000Z",
          visual_matrix_column_id: visualMatrixColumnRecord.id,
        },
        {
          blockers: ["MISSING_SOURCE_PHOTO"],
          can_generate_initial: false,
          current_private_asset_id: null,
          current_public_asset_id: null,
          fabric_id: fabricRecord.id,
          has_private_render: false,
          has_public_render: false,
          id: "00000000-0000-4000-8000-000000000918",
          candidate_count: 0,
          latest_job: null,
          sofa_id: sofaRecord.id,
          source_photo_id: null,
          source_type: "ai_generated",
          updated_at: "2026-04-28T10:30:00.000Z",
          visual_matrix_column_id: staleColumnId,
        },
        {
          blockers: ["MISSING_FABRIC_AI_REFERENCE"],
          can_generate_initial: false,
          current_private_asset_id: null,
          current_public_asset_id: null,
          fabric_id: removedFabricId,
          has_private_render: false,
          has_public_render: false,
          id: "00000000-0000-4000-8000-000000000928",
          candidate_count: 0,
          latest_job: null,
          sofa_id: sofaRecord.id,
          source_photo_id: null,
          source_type: "ai_generated",
          updated_at: "2026-04-28T10:30:00.000Z",
          visual_matrix_column_id: visualMatrixColumnRecord.id,
        },
      ],
      sofa_fabrics: [
        {
          assigned_at: "2026-04-28T10:05:00.000Z",
          fabric: fabricRecord,
          fabric_id: fabricRecord.id,
          public_order: 1,
          sofa_id: sofaRecord.id,
          updated_at: "2026-04-28T10:05:00.000Z",
        },
      ],
      sofa_id: sofaRecord.id,
      visual_matrix_columns: [visualMatrixColumnRecord],
    });

    expect(coverageResponse.render_cells).toHaveLength(1);
    expect(coverageResponse.render_cells[0]).toMatchObject({
      fabric_id: fabricRecord.id,
      id: "00000000-0000-4000-8000-000000000908",
      visual_matrix_column_id: visualMatrixColumnRecord.id,
    });
  });

  it("returns only admin-safe render candidate fields without private preview URLs", () => {
    const response = shapeFabricRenderCandidateResponse(
      fabricRenderCandidateRecord,
    );
    const serialized = JSON.stringify(response);

    expect(response).toEqual({
      accepted_at: null,
      asset: {
        asset_kind: "fabric_render_candidate",
        byte_size: 2400,
        content_type: "image/png",
        height_px: 1200,
        id: fabricRenderCandidateRecord.asset_id,
        lifecycle_state: "active",
        visibility: "private",
        width_px: 1600,
      },
      asset_id: fabricRenderCandidateRecord.asset_id,
      created_at: "2026-04-28T10:35:00.000Z",
      fabric_id: fabricRecord.id,
      generation_mode: "initial",
      id: fabricRenderCandidateRecord.id,
      is_current: false,
      job_id: fabricRenderJobRecord.id,
      preview_url: null,
      prompt_version: "v007",
      provider_model: "mock-fabric-render-v1",
      provider_name: "mock",
      render_cell_id: fabricRenderJobRecord.render_cell_id,
      sofa_id: sofaRecord.id,
      visual_matrix_column_id: visualMatrixColumnRecord.id,
    });
    expect(serialized).not.toContain("service_role");
    expect(serialized).not.toContain("object_path");
    expect(serialized).not.toContain("catalog-private-assets");
    expect(serialized).not.toContain("provider_key");
  });
});

describe("admin catalog publication helpers", () => {
  it("builds public render object paths without private bucket details", () => {
    const path = buildPublicRenderAssetObjectPath({
      contentType: "image/png",
      publicAssetId: "00000000-0000-4000-8000-000000000910",
      renderCellId: "00000000-0000-4000-8000-000000000908",
      sofaId: sofaRecord.id,
    });

    expect(path).toBe(
      "sofas/00000000-0000-4000-8000-000000000101/renders/00000000-0000-4000-8000-000000000908/00000000-0000-4000-8000-000000000910.png",
    );
    expect(path).not.toContain("catalog-private-assets");
  });
});

function createStoreEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ADMIN_UPLOAD_TOKEN_SECRET: "test-upload-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };
}

function createFakeUploadSupabaseClient(input: {
  variantLookup: {
    data: { variant_asset_id: string } | null;
    error: Record<string, unknown> | null;
  };
}) {
  const variantKinds: string[] = [];
  const deletedAssetIds: string[] = [];
  const insertedOriginalAsset = {
    asset_kind: "fabric_swatch_public",
    bucket_id: "catalog-public-assets",
    byte_size: 24,
    content_type: "image/png",
    height_px: 128,
    id: "00000000-0000-4000-8000-000000000601",
    lifecycle_state: "active",
    object_path: "fabrics/pending/swatches/original.png",
    visibility: "public",
    width_px: 256,
  };
  const existingVariantAsset = {
    ...insertedOriginalAsset,
    asset_kind: "fabric_swatch_public_variant",
    height_px: 48,
    id: input.variantLookup.data?.variant_asset_id,
    object_path:
      "variants/00000000-0000-4000-8000-000000000601/swatch_small/00000000-0000-4000-8000-000000000777.jpg",
    width_px: 96,
  };

  const client = {
    from(table: string) {
      return createFakeUploadQuery({
        deletedAssetIds,
        existingVariantAsset,
        insertedOriginalAsset,
        table,
        variantKinds,
        variantLookup: input.variantLookup,
      });
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn(async () => ({
          data: {
            signedUrl: "https://upload.example/fabric-swatch",
          },
          error: null,
        })),
        download: vi.fn(async () => ({
          data: new NodeBlob([
            createPngHeaderBytes({ heightPx: 128, widthPx: 256 }),
          ]),
          error: null,
        })),
        remove: vi.fn(async () => ({
          data: null,
          error: null,
        })),
        upload: vi.fn(async () => ({
          data: null,
          error: null,
        })),
      })),
    },
  };

  return {
    client,
    deletedAssetIds,
    variantKinds,
  };
}

function createFakeUploadQuery(input: {
  deletedAssetIds: string[];
  existingVariantAsset: Record<string, unknown>;
  insertedOriginalAsset: Record<string, unknown>;
  table: string;
  variantKinds: string[];
  variantLookup: {
    data: { variant_asset_id: string } | null;
    error: Record<string, unknown> | null;
  };
}) {
  const query = {
    eq: vi.fn((column: string, value: string) => {
      if (input.table === "storage_asset_variants" && column === "variant_kind") {
        input.variantKinds.push(value);
      }

      return query;
    }),
    in: vi.fn(async () => ({
      data:
        input.existingVariantAsset.id === undefined
          ? []
          : [input.existingVariantAsset],
      error: null,
    })),
    insert: vi.fn((asset: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            ...input.insertedOriginalAsset,
            ...asset,
            id: input.insertedOriginalAsset.id,
          },
          error: null,
        })),
      })),
    })),
    maybeSingle: vi.fn(async () => input.variantLookup),
    select: vi.fn(() => query),
    update: vi.fn(() => ({
      eq: vi.fn(async (_column: string, value: string) => {
        input.deletedAssetIds.push(value);

        return {
          data: null,
          error: null,
        };
      }),
    })),
    upsert: vi.fn(async () => ({
      data: null,
      error: null,
    })),
  };

  return query;
}

function createPngHeaderBytes(input: { heightPx: number; widthPx: number }) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  writeUint32Be(bytes, 16, input.widthPx);
  writeUint32Be(bytes, 20, input.heightPx);

  return bytes;
}

function writeUint32Be(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}
