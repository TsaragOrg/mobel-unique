import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdminCatalogDependencies } from "./AdminCatalogPages";

describe("admin catalog dependencies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses server error messages instead of technical error codes", async () => {
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
    ).rejects.toThrow("A tag with this label or slug already exists.");
  });
});
