import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../../../lib/admin-auth";
import { handleListAdminSimulationLeadJobsRequest } from "../../../../../../lib/admin-simulation-leads-route-handlers";
import { createSupabaseAdminSimulationLeadsStore } from "../../../../../../lib/admin-simulation-leads-server";
import { handleAdminAuthUnavailableRequest } from "../../../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AdminSimulationLeadJobsRouteContext {
  params: Promise<{
    lead_id: string;
  }>;
}

export async function GET(
  request: Request,
  context: AdminSimulationLeadJobsRouteContext,
) {
  try {
    const adminInput = await readAdminInput();
    const { lead_id: leadId } = await context.params;

    return handleListAdminSimulationLeadJobsRequest({
      ...adminInput,
      leadId,
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
    createStore: createSupabaseAdminSimulationLeadsStore,
    trustedDeviceSecret:
      cookieStore.get(ADMIN_TRUSTED_DEVICE_COOKIE)?.value ?? undefined,
  };
}
