import {
  ADMIN_ROLE,
  ADMIN_TRUSTED_DEVICE_COOKIE,
  type createAdminAuth
} from "./admin-auth";
import { ADMIN_ERROR_MESSAGES } from "../app/admin/admin-copy";

const TRUSTED_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

type AdminAuth = ReturnType<typeof createAdminAuth>;

export async function handleAdminSessionRequest(input: {
  adminAuth: AdminAuth;
  authorizationHeader: string | undefined;
  trustedDeviceSecret: string | undefined;
}) {
  try {
    const authorization = await input.adminAuth.authorizeRequest({
      authorizationHeader: input.authorizationHeader,
      trustedDeviceSecret: input.trustedDeviceSecret
    });

    if (!authorization.ok) {
      return jsonResponse(
        {
          error: authorization.error
        },
        authorization.status
      );
    }

    return jsonResponse(
      {
        data: {
          admin: {
            authenticated: true,
            role: ADMIN_ROLE
          }
        },
        meta: {}
      },
      200
    );
  } catch {
    return internalErrorResponse();
  }
}

export async function handleTrustedDeviceRegistrationRequest(input: {
  adminAuth: AdminAuth;
  authorizationHeader: string | undefined;
}) {
  try {
    const registration = await input.adminAuth.registerTrustedDevice({
      authorizationHeader: input.authorizationHeader
    });

    if (!registration.ok) {
      return jsonResponse(
        {
          error: registration.error
        },
        registration.status
      );
    }

    return jsonResponse(
      {
        data: {
          trustedDevice: {
            registered: true
          }
        },
        meta: {}
      },
      registration.status,
      {
        "Set-Cookie": serializeTrustedDeviceCookie(registration.deviceSecret)
      }
    );
  } catch {
    return internalErrorResponse();
  }
}

export function handleAdminLogoutRequest() {
  return jsonResponse(
    {
      data: {
        ok: true
      },
      meta: {}
    },
    200,
    {
      "Set-Cookie": serializeTrustedDeviceCookie("", {
        maxAge: 0
      })
    }
  );
}

export function handleAdminAuthUnavailableRequest() {
  return internalErrorResponse();
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      ...headers
    },
    status
  });
}

function internalErrorResponse() {
  return jsonResponse(
    {
      error: {
        code: "AUTH_INVALID",
        message: ADMIN_ERROR_MESSAGES.AUTH_INVALID
      }
    },
    401
  );
}

function serializeTrustedDeviceCookie(
  value: string,
  options: {
    maxAge?: number;
  } = {}
) {
  const maxAge = options.maxAge ?? TRUSTED_DEVICE_MAX_AGE_SECONDS;
  const encodedValue = encodeURIComponent(value);

  return [
    `${ADMIN_TRUSTED_DEVICE_COOKIE}=${encodedValue}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict"
  ].join("; ");
}
