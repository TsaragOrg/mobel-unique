#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Image } from "imagescript";

export const BACKFILL_VARIANT_KINDS = ["small", "medium"];
export const BACKFILL_ASSET_KINDS = [
  "sofa_source_photo",
  "manual_render",
  "fabric_render_candidate",
  "published_sofa_render",
];
export const BACKFILL_VARIANT_PRESETS = {
  medium: {
    maxLongestEdgePx: 1280,
  },
  small: {
    maxLongestEdgePx: 320,
  },
};
export const BACKFILL_JPEG_QUALITY = 84;

export function parseBackfillArgs(argv) {
  const options = {
    assetId: null,
    dryRun: false,
    help: false,
    limit: 100,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--limit") {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--limit must be a positive integer.");
      }
      options.limit = value;
    } else if (arg === "--asset-id") {
      const value = argv[++index];
      if (!value || !/^[0-9a-f-]{36}$/i.test(value)) {
        throw new Error("--asset-id must be a UUID.");
      }
      options.assetId = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export function usage() {
  return `Usage: node scripts/backfill-catalog-image-variants.mjs [options]

Options:
  --dry-run             Report missing variants without writing storage or rows.
  --limit <count>       Maximum number of original assets to inspect. Default: 100.
  --asset-id <uuid>     Backfill one original asset.
  --help                Show this help.
`;
}

export function formatBackfillFailure(error, serviceRoleKey) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = serviceRoleKey
    ? rawMessage.replaceAll(serviceRoleKey, "[redacted]")
    : rawMessage;

  return `FAIL catalog image variant backfill: ${message}`;
}

export async function backfillCatalogImageVariants(input) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const idGenerator = input.idGenerator ?? randomUUID;
  const generateVariants = input.generateVariants ?? generateImageVariants;
  const supabaseUrl = normalizeSupabaseUrl(input.supabaseUrl);
  const serviceRoleKey = input.serviceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const client = createSupabaseBackfillClient({
    fetchImpl,
    serviceRoleKey,
    supabaseUrl,
  });
  const originalAssets = await listCandidateAssets(client, {
    assetId: input.assetId ?? null,
    limit: input.limit ?? 100,
  });
  const result = {
    assetsScanned: originalAssets.length,
    assetsSkipped: 0,
    variantsCreated: 0,
    variantsPlanned: 0,
  };

  for (const originalAsset of originalAssets) {
    const existingKinds = await listExistingVariantKinds(
      client,
      originalAsset.id,
    );
    const missingKinds = BACKFILL_VARIANT_KINDS.filter(
      (variantKind) => !existingKinds.has(variantKind),
    );

    if (missingKinds.length === 0) {
      result.assetsSkipped += 1;
      continue;
    }

    if (input.dryRun) {
      result.variantsPlanned += missingKinds.length;
      continue;
    }

    const originalBytes = await client.downloadObject(
      originalAsset.bucket_id,
      originalAsset.object_path,
    );
    const generatedVariants = await generateVariants({
      bytes: originalBytes,
      contentType: originalAsset.content_type,
    });

    for (const variantKind of missingKinds) {
      const generatedVariant = generatedVariants[variantKind];
      const variantAssetId = idGenerator();
      const objectPath = buildVariantObjectPath({
        contentType: generatedVariant.contentType,
        originalAssetId: originalAsset.id,
        variantAssetId,
        variantKind,
      });

      await client.uploadObject({
        body: generatedVariant.bytes,
        bucketId: originalAsset.bucket_id,
        contentType: generatedVariant.contentType,
        objectPath,
      });

      await client.upsertStorageAsset({
        asset_kind: `${originalAsset.asset_kind}_variant`,
        bucket_id: originalAsset.bucket_id,
        byte_size: generatedVariant.bytes.byteLength,
        content_type: generatedVariant.contentType,
        height_px: generatedVariant.heightPx,
        id: variantAssetId,
        lifecycle_state: "active",
        object_path: objectPath,
        purged_at: null,
        deleted_at: null,
        visibility: originalAsset.visibility,
        width_px: generatedVariant.widthPx,
      });
      await client.upsertVariantLink({
        generation_kind: "stored",
        original_asset_id: originalAsset.id,
        variant_asset_id: variantAssetId,
        variant_kind: variantKind,
      });
      result.variantsCreated += 1;
    }
  }

  return result;
}

function createSupabaseBackfillClient({ fetchImpl, serviceRoleKey, supabaseUrl }) {
  async function rest(path, init = {}) {
    const response = await fetchImpl(`${supabaseUrl}${path}`, {
      ...init,
      body:
        init.body === undefined || typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body),
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(`REST ${path} failed with HTTP ${response.status}: ${text}`);
    }

    return body;
  }

  return {
    downloadObject(bucketId, objectPath) {
      return downloadStorageObject({
        bucketId,
        fetchImpl,
        objectPath,
        serviceRoleKey,
        supabaseUrl,
      });
    },
    listCandidateAssets(options) {
      return rest(buildCandidateAssetsPath(options));
    },
    listVariantLinks(originalAssetId) {
      return rest(
        `/rest/v1/storage_asset_variants?original_asset_id=eq.${encodeURIComponent(
          originalAssetId,
        )}&select=original_asset_id,variant_kind,variant_asset_id`,
      );
    },
    uploadObject(input) {
      return uploadStorageObject({
        ...input,
        fetchImpl,
        serviceRoleKey,
        supabaseUrl,
      });
    },
    upsertStorageAsset(asset) {
      return rest("/rest/v1/storage_assets?on_conflict=bucket_id,object_path&select=*", {
        body: [asset],
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        method: "POST",
      });
    },
    upsertVariantLink(link) {
      return rest(
        "/rest/v1/storage_asset_variants?on_conflict=original_asset_id,variant_kind&select=*",
        {
          body: [link],
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          method: "POST",
        },
      );
    },
  };
}

function buildCandidateAssetsPath({ assetId, limit }) {
  const query = [
    "select=*",
    "lifecycle_state=eq.active",
    `asset_kind=in.(${BACKFILL_ASSET_KINDS.join(",")})`,
    "content_type=in.(image/png,image/jpeg,image/webp)",
    "order=id.asc",
    `limit=${limit}`,
  ];

  if (assetId) {
    query.push(`id=eq.${encodeURIComponent(assetId)}`);
  }

  return `/rest/v1/storage_assets?${query.join("&")}`;
}

async function listCandidateAssets(client, options) {
  return client.listCandidateAssets(options);
}

async function listExistingVariantKinds(client, originalAssetId) {
  const links = await client.listVariantLinks(originalAssetId);

  return new Set(
    links
      .map((link) => link.variant_kind)
      .filter((variantKind) => BACKFILL_VARIANT_KINDS.includes(variantKind)),
  );
}

async function downloadStorageObject({
  bucketId,
  fetchImpl,
  objectPath,
  serviceRoleKey,
  supabaseUrl,
}) {
  const response = await fetchImpl(
    `${supabaseUrl}/storage/v1/object/${bucketId}/${encodeStorageObjectPath(
      objectPath,
    )}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Storage download failed for ${bucketId}/${objectPath}: HTTP ${response.status}`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function uploadStorageObject({
  body,
  bucketId,
  contentType,
  fetchImpl,
  objectPath,
  serviceRoleKey,
  supabaseUrl,
}) {
  const response = await fetchImpl(
    `${supabaseUrl}/storage/v1/object/${bucketId}/${encodeStorageObjectPath(
      objectPath,
    )}`,
    {
      body,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Storage upload failed for ${bucketId}/${objectPath}: HTTP ${response.status} ${text}`,
    );
  }
}

export function buildVariantObjectPath({
  contentType,
  originalAssetId,
  variantAssetId,
  variantKind,
}) {
  return [
    "variants",
    originalAssetId,
    variantKind,
    `${variantAssetId}.${extensionForContentType(contentType)}`,
  ].join("/");
}

export async function generateImageVariants({ bytes }) {
  const sourceImage = await Image.decode(bytes);
  const outputContentType = imageContainsAlpha(sourceImage)
    ? "image/png"
    : "image/jpeg";
  const variants = {};

  for (const variantKind of BACKFILL_VARIANT_KINDS) {
    const image = await Image.decode(bytes);
    const dimensions = calculateVariantDimensions({
      heightPx: image.height,
      variantKind,
      widthPx: image.width,
    });

    image.resize(dimensions.widthPx, dimensions.heightPx);

    variants[variantKind] = {
      bytes:
        outputContentType === "image/png"
          ? await image.encode()
          : await image.encodeJPEG(BACKFILL_JPEG_QUALITY),
      contentType: outputContentType,
      heightPx: dimensions.heightPx,
      widthPx: dimensions.widthPx,
    };
  }

  return variants;
}

export function calculateVariantDimensions({ heightPx, variantKind, widthPx }) {
  const maxLongestEdge = BACKFILL_VARIANT_PRESETS[variantKind].maxLongestEdgePx;
  const longestEdge = Math.max(widthPx, heightPx);

  if (longestEdge <= maxLongestEdge) {
    return {
      heightPx,
      widthPx,
    };
  }

  const scale = maxLongestEdge / longestEdge;

  return {
    heightPx: Math.max(1, Math.round(heightPx * scale)),
    widthPx: Math.max(1, Math.round(widthPx * scale)),
  };
}

function imageContainsAlpha(image) {
  if (typeof image.hasAlpha === "function") {
    return image.hasAlpha();
  }

  if (typeof image.getPixelAt !== "function") {
    return false;
  }

  for (let y = 1; y <= image.height; y += 1) {
    for (let x = 1; x <= image.width; x += 1) {
      if ((image.getPixelAt(x, y) & 0xff) < 255) {
        return true;
      }
    }
  }

  return false;
}

function extensionForContentType(contentType) {
  return contentType === "image/png" ? "png" : "jpg";
}

function encodeStorageObjectPath(objectPath) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

function normalizeSupabaseUrl(url) {
  return typeof url === "string" && url.trim()
    ? url.trim().replace(/\/+$/, "")
    : null;
}

async function main() {
  const options = parseBackfillArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const result = await backfillCatalogImageVariants({
      ...options,
      serviceRoleKey,
      supabaseUrl: process.env.SUPABASE_URL,
    });
    const prefix = options.dryRun ? "DRY RUN" : "PASS";

    console.log(
      `${prefix} catalog image variant backfill: scanned ${result.assetsScanned} assets, skipped ${result.assetsSkipped}, planned ${result.variantsPlanned}, created ${result.variantsCreated} variants.`,
    );
  } catch (error) {
    console.error(formatBackfillFailure(error, serviceRoleKey));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      formatBackfillFailure(error, process.env.SUPABASE_SERVICE_ROLE_KEY),
    );
    process.exit(1);
  });
}
