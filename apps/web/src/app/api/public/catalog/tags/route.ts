import {
  createDefaultPublicCatalogInput,
  handleListPublicCatalogTagsRequest,
} from "../../../../../lib/public-catalog-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handleListPublicCatalogTagsRequest(createDefaultPublicCatalogInput());
}
