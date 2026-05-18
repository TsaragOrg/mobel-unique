import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../lib/admin-auth";
import { handleAdminAuthUnavailableRequest } from "../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../lib/admin-server";
import { createSupabaseAdminSimulationAnalyticsStore } from "../../../../lib/admin-simulation-analytics";
import { handleGetSimulationAnalyticsRequest } from "../../../../lib/admin-simulation-analytics-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const adminInput = await readAdminInput();

    return handleGetSimulationAnalyticsRequest({
      ...adminInput,
      request,
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
    createStore: createSupabaseAdminSimulationAnalyticsStore,
    trustedDeviceSecret:
      cookieStore.get(ADMIN_TRUSTED_DEVICE_COOKIE)?.value ?? undefined,
  };
}
