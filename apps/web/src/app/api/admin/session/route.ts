import { cookies, headers } from "next/headers";
import { ADMIN_TRUSTED_DEVICE_COOKIE } from "../../../../lib/admin-auth";
import {
  handleAdminAuthUnavailableRequest,
  handleAdminSessionRequest
} from "../../../../lib/admin-route-handlers";
import { createServerAdminAuth } from "../../../../lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headerStore = await headers();
  const cookieStore = await cookies();

  try {
    return handleAdminSessionRequest({
      adminAuth: createServerAdminAuth(),
      authorizationHeader: headerStore.get("authorization") ?? undefined,
      trustedDeviceSecret:
        cookieStore.get(ADMIN_TRUSTED_DEVICE_COOKIE)?.value ?? undefined
    });
  } catch {
    return handleAdminAuthUnavailableRequest();
  }
}
