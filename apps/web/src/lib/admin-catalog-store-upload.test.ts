import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminCatalogStore } from "./admin-catalog";

const catalogVariantMocks = vi.hoisted(() => ({
  ensureCatalogImageVariants: vi.fn(),
}));

const createSignedUploadUrl = vi.fn();
const download = vi.fn();
const insert = vi.fn();
const from = vi.fn();

vi.mock("./catalog-image-variants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./catalog-image-variants")>();

  return {
    ...actual,
    ensureCatalogImageVariants: catalogVariantMocks.ensureCatalogImageVariants,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from,
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl,
        download,
      })),
    },
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
  catalogVariantMocks.ensureCatalogImageVariants.mockResolvedValue({
    created: [],
    variants: {},
  });
});

describe("admin catalog store upload completion", () => {
  it.each(["fabric_ai_reference", "sofa_source_photo"] as const)(
    "rejects oversized %s images even when a browser bypasses resize",
    async (purpose) => {
      createSignedUploadUrl.mockResolvedValue({
        data: {
          signedUrl: "https://storage.example/signed-upload",
        },
        error: null,
      });
      const bytes = pngWithDimensions(4096, 3072);
      download.mockResolvedValue({
        data: {
          arrayBuffer: async () => bytes.buffer.slice(0),
        },
        error: null,
      });
      const store = createSupabaseAdminCatalogStore({
        ...process.env,
        ADMIN_UPLOAD_TOKEN_SECRET: "test-upload-token-secret",
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      });

      const upload = await store.createUpload({
        byte_size: 1024,
        content_type: "image/png",
        purpose,
      });
      const result = await store.completeUpload(String(upload.upload_id));

      expect(result).toMatchObject({
        code: "UPLOAD_NOT_FOUND",
        message: "Upload was not found.",
        status: 404,
      });
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("fails manual render upload completion when required variants cannot be created", async () => {
    createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: "https://storage.example/signed-upload",
      },
      error: null,
    });
    download.mockResolvedValue({
      data: {
        arrayBuffer: async () => onePixelPng().buffer.slice(0),
      },
      error: null,
    });
    from.mockImplementation((table: string) => {
      if (table === "sofa_render_cells") {
        return selectMaybeSingle({
          accepted_fabric_render_candidate_id: null,
          current_private_asset_id: null,
          current_public_asset_id: null,
          fabric_id: "00000000-0000-4000-8000-000000000301",
          id: "00000000-0000-4000-8000-000000000201",
          sofa_id: "00000000-0000-4000-8000-000000000101",
          source_type: "manual_upload",
          visual_matrix_column_id: "00000000-0000-4000-8000-000000000401",
        });
      }

      if (table === "sofas") {
        return selectMaybeSingle({
          id: "00000000-0000-4000-8000-000000000101",
          lifecycle_state: "draft",
        });
      }

      if (table === "storage_assets") {
        return {
          insert: insert.mockReturnValue(
            selectSingle({
              asset_kind: "manual_render",
              bucket_id: "catalog-private-assets",
              byte_size: 68,
              content_type: "image/png",
              height_px: 1,
              id: "00000000-0000-4000-8000-000000000501",
              lifecycle_state: "active",
              object_path:
                "renders/00000000-0000-4000-8000-000000000201/manual-renders/generated.png",
              visibility: "private",
              width_px: 1,
            }),
          ),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    catalogVariantMocks.ensureCatalogImageVariants.mockRejectedValue(
      new Error("variant generation failed"),
    );
    const store = createSupabaseAdminCatalogStore({
      ...process.env,
      ADMIN_UPLOAD_TOKEN_SECRET: "test-upload-token-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    const upload = await store.createUpload({
      byte_size: 68,
      content_type: "image/png",
      purpose: "manual_render",
      render_cell_id: "00000000-0000-4000-8000-000000000201",
    });
    const result = await store.completeUpload(String(upload.upload_id));

    expect(catalogVariantMocks.ensureCatalogImageVariants).toHaveBeenCalledWith(
      expect.objectContaining({
        originalAsset: expect.objectContaining({
          asset_kind: "manual_render",
          id: "00000000-0000-4000-8000-000000000501",
        }),
      }),
    );
    expect(result).toMatchObject({
      code: "UPLOAD_VARIANTS_FAILED",
      message: "Image preview variants could not be created.",
      status: 500,
    });
  });
});

function pngWithDimensions(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  writeUint32Be(bytes, 16, width);
  writeUint32Be(bytes, 20, height);

  return bytes;
}

function onePixelPng() {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00,
  ]);
}

function selectMaybeSingle(data: Record<string, unknown> | null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data, error: null }),
      }),
    }),
  };
}

function selectSingle(data: Record<string, unknown>) {
  return {
    select: () => ({
      single: async () => ({ data, error: null }),
    }),
  };
}

function writeUint32Be(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}
