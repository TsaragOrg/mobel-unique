import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../../../lib/admin-auth";
import { createSupabaseAdminCatalogStore } from "../../../../../../../lib/admin-catalog";
import {
  handleAssignSofaFabricRequest,
  handleRemoveSofaFabricRequest,
  handleUpdateSofaFabricRequest,
} from "../../../../../../../lib/admin-catalog-route-handlers";
import { handleAdminAuthUnavailableRequest } from "../../../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SofaFabricRouteContext {
  params: Promise<{
    fabric_id: string;
    sofa_id: string;
  }>;
}

export async function PUT(request: Request, context: SofaFabricRouteContext) {
  try {
    const adminInput = await readAdminInput();
    const { fabric_id: fabricId, sofa_id: sofaId } = await context.params;

    return handleAssignSofaFabricRequest({
      ...adminInput,
      fabricId,
      request,
      sofaId,
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}

export async function PATCH(request: Request, context: SofaFabricRouteContext) {
  try {
    const adminInput = await readAdminInput();
    const { fabric_id: fabricId, sofa_id: sofaId } = await context.params;

    return handleUpdateSofaFabricRequest({
      ...adminInput,
      fabricId,
      request,
      sofaId,
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}

export async function DELETE(_request: Request, context: SofaFabricRouteContext) {
  try {
    const adminInput = await readAdminInput();
    const { fabric_id: fabricId, sofa_id: sofaId } = await context.params;

    return handleRemoveSofaFabricRequest({
      ...adminInput,
      fabricId,
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
