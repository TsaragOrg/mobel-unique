import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../../lib/admin-auth";
import { createSupabaseAdminCatalogStore } from "../../../../../../lib/admin-catalog";
import {
  handleCreateVisualMatrixColumnRequest,
  handleListVisualMatrixColumnsRequest,
} from "../../../../../../lib/admin-catalog-route-handlers";
import { handleAdminAuthUnavailableRequest } from "../../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VisualMatrixColumnsRouteContext {
  params: Promise<{
    sofa_id: string;
  }>;
}

export async function GET(
  _request: Request,
  context: VisualMatrixColumnsRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { sofa_id: sofaId } = await context.params;

    return handleListVisualMatrixColumnsRequest({
      ...adminInput,
      sofaId,
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}

export async function POST(
  request: Request,
  context: VisualMatrixColumnsRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { sofa_id: sofaId } = await context.params;

    return handleCreateVisualMatrixColumnRequest({
      ...adminInput,
      request,
      sofaId,
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
