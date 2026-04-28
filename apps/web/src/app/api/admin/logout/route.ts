import { handleAdminLogoutRequest } from "../../../../lib/admin-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST() {
  return handleAdminLogoutRequest();
}
