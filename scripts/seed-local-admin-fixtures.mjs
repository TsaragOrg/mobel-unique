#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Image } from "imagescript";
import {
  BACKFILL_VARIANT_KINDS,
  buildVariantObjectPath,
  generateImageVariants,
} from "./backfill-catalog-image-variants.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_FIXTURE_ROOT = resolve(REPO_ROOT, "fixtures/local-admin-catalog");
const FIXTURE_ROOT = resolve(
  process.env.LOCAL_ADMIN_FIXTURE_ROOT ?? DEFAULT_FIXTURE_ROOT,
);
const MANIFEST_PATH = resolve(
  process.env.LOCAL_ADMIN_FIXTURE_MANIFEST ?? `${FIXTURE_ROOT}/manifest.json`,
);
const SOFA_LIFECYCLE_STATES = new Set(["draft", "published", "archived"]);
const RENDER_COVERAGE_STATES = new Set(["complete", "source-only", "none"]);
const GENERATED_IMAGE_PRESETS = {
  fabricAiReference: {
    contentType: "image/jpeg",
    heightPx: 1024,
    widthPx: 768,
  },
  fabricSwatch: {
    contentType: "image/png",
    heightPx: 256,
    widthPx: 256,
  },
  render: {
    contentType: "image/png",
    heightPx: 720,
    widthPx: 1080,
  },
  sofaSourcePhoto: {
    contentType: "image/jpeg",
    heightPx: 720,
    widthPx: 1080,
  },
};
const VARIANT_SOURCE_ASSET_KINDS = new Set([
  "sofa_source_photo",
  "manual_render",
  "fabric_render_candidate",
  "published_sofa_render",
]);
const NOW = new Date().toISOString();

loadEnvFile(resolve(REPO_ROOT, ".env.local"));
loadEnvFile(resolve(REPO_ROOT, ".env"));
loadEnvFile(resolve(REPO_ROOT, "apps/web/.env.local"));
loadEnvFile(resolve(REPO_ROOT, "apps/web/.env"));
loadEnvFile(resolve(REPO_ROOT, "supabase/.env.local"));
loadEnvFile(resolve(REPO_ROOT, "supabase/.env"));

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOW_NON_LOCAL = process.env.LOCAL_ADMIN_SEED_ALLOW_NON_LOCAL === "1";

if (!SERVICE_ROLE_KEY) {
  fail("SUPABASE_SERVICE_ROLE_KEY is required.");
}

if (!ALLOW_NON_LOCAL && !isLocalUrl(SUPABASE_URL)) {
  fail(
    `Refusing to seed non-local Supabase URL ${SUPABASE_URL}. Set LOCAL_ADMIN_SEED_ALLOW_NON_LOCAL=1 to override.`,
  );
}

const { manifest, source } = loadManifest();
const tags = await seedTags(manifest);
const fabrics = await seedFabrics(manifest);
const sofas = await seedSofas(manifest, tags, fabrics);

console.log(
  [
    "PASS local admin fixtures seed",
    `Supabase: ${SUPABASE_URL}`,
    `Manifest: ${source}`,
    `Fixture root: ${FIXTURE_ROOT}`,
    `Tags: ${tags.length}`,
    `Fabrics: ${fabrics.length}`,
    `Sofas: ${sofas.length}`,
    "Open /admin/sofas and /admin/fabrics to test with seeded catalog data.",
  ].join("\n"),
);

function loadManifest() {
  if (existsSync(MANIFEST_PATH)) {
    const parsed = readJsonFile(MANIFEST_PATH);
    return {
      manifest: normalizeManifest(parsed, "manifest.json"),
      source: MANIFEST_PATH,
    };
  }

  return {
    manifest: normalizeManifest(defaultManifest(), "built-in defaults"),
    source: "built-in defaults",
  };
}

function normalizeManifest(input, source) {
  if (!isRecord(input)) {
    fail(`${source} must be a JSON object.`);
  }

  const prefix = stringOrDefault(
    input.prefix,
    process.env.LOCAL_ADMIN_SEED_PREFIX ?? "local-admin",
  );
  const fabrics = arrayOrEmpty(input.fabrics).map((fabric, index) =>
    normalizeFabric(fabric, index),
  );
  const sofas = arrayOrEmpty(input.sofas).map((sofa, index) =>
    normalizeSofa(sofa, index, fabrics),
  );
  const tagMap = new Map(
    arrayOrEmpty(input.tags).map((tag, index) => {
      const normalized = normalizeTag(tag, index);
      return [normalized.slug, normalized];
    }),
  );

  for (const sofa of sofas) {
    for (const tagSlug of sofa.tagSlugs) {
      if (!tagMap.has(tagSlug)) {
        tagMap.set(tagSlug, {
          publicLabel: titleFromSlug(tagSlug),
          slug: tagSlug,
        });
      }
    }
  }

  if (fabrics.length < 3) {
    fail(`${source} must define at least 3 fabrics.`);
  }

  if (sofas.length < 2) {
    fail(`${source} must define at least 2 sofas.`);
  }

  return {
    fabrics,
    prefix,
    sofas,
    tags: [...tagMap.values()],
  };
}

function normalizeFabric(value, index) {
  if (!isRecord(value)) {
    fail(`fabrics[${index}] must be an object.`);
  }

  const slug = requiredString(value.slug, `fabrics[${index}].slug`);

  return {
    aiReferenceImage: optionalString(value.ai_reference_image),
    internalName: stringOrDefault(
      value.internal_name,
      `Local ${titleFromSlug(slug)} Fabric`,
    ),
    isPremium: Boolean(value.is_premium),
    publicName: stringOrDefault(value.public_name, titleFromSlug(slug)),
    slug,
    swatchImage: optionalString(value.swatch_image),
  };
}

function normalizeSofa(value, index, fabrics) {
  if (!isRecord(value)) {
    fail(`sofas[${index}] must be an object.`);
  }

  const slug = requiredString(value.slug, `sofas[${index}].slug`);
  const lifecycleState = enumOrDefault(
    value.lifecycle_state,
    SOFA_LIFECYCLE_STATES,
    defaultSofaLifecycleState(index),
    `sofas[${index}].lifecycle_state`,
  );
  const renderCoverage = enumOrDefault(
    value.render_coverage,
    RENDER_COVERAGE_STATES,
    defaultSofaRenderCoverage(index, lifecycleState),
    `sofas[${index}].render_coverage`,
  );
  const fabricSlugs =
    arrayOrEmpty(value.fabric_slugs).length > 0
      ? arrayOrEmpty(value.fabric_slugs).map((item, fabricIndex) =>
          requiredString(item, `sofas[${index}].fabric_slugs[${fabricIndex}]`),
        )
      : fabrics.map((fabric) => fabric.slug);
  const sourceFabricSlug = stringOrDefault(
    value.source_fabric_slug,
    fabricSlugs[0],
  );

  if (!fabricSlugs.includes(sourceFabricSlug)) {
    fail(
      `sofas[${index}].source_fabric_slug must be one of the sofa fabric_slugs.`,
    );
  }

  const knownFabricSlugs = new Set(fabrics.map((fabric) => fabric.slug));
  for (const fabricSlug of fabricSlugs) {
    if (!knownFabricSlugs.has(fabricSlug)) {
      fail(`sofas[${index}] references unknown fabric slug "${fabricSlug}".`);
    }
  }

  const visualPositions =
    arrayOrEmpty(value.visual_positions).length > 0
      ? arrayOrEmpty(value.visual_positions).map((position, positionIndex) =>
          normalizeVisualPosition(
            position,
            `sofas[${index}].visual_positions[${positionIndex}]`,
            sourceFabricSlug,
          ),
        )
      : [
          {
            adminLabel: "Front",
            publicLabel: "Front",
            sequence: 1,
            sourceFabricSlug,
            sourceImage: null,
          },
        ];

  for (const position of visualPositions) {
    if (!fabricSlugs.includes(position.sourceFabricSlug)) {
      fail(
        `sofas[${index}] visual position ${position.sequence} source_fabric_slug must be one of the sofa fabric_slugs.`,
      );
    }
  }

  return {
    depthCm: positiveNumberOrNull(value.depth_cm),
    fabricSlugs,
    footprintType: optionalString(value.footprint_type),
    heightCm: positiveNumberOrNull(value.height_cm),
    internalName: stringOrDefault(
      value.internal_name,
      `Local ${titleFromSlug(slug)} Sofa`,
    ),
    lengthCm: positiveNumberOrNull(value.length_cm),
    lifecycleState,
    manualPublicOrder:
      lifecycleState === "published"
        ? (positiveIntegerOrNull(value.manual_public_order) ?? index + 1)
        : null,
    publicDescription: optionalString(value.public_description),
    publicName: stringOrDefault(value.public_name, titleFromSlug(slug)),
    publicSlug: slug,
    renderCoverage:
      lifecycleState === "published" ? "complete" : renderCoverage,
    shopifyOrderUrl: stringOrDefault(
      value.shopify_order_url,
      `https://shopify.example/products/${slug}`,
    ),
    tagSlugs: arrayOrEmpty(value.tag_slugs).map((tag, tagIndex) =>
      requiredString(tag, `sofas[${index}].tag_slugs[${tagIndex}]`),
    ),
    visualPositions,
  };
}

function normalizeVisualPosition(value, path, fallbackSourceFabricSlug) {
  if (!isRecord(value)) {
    fail(`${path} must be an object.`);
  }

  return {
    adminLabel: stringOrDefault(
      value.admin_label,
      `Position ${value.sequence}`,
    ),
    publicLabel: stringOrDefault(
      value.public_label,
      `Position ${value.sequence}`,
    ),
    sequence: positiveInteger(value.sequence, `${path}.sequence`),
    skipSourcePhoto: Boolean(value.skip_source_photo),
    sourceFabricSlug: stringOrDefault(
      value.source_fabric_slug,
      fallbackSourceFabricSlug,
    ),
    sourceImage: optionalString(value.source_image),
  };
}

function normalizeTag(value, index) {
  if (!isRecord(value)) {
    fail(`tags[${index}] must be an object.`);
  }

  const slug = requiredString(value.slug, `tags[${index}].slug`);

  return {
    publicLabel: stringOrDefault(value.public_label, titleFromSlug(slug)),
    slug,
  };
}

async function seedTags(manifest) {
  const seeded = [];

  for (const definition of manifest.tags) {
    const [tag] = await rest(
      `/rest/v1/public_tags?on_conflict=slug&select=id,public_label,slug`,
      {
        body: [
          {
            public_label: definition.publicLabel,
            slug: definition.slug,
            updated_at: NOW,
          },
        ],
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        method: "POST",
      },
    );
    seeded.push(tag);
  }

  return seeded;
}

async function seedFabrics(manifest) {
  const seeded = [];

  for (const definition of manifest.fabrics) {
    const swatchImage = await readFixtureImage(
      definition.swatchImage,
      `fabric ${definition.slug} swatch`,
      "fabricSwatch",
    );
    const aiReferenceImage = await readFixtureImage(
      definition.aiReferenceImage,
      `fabric ${definition.slug} AI reference`,
      "fabricAiReference",
    );
    const swatchAsset = await upsertImageAsset({
      assetKind: "fabric_swatch_public",
      bucketId: "catalog-public-assets",
      image: swatchImage,
      objectPath: objectPathFor(
        manifest.prefix,
        `fabrics/${definition.slug}/swatch${swatchImage.extension}`,
      ),
      visibility: "public",
    });
    const aiReferenceAsset = await upsertImageAsset({
      assetKind: "fabric_ai_reference",
      bucketId: "catalog-private-assets",
      image: aiReferenceImage,
      objectPath: objectPathFor(
        manifest.prefix,
        `fabrics/${definition.slug}/ai-reference${aiReferenceImage.extension}`,
      ),
      visibility: "private",
    });
    const existing = await selectSingle(
      `/rest/v1/fabrics?internal_name=eq.${encodeURIComponent(definition.internalName)}&select=*`,
    );
    const payload = {
      ai_reference_asset_id: aiReferenceAsset.id,
      archived_at: null,
      internal_name: definition.internalName,
      is_premium: definition.isPremium,
      lifecycle_state: "active",
      public_name: definition.publicName,
      swatch_asset_id: swatchAsset.id,
      updated_at: NOW,
    };
    const [fabric] = existing
      ? await rest(`/rest/v1/fabrics?id=eq.${existing.id}&select=*`, {
          body: payload,
          headers: {
            Prefer: "return=representation",
          },
          method: "PATCH",
        })
      : await rest("/rest/v1/fabrics?select=*", {
          body: {
            ...payload,
            created_at: NOW,
          },
          headers: {
            Prefer: "return=representation",
          },
          method: "POST",
        });

    seeded.push({
      ...fabric,
      fixture_slug: definition.slug,
    });
  }

  return seeded;
}

async function seedSofas(manifest, tags, fabrics) {
  const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag]));
  const fabricBySlug = new Map(
    fabrics.map((fabric) => [fabric.fixture_slug, fabric]),
  );
  const seeded = [];

  for (const definition of manifest.sofas) {
    const existing = await selectSingle(
      `/rest/v1/sofas?public_slug=eq.${encodeURIComponent(definition.publicSlug)}&select=*`,
    );
    const payload = {
      archived_at:
        definition.lifecycleState === "archived"
          ? (existing?.archived_at ?? NOW)
          : null,
      depth_cm: definition.depthCm,
      first_published_at:
        definition.lifecycleState === "published"
          ? (existing?.first_published_at ?? NOW)
          : null,
      footprint_measurements: definition.lengthCm
        ? {
            length_cm: definition.lengthCm,
          }
        : null,
      footprint_type: definition.footprintType,
      height_cm: definition.heightCm,
      internal_name: definition.internalName,
      lifecycle_state: definition.lifecycleState,
      length_cm: definition.lengthCm,
      manual_public_order: definition.manualPublicOrder,
      published_at:
        definition.lifecycleState === "published"
          ? (existing?.published_at ?? NOW)
          : null,
      public_description: definition.publicDescription,
      public_name: definition.publicName,
      public_slug: definition.publicSlug,
      shopify_order_url: definition.shopifyOrderUrl,
      updated_at: NOW,
    };
    const [sofa] = existing
      ? await rest(`/rest/v1/sofas?id=eq.${existing.id}&select=*`, {
          body: payload,
          headers: {
            Prefer: "return=representation",
          },
          method: "PATCH",
        })
      : await rest("/rest/v1/sofas?select=*", {
          body: {
            ...payload,
            created_at: NOW,
          },
          headers: {
            Prefer: "return=representation",
          },
          method: "POST",
        });

    for (const tagSlug of definition.tagSlugs) {
      const tag = tagBySlug.get(tagSlug);

      if (tag) {
        await upsertRows(
          "sofa_tags",
          ["sofa_id", "tag_id"],
          [
            {
              created_at: NOW,
              sofa_id: sofa.id,
              tag_id: tag.id,
            },
          ],
        );
      }
    }

    const assignedFabrics = definition.fabricSlugs.map((slug) =>
      requireMapValue(fabricBySlug, slug, `fabric "${slug}"`),
    );

    for (const [index, fabric] of assignedFabrics.entries()) {
      await upsertRows(
        "sofa_fabrics",
        ["sofa_id", "fabric_id"],
        [
          {
            assigned_at: NOW,
            fabric_id: fabric.id,
            public_order: index + 1,
            sofa_id: sofa.id,
            updated_at: NOW,
          },
        ],
      );
    }

    await seedVisualMatrixForSofa({
      assignedFabrics,
      definition,
      fabricBySlug,
      manifest,
      sofa,
    });
    seeded.push(sofa);
  }

  return seeded;
}

async function seedVisualMatrixForSofa({
  assignedFabrics,
  definition,
  fabricBySlug,
  manifest,
  sofa,
}) {
  for (const position of definition.visualPositions) {
    const sourceFabric = requireMapValue(
      fabricBySlug,
      position.sourceFabricSlug,
      `source fabric "${position.sourceFabricSlug}"`,
    );
    const existingColumn = await selectSingle(
      `/rest/v1/visual_matrix_columns?sofa_id=eq.${sofa.id}&sequence=eq.${position.sequence}&deleted_at=is.null&select=*`,
    );
    const columnPayload = {
      admin_label: position.adminLabel,
      public_label: position.publicLabel,
      sequence: position.sequence,
      sofa_id: sofa.id,
      updated_at: NOW,
    };
    const [column] = existingColumn
      ? await rest(
          `/rest/v1/visual_matrix_columns?id=eq.${existingColumn.id}&select=*`,
          {
            body: columnPayload,
            headers: {
              Prefer: "return=representation",
            },
            method: "PATCH",
          },
        )
      : await rest("/rest/v1/visual_matrix_columns?select=*", {
          body: {
            ...columnPayload,
            created_at: NOW,
          },
          headers: {
            Prefer: "return=representation",
          },
          method: "POST",
        });
    const shouldSeedSourcePhoto =
      definition.renderCoverage !== "none" && !position.skipSourcePhoto;
    let sourceAsset = null;
    let sourceImage = null;
    let sourcePhoto = null;

    if (shouldSeedSourcePhoto) {
      sourceImage = await readFixtureImage(
        position.sourceImage,
        `sofa ${definition.publicSlug} position ${position.sequence} source photo`,
        "sofaSourcePhoto",
      );
      sourceAsset = await upsertImageAsset({
        assetKind: "sofa_source_photo",
        bucketId: "catalog-private-assets",
        image: sourceImage,
        objectPath: objectPathFor(
          manifest.prefix,
          `sofas/${definition.publicSlug}/positions/${position.sequence}-source${sourceImage.extension}`,
        ),
        visibility: "private",
      });
      [sourcePhoto] = await upsertRows(
        "sofa_source_photos",
        ["sofa_id", "visual_matrix_column_id", "original_fabric_id"],
        [
          {
            asset_id: sourceAsset.id,
            original_fabric_id: sourceFabric.id,
            sofa_id: sofa.id,
            updated_at: NOW,
            visual_matrix_column_id: column.id,
          },
        ],
      );
    }

    await rest(`/rest/v1/visual_matrix_columns?id=eq.${column.id}`, {
      body: {
        current_source_photo_id: sourcePhoto?.id ?? null,
        updated_at: NOW,
      },
      method: "PATCH",
    });

    for (const fabric of assignedFabrics) {
      const isSourceFabric = fabric.id === sourceFabric.id;
      const seedSourceOnlyRender =
        definition.renderCoverage === "source-only" &&
        isSourceFabric &&
        sourceAsset;
      const seedCompleteRender = definition.renderCoverage === "complete";
      const shouldSeedPrivateRender =
        seedCompleteRender || seedSourceOnlyRender;
      let privateAsset = null;
      let publicAsset = null;
      let renderImage = null;
      let sourcePhotoId = null;
      let sourceType =
        isSourceFabric && sourceAsset ? "source_photo" : "ai_generated";

      if (shouldSeedPrivateRender) {
        if (isSourceFabric && sourceAsset && sourceImage) {
          privateAsset = sourceAsset;
          renderImage = sourceImage;
          sourcePhotoId = sourcePhoto?.id ?? null;
        } else {
          sourceType = "manual_upload";
          renderImage =
            sourceImage ??
            (await generateDeterministicFixtureImage(
              `sofa ${definition.publicSlug} fabric ${fabric.fixture_slug} position ${position.sequence} private render`,
              "render",
            ));
          privateAsset = await upsertImageAsset({
            assetKind: "manual_render",
            bucketId: "catalog-private-assets",
            image: renderImage,
            objectPath: objectPathFor(
              manifest.prefix,
              `sofas/${definition.publicSlug}/renders/${fabric.fixture_slug}/position-${position.sequence}-private${renderImage.extension}`,
            ),
            visibility: "private",
          });
        }

        if (definition.lifecycleState === "published" && renderImage) {
          publicAsset = await upsertImageAsset({
            assetKind: "published_sofa_render",
            bucketId: "catalog-public-assets",
            image: renderImage,
            objectPath: objectPathFor(
              manifest.prefix,
              `sofas/${definition.publicSlug}/published/${fabric.fixture_slug}/position-${position.sequence}${renderImage.extension}`,
            ),
            visibility: "public",
          });
        }
      }

      await upsertRows(
        "sofa_render_cells",
        ["sofa_id", "fabric_id", "visual_matrix_column_id"],
        [
          {
            accepted_fabric_render_candidate_id: null,
            current_private_asset_id: privateAsset?.id ?? null,
            current_public_asset_id: publicAsset?.id ?? null,
            fabric_id: fabric.id,
            sofa_id: sofa.id,
            source_photo_id: sourcePhotoId,
            source_type: sourceType,
            updated_at: NOW,
            visual_matrix_column_id: column.id,
          },
        ],
      );
    }
  }
}

async function upsertImageAsset({
  assetKind,
  bucketId,
  image,
  objectPath,
  visibility,
}) {
  await uploadStorageObject(
    bucketId,
    objectPath,
    image.bytes,
    image.contentType,
  );

  const [asset] = await upsertRows(
    "storage_assets",
    ["bucket_id", "object_path"],
    [
      {
        asset_kind: assetKind,
        bucket_id: bucketId,
        byte_size: image.bytes.byteLength,
        checksum_sha256: sha256(image.bytes),
        content_type: image.contentType,
        height_px: image.heightPx,
        lifecycle_state: "active",
        object_path: objectPath,
        purged_at: null,
        deleted_at: null,
        visibility,
        width_px: image.widthPx,
      },
    ],
  );

  if (VARIANT_SOURCE_ASSET_KINDS.has(assetKind)) {
    await upsertImageAssetVariants({
      asset,
      image,
    });
  }

  return asset;
}

async function upsertImageAssetVariants({ asset, image }) {
  const variants = await generateImageVariants({
    bytes: image.bytes,
    contentType: image.contentType,
  });

  for (const variantKind of BACKFILL_VARIANT_KINDS) {
    const existingLink = await selectSingle(
      `/rest/v1/storage_asset_variants?original_asset_id=eq.${asset.id}&variant_kind=eq.${variantKind}&select=variant_asset_id`,
    );

    if (existingLink?.variant_asset_id) {
      continue;
    }

    const generatedVariant = variants[variantKind];
    const variantAssetId = randomUUID();
    const objectPath = buildVariantObjectPath({
      contentType: generatedVariant.contentType,
      originalAssetId: asset.id,
      variantAssetId,
      variantKind,
    });

    await uploadStorageObject(
      asset.bucket_id,
      objectPath,
      generatedVariant.bytes,
      generatedVariant.contentType,
    );

    const [variantAsset] = await upsertRows(
      "storage_assets",
      ["bucket_id", "object_path"],
      [
        {
          asset_kind: `${asset.asset_kind}_variant`,
          bucket_id: asset.bucket_id,
          byte_size: generatedVariant.bytes.byteLength,
          checksum_sha256: sha256(generatedVariant.bytes),
          content_type: generatedVariant.contentType,
          height_px: generatedVariant.heightPx,
          id: variantAssetId,
          lifecycle_state: "active",
          object_path: objectPath,
          purged_at: null,
          deleted_at: null,
          visibility: asset.visibility,
          width_px: generatedVariant.widthPx,
        },
      ],
    );

    await upsertRows(
      "storage_asset_variants",
      ["original_asset_id", "variant_kind"],
      [
        {
          generation_kind: "stored",
          original_asset_id: asset.id,
          variant_asset_id: variantAsset.id,
          variant_kind: variantKind,
        },
      ],
    );
  }
}

async function uploadStorageObject(bucketId, objectPath, bytes, contentType) {
  let response;

  try {
    response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucketId}/${objectPath}`,
      {
        body: bytes,
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        method: "POST",
      },
    );
  } catch (error) {
    failConnection(error);
  }

  if (!response.ok) {
    const text = await response.text();
    fail(
      `Storage upload failed for ${bucketId}/${objectPath}: HTTP ${response.status} ${text}`,
    );
  }
}

async function upsertRows(table, conflictColumns, rows) {
  return rest(
    `/rest/v1/${table}?on_conflict=${conflictColumns.join(",")}&select=*`,
    {
      body: rows,
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      method: "POST",
    },
  );
}

async function selectSingle(path) {
  const rows = await rest(path);

  return rows[0] ?? null;
}

async function rest(path, init = {}) {
  let response;

  try {
    response = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      body:
        init.body === undefined || typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body),
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    failConnection(error);
  }

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      fail(`REST ${path} returned non-JSON response: ${text}`);
    }
  }

  if (!response.ok) {
    fail(`REST ${path} failed with HTTP ${response.status}: ${text}`);
  }

  return body;
}

async function readFixtureImage(relativePath, label, kind) {
  if (!relativePath) {
    return generateDeterministicFixtureImage(label, kind);
  }

  const imagePath = resolve(FIXTURE_ROOT, relativePath);

  if (!isPathInside(imagePath, FIXTURE_ROOT)) {
    fail(`${label} path must stay inside ${FIXTURE_ROOT}.`);
  }

  if (!existsSync(imagePath)) {
    return generateDeterministicFixtureImage(label, kind, relativePath);
  }

  const bytes = readFileSync(imagePath);
  const contentType = detectImageContentType(bytes, imagePath);

  if (!contentType) {
    fail(`${label} must be a PNG, JPEG, or WebP image.`);
  }

  const size = readImageSize(bytes, contentType);

  return {
    bytes,
    contentType,
    extension: extensionForContentType(contentType),
    heightPx: size?.height ?? null,
    widthPx: size?.width ?? null,
  };
}

async function generateDeterministicFixtureImage(label, kind, requestedPath) {
  const preset =
    GENERATED_IMAGE_PRESETS[kind] ?? GENERATED_IMAGE_PRESETS.render;
  const contentType = generatedContentTypeFor(
    requestedPath,
    preset.contentType,
  );
  const width = preset.widthPx;
  const height = preset.heightPx;
  const image = new Image(width, height);
  const palette = paletteFor(label);

  if (kind === "fabricSwatch" || kind === "fabricAiReference") {
    drawFabricFixture(image, palette);
  } else {
    drawSofaFixture(image, palette);
  }

  const bytes =
    contentType === "image/jpeg"
      ? await image.encodeJPEG(86)
      : await image.encode();

  return {
    bytes: Buffer.from(bytes),
    contentType,
    extension: extensionForContentType(contentType),
    heightPx: height,
    widthPx: width,
  };
}

function drawFabricFixture(image, palette) {
  image.fill(toImageColor(palette.base));

  const bandHeight = Math.max(10, Math.round(image.height / 14));
  for (let y = 1; y <= image.height; y += bandHeight * 2) {
    drawBox(image, 1, y, image.width, y + bandHeight, palette.accent);
  }

  const dotSize = Math.max(4, Math.round(image.width / 28));
  const step = dotSize * 4;
  for (let y = step; y <= image.height; y += step) {
    for (let x = step; x <= image.width; x += step) {
      drawBox(image, x, y, x + dotSize, y + dotSize, palette.light);
    }
  }

  for (let offset = -image.height; offset < image.width; offset += step * 2) {
    drawDiagonalStripe(image, offset, dotSize, palette.dark);
  }
}

function drawSofaFixture(image, palette) {
  image.fill(toImageColor(palette.wall));
  drawBox(
    image,
    1,
    Math.round(image.height * 0.58),
    image.width,
    image.height,
    palette.floor,
  );
  drawBox(
    image,
    Math.round(image.width * 0.14),
    Math.round(image.height * 0.72),
    Math.round(image.width * 0.9),
    Math.round(image.height * 0.78),
    palette.shadow,
  );
  drawBox(
    image,
    Math.round(image.width * 0.18),
    Math.round(image.height * 0.38),
    Math.round(image.width * 0.82),
    Math.round(image.height * 0.62),
    palette.dark,
  );
  drawBox(
    image,
    Math.round(image.width * 0.22),
    Math.round(image.height * 0.3),
    Math.round(image.width * 0.78),
    Math.round(image.height * 0.48),
    palette.base,
  );
  drawBox(
    image,
    Math.round(image.width * 0.18),
    Math.round(image.height * 0.52),
    Math.round(image.width * 0.82),
    Math.round(image.height * 0.68),
    palette.accent,
  );
  drawBox(
    image,
    Math.round(image.width * 0.55),
    Math.round(image.height * 0.54),
    Math.round(image.width * 0.86),
    Math.round(image.height * 0.77),
    palette.base,
  );

  const cushionCount = 3;
  const cushionWidth = Math.round((image.width * 0.56) / cushionCount);
  const cushionY1 = Math.round(image.height * 0.53);
  const cushionY2 = Math.round(image.height * 0.66);
  for (let index = 0; index < cushionCount; index += 1) {
    const x1 = Math.round(image.width * 0.2) + index * cushionWidth;
    drawBox(
      image,
      x1,
      cushionY1,
      x1 + cushionWidth - 6,
      cushionY2,
      palette.light,
    );
  }
}

function drawDiagonalStripe(image, startX, size, color) {
  for (let index = 0; index < image.height; index += 1) {
    const x = startX + index;
    if (x < 1 || x > image.width) {
      continue;
    }

    drawBox(
      image,
      x,
      index + 1,
      Math.min(image.width, x + size),
      Math.min(image.height, index + size),
      color,
    );
  }
}

function drawBox(image, x1, y1, x2, y2, color) {
  const left = clampInteger(x1, 1, image.width);
  const top = clampInteger(y1, 1, image.height);
  const right = clampInteger(x2, 1, image.width);
  const bottom = clampInteger(y2, 1, image.height);

  image.drawBox(
    left,
    top,
    Math.max(1, right - left + 1),
    Math.max(1, bottom - top + 1),
    toImageColor(color),
  );
}

function paletteFor(label) {
  const hash = createHash("sha256").update(label).digest();
  const base = [
    70 + (hash[0] % 120),
    70 + (hash[1] % 110),
    70 + (hash[2] % 110),
  ];

  return {
    accent: mixRgb(base, [238, 232, 218], 0.35),
    base,
    dark: mixRgb(base, [24, 24, 28], 0.45),
    floor: mixRgb(base, [186, 174, 154], 0.65),
    light: mixRgb(base, [248, 245, 235], 0.58),
    shadow: [42, 38, 36, 255],
    wall: mixRgb(base, [224, 226, 220], 0.78),
  };
}

function mixRgb(left, right, ratio) {
  return [
    Math.round(left[0] * (1 - ratio) + right[0] * ratio),
    Math.round(left[1] * (1 - ratio) + right[1] * ratio),
    Math.round(left[2] * (1 - ratio) + right[2] * ratio),
    255,
  ];
}

function toImageColor(color) {
  return Image.rgbaToColor(color[0], color[1], color[2], color[3] ?? 255);
}

function generatedContentTypeFor(requestedPath, fallbackContentType) {
  const extension = extname(requestedPath ?? "").toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  return fallbackContentType;
}

function detectImageContentType(bytes, path) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  const extension = extname(path).toLowerCase();

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return null;
}

function readImageSize(bytes, contentType) {
  if (contentType === "image/png" && bytes.length >= 24) {
    return {
      height: bytes.readUInt32BE(20),
      width: bytes.readUInt32BE(16),
    };
  }

  if (contentType === "image/jpeg") {
    return readJpegSize(bytes);
  }

  return null;
}

function readJpegSize(bytes) {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }

    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);

    if (length < 2) {
      return null;
    }

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3
    ) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function extensionForContentType(contentType) {
  if (contentType === "image/jpeg") {
    return ".jpg";
  }

  if (contentType === "image/webp") {
    return ".webp";
  }

  return ".png";
}

function objectPathFor(prefix, suffix) {
  return `local-admin-fixtures/${slugify(prefix)}/${suffix}`;
}

function defaultManifest() {
  const prefix = process.env.LOCAL_ADMIN_SEED_PREFIX ?? "mobel-local";

  return {
    fabrics: [
      {
        internal_name: `${prefix} fabric grey soft`,
        is_premium: false,
        public_name: "Grey Soft",
        slug: "grey-soft",
      },
      {
        internal_name: `${prefix} fabric beige dotted`,
        is_premium: false,
        public_name: "Beige Dotted",
        slug: "beige-dotted",
      },
      {
        internal_name: `${prefix} fabric beige textured`,
        is_premium: true,
        public_name: "Beige Textured",
        slug: "beige-textured",
      },
    ],
    prefix,
    sofas: [
      {
        depth_cm: 175,
        fabric_slugs: ["grey-soft", "beige-dotted", "beige-textured"],
        footprint_type: "straight",
        height_cm: 82,
        internal_name: `${prefix} sofa published complete`,
        length_cm: 285,
        lifecycle_state: "published",
        public_description:
          "Published local fixture with complete public render coverage.",
        public_name: "Local Published Complete Sofa",
        render_coverage: "complete",
        shopify_order_url:
          "https://shopify.example/products/local-published-complete-sofa",
        slug: `${prefix}-published-complete`,
        source_fabric_slug: "grey-soft",
        tag_slugs: [`${prefix}-test`, `${prefix}-public`],
        visual_positions: [
          {
            admin_label: "Front",
            public_label: "Front",
            sequence: 1,
          },
          {
            admin_label: "Angle",
            public_label: "Angle",
            sequence: 2,
          },
        ],
      },
      {
        depth_cm: 102,
        fabric_slugs: ["grey-soft", "beige-dotted", "beige-textured"],
        footprint_type: "straight",
        height_cm: 84,
        internal_name: `${prefix} sofa draft ready`,
        length_cm: 248,
        lifecycle_state: "draft",
        public_description:
          "Draft local fixture with complete private render coverage.",
        public_name: "Local Draft Ready Sofa",
        render_coverage: "complete",
        shopify_order_url:
          "https://shopify.example/products/local-draft-ready-sofa",
        slug: `${prefix}-draft-ready`,
        source_fabric_slug: "beige-textured",
        tag_slugs: [`${prefix}-test`, `${prefix}-soft`],
        visual_positions: [
          {
            admin_label: "Front",
            public_label: "Front",
            sequence: 1,
          },
          {
            admin_label: "Angle",
            public_label: "Angle",
            sequence: 2,
          },
        ],
      },
      {
        depth_cm: 190,
        fabric_slugs: ["grey-soft", "beige-dotted", "beige-textured"],
        footprint_type: "corner",
        height_cm: 86,
        internal_name: `${prefix} sofa archived complete`,
        length_cm: 305,
        lifecycle_state: "archived",
        public_description:
          "Archived local fixture kept out of the public catalog.",
        public_name: "Local Archived Complete Sofa",
        render_coverage: "complete",
        shopify_order_url:
          "https://shopify.example/products/local-archived-complete-sofa",
        slug: `${prefix}-archived-complete`,
        source_fabric_slug: "beige-dotted",
        tag_slugs: [`${prefix}-test`, `${prefix}-corner`],
        visual_positions: [
          {
            admin_label: "Right corner",
            public_label: "Right corner",
            sequence: 1,
          },
          {
            admin_label: "Left corner",
            public_label: "Left corner",
            sequence: 2,
          },
        ],
      },
      {
        depth_cm: 94,
        fabric_slugs: ["grey-soft", "beige-dotted", "beige-textured"],
        footprint_type: "straight",
        height_cm: 79,
        internal_name: `${prefix} sofa draft source only`,
        length_cm: 218,
        lifecycle_state: "draft",
        public_description:
          "Draft local fixture that still needs generated fabric renders.",
        public_name: "Local Draft Source Only Sofa",
        render_coverage: "source-only",
        shopify_order_url:
          "https://shopify.example/products/local-draft-source-only-sofa",
        slug: `${prefix}-draft-source-only`,
        source_fabric_slug: "grey-soft",
        tag_slugs: [`${prefix}-test`, `${prefix}-needs-generation`],
        visual_positions: [
          {
            admin_label: "Front",
            public_label: "Front",
            sequence: 1,
          },
          {
            admin_label: "Side",
            public_label: "Side",
            sequence: 2,
          },
        ],
      },
      {
        depth_cm: 88,
        fabric_slugs: ["grey-soft", "beige-dotted", "beige-textured"],
        footprint_type: "straight",
        height_cm: 76,
        internal_name: `${prefix} sofa draft no images`,
        length_cm: 196,
        lifecycle_state: "draft",
        public_description:
          "Draft local fixture with metadata and fabrics but no source or render images.",
        public_name: "Local Draft No Images Sofa",
        render_coverage: "none",
        shopify_order_url:
          "https://shopify.example/products/local-draft-no-images-sofa",
        slug: `${prefix}-draft-no-images`,
        source_fabric_slug: "grey-soft",
        tag_slugs: [`${prefix}-test`, `${prefix}-missing-images`],
        visual_positions: [
          {
            admin_label: "Front",
            public_label: "Front",
            sequence: 1,
            skip_source_photo: true,
          },
        ],
      },
    ],
    tags: [
      {
        public_label: "Local Test",
        slug: `${prefix}-test`,
      },
      {
        public_label: "Local Public",
        slug: `${prefix}-public`,
      },
      {
        public_label: "Local Soft",
        slug: `${prefix}-soft`,
      },
      {
        public_label: "Local Corner",
        slug: `${prefix}-corner`,
      },
      {
        public_label: "Needs Generation",
        slug: `${prefix}-needs-generation`,
      },
      {
        public_label: "Missing Images",
        slug: `${prefix}-missing-images`,
      },
    ],
  };
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }
}

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");

    for (const line of content.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");

      if (process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local env file.
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function requiredString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${path} is required.`);
  }

  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function stringOrDefault(value, fallback) {
  const stringValue = optionalString(value);

  return stringValue ?? fallback;
}

function enumOrDefault(value, allowedValues, fallback, path) {
  const stringValue = optionalString(value);

  if (!stringValue) {
    return fallback;
  }

  if (!allowedValues.has(stringValue)) {
    fail(`${path} must be one of: ${[...allowedValues].join(", ")}.`);
  }

  return stringValue;
}

function positiveInteger(value, path) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${path} must be a positive integer.`);
  }

  return value;
}

function positiveIntegerOrNull(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function positiveNumberOrNull(value) {
  return typeof value === "number" && value > 0 ? value : null;
}

function requireMapValue(map, key, label) {
  const value = map.get(key);

  if (!value) {
    fail(`Missing ${label}.`);
  }

  return value;
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultSofaLifecycleState(index) {
  if (index <= 2) {
    return "published";
  }

  if (index === 3) {
    return "archived";
  }

  return "draft";
}

function defaultSofaRenderCoverage(index, lifecycleState) {
  if (lifecycleState === "published" || lifecycleState === "archived") {
    return "complete";
  }

  if (index === 1) {
    return "complete";
  }

  if (index >= 4) {
    return "none";
  }

  return "source-only";
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isPathInside(path, parent) {
  const normalizedParent = parent.endsWith(sep) ? parent : `${parent}${sep}`;

  return path === parent || path.startsWith(normalizedParent);
}

function isLocalUrl(url) {
  return url.includes("127.0.0.1") || url.includes("localhost");
}

function fail(message) {
  console.error(`FAIL local admin fixtures seed: ${message}`);
  process.exit(1);
}

function failConnection(error) {
  const code = error?.cause?.code ?? error?.code;

  fail(
    `Cannot reach Supabase at ${SUPABASE_URL}${
      code ? ` (${code})` : ""
    }. Run \`pnpm supabase:start\` first, then rerun this script.`,
  );
}
