import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../lib/admin-auth";
import { createSupabaseAdminCatalogStore } from "../../../../../lib/admin-catalog";
import {
  handleDeleteTagRequest,
  handleUpdateTagRequest
} from "../../../../../lib/admin-catalog-route-handlers";
import { handleAdminAuthUnavailableRequest } from "../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TagRouteContext {
  params: Promise<{
    tag_id: string;
  }>;
}

export async function PATCH(request: Request, context: TagRouteContext) {
  try {
    const adminInput = await readAdminInput();
    const { tag_id: tagId } = await context.params;

    return handleUpdateTagRequest({
      ...adminInput,
      request,
      tagId
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}

export async function DELETE(_request: Request, context: TagRouteContext) {
  try {
    const adminInput = await readAdminInput();
    const { tag_id: tagId } = await context.params;

    return handleDeleteTagRequest({
      ...adminInput,
      tagId
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
      cookieStore.get(ADMIN_TRUSTED_DEVICE_COOKIE)?.value ?? undefined
  };
}
