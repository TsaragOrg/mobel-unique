import { headers } from "next/headers";
import {
  handleAdminAuthUnavailableRequest,
  handleTrustedDeviceRegistrationRequest
} from "../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const headerStore = await headers();

  try {
    return handleTrustedDeviceRegistrationRequest({
      adminAuth: createServerAdminAuth(),
      authorizationHeader: headerStore.get("authorization") ?? undefined
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}
