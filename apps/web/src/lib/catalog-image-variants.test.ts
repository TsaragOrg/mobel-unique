import { describe, expect, it, vi } from "vitest";

import {
  buildCatalogImageVariantObjectPath,
  calculateCatalogImageVariantDimensions,
  ensureCatalogImageVariants,
  ensureFabricSwatchSmallVariant,
  generateCatalogImageVariants,
  resolveCatalogImageDeliveryAsset,
  type CatalogImageVariantKind,
  type CatalogImageVariantProcessor,
  type CatalogImageVariantRepository,
  type CatalogImageVariantStorage,
  type CatalogStorageAssetRecord,
} from "./catalog-image-variants";

const originalAsset: CatalogStorageAssetRecord = {
  asset_kind: "manual_render",
  bucket_id: "catalog-private-assets",
  byte_size: 4000,
  content_type: "image/png",
  height_px: 1000,
  id: "00000000-0000-4000-8000-000000000101",
  lifecycle_state: "active",
  object_path: "renders/cell/manual-renders/original.png",
  visibility: "private",
  width_px: 2000,
};

const smallAsset: CatalogStorageAssetRecord = {
  ...originalAsset,
  asset_kind: "manual_render_variant",
  byte_size: 120,
  content_type: "image/jpeg",
  height_px: 160,
  id: "00000000-0000-4000-8000-000000000201",
  object_path:
    "variants/00000000-0000-4000-8000-000000000101/small/00000000-0000-4000-8000-000000000201.jpg",
  width_px: 320,
};

const mediumAsset: CatalogStorageAssetRecord = {
  ...smallAsset,
  byte_size: 480,
  height_px: 640,
  id: "00000000-0000-4000-8000-000000000202",
  object_path:
    "variants/00000000-0000-4000-8000-000000000101/medium/00000000-0000-4000-8000-000000000202.jpg",
  width_px: 1280,
};

const fabricSwatchAsset: CatalogStorageAssetRecord = {
  ...originalAsset,
  asset_kind: "fabric_swatch_public",
  bucket_id: "catalog-public-assets",
  object_path: "fabrics/linen/swatch.png",
  visibility: "public",
};

describe("catalog image variant helpers", () => {
  it("calculates no-crop longest-edge dimensions without upscaling", () => {
    expect(
      calculateCatalogImageVariantDimensions({
        heightPx: 2000,
        variantKind: "small",
        widthPx: 4000,
      }),
    ).toEqual({ heightPx: 160, widthPx: 320 });

    expect(
      calculateCatalogImageVariantDimensions({
        heightPx: 1500,
        variantKind: "medium",
        widthPx: 3000,
      }),
    ).toEqual({ heightPx: 640, widthPx: 1280 });

    expect(
      calculateCatalogImageVariantDimensions({
        heightPx: 80,
        variantKind: "small",
        widthPx: 100,
      }),
    ).toEqual({ heightPx: 80, widthPx: 100 });
  });

  it("keeps render small at 320 px and swatch_small at 96 px", () => {
    expect(
      calculateCatalogImageVariantDimensions({
        heightPx: 1000,
        variantKind: "small",
        widthPx: 2000,
      }),
    ).toEqual({ heightPx: 160, widthPx: 320 });

    expect(
      calculateCatalogImageVariantDimensions({
        heightPx: 1000,
        variantKind: "swatch_small",
        widthPx: 2000,
      }),
    ).toEqual({ heightPx: 48, widthPx: 96 });
  });

  it("builds immutable variant object paths from original and variant ids", () => {
    expect(
      buildCatalogImageVariantObjectPath({
        contentType: "image/jpeg",
        originalAssetId: originalAsset.id,
        variantAssetId: smallAsset.id,
        variantKind: "small",
      }),
    ).toBe(
      "variants/00000000-0000-4000-8000-000000000101/small/00000000-0000-4000-8000-000000000201.jpg",
    );

    expect(
      buildCatalogImageVariantObjectPath({
        contentType: "image/png",
        originalAssetId: originalAsset.id,
        variantAssetId: mediumAsset.id,
        variantKind: "medium",
      }),
    ).toBe(
      "variants/00000000-0000-4000-8000-000000000101/medium/00000000-0000-4000-8000-000000000202.png",
    );
  });

  it("generates JPEG variants unless decoded pixels contain alpha", async () => {
    const processor = createProcessor({ hasAlpha: false });
    const variants = await generateCatalogImageVariants({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      processor,
    });

    expect(variants.small).toMatchObject({
      contentType: "image/jpeg",
      heightPx: 160,
      widthPx: 320,
    });
    expect(variants.medium).toMatchObject({
      contentType: "image/jpeg",
      heightPx: 640,
      widthPx: 1280,
    });

    const alphaVariants = await generateCatalogImageVariants({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      processor: createProcessor({ hasAlpha: true }),
    });

    expect(alphaVariants.small?.contentType).toBe("image/png");
    expect(alphaVariants.medium?.contentType).toBe("image/png");
  });

  it("keeps default render generation limited to small and medium", async () => {
    const variants = await generateCatalogImageVariants({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      processor: createProcessor({ hasAlpha: false }),
    });

    expect(Object.keys(variants).sort()).toEqual(["medium", "small"]);
    expect(variants).not.toHaveProperty("swatch_small");
  });

  it("skips uploads and inserts when active small and medium variants already exist", async () => {
    const repository = createRepository({
      original: originalAsset,
      variants: {
        medium: mediumAsset,
        small: smallAsset,
      },
    });
    const storage = createStorage();

    const result = await ensureCatalogImageVariants({
      bytes: new Uint8Array([1, 2, 3]),
      idGenerator: () => {
        throw new Error("ids should not be generated");
      },
      originalAsset,
      processor: createProcessor({ hasAlpha: false }),
      repository,
      storage,
    });

    expect(result.created).toEqual([]);
    expect(result.variants).toEqual({
      medium: mediumAsset,
      small: smallAsset,
    });
    expect(storage.uploadObject).not.toHaveBeenCalled();
    expect(repository.insertStorageAsset).not.toHaveBeenCalled();
    expect(repository.upsertVariantLink).not.toHaveBeenCalled();
  });

  it.each([
    ["private", "catalog-private-assets"],
    ["public", "catalog-public-assets"],
  ] as const)(
    "stores generated variants in the original %s bucket and visibility",
    async (visibility, bucketId) => {
      const sourceAsset = {
        ...originalAsset,
        bucket_id: bucketId,
        visibility,
      };
      const repository = createRepository({ original: sourceAsset });
      const storage = createStorage();
      const ids = [
        "00000000-0000-4000-8000-000000000301",
        "00000000-0000-4000-8000-000000000302",
      ];

      await ensureCatalogImageVariants({
        bytes: new Uint8Array([1, 2, 3]),
        idGenerator: () => ids.shift() ?? "unexpected-id",
        originalAsset: sourceAsset,
        processor: createProcessor({ hasAlpha: false }),
        repository,
        storage,
      });

      expect(storage.uploadObject).toHaveBeenCalledTimes(2);
      expect(storage.uploadObject).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          bucketId,
          contentType: "image/jpeg",
          objectPath:
            "variants/00000000-0000-4000-8000-000000000101/small/00000000-0000-4000-8000-000000000301.jpg",
        }),
      );
      expect(repository.insertStorageAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket_id: bucketId,
          lifecycle_state: "active",
          visibility,
        }),
      );
    },
  );

  it("creates only swatch_small for fabric swatches", async () => {
    const repository = createRepository({ original: fabricSwatchAsset });
    const storage = createStorage();

    const result = await ensureFabricSwatchSmallVariant({
      bytes: new Uint8Array([1, 2, 3]),
      idGenerator: () => "00000000-0000-4000-8000-000000000301",
      originalAsset: fabricSwatchAsset,
      processor: createProcessor({ hasAlpha: false }),
      repository,
      storage,
    });

    expect(result.created).toEqual(["swatch_small"]);
    expect(Object.keys(result.variants)).toEqual(["swatch_small"]);
    expect(result.variants.swatch_small).toMatchObject({
      height_px: 48,
      object_path:
        "variants/00000000-0000-4000-8000-000000000101/swatch_small/00000000-0000-4000-8000-000000000301.jpg",
      width_px: 96,
    });
    expect(storage.uploadObject).toHaveBeenCalledTimes(1);
    expect(repository.upsertVariantLink).toHaveBeenCalledWith({
      generationKind: "stored",
      originalAssetId: fabricSwatchAsset.id,
      variantAssetId: "00000000-0000-4000-8000-000000000301",
      variantKind: "swatch_small",
    });
  });

  it("removes already uploaded objects when a later variant upload fails", async () => {
    const repository = createRepository({ original: originalAsset });
    const storage = createStorage({
      uploadObject: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("medium upload failed")),
    });

    await expect(
      ensureCatalogImageVariants({
        bytes: new Uint8Array([1, 2, 3]),
        idGenerator: createSequentialIdGenerator(),
        originalAsset,
        processor: createProcessor({ hasAlpha: false }),
        repository,
        storage,
      }),
    ).rejects.toThrow("medium upload failed");

    expect(storage.removeObjects).toHaveBeenCalledWith({
      bucketId: originalAsset.bucket_id,
      objectPaths: [
        "variants/00000000-0000-4000-8000-000000000101/small/00000000-0000-4000-8000-000000000301.jpg",
      ],
    });
  });

  it("does not fall back to original bytes when a requested variant is missing", async () => {
    const repository = createRepository({ original: originalAsset });

    await expect(
      resolveCatalogImageDeliveryAsset({
        originalAssetId: originalAsset.id,
        repository,
        variant: "small",
      }),
    ).rejects.toMatchObject({
      code: "CATALOG_IMAGE_VARIANT_NOT_FOUND",
    });
  });

  it("treats inactive original assets as unavailable for delivery and creation", async () => {
    const inactiveOriginal = {
      ...originalAsset,
      lifecycle_state: "deleted",
    };
    const repository = createRepository({ original: inactiveOriginal });

    await expect(
      resolveCatalogImageDeliveryAsset({
        originalAssetId: inactiveOriginal.id,
        repository,
        variant: "original",
      }),
    ).rejects.toMatchObject({
      code: "CATALOG_IMAGE_ORIGINAL_UNAVAILABLE",
    });

    await expect(
      ensureCatalogImageVariants({
        bytes: new Uint8Array([1, 2, 3]),
        idGenerator: createSequentialIdGenerator(),
        originalAsset: inactiveOriginal,
        processor: createProcessor({ hasAlpha: false }),
        repository,
        storage: createStorage(),
      }),
    ).rejects.toMatchObject({
      code: "CATALOG_IMAGE_ORIGINAL_UNAVAILABLE",
    });
  });
});

function createSequentialIdGenerator() {
  const ids = [
    "00000000-0000-4000-8000-000000000301",
    "00000000-0000-4000-8000-000000000302",
  ];

  return () => ids.shift() ?? "unexpected-id";
}

function createProcessor(input: {
  hasAlpha: boolean;
}): CatalogImageVariantProcessor {
  return {
    async decode() {
      return createDecodedImage(input);
    },
  };
}

function createDecodedImage(input: { hasAlpha: boolean }) {
  return {
    encode: vi.fn(async () => new Uint8Array([80, 78, 71])),
    encodeJPEG: vi.fn(async () => new Uint8Array([74, 80, 71])),
    hasAlpha: () => input.hasAlpha,
    height: 1000,
    resize(width: number, height: number) {
      this.width = width;
      this.height = height;
      return this;
    },
    width: 2000,
  };
}

function createRepository(input: {
  original: CatalogStorageAssetRecord;
  variants?: Partial<Record<CatalogImageVariantKind, CatalogStorageAssetRecord>>;
}): CatalogImageVariantRepository {
  const variants = new Map<CatalogImageVariantKind, CatalogStorageAssetRecord>(
    Object.entries(input.variants ?? {}) as [
      CatalogImageVariantKind,
      CatalogStorageAssetRecord,
    ][],
  );

  return {
    findActiveVariantAsset: vi.fn(async (_originalAssetId, variantKind) => {
      return variants.get(variantKind) ?? null;
    }),
    findStorageAssetById: vi.fn(async (assetId) => {
      return assetId === input.original.id ? input.original : null;
    }),
    insertStorageAsset: vi.fn(async (asset) => {
      const variantKind = asset.object_path.includes("/swatch_small/")
        ? "swatch_small"
        : asset.object_path.includes("/small/")
          ? "small"
          : "medium";
      variants.set(variantKind, asset);
    }),
    upsertVariantLink: vi.fn(async () => undefined),
  };
}

function createStorage(
  overrides: Partial<CatalogImageVariantStorage> = {},
): CatalogImageVariantStorage {
  return {
    removeObjects: vi.fn(async () => undefined),
    uploadObject: vi.fn(async () => undefined),
    ...overrides,
  };
}
