import { Image } from "imagescript";

export const FABRIC_RENDER_IMAGE_VARIANT_KINDS = ["small", "medium"] as const;

export type FabricRenderImageVariantKind =
  (typeof FABRIC_RENDER_IMAGE_VARIANT_KINDS)[number];

export const FABRIC_RENDER_IMAGE_VARIANT_PRESETS: Record<
  FabricRenderImageVariantKind,
  { maxLongestEdgePx: number }
> = {
  medium: { maxLongestEdgePx: 1280 },
  small: { maxLongestEdgePx: 320 },
};

export const FABRIC_RENDER_IMAGE_VARIANT_JPEG_QUALITY = 84;

export type FabricRenderCandidateImageVariant = {
  byte_size: number;
  bytes: Uint8Array;
  content_type: "image/jpeg" | "image/png";
  height_px: number;
  object_path: string;
  variant_asset_id: string;
  variant_kind: FabricRenderImageVariantKind;
  width_px: number;
};

type DecodedImage = {
  encode(): Promise<Uint8Array>;
  encodeJPEG(quality?: number): Promise<Uint8Array>;
  getPixelAt?(x: number, y: number): number;
  hasAlpha?(): boolean;
  height: number;
  resize(width: number, height: number): unknown;
  width: number;
};

type ImageVariantProcessor = {
  decode(bytes: Uint8Array): Promise<DecodedImage>;
};

export function calculateFabricRenderImageVariantDimensions(input: {
  heightPx: number;
  variantKind: FabricRenderImageVariantKind;
  widthPx: number;
}) {
  if (input.widthPx <= 0 || input.heightPx <= 0) {
    throw new Error("fabric render image variant dimensions must be positive");
  }

  const maxLongestEdge =
    FABRIC_RENDER_IMAGE_VARIANT_PRESETS[input.variantKind].maxLongestEdgePx;
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

export function buildFabricRenderCandidateVariantObjectPath(input: {
  contentType: string;
  outputPath: string;
  variantAssetId: string;
  variantKind: FabricRenderImageVariantKind;
}) {
  const outputDirectory = input.outputPath.split("/").slice(0, -1).join("/");

  return [
    outputDirectory,
    "variants",
    input.variantKind,
    `${input.variantAssetId}.${extensionForVariantContentType(input.contentType)}`,
  ]
    .filter(Boolean)
    .join("/");
}

export async function generateFabricRenderCandidateImageVariants(input: {
  createVariantAssetId?: (variantKind: FabricRenderImageVariantKind) => string;
  outputBytes: Uint8Array;
  outputContentType: string;
  outputPath: string;
  processor?: ImageVariantProcessor;
}): Promise<FabricRenderCandidateImageVariant[]> {
  if (!input.outputContentType.startsWith("image/")) {
    throw new Error("fabric render output content type must be an image");
  }

  const processor = input.processor ?? imageScriptProcessor;
  const sourceImage = await processor.decode(input.outputBytes);
  const variantContentType = imageContainsAlpha(sourceImage)
    ? "image/png"
    : "image/jpeg";
  const createVariantAssetId =
    input.createVariantAssetId ?? (() => crypto.randomUUID());
  const variants: FabricRenderCandidateImageVariant[] = [];

  for (const variantKind of FABRIC_RENDER_IMAGE_VARIANT_KINDS) {
    const image = await processor.decode(input.outputBytes);
    const dimensions = calculateFabricRenderImageVariantDimensions({
      heightPx: image.height,
      variantKind,
      widthPx: image.width,
    });

    image.resize(dimensions.widthPx, dimensions.heightPx);

    const bytes =
      variantContentType === "image/png"
        ? await image.encode()
        : await image.encodeJPEG(FABRIC_RENDER_IMAGE_VARIANT_JPEG_QUALITY);
    const variantAssetId = createVariantAssetId(variantKind);

    variants.push({
      byte_size: bytes.byteLength,
      bytes,
      content_type: variantContentType,
      height_px: dimensions.heightPx,
      object_path: buildFabricRenderCandidateVariantObjectPath({
        contentType: variantContentType,
        outputPath: input.outputPath,
        variantAssetId,
        variantKind,
      }),
      variant_asset_id: variantAssetId,
      variant_kind: variantKind,
      width_px: dimensions.widthPx,
    });
  }

  return variants;
}

function imageContainsAlpha(image: DecodedImage) {
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

  throw new Error("fabric render image variant content type is unsupported");
}

const imageScriptProcessor: ImageVariantProcessor = {
  async decode(bytes) {
    return Image.decode(bytes);
  },
};
