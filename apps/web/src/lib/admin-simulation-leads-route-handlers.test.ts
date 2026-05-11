import { describe, expect, it, vi } from "vitest";
import { formatAdminErrorCodeMessage } from "../app/admin/admin-copy";
import { createAdminAuth, type AdminAuthUser } from "./admin-auth";
import {
  handleDeleteAdminSimulationLeadRequest,
  handleListAdminSimulationLeadJobsRequest,
  handleListAdminSimulationLeadsRequest,
  type AdminSimulationLeadsStore,
} from "./admin-simulation-leads-route-handlers";

const adminUser: AdminAuthUser = {
  app_metadata: {
    mobel_unique: {
      role: "admin",
    },
  },
  id: "00000000-0000-4000-8000-000000000801",
  user_metadata: {},
};

const nonAdminUser: AdminAuthUser = {
  app_metadata: {},
  id: "00000000-0000-4000-8000-000000000802",
  user_metadata: {},
};

function createRouteAuth(user: AdminAuthUser = adminUser) {
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
        return {
          id: "00000000-0000-4000-8000-000000000803",
        };
      },
      async registerDevice() {
        return {
          id: "00000000-0000-4000-8000-000000000804",
        };
      },
      async touchDevice() {},
    },
  });
}

function createRequest(path: string, method = "GET") {
  return new Request(`http://localhost${path}`, {
    method,
  });
}

function createStore(overrides: Partial<AdminSimulationLeadsStore> = {}) {
  const listLeads = vi.fn(async () => ({
    leads: [
      {
        consent_id: "consent-private",
        email: "client@example.com",
        job_id: "job-private",
        lastSimulationAt: "2026-05-11T10:00:00.000Z",
        leadId: "00000000-0000-4000-8000-000000000811",
        matchingJobCount: 3,
        session_id: "session-private",
        signed_url: "https://storage.example/signed/private",
        storage_path: "simulation-private-artifacts/customer-room.png",
      },
    ],
    nextCursor: null,
  }));
  const listLeadJobs = vi.fn(async () => ({
    email: "client@example.com",
    jobs: [
      {
        fabricName: "Tissu beige",
        generated_output_path: "outputs/private-result.png",
        in_home_simulation_job_id: "job-private",
        previewImageUrl:
          "/api/admin/storage-assets/00000000-0000-4000-8000-000000000812/preview?variant=medium",
        room_photo_path: "customer-room/private-photo.png",
        simulationDate: "2026-05-11T10:00:00.000Z",
        sofaName: "Canape droit",
        statusLabel: "Terminee",
        storage_prefix: "simulations/private",
        visualPositionLabel: "Vue de face",
      },
    ],
    matchingJobCount: 1,
  }));
  const deleteLead = vi.fn(async () => ({
    deleted: true as const,
  }));

  return {
    deleteLead,
    listLeadJobs,
    listLeads,
    ...overrides,
  } satisfies AdminSimulationLeadsStore;
}

function createInput(store: AdminSimulationLeadsStore, request: Request) {
  return {
    adminAuth: createRouteAuth(),
    authorizationHeader: "Bearer admin-token",
    createStore: () => store,
    request,
    trustedDeviceSecret: "trusted-device-secret",
  };
}

describe("admin simulation leads route handlers", () => {
  it("returns the existing safe admin rejection for anonymous requests", async () => {
    const response = await handleListAdminSimulationLeadsRequest({
      adminAuth: createRouteAuth(),
      authorizationHeader: undefined,
      createStore: () => createStore(),
      request: createRequest("/api/admin/simulation-leads"),
      trustedDeviceSecret: undefined,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AUTH_REQUIRED",
        message: formatAdminErrorCodeMessage("AUTH_REQUIRED"),
      },
    });
  });

  it("returns the existing safe admin rejection for authenticated non-admin users", async () => {
    const response = await handleListAdminSimulationLeadsRequest({
      adminAuth: createRouteAuth(nonAdminUser),
      authorizationHeader: "Bearer non-admin-token",
      createStore: () => createStore(),
      request: createRequest("/api/admin/simulation-leads"),
      trustedDeviceSecret: "trusted-device-secret",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "ADMIN_REQUIRED",
        message: formatAdminErrorCodeMessage("ADMIN_REQUIRED"),
      },
    });
  });

  it("returns readable lead email only after admin authorization and hides private identifiers", async () => {
    const store = createStore();
    const response = await handleListAdminSimulationLeadsRequest(
      createInput(store, createRequest("/api/admin/simulation-leads")),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      data: {
        leads: [
          {
            email: "client@example.com",
            last_simulation_at: "2026-05-11T10:00:00.000Z",
            lead_id: "00000000-0000-4000-8000-000000000811",
            matching_job_count: 3,
          },
        ],
        next_cursor: null,
      },
      meta: {},
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("job-private");
    expect(serialized).not.toContain("consent-private");
    expect(serialized).not.toContain("session-private");
    expect(serialized).not.toContain("storage_path");
    expect(serialized).not.toContain("signed");
    expect(serialized).not.toContain("customer-room");
  });

  it("passes day, week, month, custom date filters, sort, limit, cursor, and normalized exact email search to the store", async () => {
    const store = createStore();

    await handleListAdminSimulationLeadsRequest(
      createInput(
        store,
        createRequest(
          "/api/admin/simulation-leads?range=day&sort=oldest&email=%20Client@Example.COM%20&limit=25&cursor=eyJ0IjoiMjAyNi0wNS0xMVQxMDowMDowMC4wMDBaIiwiaWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDA4MTEifQ",
        ),
      ),
    );
    await handleListAdminSimulationLeadsRequest(
      createInput(store, createRequest("/api/admin/simulation-leads?range=week")),
    );
    await handleListAdminSimulationLeadsRequest(
      createInput(store, createRequest("/api/admin/simulation-leads?range=month")),
    );
    await handleListAdminSimulationLeadsRequest(
      createInput(
        store,
        createRequest(
          "/api/admin/simulation-leads?from=2026-05-01T00:00:00.000Z&to=2026-05-10T00:00:00.000Z",
        ),
      ),
    );

    expect(store.listLeads).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        cursor: {
          id: "00000000-0000-4000-8000-000000000811",
          lastSimulationAt: "2026-05-11T10:00:00.000Z",
        },
        email: "client@example.com",
        limit: 25,
        range: "day",
        sort: "oldest",
      }),
    );
    expect(store.listLeads).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ range: "week" }),
    );
    expect(store.listLeads).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ range: "month" }),
    );
    expect(store.listLeads).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        from: "2026-05-01T00:00:00.000Z",
        range: null,
        to: "2026-05-10T00:00:00.000Z",
      }),
    );
  });

  it("returns a safe validation error for invalid filters", async () => {
    const response = await handleListAdminSimulationLeadsRequest(
      createInput(
        createStore(),
        createRequest("/api/admin/simulation-leads?range=year&sort=sideways"),
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(JSON.stringify(body)).not.toContain("year");
    expect(JSON.stringify(body)).not.toContain("sideways");
  });

  it("returns safe job modal data and omits private artifact details", async () => {
    const store = createStore();
    const response = await handleListAdminSimulationLeadJobsRequest({
      ...createInput(
        store,
        createRequest(
          "/api/admin/simulation-leads/00000000-0000-4000-8000-000000000811/jobs?range=day",
        ),
      ),
      leadId: "00000000-0000-4000-8000-000000000811",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      data: {
        email: "client@example.com",
        jobs: [
          {
            fabric_name: "Tissu beige",
            preview_image_url:
              "/api/admin/storage-assets/00000000-0000-4000-8000-000000000812/preview?variant=medium",
            simulation_date: "2026-05-11T10:00:00.000Z",
            sofa_name: "Canape droit",
            status_label: "Terminee",
            visual_position_label: "Vue de face",
          },
        ],
        matching_job_count: 1,
      },
      meta: {},
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("job-private");
    expect(serialized).not.toContain("customer-room");
    expect(serialized).not.toContain("private-result");
    expect(serialized).not.toContain("storage_prefix");
  });

  it("deletes a lead with an idempotent success response", async () => {
    const store = createStore({
      deleteLead: vi.fn(async () => ({
        deleted: true as const,
      })),
    });

    const response = await handleDeleteAdminSimulationLeadRequest({
      ...createInput(
        store,
        createRequest(
          "/api/admin/simulation-leads/00000000-0000-4000-8000-000000000811",
          "DELETE",
        ),
      ),
      leadId: "00000000-0000-4000-8000-000000000811",
    });

    expect(response.status).toBe(200);
    expect(store.deleteLead).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000811",
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        deleted: true,
      },
      meta: {},
    });
  });

  it("returns safe failure messages without SQL, stack, provider, storage, encryption, or secret details", async () => {
    const store = createStore({
      listLeads: vi.fn(async () => {
        throw new Error(
          "SQL stack Supabase provider storage path encryption SUPABASE_SERVICE_ROLE_KEY",
        );
      }),
    });

    const response = await handleListAdminSimulationLeadsRequest(
      createInput(store, createRequest("/api/admin/simulation-leads")),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(body.error).toMatchObject({
      code: "SIMULATION_LEADS_UNAVAILABLE",
    });
    expect(serialized).not.toMatch(/SQL|stack|provider|storage|encryption|SUPABASE_SERVICE_ROLE_KEY/i);
  });
});
