import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminCatalogStore } from "./admin-catalog";

const createSignedUploadUrl = vi.fn();
const download = vi.fn();
const insert = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert,
    })),
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

function writeUint32Be(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}
