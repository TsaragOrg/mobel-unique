import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;
type SupabaseCatalogClient = any;

export type AdminCatalogErrorStatus = 400 | 404 | 409 | 422 | 500;

export type AdminCatalogErrorCode =
  | "CATALOG_UNAVAILABLE"
  | "SOFA_CONFLICT"
  | "SOFA_NOT_FOUND"
  | "TAG_CONFLICT"
  | "TAG_IN_USE"
  | "TAG_NOT_FOUND";

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

export interface AdminCatalogStore {
  createSofa(input: SofaMutationInput): Promise<AdminSofaRecord | JsonObject>;
  createTag(input: TagMutationInput): Promise<AdminTagRecord | JsonObject>;
  deleteTag(tagId: string): Promise<AdminCatalogOperationErrorData | null>;
  getSofa(sofaId: string): Promise<AdminSofaRecord | JsonObject | null>;
  getSofaPublicationReadiness(
    sofaId: string,
  ): Promise<PublicationReadiness | null>;
  listSofas(): Promise<Array<AdminSofaRecord | JsonObject>>;
  listTags(): Promise<Array<AdminTagRecord | JsonObject>>;
  updateSofa(
    sofaId: string,
    input: SofaPatchInput,
  ): Promise<AdminSofaRecord | JsonObject | null>;
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
