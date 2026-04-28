import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type JsonObject = Record<string, unknown>;
type SupabaseCatalogClient = any;

export type AdminCatalogErrorStatus = 400 | 404 | 409 | 422 | 500;

export type AdminCatalogErrorCode =
  | "CATALOG_UNAVAILABLE"
  | "FABRIC_ARCHIVED"
  | "FABRIC_CONFLICT"
  | "FABRIC_NOT_FOUND"
  | "SOFA_FABRIC_NOT_FOUND"
  | "SOFA_FABRIC_ORDER_CONFLICT"
  | "SOFA_CONFLICT"
  | "SOFA_NOT_FOUND"
  | "TAG_CONFLICT"
  | "TAG_IN_USE"
  | "TAG_NOT_FOUND"
  | "UPLOAD_NOT_FOUND";

export interface AdminCatalogOperationErrorData {
  code: AdminCatalogErrorCode | string;
  details?: JsonObject;
  message: string;
  status: AdminCatalogErrorStatus;
}

export class AdminCatalogOperationError extends Error {
  code: AdminCatalogOperationErrorData["code"];
  details?: JsonObject;
  status: AdminCatalogErrorStatus;

  constructor(error: AdminCatalogOperationErrorData) {
    super(error.message);
    this.code = error.code;
    this.details = error.details;
    this.status = error.status;
  }
}

export interface AdminTagRecord {
  id: string;
  public_label: string;
  slug: string;
}

export interface AdminSofaRecord {
  created_at: string;
  depth_cm?: number | null;
  footprint_measurements?: unknown;
  footprint_type?: string | null;
  height_cm?: number | null;
  id: string;
  internal_name: string;
  lifecycle_state: string;
  manual_public_order?: number | null;
  public_description?: string | null;
  public_name?: string | null;
  public_slug?: string | null;
  shopify_order_url?: string | null;
  tags?: AdminTagRecord[];
  updated_at: string;
  length_cm?: number | null;
}

export interface AdminStorageAssetRecord {
  asset_kind: string;
  bucket_id?: string;
  byte_size?: number | null;
  content_type: string;
  height_px?: number | null;
  id: string;
  lifecycle_state: string;
  object_path?: string;
  visibility: string;
  width_px?: number | null;
}

export interface AdminFabricRecord {
  ai_reference_asset?: AdminStorageAssetRecord | JsonObject | null;
  ai_reference_asset_id: string;
  archived_at?: string | null;
  created_at: string;
  id: string;
  internal_name: string;
  is_premium: boolean;
  lifecycle_state: string;
  public_name: string;
  swatch_asset?: AdminStorageAssetRecord | JsonObject | null;
  swatch_asset_id: string;
  updated_at: string;
}

export interface AdminUploadRecord {
  expires_at: string;
  method: "signed_upload";
  signed_upload_url: string;
  upload_id: string;
}

export interface AdminSofaFabricRecord {
  assigned_at: string;
  fabric?: AdminFabricRecord | JsonObject | null;
  fabric_id: string;
  public_order: number | null;
  sofa_id: string;
  updated_at: string;
}

export interface AdminCatalogStore {
  archiveFabric(
    fabricId: string,
  ): Promise<AdminFabricRecord | JsonObject | null>;
  assignSofaFabric(
    sofaId: string,
    fabricId: string,
    input: SofaFabricMutationInput,
  ): Promise<
    AdminSofaFabricRecord | JsonObject | AdminCatalogOperationErrorData
  >;
  completeUpload(
    uploadId: string,
  ): Promise<
    AdminStorageAssetRecord | JsonObject | AdminCatalogOperationErrorData
  >;
  createFabric(
    input: FabricMutationInput,
  ): Promise<AdminFabricRecord | JsonObject>;
  createSofa(input: SofaMutationInput): Promise<AdminSofaRecord | JsonObject>;
  createTag(input: TagMutationInput): Promise<AdminTagRecord | JsonObject>;
  createUpload(
    input: UploadCreateInput,
  ): Promise<AdminUploadRecord | JsonObject>;
  deleteTag(tagId: string): Promise<AdminCatalogOperationErrorData | null>;
  getFabric(fabricId: string): Promise<AdminFabricRecord | JsonObject | null>;
  getSofa(sofaId: string): Promise<AdminSofaRecord | JsonObject | null>;
  getSofaPublicationReadiness(
    sofaId: string,
  ): Promise<PublicationReadiness | null>;
  listFabrics(): Promise<Array<AdminFabricRecord | JsonObject>>;
  listSofas(): Promise<Array<AdminSofaRecord | JsonObject>>;
  listSofaFabrics(
    sofaId: string,
  ): Promise<Array<AdminSofaFabricRecord | JsonObject> | null>;
  listTags(): Promise<Array<AdminTagRecord | JsonObject>>;
  removeSofaFabric(
    sofaId: string,
    fabricId: string,
  ): Promise<AdminCatalogOperationErrorData | null>;
  updateFabric(
    fabricId: string,
    input: FabricPatchInput,
  ): Promise<AdminFabricRecord | JsonObject | null>;
  updateSofa(
    sofaId: string,
    input: SofaPatchInput,
  ): Promise<AdminSofaRecord | JsonObject | null>;
  updateSofaFabric(
    sofaId: string,
    fabricId: string,
    input: SofaFabricMutationInput,
  ): Promise<
    AdminSofaFabricRecord | JsonObject | AdminCatalogOperationErrorData
  >;
  updateTag(
    tagId: string,
    input: TagMutationInput,
  ): Promise<AdminTagRecord | JsonObject | null>;
}

export interface PublicationReadiness {
  errors: Array<{
    code: string;
    message: string;
  }>;
  ready: boolean;
}

export type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      error: {
        code: "INVALID_REQUEST" | "UNSUPPORTED_FIELD" | "VALIDATION_FAILED";
        details: JsonObject;
        message: string;
      };
      ok: false;
      status: 400 | 422;
    };

export interface SofaMutationInput {
  depth_cm?: number | null;
  footprint_measurements?: unknown;
  footprint_type?: string | null;
  height_cm?: number | null;
  internal_name: string;
  manual_public_order?: number | null;
  public_description?: string | null;
  public_name?: string | null;
  shopify_order_url?: string | null;
  tag_ids: string[];
  length_cm?: number | null;
}

export type SofaPatchInput = Partial<Omit<SofaMutationInput, "internal_name">> &
  Pick<Partial<SofaMutationInput>, "internal_name">;

export interface TagMutationInput {
  public_label: string;
  slug: string;
}

export interface FabricMutationInput {
  ai_reference_asset_id: string;
  internal_name: string;
  is_premium: boolean;
  public_name: string;
  swatch_asset_id: string;
}

export type FabricPatchInput = Partial<FabricMutationInput>;

export interface UploadCreateInput {
  byte_size: number;
  content_type: string;
  purpose: UploadPurpose;
}

export type UploadPurpose = "fabric_swatch" | "fabric_ai_reference";

export interface SofaFabricMutationInput {
  public_order: number | null;
}

const SOFA_FIELDS = [
  "internal_name",
  "public_name",
  "shopify_order_url",
  "public_description",
  "length_cm",
  "depth_cm",
  "height_cm",
  "footprint_type",
  "footprint_measurements",
  "manual_public_order",
  "tag_ids",
] as const;

const TAG_FIELDS = ["public_label"] as const;

const FABRIC_FIELDS = [
  "internal_name",
  "public_name",
  "swatch_asset_id",
  "ai_reference_asset_id",
  "is_premium",
] as const;

const UPLOAD_FIELDS = ["purpose", "content_type", "byte_size"] as const;

const SOFA_FABRIC_FIELDS = ["public_order"] as const;

const UPLOAD_PURPOSES = ["fabric_swatch", "fabric_ai_reference"] as const;

const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const MAX_ADMIN_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_RENDER_INPUT_EDGE_PX = 2048;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSofaCreatePayload(
  payload: unknown,
): ValidationResult<SofaMutationInput> {
  const baseResult = validateSofaPayload(payload, {
    requireInternalName: true,
  });

  if (!baseResult.ok) {
    return baseResult;
  }

  return {
    ok: true,
    value: {
      ...baseResult.value,
      internal_name: baseResult.value.internal_name ?? "",
      tag_ids: baseResult.value.tag_ids ?? [],
    },
  };
}

export function validateSofaPatchPayload(
  payload: unknown,
): ValidationResult<SofaPatchInput> {
  const baseResult = validateSofaPayload(payload, {
    requireInternalName: false,
  });

  if (!baseResult.ok) {
    return baseResult;
  }

  return {
    ok: true,
    value: baseResult.value,
  };
}

export function validateTagMutationPayload(
  payload: unknown,
): ValidationResult<TagMutationInput> {
  if (!isRecord(payload)) {
    return invalidRequest("Request body must be a JSON object.");
  }

  const unsupportedFields = findUnsupportedFields(payload, TAG_FIELDS);

  if (unsupportedFields.length > 0) {
    return unsupportedField(unsupportedFields);
  }

  const publicLabel = readStringField(payload, "public_label", {
    allowNull: false,
    required: true,
  });

  if (!publicLabel.ok) {
    return validationFailed(publicLabel.fields);
  }

  const publicLabelValue = publicLabel.value ?? "";

  return {
    ok: true,
    value: {
      public_label: publicLabelValue,
      slug: buildPublicTagSlug(publicLabelValue),
    },
  };
}

export function validateFabricCreatePayload(
  payload: unknown,
): ValidationResult<FabricMutationInput> {
  const result = validateFabricPayload(payload, {
    requireAll: true,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value: {
      ai_reference_asset_id: result.value.ai_reference_asset_id ?? "",
      internal_name: result.value.internal_name ?? "",
      is_premium: result.value.is_premium ?? false,
      public_name: result.value.public_name ?? "",
      swatch_asset_id: result.value.swatch_asset_id ?? "",
    },
  };
}

export function validateFabricPatchPayload(
  payload: unknown,
): ValidationResult<FabricPatchInput> {
  return validateFabricPayload(payload, {
    requireAll: false,
  });
}

export function validateUploadCreatePayload(
  payload: unknown,
): ValidationResult<UploadCreateInput> {
  if (!isRecord(payload)) {
    return invalidRequest("Request body must be a JSON object.");
  }

  const unsupportedFields = findUnsupportedFields(payload, UPLOAD_FIELDS);

  if (unsupportedFields.length > 0) {
    return unsupportedField(unsupportedFields);
  }

  const fields: string[] = [];
  const purpose =
    typeof payload.purpose === "string" &&
    (UPLOAD_PURPOSES as readonly string[]).includes(payload.purpose)
      ? (payload.purpose as UploadPurpose)
      : null;
  const contentType =
    typeof payload.content_type === "string"
      ? payload.content_type.trim().toLowerCase()
      : null;
  const byteSize = payload.byte_size;

  if (!purpose) {
    fields.push("purpose");
  }

  if (
    !contentType ||
    !(IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)
  ) {
    fields.push("content_type");
  }

  if (
    typeof byteSize !== "number" ||
    !Number.isInteger(byteSize) ||
    byteSize <= 0 ||
    byteSize > MAX_ADMIN_UPLOAD_BYTES
  ) {
    fields.push("byte_size");
  }

  if (fields.length > 0) {
    return validationFailed([...new Set(fields)]);
  }

  return {
    ok: true,
    value: {
      byte_size: byteSize as number,
      content_type: contentType as string,
      purpose: purpose as UploadPurpose,
    },
  };
}

export function validateSofaFabricMutationPayload(
  payload: unknown,
): ValidationResult<SofaFabricMutationInput> {
  if (!isRecord(payload)) {
    return invalidRequest("Request body must be a JSON object.");
  }

  const unsupportedFields = findUnsupportedFields(payload, SOFA_FABRIC_FIELDS);

  if (unsupportedFields.length > 0) {
    return unsupportedField(unsupportedFields);
  }

  const publicOrder = readPositiveNumberField(payload, "public_order", {
    integer: true,
    zeroAllowed: true,
  });

  if (!publicOrder.ok) {
    return validationFailed(["public_order"]);
  }

  return {
    ok: true,
    value: {
      public_order: publicOrder.present ? publicOrder.value : null,
    },
  };
}

export function buildPublicTagSlug(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tag";
}

export function shapeSofaResponse(record: AdminSofaRecord | JsonObject) {
  return {
    created_at: stringOrNull(record.created_at),
    depth_cm: numberOrNull(record.depth_cm),
    footprint_measurements:
      record.footprint_measurements === undefined
        ? null
        : record.footprint_measurements,
    footprint_type: stringOrNull(record.footprint_type),
    height_cm: numberOrNull(record.height_cm),
    id: stringOrNull(record.id),
    internal_name: stringOrNull(record.internal_name),
    lifecycle_state: stringOrNull(record.lifecycle_state),
    manual_public_order: numberOrNull(record.manual_public_order),
    public_description: stringOrNull(record.public_description),
    public_name: stringOrNull(record.public_name),
    public_slug: stringOrNull(record.public_slug),
    shopify_order_url: stringOrNull(record.shopify_order_url),
    tags: readTags(record.tags),
    updated_at: stringOrNull(record.updated_at),
    length_cm: numberOrNull(record.length_cm),
  };
}

export function shapeTagResponse(record: AdminTagRecord | JsonObject) {
  return {
    id: stringOrNull(record.id),
    public_label: stringOrNull(record.public_label),
    slug: stringOrNull(record.slug),
  };
}

export function shapeStorageAssetResponse(
  record: AdminStorageAssetRecord | JsonObject | null | undefined,
) {
  if (!record || !isRecord(record)) {
    return null;
  }

  return {
    asset_kind: stringOrNull(record.asset_kind),
    byte_size: numberOrNull(record.byte_size),
    content_type: stringOrNull(record.content_type),
    height_px: numberOrNull(record.height_px),
    id: stringOrNull(record.id),
    lifecycle_state: stringOrNull(record.lifecycle_state),
    visibility: stringOrNull(record.visibility),
    width_px: numberOrNull(record.width_px),
  };
}

export function shapeFabricResponse(record: AdminFabricRecord | JsonObject) {
  const aiReferenceAsset = isRecord(record.ai_reference_asset)
    ? record.ai_reference_asset
    : null;
  const swatchAsset = isRecord(record.swatch_asset)
    ? record.swatch_asset
    : null;

  return {
    ai_reference_asset: shapeStorageAssetResponse(aiReferenceAsset),
    ai_reference_asset_id: stringOrNull(record.ai_reference_asset_id),
    archived_at: stringOrNull(record.archived_at),
    created_at: stringOrNull(record.created_at),
    id: stringOrNull(record.id),
    internal_name: stringOrNull(record.internal_name),
    is_premium: Boolean(record.is_premium),
    lifecycle_state: stringOrNull(record.lifecycle_state),
    public_name: stringOrNull(record.public_name),
    swatch_asset: shapeStorageAssetResponse(swatchAsset),
    swatch_asset_id: stringOrNull(record.swatch_asset_id),
    updated_at: stringOrNull(record.updated_at),
  };
}

export function shapeUploadResponse(record: AdminUploadRecord | JsonObject) {
  return {
    expires_at: stringOrNull(record.expires_at),
    method: record.method === "signed_upload" ? "signed_upload" : null,
    signed_upload_url: stringOrNull(record.signed_upload_url),
    upload_id: stringOrNull(record.upload_id),
  };
}

export function shapeSofaFabricResponse(
  record: AdminSofaFabricRecord | JsonObject,
) {
  return {
    assigned_at: stringOrNull(record.assigned_at),
    fabric: isRecord(record.fabric) ? shapeFabricResponse(record.fabric) : null,
    fabric_id: stringOrNull(record.fabric_id),
    public_order: numberOrNull(record.public_order),
    sofa_id: stringOrNull(record.sofa_id),
    updated_at: stringOrNull(record.updated_at),
  };
}

export function createSupabaseAdminCatalogStore(
  env: NodeJS.ProcessEnv = process.env,
): AdminCatalogStore {
  const client = createClient(
    requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
    requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  ) as SupabaseCatalogClient;

  return {
    async archiveFabric(fabricId) {
      const existing = await fetchFabricWithAssets(client, fabricId);

      if (!existing) {
        return null;
      }

      const { error } = await client
        .from("fabrics")
        .update({
          archived_at: new Date().toISOString(),
          lifecycle_state: "archived",
        })
        .eq("id", fabricId);

      if (error) {
        throw mapSupabaseError(error);
      }

      return fetchFabricWithAssets(client, fabricId);
    },
    async assignSofaFabric(sofaId, fabricId, input) {
      const relationError = await validateSofaFabricRelation(client, {
        allowArchivedExistingAssignment: false,
        fabricId,
        sofaId,
      });

      if (relationError) {
        return relationError;
      }

      if (input.public_order !== null) {
        const orderError = await validateSofaFabricPublicOrder(client, {
          fabricId,
          publicOrder: input.public_order,
          sofaId,
        });

        if (orderError) {
          return orderError;
        }
      }

      const { error } = await client.from("sofa_fabrics").upsert({
        fabric_id: fabricId,
        public_order: input.public_order,
        sofa_id: sofaId,
      });

      if (error) {
        return mapSofaFabricMutationError(error);
      }

      const assignment = await fetchSofaFabricAssignment(
        client,
        sofaId,
        fabricId,
      );

      if (!assignment) {
        return {
          code: "SOFA_FABRIC_NOT_FOUND",
          message: "Sofa fabric assignment was not found.",
          status: 404,
        };
      }

      return assignment;
    },
    async completeUpload(uploadId) {
      const descriptor = readUploadDescriptor(uploadId, env);

      if (!descriptor) {
        return {
          code: "UPLOAD_NOT_FOUND",
          message: "Upload was not found.",
          status: 404,
        };
      }

      if (new Date(descriptor.expires_at).getTime() <= Date.now()) {
        return {
          code: "UPLOAD_NOT_FOUND",
          message: "Upload was not found.",
          status: 404,
        };
      }

      const { data: blob, error: downloadError } = await client.storage
        .from(descriptor.bucket_id)
        .download(descriptor.object_path);

      if (downloadError || !blob) {
        return {
          code: "UPLOAD_NOT_FOUND",
          message: "Upload was not found.",
          status: 404,
        };
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const imageMetadata = readImageMetadata(bytes, descriptor.content_type);

      if (!imageMetadata) {
        return {
          code: "UPLOAD_NOT_FOUND",
          message: "Upload was not found.",
          status: 404,
        };
      }

      if (
        descriptor.purpose === "fabric_ai_reference" &&
        Math.max(imageMetadata.width_px, imageMetadata.height_px) >
          MAX_RENDER_INPUT_EDGE_PX
      ) {
        return {
          code: "UPLOAD_NOT_FOUND",
          message: "Upload was not found.",
          status: 404,
        };
      }

      const { data, error } = await client
        .from("storage_assets")
        .insert({
          asset_kind: assetKindForUploadPurpose(descriptor.purpose),
          bucket_id: descriptor.bucket_id,
          byte_size: bytes.byteLength,
          content_type: descriptor.content_type,
          height_px: imageMetadata.height_px,
          object_path: descriptor.object_path,
          visibility:
            descriptor.purpose === "fabric_swatch" ? "public" : "private",
          width_px: imageMetadata.width_px,
        })
        .select(STORAGE_ASSET_SELECT)
        .single();

      if (error) {
        throw mapSupabaseError(error);
      }

      return data as AdminStorageAssetRecord;
    },
    async createFabric(input) {
      await verifyFabricAssets(client, input);

      const { data, error } = await client
        .from("fabrics")
        .insert({
          ...input,
          lifecycle_state: "active",
        })
        .select(FABRIC_SELECT)
        .single();

      if (error) {
        throw mapSupabaseError(error, {
          duplicateCode: "FABRIC_CONFLICT",
          duplicateMessage: "A fabric with these details already exists.",
        });
      }

      const fabric = await fetchFabricWithAssets(client, data.id as string);

      if (!fabric) {
        throw new AdminCatalogOperationError({
          code: "FABRIC_NOT_FOUND",
          message: "Created fabric could not be loaded.",
          status: 404,
        });
      }

      return fabric;
    },
    async createSofa(input) {
      await verifyTagsExist(client, input.tag_ids);

      const { tag_ids: tagIds, ...sofaInput } = input;
      const { data, error } = await client
        .from("sofas")
        .insert({
          ...sofaInput,
          lifecycle_state: "draft",
        })
        .select(SOFA_SELECT)
        .single();

      if (error) {
        throw mapSupabaseError(error);
      }

      await replaceSofaTags(client, data.id as string, tagIds);

      const sofa = await fetchSofaWithTags(client, data.id as string);

      if (!sofa) {
        throw new AdminCatalogOperationError({
          code: "SOFA_NOT_FOUND",
          message: "Created sofa could not be loaded.",
          status: 404,
        });
      }

      return sofa;
    },
    async createTag(input) {
      const { data, error } = await client
        .from("public_tags")
        .insert(input)
        .select(TAG_SELECT)
        .single();

      if (error) {
        throw mapSupabaseError(error, {
          duplicateCode: "TAG_CONFLICT",
          duplicateMessage: "A tag with this label or slug already exists.",
        });
      }

      return data as AdminTagRecord;
    },
    async createUpload(input) {
      const descriptor = createUploadDescriptor(input, env);
      const { data, error } = await client.storage
        .from(descriptor.bucket_id)
        .createSignedUploadUrl(descriptor.object_path);

      if (error || !data?.signedUrl) {
        throw mapSupabaseError(error ?? {});
      }

      return {
        expires_at: descriptor.expires_at,
        method: "signed_upload",
        signed_upload_url: data.signedUrl,
        upload_id: signUploadDescriptor(descriptor, env),
      };
    },
    async deleteTag(tagId) {
      const { data: existing, error: existingError } = await client
        .from("public_tags")
        .select("id")
        .eq("id", tagId)
        .maybeSingle();

      if (existingError) {
        throw mapSupabaseError(existingError);
      }

      if (!existing) {
        return {
          code: "TAG_NOT_FOUND",
          message: "Tag was not found.",
          status: 404,
        };
      }

      const { count, error: usageError } = await client
        .from("sofa_tags")
        .select("sofa_id", {
          count: "exact",
          head: true,
        })
        .eq("tag_id", tagId);

      if (usageError) {
        throw mapSupabaseError(usageError);
      }

      if ((count ?? 0) > 0) {
        return {
          code: "TAG_IN_USE",
          message: "Assigned tags cannot be deleted.",
          status: 409,
        };
      }

      const { error } = await client
        .from("public_tags")
        .delete()
        .eq("id", tagId);

      if (error) {
        throw mapSupabaseError(error, {
          foreignKeyCode: "TAG_IN_USE",
          foreignKeyMessage: "Assigned tags cannot be deleted.",
        });
      }

      return null;
    },
    async getFabric(fabricId) {
      return fetchFabricWithAssets(client, fabricId);
    },
    async getSofa(sofaId) {
      return fetchSofaWithTags(client, sofaId);
    },
    async getSofaPublicationReadiness(sofaId) {
      const { data, error } = await client.rpc(
        "sofa_publication_readiness_errors",
        {
          p_sofa_id: sofaId,
        },
      );

      if (error) {
        throw mapSupabaseError(error);
      }

      const errorCodes = Array.isArray(data) ? data : [];

      if (errorCodes.includes("sofa_not_found")) {
        return null;
      }

      return {
        errors: errorCodes.map(mapReadinessError),
        ready: errorCodes.length === 0,
      };
    },
    async listSofas() {
      const { data, error } = await client
        .from("sofas")
        .select(SOFA_SELECT)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw mapSupabaseError(error);
      }

      return attachTagsToSofas(client, data ?? []);
    },
    async listTags() {
      const { data, error } = await client
        .from("public_tags")
        .select(TAG_SELECT)
        .order("public_label", {
          ascending: true,
        });

      if (error) {
        throw mapSupabaseError(error);
      }

      return (data ?? []) as AdminTagRecord[];
    },
    async listFabrics() {
      const { data, error } = await client
        .from("fabrics")
        .select(FABRIC_SELECT)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw mapSupabaseError(error);
      }

      return attachAssetsToFabrics(client, data ?? []);
    },
    async listSofaFabrics(sofaId) {
      const sofa = await fetchSofaLifecycle(client, sofaId);

      if (!sofa) {
        return null;
      }

      return fetchSofaFabricAssignments(client, sofaId);
    },
    async removeSofaFabric(sofaId, fabricId) {
      const existing = await fetchSofaFabricAssignment(
        client,
        sofaId,
        fabricId,
      );

      if (!existing) {
        return {
          code: "SOFA_FABRIC_NOT_FOUND",
          message: "Sofa fabric assignment was not found.",
          status: 404,
        };
      }

      const sofa = await fetchSofaLifecycle(client, sofaId);

      if (sofa?.lifecycle_state !== "draft") {
        return {
          code: "SOFA_CONFLICT",
          message: "Only draft sofa fabric assignments can be edited.",
          status: 409,
        };
      }

      const { error } = await client
        .from("sofa_fabrics")
        .delete()
        .eq("sofa_id", sofaId)
        .eq("fabric_id", fabricId);

      if (error) {
        throw mapSupabaseError(error);
      }

      return null;
    },
    async updateFabric(fabricId, input) {
      const existing = await fetchFabricWithAssets(client, fabricId);

      if (!existing) {
        return null;
      }

      if (existing.lifecycle_state === "archived") {
        throw new AdminCatalogOperationError({
          code: "FABRIC_ARCHIVED",
          message: "Archived fabrics cannot be edited.",
          status: 409,
        });
      }

      await verifyFabricAssets(client, {
        ai_reference_asset_id:
          input.ai_reference_asset_id ?? existing.ai_reference_asset_id,
        internal_name: input.internal_name ?? existing.internal_name,
        is_premium: input.is_premium ?? existing.is_premium,
        public_name: input.public_name ?? existing.public_name,
        swatch_asset_id: input.swatch_asset_id ?? existing.swatch_asset_id,
      });

      const updatePayload = removeUndefinedValues(input);

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await client
          .from("fabrics")
          .update(updatePayload)
          .eq("id", fabricId);

        if (error) {
          throw mapSupabaseError(error, {
            duplicateCode: "FABRIC_CONFLICT",
            duplicateMessage: "A fabric with these details already exists.",
          });
        }
      }

      return fetchFabricWithAssets(client, fabricId);
    },
    async updateSofa(sofaId, input) {
      const existing = await fetchSofaWithTags(client, sofaId);

      if (!existing) {
        return null;
      }

      if (existing.lifecycle_state !== "draft") {
        throw new AdminCatalogOperationError({
          code: "SOFA_CONFLICT",
          message: "Only draft sofas can be edited in this API slice.",
          status: 409,
        });
      }

      if (input.tag_ids) {
        await verifyTagsExist(client, input.tag_ids);
      }

      const { tag_ids: tagIds, ...sofaInput } = input;
      const updatePayload = removeUndefinedValues(sofaInput);

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await client
          .from("sofas")
          .update(updatePayload)
          .eq("id", sofaId);

        if (error) {
          throw mapSupabaseError(error);
        }
      }

      if (tagIds) {
        await replaceSofaTags(client, sofaId, tagIds);
      }

      return fetchSofaWithTags(client, sofaId);
    },
    async updateSofaFabric(sofaId, fabricId, input) {
      const existing = await fetchSofaFabricAssignment(
        client,
        sofaId,
        fabricId,
      );

      if (!existing) {
        return {
          code: "SOFA_FABRIC_NOT_FOUND",
          message: "Sofa fabric assignment was not found.",
          status: 404,
        };
      }

      const relationError = await validateSofaFabricRelation(client, {
        allowArchivedExistingAssignment: true,
        fabricId,
        sofaId,
      });

      if (relationError) {
        return relationError;
      }

      if (input.public_order !== null) {
        const orderError = await validateSofaFabricPublicOrder(client, {
          fabricId,
          publicOrder: input.public_order,
          sofaId,
        });

        if (orderError) {
          return orderError;
        }
      }

      const { error } = await client
        .from("sofa_fabrics")
        .update({
          public_order: input.public_order,
        })
        .eq("sofa_id", sofaId)
        .eq("fabric_id", fabricId);

      if (error) {
        return mapSofaFabricMutationError(error);
      }

      return (
        (await fetchSofaFabricAssignment(client, sofaId, fabricId)) ?? {
          code: "SOFA_FABRIC_NOT_FOUND",
          message: "Sofa fabric assignment was not found.",
          status: 404,
        }
      );
    },
    async updateTag(tagId, input) {
      const { data, error } = await client
        .from("public_tags")
        .update(input)
        .eq("id", tagId)
        .select(TAG_SELECT)
        .maybeSingle();

      if (error) {
        throw mapSupabaseError(error, {
          duplicateCode: "TAG_CONFLICT",
          duplicateMessage: "A tag with this label or slug already exists.",
        });
      }

      return data as AdminTagRecord | null;
    },
  };
}

const SOFA_SELECT = [
  "id",
  "lifecycle_state",
  "internal_name",
  "public_name",
  "public_slug",
  "shopify_order_url",
  "public_description",
  "length_cm",
  "depth_cm",
  "height_cm",
  "footprint_type",
  "footprint_measurements",
  "manual_public_order",
  "created_at",
  "updated_at",
].join(",");

const TAG_SELECT = "id,public_label,slug";

const FABRIC_SELECT = [
  "id",
  "lifecycle_state",
  "internal_name",
  "public_name",
  "swatch_asset_id",
  "ai_reference_asset_id",
  "is_premium",
  "archived_at",
  "created_at",
  "updated_at",
].join(",");

const STORAGE_ASSET_SELECT = [
  "id",
  "bucket_id",
  "visibility",
  "lifecycle_state",
  "asset_kind",
  "content_type",
  "byte_size",
  "width_px",
  "height_px",
].join(",");

const SOFA_FABRIC_SELECT = [
  "sofa_id",
  "fabric_id",
  "public_order",
  "assigned_at",
  "updated_at",
].join(",");

function validateSofaPayload(
  payload: unknown,
  options: {
    requireInternalName: boolean;
  },
): ValidationResult<Partial<SofaMutationInput>> {
  if (!isRecord(payload)) {
    return invalidRequest("Request body must be a JSON object.");
  }

  const unsupportedFields = findUnsupportedFields(payload, SOFA_FIELDS);

  if (unsupportedFields.length > 0) {
    return unsupportedField(unsupportedFields);
  }

  const fields: string[] = [];
  const value: Partial<SofaMutationInput> = {};

  const internalName = readStringField(payload, "internal_name", {
    allowNull: false,
    required: options.requireInternalName,
  });

  if (!internalName.ok) {
    fields.push(...internalName.fields);
  } else if (internalName.present) {
    value.internal_name = internalName.value ?? "";
  }

  for (const field of [
    "public_name",
    "shopify_order_url",
    "public_description",
    "footprint_type",
  ] as const) {
    const result = readStringField(payload, field, {
      allowNull: true,
      required: false,
    });

    if (!result.ok) {
      fields.push(...result.fields);
    } else if (result.present) {
      value[field] = result.value;
    }
  }

  for (const field of ["length_cm", "depth_cm", "height_cm"] as const) {
    const result = readPositiveNumberField(payload, field, {
      integer: false,
    });

    if (!result.ok) {
      fields.push(field);
    } else if (result.present) {
      value[field] = result.value;
    }
  }

  const manualOrder = readPositiveNumberField(payload, "manual_public_order", {
    integer: true,
    zeroAllowed: true,
  });

  if (!manualOrder.ok) {
    fields.push("manual_public_order");
  } else if (manualOrder.present) {
    value.manual_public_order = manualOrder.value;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "footprint_measurements")) {
    const measurements = payload.footprint_measurements;

    if (
      measurements !== null &&
      (typeof measurements !== "object" || Array.isArray(measurements))
    ) {
      fields.push("footprint_measurements");
    } else {
      value.footprint_measurements = measurements;
    }
  }

  const tagIds = readTagIds(payload);

  if (!tagIds.ok) {
    fields.push("tag_ids");
  } else if (tagIds.present) {
    value.tag_ids = tagIds.value;
  }

  if (fields.length > 0) {
    return validationFailed([...new Set(fields)]);
  }

  return {
    ok: true,
    value,
  };
}

function validateFabricPayload(
  payload: unknown,
  options: {
    requireAll: boolean;
  },
): ValidationResult<Partial<FabricMutationInput>> {
  if (!isRecord(payload)) {
    return invalidRequest("Request body must be a JSON object.");
  }

  const unsupportedFields = findUnsupportedFields(payload, FABRIC_FIELDS);

  if (unsupportedFields.length > 0) {
    return unsupportedField(unsupportedFields);
  }

  const fields: string[] = [];
  const value: Partial<FabricMutationInput> = {};

  for (const field of ["internal_name", "public_name"] as const) {
    const result = readStringField(payload, field, {
      allowNull: false,
      required: options.requireAll,
    });

    if (!result.ok) {
      fields.push(...result.fields);
    } else if (result.present) {
      value[field] = result.value ?? "";
    }
  }

  for (const field of ["swatch_asset_id", "ai_reference_asset_id"] as const) {
    const result = readUuidField(payload, field, {
      required: options.requireAll,
    });

    if (!result.ok) {
      fields.push(field);
    } else if (result.present) {
      value[field] = result.value;
    }
  }

  const premiumResult = readBooleanField(payload, "is_premium", {
    required: options.requireAll,
  });

  if (!premiumResult.ok) {
    fields.push("is_premium");
  } else if (premiumResult.present) {
    value.is_premium = premiumResult.value;
  }

  if (fields.length > 0) {
    return validationFailed([...new Set(fields)]);
  }

  return {
    ok: true,
    value,
  };
}

function findUnsupportedFields(
  payload: JsonObject,
  supportedFields: readonly string[],
) {
  return Object.keys(payload).filter(
    (field) => !supportedFields.includes(field),
  );
}

function readStringField(
  payload: JsonObject,
  field: string,
  options: {
    allowNull: boolean;
    required: boolean;
  },
):
  | {
      ok: false;
      fields: string[];
    }
  | {
      ok: true;
      present: false;
      value?: never;
    }
  | {
      ok: true;
      present: true;
      value: string | null;
    } {
  if (!Object.prototype.hasOwnProperty.call(payload, field)) {
    if (options.required) {
      return {
        fields: [field],
        ok: false,
      };
    }

    return {
      ok: true,
      present: false,
    };
  }

  const value = payload[field];

  if (value === null && options.allowNull) {
    return {
      ok: true,
      present: true,
      value: null,
    };
  }

  if (typeof value !== "string") {
    return {
      fields: [field],
      ok: false,
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return {
      fields: [field],
      ok: false,
    };
  }

  return {
    ok: true,
    present: true,
    value: trimmed,
  };
}

function readPositiveNumberField(
  payload: JsonObject,
  field: string,
  options: {
    integer: boolean;
    zeroAllowed?: boolean;
  },
):
  | {
      ok: false;
      present: true;
      value?: never;
    }
  | {
      ok: true;
      present: false;
      value?: never;
    }
  | {
      ok: true;
      present: true;
      value: number | null;
    } {
  if (!Object.prototype.hasOwnProperty.call(payload, field)) {
    return {
      ok: true,
      present: false,
    };
  }

  const value = payload[field];

  if (value === null) {
    return {
      ok: true,
      present: true,
      value: null,
    };
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (options.integer && !Number.isInteger(value)) ||
    (options.zeroAllowed ? value < 0 : value <= 0)
  ) {
    return {
      ok: false,
      present: true,
    };
  }

  return {
    ok: true,
    present: true,
    value,
  };
}

function readUuidField(
  payload: JsonObject,
  field: string,
  options: {
    required: boolean;
  },
):
  | {
      ok: false;
      present: true;
      value?: never;
    }
  | {
      ok: true;
      present: false;
      value?: never;
    }
  | {
      ok: true;
      present: true;
      value: string;
    } {
  if (!Object.prototype.hasOwnProperty.call(payload, field)) {
    return options.required
      ? {
          ok: false,
          present: true,
        }
      : {
          ok: true,
          present: false,
        };
  }

  const value = payload[field];

  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return {
      ok: false,
      present: true,
    };
  }

  return {
    ok: true,
    present: true,
    value,
  };
}

function readBooleanField(
  payload: JsonObject,
  field: string,
  options: {
    required: boolean;
  },
):
  | {
      ok: false;
      present: true;
      value?: never;
    }
  | {
      ok: true;
      present: false;
      value?: never;
    }
  | {
      ok: true;
      present: true;
      value: boolean;
    } {
  if (!Object.prototype.hasOwnProperty.call(payload, field)) {
    return options.required
      ? {
          ok: false,
          present: true,
        }
      : {
          ok: true,
          present: false,
        };
  }

  const value = payload[field];

  if (typeof value !== "boolean") {
    return {
      ok: false,
      present: true,
    };
  }

  return {
    ok: true,
    present: true,
    value,
  };
}

function readTagIds(payload: JsonObject):
  | {
      ok: false;
      present: true;
      value?: never;
    }
  | {
      ok: true;
      present: false;
      value?: never;
    }
  | {
      ok: true;
      present: true;
      value: string[];
    } {
  if (!Object.prototype.hasOwnProperty.call(payload, "tag_ids")) {
    return {
      ok: true,
      present: false,
    };
  }

  const value = payload.tag_ids;

  if (
    !Array.isArray(value) ||
    value.some(
      (tagId) => typeof tagId !== "string" || !UUID_PATTERN.test(tagId),
    )
  ) {
    return {
      ok: false,
      present: true,
    };
  }

  return {
    ok: true,
    present: true,
    value: [...new Set(value)],
  };
}

function invalidRequest(message: string): ValidationResult<never> {
  return {
    error: {
      code: "INVALID_REQUEST",
      details: {},
      message,
    },
    ok: false,
    status: 400,
  };
}

function unsupportedField(fields: string[]): ValidationResult<never> {
  return {
    error: {
      code: "UNSUPPORTED_FIELD",
      details: {
        fields,
      },
      message: "Request contains unsupported fields.",
    },
    ok: false,
    status: 400,
  };
}

function validationFailed(fields: string[]): ValidationResult<never> {
  return {
    error: {
      code: "VALIDATION_FAILED",
      details: {
        fields,
      },
      message: "Request fields are invalid.",
    },
    ok: false,
    status: 422,
  };
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

function readTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((tag) => ({
      id: stringOrNull(tag.id),
      public_label: stringOrNull(tag.public_label),
      slug: stringOrNull(tag.slug),
    }))
    .filter((tag) => tag.id && tag.public_label && tag.slug);
}

interface UploadDescriptor extends UploadCreateInput {
  bucket_id: string;
  expires_at: string;
  object_path: string;
}

function createUploadDescriptor(
  input: UploadCreateInput,
  env: NodeJS.ProcessEnv,
): UploadDescriptor {
  const assetId = randomUUID();
  const extension = extensionForContentType(input.content_type);
  const bucketId =
    input.purpose === "fabric_swatch"
      ? "catalog-public-assets"
      : "catalog-private-assets";
  const prefix =
    input.purpose === "fabric_swatch"
      ? `fabrics/pending/swatches/${assetId}`
      : `fabrics/pending/ai-references/${assetId}`;

  return {
    ...input,
    bucket_id: bucketId,
    expires_at: new Date(Date.now() + uploadTtlMs(env)).toISOString(),
    object_path: `${prefix}.${extension}`,
  };
}

function extensionForContentType(contentType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensions[contentType] ?? "bin";
}

function uploadTtlMs(env: NodeJS.ProcessEnv) {
  const seconds = Number(env.ADMIN_UPLOAD_TTL_SECONDS ?? 60 * 60 * 2);

  return Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : 60 * 60 * 2 * 1000;
}

function signUploadDescriptor(
  descriptor: UploadDescriptor,
  env: NodeJS.ProcessEnv,
) {
  const payload = Buffer.from(JSON.stringify(descriptor)).toString("base64url");
  const signature = createHmac("sha256", uploadTokenSecret(env))
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function readUploadDescriptor(
  uploadId: string,
  env: NodeJS.ProcessEnv,
): UploadDescriptor | null {
  const [payload, signature] = uploadId.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", uploadTokenSecret(env))
    .update(payload)
    .digest("base64url");

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    if (!isRecord(parsed)) {
      return null;
    }

    if (
      parsed.purpose !== "fabric_swatch" &&
      parsed.purpose !== "fabric_ai_reference"
    ) {
      return null;
    }

    if (
      typeof parsed.bucket_id !== "string" ||
      typeof parsed.object_path !== "string" ||
      typeof parsed.content_type !== "string" ||
      typeof parsed.byte_size !== "number" ||
      typeof parsed.expires_at !== "string"
    ) {
      return null;
    }

    return parsed as unknown as UploadDescriptor;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function uploadTokenSecret(env: NodeJS.ProcessEnv) {
  return (
    env.ADMIN_UPLOAD_TOKEN_SECRET ??
    env.ADMIN_TRUSTED_DEVICE_SECRET ??
    env.SUPABASE_SERVICE_ROLE_KEY ??
    "local-admin-upload-token-secret"
  );
}

function assetKindForUploadPurpose(purpose: UploadPurpose) {
  return purpose === "fabric_swatch"
    ? "fabric_swatch_public"
    : "fabric_ai_reference";
}

function readImageMetadata(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/png") {
    return readPngMetadata(bytes);
  }

  if (contentType === "image/jpeg") {
    return readJpegMetadata(bytes);
  }

  if (contentType === "image/webp") {
    return readWebpMetadata(bytes);
  }

  return null;
}

function readPngMetadata(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  return {
    height_px: readUint32Be(bytes, 20),
    width_px: readUint32Be(bytes, 16),
  };
}

function readJpegMetadata(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = readUint16Be(bytes, offset + 2);

    if (length < 2) {
      return null;
    }

    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < bytes.length) {
      return {
        height_px: readUint16Be(bytes, offset + 5),
        width_px: readUint16Be(bytes, offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function readWebpMetadata(bytes: Uint8Array) {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return null;
  }

  const chunkType = ascii(bytes, 12, 4);

  if (chunkType === "VP8X" && bytes.length >= 30) {
    return {
      height_px: 1 + readUint24Le(bytes, 27),
      width_px: 1 + readUint24Le(bytes, 24),
    };
  }

  if (chunkType === "VP8 " && bytes.length >= 30) {
    return {
      height_px: readUint16Le(bytes, 28) & 0x3fff,
      width_px: readUint16Le(bytes, 26) & 0x3fff,
    };
  }

  return null;
}

function readUint16Be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) + bytes[offset + 1];
}

function readUint16Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8);
}

function readUint24Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
}

function readUint32Be(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

async function fetchSofaWithTags(
  client: SupabaseCatalogClient,
  sofaId: string,
) {
  const { data: sofa, error } = await client
    .from("sofas")
    .select(SOFA_SELECT)
    .eq("id", sofaId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (!sofa) {
    return null;
  }

  const tagMap = await fetchTagsBySofaIds(client, [sofaId]);

  return {
    ...sofa,
    tags: tagMap.get(sofaId) ?? [],
  } as AdminSofaRecord;
}

async function fetchFabricWithAssets(
  client: SupabaseCatalogClient,
  fabricId: string,
) {
  const { data: fabric, error } = await client
    .from("fabrics")
    .select(FABRIC_SELECT)
    .eq("id", fabricId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (!fabric) {
    return null;
  }

  const [fabricWithAssets] = await attachAssetsToFabrics(client, [fabric]);

  return fabricWithAssets ?? null;
}

async function attachAssetsToFabrics(
  client: SupabaseCatalogClient,
  fabrics: JsonObject[],
) {
  const assetIds = [
    ...new Set(
      fabrics
        .flatMap((fabric) => [
          fabric.swatch_asset_id,
          fabric.ai_reference_asset_id,
        ])
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const assetMap = await fetchAssetsByIds(client, assetIds);

  return fabrics.map(
    (fabric) =>
      ({
        ...fabric,
        ai_reference_asset:
          typeof fabric.ai_reference_asset_id === "string"
            ? (assetMap.get(fabric.ai_reference_asset_id) ?? null)
            : null,
        swatch_asset:
          typeof fabric.swatch_asset_id === "string"
            ? (assetMap.get(fabric.swatch_asset_id) ?? null)
            : null,
      }) as AdminFabricRecord,
  );
}

async function fetchAssetsByIds(
  client: SupabaseCatalogClient,
  assetIds: string[],
) {
  const assetMap = new Map<string, AdminStorageAssetRecord>();

  if (assetIds.length === 0) {
    return assetMap;
  }

  const { data, error } = await client
    .from("storage_assets")
    .select(STORAGE_ASSET_SELECT)
    .in("id", assetIds);

  if (error) {
    throw mapSupabaseError(error);
  }

  for (const asset of data ?? []) {
    if (typeof asset.id === "string") {
      assetMap.set(asset.id, asset as AdminStorageAssetRecord);
    }
  }

  return assetMap;
}

async function verifyFabricAssets(
  client: SupabaseCatalogClient,
  input: FabricMutationInput,
) {
  const assetMap = await fetchAssetsByIds(client, [
    input.swatch_asset_id,
    input.ai_reference_asset_id,
  ]);
  const swatchAsset = assetMap.get(input.swatch_asset_id);
  const aiReferenceAsset = assetMap.get(input.ai_reference_asset_id);
  const invalidFields: string[] = [];

  if (
    !swatchAsset ||
    swatchAsset.lifecycle_state !== "active" ||
    swatchAsset.asset_kind !== "fabric_swatch_public" ||
    swatchAsset.visibility !== "public" ||
    swatchAsset.bucket_id !== "catalog-public-assets"
  ) {
    invalidFields.push("swatch_asset_id");
  }

  if (
    !aiReferenceAsset ||
    aiReferenceAsset.lifecycle_state !== "active" ||
    aiReferenceAsset.asset_kind !== "fabric_ai_reference" ||
    aiReferenceAsset.visibility !== "private" ||
    aiReferenceAsset.bucket_id !== "catalog-private-assets"
  ) {
    invalidFields.push("ai_reference_asset_id");
  }

  if (invalidFields.length > 0) {
    throw new AdminCatalogOperationError({
      code: "FABRIC_NOT_FOUND",
      details: {
        fields: invalidFields,
      },
      message: "One or more fabric assets were not found.",
      status: 422,
    });
  }
}

async function fetchSofaLifecycle(
  client: SupabaseCatalogClient,
  sofaId: string,
) {
  const { data, error } = await client
    .from("sofas")
    .select("id,lifecycle_state")
    .eq("id", sofaId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as { id: string; lifecycle_state: string } | null;
}

async function fetchFabricLifecycle(
  client: SupabaseCatalogClient,
  fabricId: string,
) {
  const { data, error } = await client
    .from("fabrics")
    .select("id,lifecycle_state")
    .eq("id", fabricId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as { id: string; lifecycle_state: string } | null;
}

async function validateSofaFabricRelation(
  client: SupabaseCatalogClient,
  input: {
    allowArchivedExistingAssignment: boolean;
    fabricId: string;
    sofaId: string;
  },
): Promise<AdminCatalogOperationErrorData | null> {
  const [sofa, fabric] = await Promise.all([
    fetchSofaLifecycle(client, input.sofaId),
    fetchFabricLifecycle(client, input.fabricId),
  ]);

  if (!sofa) {
    return {
      code: "SOFA_NOT_FOUND",
      message: "Sofa was not found.",
      status: 404,
    };
  }

  if (sofa.lifecycle_state !== "draft") {
    return {
      code: "SOFA_CONFLICT",
      message: "Only draft sofa fabric assignments can be edited.",
      status: 409,
    };
  }

  if (!fabric) {
    return {
      code: "FABRIC_NOT_FOUND",
      message: "Fabric was not found.",
      status: 404,
    };
  }

  if (
    fabric.lifecycle_state === "archived" &&
    !input.allowArchivedExistingAssignment
  ) {
    return {
      code: "FABRIC_ARCHIVED",
      message: "Archived fabrics cannot be assigned to sofas.",
      status: 409,
    };
  }

  return null;
}

async function validateSofaFabricPublicOrder(
  client: SupabaseCatalogClient,
  input: {
    fabricId: string;
    publicOrder: number;
    sofaId: string;
  },
): Promise<AdminCatalogOperationErrorData | null> {
  const { data, error } = await client
    .from("sofa_fabrics")
    .select("fabric_id")
    .eq("sofa_id", input.sofaId)
    .eq("public_order", input.publicOrder)
    .neq("fabric_id", input.fabricId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (data) {
    return {
      code: "SOFA_FABRIC_ORDER_CONFLICT",
      message: "Another fabric already uses this public order.",
      status: 409,
    };
  }

  return null;
}

async function fetchSofaFabricAssignments(
  client: SupabaseCatalogClient,
  sofaId: string,
) {
  const { data, error } = await client
    .from("sofa_fabrics")
    .select(SOFA_FABRIC_SELECT)
    .eq("sofa_id", sofaId)
    .order("public_order", {
      ascending: true,
      nullsFirst: false,
    })
    .order("assigned_at", {
      ascending: true,
    });

  if (error) {
    throw mapSupabaseError(error);
  }

  return attachFabricsToAssignments(client, data ?? []);
}

async function fetchSofaFabricAssignment(
  client: SupabaseCatalogClient,
  sofaId: string,
  fabricId: string,
) {
  const { data, error } = await client
    .from("sofa_fabrics")
    .select(SOFA_FABRIC_SELECT)
    .eq("sofa_id", sofaId)
    .eq("fabric_id", fabricId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (!data) {
    return null;
  }

  const [assignment] = await attachFabricsToAssignments(client, [data]);

  return assignment ?? null;
}

async function attachFabricsToAssignments(
  client: SupabaseCatalogClient,
  assignments: JsonObject[],
) {
  const fabricIds = assignments
    .map((assignment) => assignment.fabric_id)
    .filter((id): id is string => typeof id === "string");
  const fabrics = await fetchFabricsByIds(client, fabricIds);

  return assignments.map(
    (assignment) =>
      ({
        ...assignment,
        fabric:
          typeof assignment.fabric_id === "string"
            ? (fabrics.get(assignment.fabric_id) ?? null)
            : null,
      }) as AdminSofaFabricRecord,
  );
}

async function fetchFabricsByIds(
  client: SupabaseCatalogClient,
  fabricIds: string[],
) {
  const fabricMap = new Map<string, AdminFabricRecord>();

  if (fabricIds.length === 0) {
    return fabricMap;
  }

  const { data, error } = await client
    .from("fabrics")
    .select(FABRIC_SELECT)
    .in("id", [...new Set(fabricIds)]);

  if (error) {
    throw mapSupabaseError(error);
  }

  const fabrics = await attachAssetsToFabrics(client, data ?? []);

  for (const fabric of fabrics) {
    fabricMap.set(fabric.id, fabric);
  }

  return fabricMap;
}

async function attachTagsToSofas(
  client: SupabaseCatalogClient,
  sofas: JsonObject[],
) {
  const sofaIds = sofas
    .map((sofa) => sofa.id)
    .filter((id): id is string => typeof id === "string");
  const tagMap = await fetchTagsBySofaIds(client, sofaIds);

  return sofas.map(
    (sofa) =>
      ({
        ...sofa,
        tags: typeof sofa.id === "string" ? (tagMap.get(sofa.id) ?? []) : [],
      }) as AdminSofaRecord,
  );
}

async function fetchTagsBySofaIds(
  client: SupabaseCatalogClient,
  sofaIds: string[],
) {
  const tagMap = new Map<string, AdminTagRecord[]>();

  if (sofaIds.length === 0) {
    return tagMap;
  }

  const { data, error } = await client
    .from("sofa_tags")
    .select("sofa_id,public_tags(id,public_label,slug)")
    .in("sofa_id", sofaIds);

  if (error) {
    throw mapSupabaseError(error);
  }

  for (const row of data ?? []) {
    const sofaId = row.sofa_id as string;
    const publicTag = normalizeJoinedTag(row.public_tags);

    if (!publicTag) {
      continue;
    }

    const currentTags = tagMap.get(sofaId) ?? [];
    currentTags.push(publicTag);
    tagMap.set(sofaId, currentTags);
  }

  return tagMap;
}

function normalizeJoinedTag(value: unknown): AdminTagRecord | null {
  const tag = Array.isArray(value) ? value[0] : value;

  if (!isRecord(tag)) {
    return null;
  }

  if (
    typeof tag.id !== "string" ||
    typeof tag.public_label !== "string" ||
    typeof tag.slug !== "string"
  ) {
    return null;
  }

  return {
    id: tag.id,
    public_label: tag.public_label,
    slug: tag.slug,
  };
}

async function verifyTagsExist(
  client: SupabaseCatalogClient,
  tagIds: string[],
) {
  if (tagIds.length === 0) {
    return;
  }

  const { data, error } = await client
    .from("public_tags")
    .select("id")
    .in("id", tagIds);

  if (error) {
    throw mapSupabaseError(error);
  }

  const foundIds = new Set(
    (data ?? []).map((tag: JsonObject) => tag.id as string),
  );
  const missingTagIds = tagIds.filter((tagId) => !foundIds.has(tagId));

  if (missingTagIds.length > 0) {
    throw new AdminCatalogOperationError({
      code: "TAG_NOT_FOUND",
      details: {
        tag_ids: missingTagIds,
      },
      message: "One or more tags were not found.",
      status: 422,
    });
  }
}

async function replaceSofaTags(
  client: SupabaseCatalogClient,
  sofaId: string,
  tagIds: string[],
) {
  const { error: deleteError } = await client
    .from("sofa_tags")
    .delete()
    .eq("sofa_id", sofaId);

  if (deleteError) {
    throw mapSupabaseError(deleteError);
  }

  if (tagIds.length === 0) {
    return;
  }

  const { error: insertError } = await client.from("sofa_tags").insert(
    tagIds.map((tagId) => ({
      sofa_id: sofaId,
      tag_id: tagId,
    })),
  );

  if (insertError) {
    throw mapSupabaseError(insertError);
  }
}

function removeUndefinedValues(value: JsonObject) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

function mapReadinessError(code: string) {
  const mappedCode = code.toUpperCase();
  const messages: Record<string, string> = {
    INCOMPLETE_PUBLIC_RENDER_COVERAGE: "Public render coverage is incomplete.",
    MISSING_ACTIVE_VISUAL_POSITION:
      "At least one active visual position is required.",
    MISSING_FROZEN_PUBLIC_SLUG:
      "A previously published sofa needs its public slug.",
    MISSING_OR_INVALID_SHOPIFY_ORDER_URL:
      "A valid Shopify order URL is required.",
    MISSING_PUBLIC_FABRIC: "At least one active public fabric is required.",
    MISSING_PUBLIC_NAME: "A public sofa name is required.",
    MISSING_PUBLIC_SWATCH_ASSET: "Public fabric swatch assets are required.",
  };

  return {
    code: mappedCode,
    message: messages[mappedCode] ?? "Publication readiness failed.",
  };
}

function mapSofaFabricMutationError(error: {
  code?: string;
  message?: string;
}): AdminCatalogOperationErrorData {
  if (error.code === "23505") {
    return {
      code: "SOFA_FABRIC_ORDER_CONFLICT",
      message: "Another fabric already uses this public order.",
      status: 409,
    };
  }

  if (error.code === "23503") {
    return {
      code: "FABRIC_NOT_FOUND",
      message: "Referenced sofa or fabric was not found.",
      status: 404,
    };
  }

  return {
    code: "CATALOG_UNAVAILABLE",
    message: "Catalog service is unavailable.",
    status: 500,
  };
}

function mapSupabaseError(
  error: {
    code?: string;
    message?: string;
  },
  options: {
    duplicateCode?: AdminCatalogErrorCode;
    duplicateMessage?: string;
    foreignKeyCode?: AdminCatalogErrorCode;
    foreignKeyMessage?: string;
  } = {},
) {
  if (error.code === "23505") {
    return new AdminCatalogOperationError({
      code: options.duplicateCode ?? "SOFA_CONFLICT",
      message: options.duplicateMessage ?? "Catalog record already exists.",
      status: 409,
    });
  }

  if (error.code === "23503") {
    return new AdminCatalogOperationError({
      code: options.foreignKeyCode ?? "TAG_NOT_FOUND",
      message:
        options.foreignKeyMessage ?? "Referenced catalog record was not found.",
      status: options.foreignKeyCode === "TAG_IN_USE" ? 409 : 422,
    });
  }

  return new AdminCatalogOperationError({
    code: "CATALOG_UNAVAILABLE",
    message: "Catalog service is unavailable.",
    status: 500,
  });
}

function requiredEnv(
  env: NodeJS.ProcessEnv,
  primaryName: string,
  fallbackName?: string,
) {
  const value = env[primaryName] ?? (fallbackName ? env[fallbackName] : "");

  if (!value) {
    throw new Error(`${primaryName} is required.`);
  }

  return value;
}
