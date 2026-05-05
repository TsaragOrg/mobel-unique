import {
  createDefaultPublicCatalogInput,
  handleListPublicCatalogRequest,
} from "../../../../lib/public-catalog-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListPublicCatalogRequest({
    ...createDefaultPublicCatalogInput(),
    request,
  });
}
