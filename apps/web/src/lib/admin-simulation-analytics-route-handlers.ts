import { ADMIN_ERROR_MESSAGES } from "../app/admin/admin-copy";
import type { createAdminAuth } from "./admin-auth";
import {
  parseAdminSimulationAnalyticsQuery,
  type AdminSimulationAnalyticsStore,
} from "./admin-simulation-analytics";

type AdminAuth = ReturnType<typeof createAdminAuth>;

interface AdminSimulationAnalyticsRouteInput {
  adminAuth: AdminAuth;
  authorizationHeader: string | undefined;
  createStore(): AdminSimulationAnalyticsStore;
  request: Request;
  trustedDeviceSecret: string | undefined;
}

export async function handleGetSimulationAnalyticsRequest(
  input: AdminSimulationAnalyticsRouteInput,
) {
  try {
    const authorization = await input.adminAuth.authorizeRequest({
      authorizationHeader: input.authorizationHeader,
      trustedDeviceSecret: input.trustedDeviceSecret,
    });

    if (!authorization.ok) {
      return jsonResponse(
        {
          error: authorization.error,
        },
        authorization.status,
      );
    }

    const query = parseAdminSimulationAnalyticsQuery(
      new URL(input.request.url).searchParams,
    );

    if (!query.ok) {
      return jsonResponse(
        {
          error: query.error,
        },
        query.status,
      );
    }

    const analytics = await input
      .createStore()
      .getSimulationAnalytics(query.value);

    return jsonResponse(
      {
        data: analytics,
        meta: {},
      },
      200,
    );
  } catch {
    return jsonResponse(
      {
        error: {
          code: "ANALYTICS_UNAVAILABLE",
          message: ADMIN_ERROR_MESSAGES.ANALYTICS_UNAVAILABLE,
        },
      },
      500,
    );
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
    status,
  });
}
