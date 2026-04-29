import {
  PublicCatalogOperationError,
  createSupabasePublicCatalogStore,
  getPublicSofaDetail,
  listPublicCatalog,
  listPublicCatalogTags,
  parseCatalogListQuery,
  type PublicCatalogOperationErrorData,
  type PublicCatalogStore,
} from "./public-catalog";

export type { PublicCatalogStore } from "./public-catalog";

interface BaseInput {
  createStore: () => PublicCatalogStore;
}

type CatalogRequestInput = BaseInput & {
  request: Request;
};

type SofaInput = BaseInput & {
  publicSlug: string;
};

export async function handleListPublicCatalogRequest(
  input: CatalogRequestInput,
) {
  try {
    const url = new URL(input.request.url);
    const validation = parseCatalogListQuery(url);

    if (!validation.ok) {
      return catalogErrorResponse(validation.error);
    }

    const catalog = await listPublicCatalog(input.createStore(), validation.value);

    return jsonResponse(
      {
        data: catalog,
        meta: {},
      },
      200,
    );
  } catch (error) {
    return catalogErrorResponse(mapPublicCatalogError(error));
  }
}

export async function handleListPublicCatalogTagsRequest(input: BaseInput) {
  try {
    const tags = await listPublicCatalogTags(input.createStore());

    return jsonResponse(
      {
        data: tags,
        meta: {},
      },
      200,
    );
  } catch (error) {
    return catalogErrorResponse(mapPublicCatalogError(error));
  }
}

export async function handleGetPublicSofaRequest(input: SofaInput) {
  try {
    const sofa = await getPublicSofaDetail(
      input.createStore(),
      input.publicSlug,
    );

    return jsonResponse(
      {
        data: sofa,
        meta: {},
      },
      200,
    );
  } catch (error) {
    return catalogErrorResponse(mapPublicCatalogError(error));
  }
}

export function createDefaultPublicCatalogInput() {
  return {
    createStore: createSupabasePublicCatalogStore,
  };
}

function mapPublicCatalogError(
  error: unknown,
): PublicCatalogOperationErrorData {
  if (error instanceof PublicCatalogOperationError) {
    return {
      code: error.code,
      details: error.details,
      message: error.message,
      status: error.status,
    };
  }

  return {
    code: "CATALOG_UNAVAILABLE",
    details: {},
    message: "Le catalogue est temporairement indisponible.",
    status: 503,
  };
}

function catalogErrorResponse(error: PublicCatalogOperationErrorData) {
  return jsonResponse(
    {
      error: {
        code: error.code,
        details: error.details ?? {},
        message: error.message,
      },
    },
    error.status,
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}
