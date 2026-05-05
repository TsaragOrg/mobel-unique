import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../../lib/admin-auth";
import { createSupabaseAdminCatalogStore } from "../../../../../../lib/admin-catalog";
import { handleRetryFabricRenderJobRequest } from "../../../../../../lib/admin-catalog-route-handlers";
import { handleAdminAuthUnavailableRequest } from "../../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RetryFabricRenderJobRouteContext {
  params: Promise<{
    job_id: string;
  }>;
}

export async function POST(
  _request: Request,
  context: RetryFabricRenderJobRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { job_id: jobId } = await context.params;

    return handleRetryFabricRenderJobRequest({
      ...adminInput,
      jobId,
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
