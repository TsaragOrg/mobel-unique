import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;
type SupabasePublicClient = any;

export const DEFAULT_CATALOG_LIMIT = 12;
export const MAX_CATALOG_LIMIT = 48;

export interface CatalogCursor {
  created_at: string;
  id: string;
  manual_public_order: number | null;
}

export interface CatalogListInput {
  cursor: CatalogCursor | null;
  limit: number;
  tags: string[];
}

export type PublicCatalogErrorStatus = 400 | 404 | 410 | 503;

export interface PublicCatalogOperationErrorData {
  code: string;
  details?: JsonObject;
  message: string;
  status: PublicCatalogErrorStatus;
}

export class PublicCatalogOperationError extends Error {
  code: string;
  details?: JsonObject;
  status: PublicCatalogErrorStatus;

  constructor(error: PublicCatalogOperationErrorData) {
    super(error.message);
    this.code = error.code;
    this.details = error.details;
    this.status = error.status;
  }
}

export type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      error: PublicCatalogOperationErrorData;
      ok: false;
      status: 400;
    };

export interface PublicSofaRecord {
  created_at: string;
  depth_cm?: number | null;
  footprint_measurements?: unknown;
  footprint_type?: string | null;
  height_cm?: number | null;
  id: string;
  length_cm?: number | null;
  manual_public_order?: number | null;
  price_cents?: number | null;
  price_currency?: string | null;
  public_description?: string | null;
  public_name: string;
  public_slug: string;
  shopify_order_url?: string | null;
}

export interface PublicSofaTagRecord {
  public_label: string;
  slug: string;
  sofa_id: string;
}

export interface PublicSofaFabricRecord {
  id: string;
  is_premium: boolean;
  public_name: string;
  public_order: number;
  public_swatch_height_px?: number | null;
  public_swatch_object_path: string;
  public_swatch_small_content_type: string;
  public_swatch_small_height_px?: number | null;
  public_swatch_small_object_path: string;
  public_swatch_small_width_px?: number | null;
  public_swatch_width_px?: number | null;
  sofa_id: string;
}

export interface PublicVisualPositionRecord {
  id: string;
  public_label?: string | null;
  sequence: number;
  sofa_id: string;
}

export interface PublicRenderCellRecord {
  fabric_id: string;
  public_render_height_px?: number | null;
  public_render_content_type?: string | null;
  public_render_object_path: string;
  public_render_width_px?: number | null;
  render_medium_content_type: string;
  render_medium_height_px?: number | null;
  render_medium_object_path: string;
  render_medium_width_px?: number | null;
  render_original_content_type: string;
  render_original_height_px?: number | null;
  render_original_object_path: string;
  render_original_width_px?: number | null;
  render_cell_id: string;
  sofa_id: string;
  visual_matrix_column_id: string;
}

export interface UnavailableSofaRecord {
  first_published_at?: string | null;
  id: string;
  lifecycle_state: string;
  public_slug: string;
}

export interface PublicCatalogStore {
  publicAssetBaseUrl: string;
  findUnavailableSofaBySlug(
    publicSlug: string,
  ): Promise<UnavailableSofaRecord | null>;
  listPublicFabrics(): Promise<Array<PublicSofaFabricRecord | JsonObject>>;
  listPublicRenderCells(): Promise<Array<PublicRenderCellRecord | JsonObject>>;
  listPublicSofaTags(): Promise<Array<PublicSofaTagRecord | JsonObject>>;
  listPublicSofas(): Promise<Array<PublicSofaRecord | JsonObject>>;
  listPublicVisualPositions(): Promise<
    Array<PublicVisualPositionRecord | JsonObject>
  >;
}

export interface PublicTagResponse {
  public_label: string;
  slug: string;
}

export interface PublicPriceResponse {
  amount_cents: number;
  currency: "EUR";
}

export interface PublicCatalogCardFabricResponse {
  id: string;
  is_premium: boolean;
  public_name: string;
  public_order: number;
  render_medium_content_type: string;
  render_medium_height_px: number | null;
  render_medium_url: string;
  render_medium_width_px: number | null;
  swatch_small_content_type: string;
  swatch_small_height_px: number | null;
  swatch_small_url: string;
  swatch_small_width_px: number | null;
}

export interface PublicCatalogItemResponse {
  default_fabric_id: string;
  default_render_medium_content_type: string;
  default_render_medium_height_px: number | null;
  default_render_medium_url: string;
  default_render_medium_width_px: number | null;
  default_render_url: string;
  default_visual_position_id: string;
  dimensions: {
    depth_cm: number | null;
    footprint_measurements: unknown;
    footprint_type: string | null;
    height_cm: number | null;
    length_cm: number | null;
  };
  fabrics: PublicCatalogCardFabricResponse[];
  id: string;
  price: PublicPriceResponse | null;
  public_description: string | null;
  public_name: string;
  public_slug: string;
  shopify_order_url: string | null;
  tags: PublicTagResponse[];
}

export interface PublicCatalogListResponse {
  items: PublicCatalogItemResponse[];
  next_cursor: string | null;
}

export interface PublicSofaDetailResponse {
  defaults: {
    fabric_id: string;
    visual_position_id: string;
  };
  fabrics: Array<{
    id: string;
    is_premium: boolean;
    public_name: string;
    public_order: number;
    swatch_small_content_type: string;
    swatch_small_height_px: number | null;
    swatch_small_url: string;
    swatch_small_width_px: number | null;
    swatch_url: string;
  }>;
  renders: Array<{
    fabric_id: string;
    height_px: number | null;
    render_medium_content_type: string;
    render_medium_height_px: number | null;
    render_medium_url: string;
    render_medium_width_px: number | null;
    render_original_content_type: string;
    render_original_height_px: number | null;
    render_original_url: string;
    render_original_width_px: number | null;
    render_url: string;
    visual_position_id: string;
    width_px: number | null;
  }>;
  sofa: {
    dimensions: PublicCatalogItemResponse["dimensions"];
    id: string;
    price: PublicPriceResponse | null;
    public_description: string | null;
    public_name: string;
    public_slug: string;
    shopify_order_url: string | null;
    tags: PublicTagResponse[];
  };
  visual_positions: Array<{
    id: string;
    public_label: string | null;
    sequence: number;
  }>;
}

interface PublicCatalogData {
  fabrics: PublicSofaFabricRecord[];
  renderCells: PublicRenderCellRecord[];
  sofas: PublicSofaRecord[];
  tags: PublicSofaTagRecord[];
  visualPositions: PublicVisualPositionRecord[];
}

interface UsableSofaState {
  defaultFabric: PublicSofaFabricRecord;
  defaultRender: PublicRenderCellRecord;
  defaultVisualPosition: PublicVisualPositionRecord;
  fabrics: PublicSofaFabricRecord[];
  renders: PublicRenderCellRecord[];
  sofa: PublicSofaRecord;
  tags: PublicTagResponse[];
  visualPositions: PublicVisualPositionRecord[];
}

interface CatalogSortKey {
  created_at: string;
  id: string;
  manual_public_order?: number | null;
}

const TAG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMPTY_DETAILS: JsonObject = {};

export function parseCatalogListQuery(
  url: URL,
): ValidationResult<CatalogListInput> {
  const limitResult = parseLimit(url.searchParams.get("limit"));

  if (!limitResult.ok) {
    return limitResult;
  }

  const cursorResult = parseCursor(url.searchParams.get("cursor"));

  if (!cursorResult.ok) {
    return cursorResult;
  }

  const tags = uniqueSafeTags(url.searchParams.getAll("tag"));

  return {
    ok: true,
    value: {
      cursor: cursorResult.value,
      limit: limitResult.value,
      tags,
    },
  };
}

export function encodeCatalogCursor(cursor: CatalogCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCatalogCursor(value: string): CatalogCursor {
  const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

  if (!isCatalogCursor(decoded)) {
    throw new Error("Invalid catalog cursor.");
  }

  return decoded;
}

export function buildPublicStorageUrl(
  publicAssetBaseUrl: string,
  objectPath: string,
) {
  const baseUrl = publicAssetBaseUrl.replace(/\/+$/, "");
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${baseUrl}/storage/v1/object/public/catalog-public-assets/${encodedPath}`;
}

export async function listPublicCatalog(
  store: PublicCatalogStore,
  input: CatalogListInput,
): Promise<PublicCatalogListResponse> {
  const data = await readPublicCatalogData(store);
  const usableSofas = buildUsableSofaStates(data);
  const filtered = filterSofasByTags(usableSofas, input.tags)
    .sort((left, right) => compareCatalogSort(left.sofa, right.sofa))
    .filter((state) =>
      input.cursor ? compareCatalogSort(state.sofa, input.cursor) > 0 : true,
    );

  const page = filtered.slice(0, input.limit);
  const nextItem = filtered[input.limit];

  return {
    items: page.map((state) =>
      shapeCatalogItemResponse(state, store.publicAssetBaseUrl),
    ),
    next_cursor: nextItem
      ? encodeCatalogCursor({
          created_at: page[page.length - 1].sofa.created_at,
          id: page[page.length - 1].sofa.id,
          manual_public_order:
            page[page.length - 1].sofa.manual_public_order ?? null,
        })
      : null,
  };
}

export async function listPublicCatalogTags(
  store: PublicCatalogStore,
): Promise<{ items: PublicTagResponse[] }> {
  const data = await readPublicCatalogData(store);
  const usableSofaIds = new Set(
    buildUsableSofaStates(data).map((state) => state.sofa.id),
  );
  const tags = dedupeTags(
    data.tags.filter((tag) => usableSofaIds.has(tag.sofa_id)),
  );

  return {
    items: tags,
  };
}

export async function getPublicSofaDetail(
  store: PublicCatalogStore,
  publicSlug: string,
): Promise<PublicSofaDetailResponse> {
  const data = await readPublicCatalogData(store);
  const state = buildUsableSofaStates(data).find(
    (candidate) => candidate.sofa.public_slug === publicSlug,
  );

  if (!state) {
    const unavailable = await store.findUnavailableSofaBySlug(publicSlug);

    if (
      unavailable?.first_published_at &&
      unavailable.lifecycle_state !== "published"
    ) {
      throw new PublicCatalogOperationError({
        code: "SOFA_UNAVAILABLE",
        message: "Ce canapé n'est plus disponible.",
        status: 410,
      });
    }

    throw new PublicCatalogOperationError({
      code: "SOFA_NOT_FOUND",
      message: "Canapé introuvable.",
      status: 404,
    });
  }

  return shapeSofaDetailResponse(state, store.publicAssetBaseUrl);
}

export function createSupabasePublicCatalogStore(
  env: NodeJS.ProcessEnv = process.env,
): PublicCatalogStore {
  const supabaseUrl = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anonClient = createClient(
    supabaseUrl,
    requiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

  return {
    publicAssetBaseUrl: supabaseUrl,
    async findUnavailableSofaBySlug(publicSlug) {
      if (!serviceClient) {
        return null;
      }

      const { data, error } = await serviceClient
        .from("sofas")
        .select("id, public_slug, lifecycle_state, first_published_at")
        .eq("public_slug", publicSlug)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data
        ? {
            first_published_at: stringOrNull(data.first_published_at),
            id: String(data.id),
            lifecycle_state: String(data.lifecycle_state),
            public_slug: String(data.public_slug),
          }
        : null;
    },
    async listPublicFabrics() {
      return selectPublicRows(anonClient, "public_sofa_fabrics");
    },
    async listPublicRenderCells() {
      return selectPublicRows(anonClient, "public_sofa_render_cells");
    },
    async listPublicSofaTags() {
      return selectPublicRows(anonClient, "public_sofa_tags");
    },
    async listPublicSofas() {
      return selectPublicRows(anonClient, "public_catalog_sofas");
    },
    async listPublicVisualPositions() {
      return selectPublicRows(anonClient, "public_sofa_visual_positions");
    },
  };
}

function parseLimit(value: string | null): ValidationResult<number> {
  if (!value) {
    return {
      ok: true,
      value: DEFAULT_CATALOG_LIMIT,
    };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return invalidQuery("INVALID_LIMIT", "Le nombre d'éléments est invalide.");
  }

  return {
    ok: true,
    value: Math.min(parsed, MAX_CATALOG_LIMIT),
  };
}

function parseCursor(value: string | null): ValidationResult<CatalogCursor | null> {
  if (!value) {
    return {
      ok: true,
      value: null,
    };
  }

  try {
    return {
      ok: true,
      value: decodeCatalogCursor(value),
    };
  } catch {
    return invalidQuery("INVALID_CURSOR", "Le curseur de catalogue est invalide.");
  }
}

function invalidQuery(
  code: string,
  message: string,
): ValidationResult<never> {
  return {
    error: {
      code,
      details: EMPTY_DETAILS,
      message,
      status: 400,
    },
    ok: false,
    status: 400,
  };
}

function uniqueSafeTags(values: string[]) {
  const unique = new Set<string>();

  for (const value of values) {
    const slug = value.trim().toLowerCase();

    if (TAG_SLUG_PATTERN.test(slug)) {
      unique.add(slug);
    }
  }

  return [...unique];
}

async function readPublicCatalogData(
  store: PublicCatalogStore,
): Promise<PublicCatalogData> {
  const [sofas, tags, fabrics, visualPositions, renderCells] =
    await Promise.all([
      store.listPublicSofas(),
      store.listPublicSofaTags(),
      store.listPublicFabrics(),
      store.listPublicVisualPositions(),
      store.listPublicRenderCells(),
    ]);

  return {
    fabrics: fabrics.map(shapeFabricRecord).filter(isDefined),
    renderCells: renderCells.map(shapeRenderCellRecord).filter(isDefined),
    sofas: sofas.map(shapeSofaRecord).filter(isDefined),
    tags: tags.map(shapeSofaTagRecord).filter(isDefined),
    visualPositions: visualPositions
      .map(shapeVisualPositionRecord)
      .filter(isDefined),
  };
}

function buildUsableSofaStates(data: PublicCatalogData): UsableSofaState[] {
  return data.sofas
    .map((sofa) => buildUsableSofaState(data, sofa))
    .filter(isDefined);
}

function buildUsableSofaState(
  data: PublicCatalogData,
  sofa: PublicSofaRecord,
): UsableSofaState | null {
  const visualPositions = data.visualPositions
    .filter((position) => position.sofa_id === sofa.id)
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));

  if (visualPositions.length === 0) {
    return null;
  }

  const renderCells = data.renderCells.filter((cell) => cell.sofa_id === sofa.id);
  const completeFabrics = data.fabrics
    .filter((fabric) => fabric.sofa_id === sofa.id)
    .filter((fabric) =>
      visualPositions.every((position) =>
        renderCells.some(
          (cell) =>
            cell.fabric_id === fabric.id &&
            cell.visual_matrix_column_id === position.id,
        ),
      ),
    )
    .sort(
      (left, right) =>
        left.public_order - right.public_order || left.id.localeCompare(right.id),
    );

  if (completeFabrics.length === 0) {
    return null;
  }

  const completeFabricIds = new Set(completeFabrics.map((fabric) => fabric.id));
  const visualPositionIds = new Set(visualPositions.map((position) => position.id));
  const publicRenders = renderCells
    .filter(
      (cell) =>
        completeFabricIds.has(cell.fabric_id) &&
        visualPositionIds.has(cell.visual_matrix_column_id),
    )
    .sort(
      (left, right) =>
        completeFabrics.findIndex((fabric) => fabric.id === left.fabric_id) -
          completeFabrics.findIndex((fabric) => fabric.id === right.fabric_id) ||
        visualPositions.findIndex(
          (position) => position.id === left.visual_matrix_column_id,
        ) -
          visualPositions.findIndex(
            (position) => position.id === right.visual_matrix_column_id,
          ),
    );
  const defaultFabric = completeFabrics[0];
  const defaultVisualPosition = visualPositions[0];
  const defaultRender = publicRenders.find(
    (cell) =>
      cell.fabric_id === defaultFabric.id &&
      cell.visual_matrix_column_id === defaultVisualPosition.id,
  );

  if (!defaultRender) {
    return null;
  }

  return {
    defaultFabric,
    defaultRender,
    defaultVisualPosition,
    fabrics: completeFabrics,
    renders: publicRenders,
    sofa,
    tags: dedupeTags(data.tags.filter((tag) => tag.sofa_id === sofa.id)),
    visualPositions,
  };
}

function filterSofasByTags(states: UsableSofaState[], tags: string[]) {
  if (tags.length === 0) {
    return states;
  }

  return states.filter((state) => {
    const sofaTags = new Set(state.tags.map((tag) => tag.slug));

    return tags.every((tag) => sofaTags.has(tag));
  });
}

function shapeCatalogItemResponse(
  state: UsableSofaState,
  publicAssetBaseUrl: string,
): PublicCatalogItemResponse {
  const mediumUrl = buildPublicStorageUrl(
    publicAssetBaseUrl,
    state.defaultRender.render_medium_object_path,
  );

  return {
    default_fabric_id: state.defaultFabric.id,
    default_render_medium_content_type:
      state.defaultRender.render_medium_content_type,
    default_render_medium_height_px:
      state.defaultRender.render_medium_height_px ?? null,
    default_render_medium_url: mediumUrl,
    default_render_medium_width_px:
      state.defaultRender.render_medium_width_px ?? null,
    default_render_url: mediumUrl,
    default_visual_position_id: state.defaultVisualPosition.id,
    dimensions: shapeDimensions(state.sofa),
    fabrics: shapeCatalogCardFabrics(state, publicAssetBaseUrl),
    id: state.sofa.id,
    price: shapePrice(state.sofa),
    public_description: state.sofa.public_description ?? null,
    public_name: state.sofa.public_name,
    public_slug: state.sofa.public_slug,
    shopify_order_url: state.sofa.shopify_order_url ?? null,
    tags: state.tags,
  };
}

function shapeCatalogCardFabrics(
  state: UsableSofaState,
  publicAssetBaseUrl: string,
): PublicCatalogCardFabricResponse[] {
  return state.fabrics
    .map((fabric) => {
      const defaultPositionRender = state.renders.find(
        (render) =>
          render.fabric_id === fabric.id &&
          render.visual_matrix_column_id === state.defaultVisualPosition.id,
      );

      if (!defaultPositionRender) {
        return null;
      }

      return {
        id: fabric.id,
        is_premium: fabric.is_premium,
        public_name: fabric.public_name,
        public_order: fabric.public_order,
        render_medium_content_type:
          defaultPositionRender.render_medium_content_type,
        render_medium_height_px:
          defaultPositionRender.render_medium_height_px ?? null,
        render_medium_url: buildPublicStorageUrl(
          publicAssetBaseUrl,
          defaultPositionRender.render_medium_object_path,
        ),
        render_medium_width_px:
          defaultPositionRender.render_medium_width_px ?? null,
        swatch_small_content_type: fabric.public_swatch_small_content_type,
        swatch_small_height_px: fabric.public_swatch_small_height_px ?? null,
        swatch_small_url: buildPublicStorageUrl(
          publicAssetBaseUrl,
          fabric.public_swatch_small_object_path,
        ),
        swatch_small_width_px: fabric.public_swatch_small_width_px ?? null,
      };
    })
    .filter(isDefined);
}

function shapeSofaDetailResponse(
  state: UsableSofaState,
  publicAssetBaseUrl: string,
): PublicSofaDetailResponse {
  return {
    defaults: {
      fabric_id: state.defaultFabric.id,
      visual_position_id: state.defaultVisualPosition.id,
    },
    fabrics: state.fabrics.map((fabric) => ({
      id: fabric.id,
      is_premium: fabric.is_premium,
      public_name: fabric.public_name,
      public_order: fabric.public_order,
      swatch_url: buildPublicStorageUrl(
        publicAssetBaseUrl,
        fabric.public_swatch_object_path,
      ),
      swatch_small_content_type: fabric.public_swatch_small_content_type,
      swatch_small_height_px: fabric.public_swatch_small_height_px ?? null,
      swatch_small_url: buildPublicStorageUrl(
        publicAssetBaseUrl,
        fabric.public_swatch_small_object_path,
      ),
      swatch_small_width_px: fabric.public_swatch_small_width_px ?? null,
    })),
    renders: state.renders.map((render) => {
      const mediumUrl = buildPublicStorageUrl(
        publicAssetBaseUrl,
        render.render_medium_object_path,
      );
      const originalUrl = buildPublicStorageUrl(
        publicAssetBaseUrl,
        render.render_original_object_path,
      );

      return {
        fabric_id: render.fabric_id,
        height_px: render.render_original_height_px ?? null,
        render_medium_content_type: render.render_medium_content_type,
        render_medium_height_px: render.render_medium_height_px ?? null,
        render_medium_url: mediumUrl,
        render_medium_width_px: render.render_medium_width_px ?? null,
        render_original_content_type: render.render_original_content_type,
        render_original_height_px: render.render_original_height_px ?? null,
        render_original_url: originalUrl,
        render_original_width_px: render.render_original_width_px ?? null,
        render_url: originalUrl,
        visual_position_id: render.visual_matrix_column_id,
        width_px: render.render_original_width_px ?? null,
      };
    }),
    sofa: {
      dimensions: shapeDimensions(state.sofa),
      id: state.sofa.id,
      price: shapePrice(state.sofa),
      public_description: state.sofa.public_description ?? null,
      public_name: state.sofa.public_name,
      public_slug: state.sofa.public_slug,
      shopify_order_url: state.sofa.shopify_order_url ?? null,
      tags: state.tags,
    },
    visual_positions: state.visualPositions.map((position) => ({
      id: position.id,
      public_label: position.public_label ?? null,
      sequence: position.sequence,
    })),
  };
}

function shapeDimensions(sofa: PublicSofaRecord) {
  return {
    depth_cm: numberOrNull(sofa.depth_cm),
    footprint_measurements: sofa.footprint_measurements ?? null,
    footprint_type: stringOrNull(sofa.footprint_type),
    height_cm: numberOrNull(sofa.height_cm),
    length_cm: numberOrNull(sofa.length_cm),
  };
}

function shapePrice(sofa: PublicSofaRecord): PublicPriceResponse | null {
  const amountCents = numberOrNull(sofa.price_cents);
  const currency = stringOrNull(sofa.price_currency);

  if (!amountCents || currency !== "EUR") {
    return null;
  }

  return {
    amount_cents: amountCents,
    currency: "EUR",
  };
}

function dedupeTags(tags: PublicSofaTagRecord[]): PublicTagResponse[] {
  const bySlug = new Map<string, PublicTagResponse>();

  for (const tag of tags) {
    if (!bySlug.has(tag.slug)) {
      bySlug.set(tag.slug, {
        public_label: tag.public_label,
        slug: tag.slug,
      });
    }
  }

  return [...bySlug.values()].sort(
    (left, right) =>
      left.public_label.localeCompare(right.public_label, "fr") ||
      left.slug.localeCompare(right.slug),
  );
}

function compareCatalogSort(left: CatalogSortKey, right: CatalogSortKey) {
  const leftOrder = left.manual_public_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.manual_public_order ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftCreatedAt = Date.parse(left.created_at);
  const rightCreatedAt = Date.parse(right.created_at);

  if (leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  return left.id.localeCompare(right.id);
}

async function selectPublicRows(client: SupabasePublicClient, viewName: string) {
  const { data, error } = await client.from(viewName).select("*");

  if (error) {
    throw error;
  }

  return data ?? [];
}

function shapeSofaRecord(
  record: PublicSofaRecord | JsonObject,
): PublicSofaRecord | null {
  if (
    !isRecord(record) ||
    typeof record.id !== "string" ||
    typeof record.public_name !== "string" ||
    typeof record.public_slug !== "string" ||
    typeof record.created_at !== "string"
  ) {
    return null;
  }

  return {
    created_at: record.created_at,
    depth_cm: numberOrNull(record.depth_cm),
    footprint_measurements: record.footprint_measurements ?? null,
    footprint_type: stringOrNull(record.footprint_type),
    height_cm: numberOrNull(record.height_cm),
    id: record.id,
    length_cm: numberOrNull(record.length_cm),
    manual_public_order: numberOrNull(record.manual_public_order),
    price_cents: numberOrNull(record.price_cents),
    price_currency: stringOrNull(record.price_currency),
    public_description: stringOrNull(record.public_description),
    public_name: record.public_name,
    public_slug: record.public_slug,
    shopify_order_url: stringOrNull(record.shopify_order_url),
  };
}

function shapeSofaTagRecord(
  record: PublicSofaTagRecord | JsonObject,
): PublicSofaTagRecord | null {
  if (
    !isRecord(record) ||
    typeof record.sofa_id !== "string" ||
    typeof record.slug !== "string" ||
    typeof record.public_label !== "string"
  ) {
    return null;
  }

  return {
    public_label: record.public_label,
    slug: record.slug,
    sofa_id: record.sofa_id,
  };
}

function shapeFabricRecord(
  record: PublicSofaFabricRecord | JsonObject,
): PublicSofaFabricRecord | null {
  if (
    !isRecord(record) ||
    typeof record.id !== "string" ||
    typeof record.sofa_id !== "string" ||
    typeof record.public_name !== "string" ||
    typeof record.public_swatch_object_path !== "string" ||
    typeof record.public_swatch_small_content_type !== "string" ||
    typeof record.public_swatch_small_object_path !== "string" ||
    typeof record.public_order !== "number" ||
    typeof record.is_premium !== "boolean"
  ) {
    return null;
  }

  return {
    id: record.id,
    is_premium: record.is_premium,
    public_name: record.public_name,
    public_order: record.public_order,
    public_swatch_height_px: numberOrNull(record.public_swatch_height_px),
    public_swatch_object_path: record.public_swatch_object_path,
    public_swatch_small_content_type: record.public_swatch_small_content_type,
    public_swatch_small_height_px: numberOrNull(
      record.public_swatch_small_height_px,
    ),
    public_swatch_small_object_path: record.public_swatch_small_object_path,
    public_swatch_small_width_px: numberOrNull(
      record.public_swatch_small_width_px,
    ),
    public_swatch_width_px: numberOrNull(record.public_swatch_width_px),
    sofa_id: record.sofa_id,
  };
}

function shapeVisualPositionRecord(
  record: PublicVisualPositionRecord | JsonObject,
): PublicVisualPositionRecord | null {
  if (
    !isRecord(record) ||
    typeof record.id !== "string" ||
    typeof record.sofa_id !== "string" ||
    typeof record.sequence !== "number"
  ) {
    return null;
  }

  return {
    id: record.id,
    public_label: stringOrNull(record.public_label),
    sequence: record.sequence,
    sofa_id: record.sofa_id,
  };
}

function shapeRenderCellRecord(
  record: PublicRenderCellRecord | JsonObject,
): PublicRenderCellRecord | null {
  const mediumObjectPath =
    stringOrNull(record.render_medium_object_path) ??
    stringOrNull(record.public_render_object_path);
  const mediumContentType =
    stringOrNull(record.render_medium_content_type) ??
    stringOrNull(record.public_render_content_type);
  const originalObjectPath = stringOrNull(record.render_original_object_path);
  const originalContentType = stringOrNull(record.render_original_content_type);

  if (
    !isRecord(record) ||
    typeof record.render_cell_id !== "string" ||
    typeof record.sofa_id !== "string" ||
    typeof record.fabric_id !== "string" ||
    typeof record.visual_matrix_column_id !== "string" ||
    !mediumObjectPath ||
    !mediumContentType ||
    !originalObjectPath ||
    !originalContentType
  ) {
    return null;
  }

  return {
    fabric_id: record.fabric_id,
    public_render_content_type: mediumContentType,
    public_render_height_px:
      numberOrNull(record.public_render_height_px) ??
      numberOrNull(record.render_medium_height_px),
    public_render_object_path: mediumObjectPath,
    public_render_width_px:
      numberOrNull(record.public_render_width_px) ??
      numberOrNull(record.render_medium_width_px),
    render_medium_content_type: mediumContentType,
    render_medium_height_px:
      numberOrNull(record.render_medium_height_px) ??
      numberOrNull(record.public_render_height_px),
    render_medium_object_path: mediumObjectPath,
    render_medium_width_px:
      numberOrNull(record.render_medium_width_px) ??
      numberOrNull(record.public_render_width_px),
    render_original_content_type: originalContentType,
    render_original_height_px: numberOrNull(record.render_original_height_px),
    render_original_object_path: originalObjectPath,
    render_original_width_px: numberOrNull(record.render_original_width_px),
    render_cell_id: record.render_cell_id,
    sofa_id: record.sofa_id,
    visual_matrix_column_id: record.visual_matrix_column_id,
  };
}

function isCatalogCursor(value: unknown): value is CatalogCursor {
  return (
    isRecord(value) &&
    typeof value.created_at === "string" &&
    typeof value.id === "string" &&
    (typeof value.manual_public_order === "number" ||
      value.manual_public_order === null)
  );
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredEnv(
  env: NodeJS.ProcessEnv,
  primaryName: string,
  fallbackName?: string,
) {
  const value =
    env[primaryName] ?? (fallbackName ? env[fallbackName] : undefined);

  if (!value) {
    throw new Error(`${primaryName} is required.`);
  }

  return value;
}
