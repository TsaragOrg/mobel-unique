import { describe, expect, it } from "vitest";
import { createAdminAuth, type AdminAuthUser } from "./admin-auth";
import {
  handleAdminLogoutRequest,
  handleAdminSessionRequest,
  handleTrustedDeviceRegistrationRequest
} from "./admin-route-handlers";

const adminUser: AdminAuthUser = {
  app_metadata: {
    mobel_unique: {
      role: "admin"
    }
  },
  id: "00000000-0000-4000-8000-000000000021",
  user_metadata: {}
};

const nonAdminUser: AdminAuthUser = {
  app_metadata: {},
  id: "00000000-0000-4000-8000-000000000022",
  user_metadata: {}
};

function createRouteAuth({
  activeDevice = true,
  user = adminUser
}: {
  activeDevice?: boolean;
  user?: AdminAuthUser;
}) {
  return createAdminAuth({
    authVerifier: {
      async getUser(accessToken) {
        if (accessToken === "anonymous") {
          return {
            error: new Error("missing"),
            user: null
          };
        }

        return {
          error: null,
          user
        };
      }
    },
    environment: "local",
    generateDeviceSecret: () => "registered-device-secret",
    trustedDeviceStore: {
      async findActiveDevice() {
        if (!activeDevice) {
          return null;
        }

        return {
          id: "00000000-0000-4000-8000-000000000023"
        };
      },
      async registerDevice() {
        return {
          id: "00000000-0000-4000-8000-000000000024"
        };
      },
      async touchDevice() {}
    }
  });
}

describe("admin route handlers", () => {
  it("returns 401 for anonymous session checks", async () => {
    const response = await handleAdminSessionRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: undefined,
      trustedDeviceSecret: undefined
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AUTH_REQUIRED"
      }
    });
  });

  it("returns 403 for non-admin session checks", async () => {
    const response = await handleAdminSessionRequest({
      adminAuth: createRouteAuth({
        user: nonAdminUser
      }),
      authorizationHeader: "Bearer non-admin-token",
      trustedDeviceSecret: "trusted-device-secret"
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "ADMIN_REQUIRED"
      }
    });
  });

  it("returns 401 for revoked trusted devices", async () => {
    const response = await handleAdminSessionRequest({
      adminAuth: createRouteAuth({
        activeDevice: false
      }),
      authorizationHeader: "Bearer admin-token",
      trustedDeviceSecret: "revoked-device-secret"
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AUTH_INVALID"
      }
    });
  });

  it("returns the minimal successful admin session envelope", async () => {
    const response = await handleAdminSessionRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: "Bearer admin-token",
      trustedDeviceSecret: "trusted-device-secret"
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        admin: {
          authenticated: true,
          role: "admin"
        }
      },
      meta: {}
    });
  });

  it("does not expose service-role credentials in admin session responses", async () => {
    const response = await handleAdminSessionRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: "Bearer admin-token",
      trustedDeviceSecret: "trusted-device-secret"
    });

    const responseText = await response.text();

    expect(responseText).not.toContain("service_role");
    expect(responseText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("registers trusted devices through a secure first-party cookie", async () => {
    const response = await handleTrustedDeviceRegistrationRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: "Bearer admin-token"
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-mobel_admin_device="
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
  });

  it("clears trusted device browser state on logout", async () => {
    const response = handleAdminLogoutRequest();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-mobel_admin_device=;"
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
