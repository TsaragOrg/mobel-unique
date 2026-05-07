import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminCatalogStore } from "./admin-catalog";

const variantMocks = vi.hoisted(() => ({
  ensureCatalogImageVariants: vi.fn(),
  resolveCatalogImageDeliveryAsset: vi.fn(),
}));

const ids = {
  asset: "00000000-0000-4000-8000-000000000501",
  candidate: "00000000-0000-4000-8000-000000000601",
  cell: "00000000-0000-4000-8000-000000000401",
  column: "00000000-0000-4000-8000-000000000301",
  fabric: "00000000-0000-4000-8000-000000000201",
  job: "00000000-0000-4000-8000-000000000701",
  sofa: "00000000-0000-4000-8000-000000000101",
};

const state = vi.hoisted(() => ({
  assetMode: "candidate" as "candidate" | "manual",
  updateCalls: [] as Array<{ payload: unknown; table: string }>,
}));

vi.mock("./catalog-image-variants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./catalog-image-variants")>();

  return {
    ...actual,
    ensureCatalogImageVariants: variantMocks.ensureCatalogImageVariants,
    resolveCatalogImageDeliveryAsset: variantMocks.resolveCatalogImageDeliveryAsset,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from,
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://storage.example/private.png" },
          error: null,
        })),
      })),
    },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.assetMode = "candidate";
  state.updateCalls = [];
  variantMocks.ensureCatalogImageVariants.mockResolvedValue({
    created: [],
    variants: {},
  });
  variantMocks.resolveCatalogImageDeliveryAsset.mockResolvedValue(candidateAsset);
});

describe("admin catalog store variant guards", () => {
  it("does not select a generated render candidate until small and medium variants exist", async () => {
    variantMocks.resolveCatalogImageDeliveryAsset.mockImplementation(
      async ({ variant }: { variant: string }) => {
        if (variant === "small") {
          return candidateAsset;
        }

        throw Object.assign(new Error("missing medium variant"), {
          code: "CATALOG_IMAGE_VARIANT_NOT_FOUND",
        });
      },
    );
    const store = createSupabaseAdminCatalogStore({
      ...process.env,
      ADMIN_UPLOAD_TOKEN_SECRET: "test-upload-token-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    const result = await store.useRenderCandidate(ids.candidate);

    expect(variantMocks.resolveCatalogImageDeliveryAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        originalAssetId: ids.asset,
        variant: "small",
      }),
    );
    expect(variantMocks.resolveCatalogImageDeliveryAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        originalAssetId: ids.asset,
        variant: "medium",
      }),
    );
    expect(result).toMatchObject({
      code: "FABRIC_RENDER_CANDIDATE_NOT_FOUND",
      message: "Fabric render candidate was not found.",
      status: 404,
    });
    expect(state.updateCalls).toEqual([]);
  });

  it("does not attach a manual render asset until small and medium variants exist", async () => {
    state.assetMode = "manual";
    variantMocks.resolveCatalogImageDeliveryAsset.mockImplementation(
      async ({ variant }: { variant: string }) => {
        if (variant === "small") {
          return manualRenderAsset;
        }

        throw Object.assign(new Error("missing medium variant"), {
          code: "CATALOG_IMAGE_VARIANT_NOT_FOUND",
        });
      },
    );
    const store = createSupabaseAdminCatalogStore({
      ...process.env,
      ADMIN_UPLOAD_TOKEN_SECRET: "test-upload-token-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    const result = await store.setManualRender(ids.cell, {
      asset_id: ids.asset,
    });

    expect(variantMocks.resolveCatalogImageDeliveryAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        originalAssetId: ids.asset,
        variant: "small",
      }),
    );
    expect(variantMocks.resolveCatalogImageDeliveryAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        originalAssetId: ids.asset,
        variant: "medium",
      }),
    );
    expect(result).toMatchObject({
      code: "MANUAL_RENDER_NOT_FOUND",
      message: "Manual render asset was not found.",
      status: 422,
    });
    expect(state.updateCalls).toEqual([]);
  });
});

const candidateAsset = {
  asset_kind: "fabric_render_candidate",
  bucket_id: "catalog-private-assets",
  byte_size: 1200,
  content_type: "image/png",
  height_px: 900,
  id: ids.asset,
  lifecycle_state: "active",
  object_path: "renders/sofa/fabric/column/candidates/job/output.png",
  visibility: "private",
  width_px: 1200,
};

const manualRenderAsset = {
  ...candidateAsset,
  asset_kind: "manual_render",
  object_path: `renders/${ids.cell}/manual-renders/manual.png`,
};

const candidate = {
  accepted_at: null,
  asset_id: ids.asset,
  created_at: "2026-05-07T10:00:00.000Z",
  fabric_id: ids.fabric,
  generation_mode: "initial",
  id: ids.candidate,
  job_id: ids.job,
  prompt_version: "v007",
  provider_model: "mock-fabric-render-v1",
  provider_name: "mock",
  render_cell_id: ids.cell,
  sofa_id: ids.sofa,
  visual_matrix_column_id: ids.column,
};

const renderCell = {
  accepted_fabric_render_candidate_id: null,
  current_private_asset_id: null,
  current_public_asset_id: null,
  fabric_id: ids.fabric,
  id: ids.cell,
  sofa_id: ids.sofa,
  source_photo_id: null,
  source_type: "manual_upload",
  updated_at: "2026-05-07T10:00:00.000Z",
  visual_matrix_column_id: ids.column,
};

function from(table: string) {
  const query: Record<string, unknown> = {};

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.update = vi.fn((payload: unknown) => {
    state.updateCalls.push({ payload, table });
    return query;
  });
  query.maybeSingle = vi.fn(async () => {
    if (table === "fabric_render_candidates") {
      return { data: candidate, error: null };
    }

    if (table === "sofa_render_cells") {
      return { data: renderCell, error: null };
    }

    if (table === "sofas") {
      return {
        data: {
          id: ids.sofa,
          lifecycle_state: "draft",
        },
        error: null,
      };
    }

    return { data: null, error: null };
  });
  query.single = vi.fn(async () => {
    if (table === "sofa_render_cells") {
      return {
        data: {
          ...renderCell,
          current_private_asset_id: ids.asset,
          source_type: "manual_upload",
        },
        error: null,
      };
    }

    return { data: null, error: null };
  });
  query.in = vi.fn(async () => {
    if (table === "storage_assets") {
      return {
        data: [state.assetMode === "manual" ? manualRenderAsset : candidateAsset],
        error: null,
      };
    }

    return { data: [], error: null };
  });

  return query;
}
