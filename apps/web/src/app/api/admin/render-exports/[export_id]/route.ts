import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../lib/admin-auth";
import { createSupabaseAdminCatalogStore } from "../../../../../lib/admin-catalog";
import { handleGetSofaRenderExportRequest } from "../../../../../lib/admin-catalog-route-handlers";
import { handleAdminAuthUnavailableRequest } from "../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RenderExportRouteContext {
  params: Promise<{
    export_id: string;
  }>;
}

export async function GET(
  _request: Request,
  context: RenderExportRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { export_id: exportId } = await context.params;

    return handleGetSofaRenderExportRequest({
      ...adminInput,
      exportId,
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
