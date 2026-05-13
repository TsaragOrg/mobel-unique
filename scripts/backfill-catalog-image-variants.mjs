import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Image } from "imagescript";

export const BACKFILL_RENDER_VARIANT_KINDS = ["small", "medium"];
export const BACKFILL_SWATCH_VARIANT_KINDS = ["swatch_small"];
export const BACKFILL_VARIANT_KINDS = [
  ...BACKFILL_RENDER_VARIANT_KINDS,
  ...BACKFILL_SWATCH_VARIANT_KINDS,
];
export const BACKFILL_RENDER_ASSET_KINDS = [
  "sofa_source_photo",
  "manual_render",
  "fabric_render_candidate",
  "published_sofa_render",
];
export const BACKFILL_SWATCH_ASSET_KINDS = ["fabric_swatch_public"];
export const BACKFILL_ASSET_KINDS = [
  ...BACKFILL_RENDER_ASSET_KINDS,
  ...BACKFILL_SWATCH_ASSET_KINDS,
];
export const BACKFILL_VARIANT_PRESETS = {
  medium: {
    maxLongestEdgePx: 1280,
  },
  small: {
    maxLongestEdgePx: 320,
  },
  swatch_small: {
    maxLongestEdgePx: 96,
  },
};
export const BACKFILL_JPEG_QUALITY = 84;
export const BACKFILL_ENVIRONMENTS = ["local", "dev", "prod"];
export const BACKFILL_SCOPES = ["all", "renders", "swatches"];
export const DEFAULT_BACKFILL_PAGE_SIZE = 100;

export function parseBackfillArgs(argv) {
  const options = {
    assetId: null,
    confirmProd: false,
    dryRun: false,
    environment: "local",
    help: false,
    limit: null,
    pageSize: DEFAULT_BACKFILL_PAGE_SIZE,
    scope: "all",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    } else if (arg === "--help") {
      options.help = true;
    } else if (arg === "--confirm-prod") {
      options.confirmProd = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--environment") {
      const value = argv[++index];
      if (!BACKFILL_ENVIRONMENTS.includes(value)) {
        throw new Error("--environment must be local, dev, or prod.");
      }
      options.environment = value;
    } else if (arg === "--limit") {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--limit must be a positive integer.");
      }
      options.limit = value;
    } else if (arg === "--page-size") {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--page-size must be a positive integer.");
      }
      options.pageSize = value;
    } else if (arg === "--scope") {
      const value = argv[++index];
      if (!BACKFILL_SCOPES.includes(value)) {
        throw new Error("--scope must be all, renders, or swatches.");
      }
      options.scope = value;
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
  --environment <name>  Target environment: local, dev, or prod. Default: local.
  --dry-run             Report missing variants without writing storage or rows.
  --confirm-prod        Required for non-dry-run writes when --environment prod.
  --limit <count>       Maximum number of original assets to inspect. Default: all.
  --page-size <count>   REST page size for candidate asset scans. Default: 100.
  --scope <scope>       Asset scope: all, renders, or swatches. Default: all.
  --asset-id <uuid>     Backfill one original asset.
  --help                Show this help.

Environment variables:
  local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  dev:   SUPABASE_DEV_URL, SUPABASE_DEV_SERVICE_ROLE_KEY
  prod:  SUPABASE_PROD_URL, SUPABASE_PROD_SERVICE_ROLE_KEY
`;
}

export function resolveBackfillConnection({ env = process.env, options }) {
  const environment = options.environment ?? "local";
  let serviceRoleKey;
  let supabaseUrl;

  if (environment === "local") {
    supabaseUrl = normalizeSupabaseUrl(
      env.SUPABASE_URL ??
        env.NEXT_PUBLIC_SUPABASE_URL ??
        "http://127.0.0.1:54321",
    );
    serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!isLocalSupabaseUrl(supabaseUrl)) {
      throw new Error(
        `--environment local requires a local SUPABASE_URL (got ${supabaseUrl}).`,
      );
    }
  } else if (environment === "dev") {
    supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_DEV_URL);
    serviceRoleKey = env.SUPABASE_DEV_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "SUPABASE_DEV_URL and SUPABASE_DEV_SERVICE_ROLE_KEY are required for --environment dev.",
      );
    }
    if (isLocalSupabaseUrl(supabaseUrl)) {
      throw new Error("SUPABASE_DEV_URL must not point at local Supabase.");
    }
    if (
      env.SUPABASE_PROD_URL &&
      supabaseUrl === normalizeSupabaseUrl(env.SUPABASE_PROD_URL)
    ) {
      throw new Error("SUPABASE_DEV_URL must differ from SUPABASE_PROD_URL.");
    }
  } else if (environment === "prod") {
    supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_PROD_URL);
    serviceRoleKey = env.SUPABASE_PROD_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_ROLE_KEY are required for --environment prod.",
      );
    }
    if (isLocalSupabaseUrl(supabaseUrl)) {
      throw new Error("SUPABASE_PROD_URL must not point at local Supabase.");
    }
    if (!options.dryRun && !options.confirmProd) {
      throw new Error("--confirm-prod is required before writing to PROD.");
    }
  } else {
    throw new Error("--environment must be local, dev, or prod.");
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return {
    environment,
    serviceRoleKey,
    supabaseUrl,
  };
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
  const result = {
    assetsScanned: 0,
    assetsSkipped: 0,
    variantsCreated: 0,
    variantsPlanned: 0,
  };

  const pageSize = input.pageSize ?? DEFAULT_BACKFILL_PAGE_SIZE;
  const assetKinds = assetKindsForScope(input.scope ?? "all");
  const maxAssets = input.assetId ? 1 : (input.limit ?? null);
  let offset = 0;

  while (maxAssets === null || result.assetsScanned < maxAssets) {
    const remaining =
      maxAssets === null ? pageSize : maxAssets - result.assetsScanned;
    const originalAssets = await listCandidateAssets(client, {
      assetId: input.assetId ?? null,
      assetKinds,
      limit: Math.min(pageSize, remaining),
      offset,
    });

    if (originalAssets.length === 0) {
      break;
    }

    for (const originalAsset of originalAssets) {
      result.assetsScanned += 1;

      const requestedVariantKinds = variantKindsForAsset(originalAsset);
      const existingKinds = await listExistingVariantKinds(
        client,
        originalAsset.id,
        requestedVariantKinds,
      );
      const missingKinds = requestedVariantKinds.filter(
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
        variantKinds: missingKinds,
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

    if (input.assetId) {
      break;
    }

    offset += originalAssets.length;
  }

  return result;
}

function createSupabaseBackfillClient({
  fetchImpl,
  serviceRoleKey,
  supabaseUrl,
}) {
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
      throw new Error(
        `REST ${path} failed with HTTP ${response.status}: ${text}`,
      );
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
      return rest(
        "/rest/v1/storage_assets?on_conflict=bucket_id,object_path&select=*",
        {
          body: [asset],
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          method: "POST",
        },
      );
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

function buildCandidateAssetsPath({ assetId, assetKinds, limit, offset = 0 }) {
  const scopedAssetKinds = assetKinds ?? BACKFILL_ASSET_KINDS;
  const query = [
    "select=*",
    "lifecycle_state=eq.active",
    `asset_kind=in.(${scopedAssetKinds.join(",")})`,
    "content_type=in.(image/png,image/jpeg,image/webp)",
    "order=id.asc",
    `limit=${limit}`,
  ];

  if (!assetId && offset > 0) {
    query.push(`offset=${offset}`);
  }

  if (assetId) {
    query.push(`id=eq.${encodeURIComponent(assetId)}`);
  }

  return `/rest/v1/storage_assets?${query.join("&")}`;
}

export function assetKindsForScope(scope) {
  if (scope === "renders") {
    return BACKFILL_RENDER_ASSET_KINDS;
  }

  if (scope === "swatches") {
    return BACKFILL_SWATCH_ASSET_KINDS;
  }

  if (scope === "all") {
    return BACKFILL_ASSET_KINDS;
  }

  throw new Error("--scope must be all, renders, or swatches.");
}

async function listCandidateAssets(client, options) {
  return client.listCandidateAssets(options);
}

function variantKindsForAsset(asset) {
  if (BACKFILL_SWATCH_ASSET_KINDS.includes(asset.asset_kind)) {
    return BACKFILL_SWATCH_VARIANT_KINDS;
  }

  return BACKFILL_RENDER_VARIANT_KINDS;
}

async function listExistingVariantKinds(client, originalAssetId, variantKinds) {
  const links = await client.listVariantLinks(originalAssetId);

  return new Set(
    links
      .map((link) => link.variant_kind)
      .filter((variantKind) => variantKinds.includes(variantKind)),
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

export async function generateImageVariants({
  bytes,
  variantKinds = BACKFILL_RENDER_VARIANT_KINDS,
}) {
  const sourceImage = await Image.decode(bytes);
  const outputContentType = imageContainsAlpha(sourceImage)
    ? "image/png"
    : "image/jpeg";
  const variants = {};

  for (const variantKind of variantKinds) {
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

function isLocalSupabaseUrl(url) {
  return (
    typeof url === "string" &&
    (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost"))
  );
}

async function main() {
  const options = parseBackfillArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const connection = resolveBackfillConnection({
    env: process.env,
    options,
  });

  try {
    const result = await backfillCatalogImageVariants({
      ...options,
      serviceRoleKey: connection.serviceRoleKey,
      supabaseUrl: connection.supabaseUrl,
    });
    const prefix = options.dryRun ? "DRY RUN" : "PASS";

    console.log(
      `${prefix} catalog image variant backfill (${connection.environment}): scanned ${result.assetsScanned} assets, skipped ${result.assetsSkipped}, planned ${result.variantsPlanned}, created ${result.variantsCreated} variants.`,
    );
  } catch (error) {
    console.error(formatBackfillFailure(error, connection.serviceRoleKey));
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
