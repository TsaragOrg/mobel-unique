import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../lib/admin-auth";
import { createSupabaseAdminCatalogStore } from "../../../../../lib/admin-catalog";
import {
  handleDeleteVisualMatrixColumnRequest,
  handleUpdateVisualMatrixColumnRequest,
} from "../../../../../lib/admin-catalog-route-handlers";
import { handleAdminAuthUnavailableRequest } from "../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VisualMatrixColumnRouteContext {
  params: Promise<{
    column_id: string;
  }>;
}

export async function PATCH(
  request: Request,
  context: VisualMatrixColumnRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { column_id: columnId } = await context.params;

    return handleUpdateVisualMatrixColumnRequest({
      ...adminInput,
      columnId,
      request,
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}

export async function DELETE(
  _request: Request,
  context: VisualMatrixColumnRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { column_id: columnId } = await context.params;

    return handleDeleteVisualMatrixColumnRequest({
      ...adminInput,
      columnId,
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
