import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdminCatalogDependencies } from "./AdminCatalogPages";

describe("admin catalog dependencies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses French admin messages instead of technical error codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "TAG_CONFLICT",
                message: "A tag with this label or slug already exists.",
              },
            }),
            {
              headers: {
                "Content-Type": "application/json",
              },
              status: 409,
            },
          ),
      ),
    );

    const dependencies = createDefaultAdminCatalogDependencies(
      vi.fn(),
      vi.fn(),
    );

    await expect(
      dependencies.createTag("admin-token", {
        public_label: "Angle premium",
      }),
    ).rejects.toThrow("Une étiquette utilise déjà ce libellé ou cette adresse.");
  });

  it("builds protected admin preview URLs with the requested variant", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Blob(["preview"], { type: "image/png" }), {
          headers: {
            "Content-Type": "image/png",
          },
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => "blob:preview"),
    });

    const dependencies = createDefaultAdminCatalogDependencies(
      vi.fn(),
      vi.fn(),
    );

    await dependencies.createStorageAssetPreviewUrl(
      "admin-token",
      "00000000-0000-4000-8000-000000000907",
      "small",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/storage-assets/00000000-0000-4000-8000-000000000907/preview?variant=small",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });
});
