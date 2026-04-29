import {
  createDefaultPublicCatalogInput,
  handleGetPublicSofaRequest,
} from "../../../../../lib/public-catalog-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PublicSofaRouteContext {
  params: Promise<{
    public_slug: string;
  }>;
}

export async function GET(
  _request: Request,
  context: PublicSofaRouteContext,
) {
  const { public_slug: publicSlug } = await context.params;

  return handleGetPublicSofaRequest({
    ...createDefaultPublicCatalogInput(),
    publicSlug,
  });
}
