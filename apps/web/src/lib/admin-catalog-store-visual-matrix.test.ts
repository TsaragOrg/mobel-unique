import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminCatalogStore } from "./admin-catalog";

const mocks = vi.hoisted(() => {
  const columnId = "00000000-0000-4000-8000-000000000501";
  const sofaId = "00000000-0000-4000-8000-000000000502";
  const sourcePhotoId = "00000000-0000-4000-8000-000000000503";
  const assetId = "00000000-0000-4000-8000-000000000504";
  const currentFabricId = "00000000-0000-4000-8000-000000000505";
  const nextFabricId = "00000000-0000-4000-8000-000000000506";

  const state = {
    updateCalls: [] as Array<{ payload: unknown; table: string }>,
    visualMatrixFetchCount: 0,
  };

  const column = {
    admin_label: "Front",
    created_at: "2026-05-04T10:00:00.000Z",
    current_source_photo_id: sourcePhotoId,
    deleted_at: null,
    id: columnId,
    public_label: "Front",
    sequence: 1,
    sofa_id: sofaId,
    updated_at: "2026-05-04T10:00:00.000Z",
  };

  const finalColumn = {
    ...column,
    admin_label: "Updated front",
    sequence: 2,
    updated_at: "2026-05-04T10:05:00.000Z",
  };

  const sourcePhoto = {
    asset_id: assetId,
    created_at: "2026-05-04T10:00:00.000Z",
    id: sourcePhotoId,
    original_fabric_id: currentFabricId,
    sofa_id: sofaId,
    updated_at: "2026-05-04T10:00:00.000Z",
    visual_matrix_column_id: columnId,
  };

  const asset = {
    asset_kind: "sofa_source_photo",
    bucket_id: "catalog-private-assets",
    byte_size: 1200,
    content_type: "image/png",
    height_px: 900,
    id: assetId,
    lifecycle_state: "active",
    object_path: "sofas/source.png",
    visibility: "private",
    width_px: 1200,
  };

  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const createSignedUrl = vi.fn(async () => ({
    data: { signedUrl: "https://storage.example/source.png" },
    error: null,
  }));
  const storageFrom = vi.fn(() => ({ createSignedUrl }));

  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = {};

    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.update = vi.fn((payload: unknown) => {
      state.updateCalls.push({ payload, table });
      return query;
    });
    query.upsert = vi.fn(async (payload: unknown) => {
      state.updateCalls.push({ payload, table });
      return { error: null };
    });
    query.in = vi.fn(async () => {
      if (table === "sofa_source_photos") {
        return { data: [sourcePhoto], error: null };
      }

      if (table === "storage_assets") {
        return { data: [asset], error: null };
      }

      return { data: [], error: null };
    });
    query.maybeSingle = vi.fn(async () => {
      if (table === "visual_matrix_columns") {
        const data =
          state.visualMatrixFetchCount === 0 ? column : finalColumn;
        state.visualMatrixFetchCount += 1;

        return { data, error: null };
      }

      if (table === "sofas") {
        return {
          data: {
            id: sofaId,
            lifecycle_state: "draft",
          },
          error: null,
        };
      }

      if (table === "sofa_source_photos") {
        return { data: sourcePhoto, error: null };
      }

      return { data: null, error: null };
    });
    query.single = vi.fn(async () => {
      if (table === "sofa_source_photos") {
        return {
          data: {
            ...sourcePhoto,
            original_fabric_id: nextFabricId,
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    return query;
  });

  return {
    columnId,
    createSignedUrl,
    from,
    nextFabricId,
    rpc,
    state,
    storageFrom,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mocks.from,
    rpc: mocks.rpc,
    storage: {
      from: mocks.storageFrom,
    },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.updateCalls = [];
  mocks.state.visualMatrixFetchCount = 0;
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

describe("admin catalog visual matrix store", () => {
  it("uses the transaction RPC when changing an existing source photo fabric", async () => {
    const store = createSupabaseAdminCatalogStore({
      ...process.env,
      ADMIN_UPLOAD_TOKEN_SECRET: "test-upload-token-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    const result = await store.updateVisualMatrixColumn(mocks.columnId, {
      admin_label: "Updated front",
      sequence: 2,
      source_original_fabric_id: mocks.nextFabricId,
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_update_visual_matrix_column_source_fabric",
      {
        p_admin_label: "Updated front",
        p_column_id: mocks.columnId,
        p_public_label: null,
        p_sequence: 2,
        p_source_original_fabric_id: mocks.nextFabricId,
        p_update_admin_label: true,
        p_update_public_label: false,
        p_update_sequence: true,
      },
    );
    expect(
      mocks.state.updateCalls.filter(({ table }) =>
        [
          "visual_matrix_columns",
          "sofa_source_photos",
          "sofa_render_cells",
        ].includes(table),
      ),
    ).toEqual([]);
    expect(result).toMatchObject({
      admin_label: "Updated front",
      id: mocks.columnId,
      sequence: 2,
    });
  });
});
