import { describe, expect, it } from "vitest";
import {
  buildPublicStorageUrl,
  decodeCatalogCursor,
  encodeCatalogCursor,
  parseCatalogListQuery,
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
});
