import { randomUUID } from "node:crypto";
import { Image } from "imagescript";

export const CATALOG_IMAGE_VARIANT_KINDS = ["small", "medium"] as const;

export type CatalogImageVariantKind =
  (typeof CATALOG_IMAGE_VARIANT_KINDS)[number];

export type CatalogImageDeliveryVariant = CatalogImageVariantKind | "original";

export const CATALOG_IMAGE_VARIANT_PRESETS: Record<
  CatalogImageVariantKind,
  { maxLongestEdgePx: number }
> = {
  medium: { maxLongestEdgePx: 1280 },
  small: { maxLongestEdgePx: 320 },
};

export const CATALOG_IMAGE_VARIANT_JPEG_QUALITY = 84;

export interface CatalogStorageAssetRecord {
  asset_kind: string;
  bucket_id: string;
  byte_size: number | null;
  content_type: string;
  height_px: number | null;
  id: string;
  lifecycle_state: string;
  object_path: string;
  visibility: string;
  width_px: number | null;
}

export interface CatalogImageVariantBytes {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png";
  heightPx: number;
  widthPx: number;
}

export interface CatalogDecodedImage {
  encode(): Promise<Uint8Array>;
  encodeJPEG(quality?: number): Promise<Uint8Array>;
  getPixelAt?(x: number, y: number): number;
  hasAlpha?(): boolean;
  height: number;
  resize(width: number, height: number): unknown;
  width: number;
}

export interface CatalogImageVariantProcessor {
  decode(bytes: Uint8Array): Promise<CatalogDecodedImage>;
}

export interface CatalogImageVariantRepository {
  findActiveVariantAsset(
    originalAssetId: string,
    variantKind: CatalogImageVariantKind,
  ): Promise<CatalogStorageAssetRecord | null>;
  findStorageAssetById(assetId: string): Promise<CatalogStorageAssetRecord | null>;
  insertStorageAsset(asset: CatalogStorageAssetRecord): Promise<void>;
  upsertVariantLink(input: {
    generationKind: "stored";
    originalAssetId: string;
    variantAssetId: string;
    variantKind: CatalogImageVariantKind;
  }): Promise<void>;
}

export interface CatalogImageVariantStorage {
  removeObjects(input: {
    bucketId: string;
    objectPaths: string[];
  }): Promise<void>;
  uploadObject(input: {
    body: Uint8Array;
    bucketId: string;
    contentType: string;
    objectPath: string;
  }): Promise<void>;
}

export class CatalogImageVariantError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function calculateCatalogImageVariantDimensions(input: {
  heightPx: number;
  variantKind: CatalogImageVariantKind;
  widthPx: number;
}) {
  if (input.widthPx <= 0 || input.heightPx <= 0) {
    throw new CatalogImageVariantError(
      "CATALOG_IMAGE_INVALID_DIMENSIONS",
      "Catalog image dimensions must be positive.",
    );
  }

  const maxLongestEdge =
    CATALOG_IMAGE_VARIANT_PRESETS[input.variantKind].maxLongestEdgePx;
  const longestEdge = Math.max(input.widthPx, input.heightPx);

  if (longestEdge <= maxLongestEdge) {
    return {
      heightPx: input.heightPx,
      widthPx: input.widthPx,
    };
  }

  const scale = maxLongestEdge / longestEdge;

  return {
    heightPx: Math.max(1, Math.round(input.heightPx * scale)),
    widthPx: Math.max(1, Math.round(input.widthPx * scale)),
  };
}

export function buildCatalogImageVariantObjectPath(input: {
  contentType: string;
  originalAssetId: string;
  variantAssetId: string;
  variantKind: CatalogImageVariantKind;
}) {
  return [
    "variants",
    input.originalAssetId,
    input.variantKind,
    `${input.variantAssetId}.${extensionForVariantContentType(input.contentType)}`,
  ].join("/");
}

export async function generateCatalogImageVariants(input: {
  bytes: Uint8Array;
  contentType: string;
  processor?: CatalogImageVariantProcessor;
}): Promise<Record<CatalogImageVariantKind, CatalogImageVariantBytes>> {
  const processor = input.processor ?? imageScriptProcessor;
  const sourceImage = await processor.decode(input.bytes);
  const outputContentType = imageContainsAlpha(sourceImage)
    ? "image/png"
    : "image/jpeg";
  const variants = {} as Record<CatalogImageVariantKind, CatalogImageVariantBytes>;

  for (const variantKind of CATALOG_IMAGE_VARIANT_KINDS) {
    const image = await processor.decode(input.bytes);
    const dimensions = calculateCatalogImageVariantDimensions({
      heightPx: image.height,
      variantKind,
      widthPx: image.width,
    });

    image.resize(dimensions.widthPx, dimensions.heightPx);

    const bytes =
      outputContentType === "image/png"
        ? await image.encode()
        : await image.encodeJPEG(CATALOG_IMAGE_VARIANT_JPEG_QUALITY);

    variants[variantKind] = {
      bytes,
      contentType: outputContentType,
      heightPx: dimensions.heightPx,
      widthPx: dimensions.widthPx,
    };
  }

  return variants;
}

export async function ensureCatalogImageVariants(input: {
  bytes: Uint8Array;
  idGenerator?: () => string;
  originalAsset: CatalogStorageAssetRecord;
  processor?: CatalogImageVariantProcessor;
  repository: CatalogImageVariantRepository;
  storage: CatalogImageVariantStorage;
}) {
  assertActiveOriginalImage(input.originalAsset);

  const existingVariants = await readExistingVariants(
    input.repository,
    input.originalAsset.id,
  );
  const missingKinds = CATALOG_IMAGE_VARIANT_KINDS.filter(
    (variantKind) => !existingVariants[variantKind],
  );

  if (missingKinds.length === 0) {
    return {
      created: [] as CatalogImageVariantKind[],
      originalAsset: input.originalAsset,
      variants: existingVariants as Record<
        CatalogImageVariantKind,
        CatalogStorageAssetRecord
      >,
    };
  }

  const idGenerator = input.idGenerator ?? randomUUID;
  const generatedVariants = await generateCatalogImageVariants({
    bytes: input.bytes,
    contentType: input.originalAsset.content_type,
    processor: input.processor,
  });
  const uploadedObjectPaths: string[] = [];
  const created: CatalogImageVariantKind[] = [];

  try {
    for (const variantKind of missingKinds) {
      const generatedVariant = generatedVariants[variantKind];
      const variantAssetId = idGenerator();
      const objectPath = buildCatalogImageVariantObjectPath({
        contentType: generatedVariant.contentType,
        originalAssetId: input.originalAsset.id,
        variantAssetId,
        variantKind,
      });

      await input.storage.uploadObject({
        body: generatedVariant.bytes,
        bucketId: input.originalAsset.bucket_id,
        contentType: generatedVariant.contentType,
        objectPath,
      });
      uploadedObjectPaths.push(objectPath);

      const variantAsset: CatalogStorageAssetRecord = {
        asset_kind: `${input.originalAsset.asset_kind}_variant`,
        bucket_id: input.originalAsset.bucket_id,
        byte_size: generatedVariant.bytes.byteLength,
        content_type: generatedVariant.contentType,
        height_px: generatedVariant.heightPx,
        id: variantAssetId,
        lifecycle_state: "active",
        object_path: objectPath,
        visibility: input.originalAsset.visibility,
        width_px: generatedVariant.widthPx,
      };

      await input.repository.insertStorageAsset(variantAsset);
      await input.repository.upsertVariantLink({
        generationKind: "stored",
        originalAssetId: input.originalAsset.id,
        variantAssetId,
        variantKind,
      });

      existingVariants[variantKind] = variantAsset;
      created.push(variantKind);
    }
  } catch (error) {
    if (uploadedObjectPaths.length > 0) {
      await input.storage.removeObjects({
        bucketId: input.originalAsset.bucket_id,
        objectPaths: uploadedObjectPaths,
      });
    }

    throw error;
  }

  return {
    created,
    originalAsset: input.originalAsset,
    variants: existingVariants as Record<
      CatalogImageVariantKind,
      CatalogStorageAssetRecord
    >,
  };
}

export async function resolveCatalogImageDeliveryAsset(input: {
  originalAssetId: string;
  repository: CatalogImageVariantRepository;
  variant: CatalogImageDeliveryVariant;
}) {
  const originalAsset = await input.repository.findStorageAssetById(
    input.originalAssetId,
  );

  if (!originalAsset) {
    throw new CatalogImageVariantError(
      "CATALOG_IMAGE_ORIGINAL_UNAVAILABLE",
      "Catalog image original asset is unavailable.",
    );
  }

  assertActiveOriginalImage(originalAsset);

  if (input.variant === "original") {
    return originalAsset;
  }

  const variantAsset = await input.repository.findActiveVariantAsset(
    input.originalAssetId,
    input.variant,
  );

  if (!variantAsset || !isActiveImageAsset(variantAsset)) {
    throw new CatalogImageVariantError(
      "CATALOG_IMAGE_VARIANT_NOT_FOUND",
      "Catalog image variant was not found.",
    );
  }

  return variantAsset;
}

async function readExistingVariants(
  repository: CatalogImageVariantRepository,
  originalAssetId: string,
) {
  const variants: Partial<
    Record<CatalogImageVariantKind, CatalogStorageAssetRecord>
  > = {};

  for (const variantKind of CATALOG_IMAGE_VARIANT_KINDS) {
    const variant = await repository.findActiveVariantAsset(
      originalAssetId,
      variantKind,
    );

    if (variant && isActiveImageAsset(variant)) {
      variants[variantKind] = variant;
    }
  }

  return variants;
}

function assertActiveOriginalImage(asset: CatalogStorageAssetRecord) {
  if (!isActiveImageAsset(asset)) {
    throw new CatalogImageVariantError(
      "CATALOG_IMAGE_ORIGINAL_UNAVAILABLE",
      "Catalog image original asset is unavailable.",
    );
  }
}

function isActiveImageAsset(asset: CatalogStorageAssetRecord) {
  return (
    asset.lifecycle_state === "active" &&
    typeof asset.bucket_id === "string" &&
    asset.bucket_id.length > 0 &&
    typeof asset.object_path === "string" &&
    asset.object_path.length > 0 &&
    typeof asset.content_type === "string" &&
    asset.content_type.startsWith("image/") &&
    typeof asset.visibility === "string" &&
    asset.visibility.length > 0
  );
}

function imageContainsAlpha(image: CatalogDecodedImage) {
  if (typeof image.hasAlpha === "function") {
    return image.hasAlpha();
  }

  if (typeof image.getPixelAt !== "function") {
    return false;
  }

  for (let y = 1; y <= image.height; y += 1) {
    for (let x = 1; x <= image.width; x += 1) {
      const [, , , alpha] = Image.colorToRGBA(image.getPixelAt(x, y));

      if (alpha < 255) {
        return true;
      }
    }
  }

  return false;
}

function extensionForVariantContentType(contentType: string) {
  if (contentType === "image/jpeg") {
    return "jpg";
  }

  if (contentType === "image/png") {
    return "png";
  }

  throw new CatalogImageVariantError(
    "CATALOG_IMAGE_VARIANT_CONTENT_TYPE_UNSUPPORTED",
    "Catalog image variant content type is unsupported.",
  );
}

const imageScriptProcessor: CatalogImageVariantProcessor = {
  async decode(bytes) {
    return Image.decode(bytes);
  },
};
