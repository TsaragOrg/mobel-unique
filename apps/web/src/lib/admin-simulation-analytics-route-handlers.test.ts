import { describe, expect, it, vi } from "vitest";
import { createAdminAuth, type AdminAuthUser } from "./admin-auth";
import {
  handleGetSimulationAnalyticsRequest,
} from "./admin-simulation-analytics-route-handlers";
import type {
  AdminSimulationAnalytics,
  AdminSimulationAnalyticsQuery,
  AdminSimulationAnalyticsStore,
} from "./admin-simulation-analytics";

const adminUser: AdminAuthUser = {
  app_metadata: {
    mobel_unique: {
      role: "admin",
    },
  },
  id: "00000000-0000-4000-8000-000000000401",
  user_metadata: {},
};

const nonAdminUser: AdminAuthUser = {
  app_metadata: {},
  id: "00000000-0000-4000-8000-000000000402",
  user_metadata: {},
};

const analytics: AdminSimulationAnalytics = {
  combinations: [
    {
      fabric_name: "Tissu lin",
      simulation_count: 2,
      sofa_name: "Canape Oslo",
    },
  ],
  fabrics: [
    {
      fabric_name: "Tissu lin",
      simulation_count: 3,
    },
  ],
  period: "30d",
  sofas: [
    {
      simulation_count: 3,
      sofa_name: "Canape Oslo",
      top_fabric_name: "Tissu lin",
    },
  ],
  sort: "most",
  summary: {
    total_simulations: 3,
    unique_fabrics: 1,
    unique_sofas: 1,
  },
};

function createRouteAuth({
  activeDevice = true,
  user = adminUser,
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
            user: null,
          };
        }

        return {
          error: null,
          user,
        };
      },
    },
    environment: "local",
    trustedDeviceStore: {
      async findActiveDevice() {
        return activeDevice
          ? {
              id: "00000000-0000-4000-8000-000000000403",
            }
          : null;
      },
      async registerDevice() {
        return {
          id: "00000000-0000-4000-8000-000000000404",
        };
      },
      async touchDevice() {},
    },
  });
}

function createFakeStore(
  getSimulationAnalytics = vi.fn(async () => analytics),
): AdminSimulationAnalyticsStore {
  return {
    getSimulationAnalytics,
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("admin simulation analytics route handler", () => {
  it("returns protected analytics for authorized admins with default query settings", async () => {
    const getSimulationAnalytics = vi.fn(
      async (_query: AdminSimulationAnalyticsQuery) => analytics,
    );
    const response = await handleGetSimulationAnalyticsRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: "Bearer admin-token",
      createStore: () => createFakeStore(getSimulationAnalytics),
      request: new Request("http://localhost/api/admin/simulation-analytics"),
      trustedDeviceSecret: "trusted-device",
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getSimulationAnalytics).toHaveBeenCalledWith({
      limit: 10,
      period: "30d",
      sort: "most",
    });
    expect(body).toEqual({
      data: analytics,
      meta: {},
    });
    expect(JSON.stringify(body)).not.toContain("00000000-0000");
    expect(JSON.stringify(body)).not.toContain("email");
  });

  it("rejects anonymous and non-admin requests without creating the analytics store", async () => {
    const anonymousStore = vi.fn(() => createFakeStore());
    const anonymous = await handleGetSimulationAnalyticsRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: undefined,
      createStore: anonymousStore,
      request: new Request("http://localhost/api/admin/simulation-analytics"),
      trustedDeviceSecret: "trusted-device",
    });
    const nonAdminStore = vi.fn(() => createFakeStore());
    const nonAdmin = await handleGetSimulationAnalyticsRequest({
      adminAuth: createRouteAuth({ user: nonAdminUser }),
      authorizationHeader: "Bearer admin-token",
      createStore: nonAdminStore,
      request: new Request("http://localhost/api/admin/simulation-analytics"),
      trustedDeviceSecret: "trusted-device",
    });

    expect(anonymous.status).toBe(401);
    expect(nonAdmin.status).toBe(403);
    expect(anonymousStore).not.toHaveBeenCalled();
    expect(nonAdminStore).not.toHaveBeenCalled();
  });

  it("rejects invalid query parameters before store access", async () => {
    const createStore = vi.fn(() => createFakeStore());
    const response = await handleGetSimulationAnalyticsRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: "Bearer admin-token",
      createStore,
      request: new Request(
        "http://localhost/api/admin/simulation-analytics?period=90d",
      ),
      trustedDeviceSecret: "trusted-device",
    });
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(createStore).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
      },
    });
  });

  it("returns a safe error when analytics loading fails", async () => {
    const response = await handleGetSimulationAnalyticsRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: "Bearer admin-token",
      createStore: () =>
        createFakeStore(
          vi.fn(async () => {
            throw new Error("raw SQL failure with storage/object_path");
          }),
        ),
      request: new Request("http://localhost/api/admin/simulation-analytics"),
      trustedDeviceSecret: "trusted-device",
    });
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: {
        code: "ANALYTICS_UNAVAILABLE",
      },
    });
    expect(serialized).not.toContain("raw SQL");
    expect(serialized).not.toContain("object_path");
  });
});
