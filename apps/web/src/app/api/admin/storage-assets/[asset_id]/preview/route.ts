import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../../lib/admin-auth";
import { createSupabaseAdminCatalogStore } from "../../../../../../lib/admin-catalog";
import { handleGetStorageAssetPreviewRequest } from "../../../../../../lib/admin-catalog-route-handlers";
import { handleAdminAuthUnavailableRequest } from "../../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface StorageAssetPreviewRouteContext {
  params: Promise<{
    asset_id: string;
  }>;
}

export async function GET(
  request: Request,
  context: StorageAssetPreviewRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { asset_id: assetId } = await context.params;
    const variant = new URL(request.url).searchParams.get("variant");

    return handleGetStorageAssetPreviewRequest({
      ...adminInput,
      assetId,
      variant,
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}

async function readAdminInput() {
  const headerStore = await headers();
  const cookieStore = await cookies();

  return {
    adminAuth: createServerAdminAuth(),
    authorizationHeader: headerStore.get("authorization") ?? undefined,
    createStore: createSupabaseAdminCatalogStore,
    trustedDeviceSecret:
      cookieStore.get(ADMIN_TRUSTED_DEVICE_COOKIE)?.value ?? undefined,
  };
}
