import { describe, expect, it, vi } from "vitest";
import { createAdminAuth, type AdminAuthUser } from "./admin-auth";
import {
  handleCreateSofaRequest,
  handleCreateTagRequest,
  handleDeleteTagRequest,
  handleGetSofaPublicationReadinessRequest,
  handleGetSofaRequest,
  handleListSofasRequest,
  handleListTagsRequest,
  handleUpdateSofaRequest,
  handleUpdateTagRequest,
  type AdminCatalogStore,
} from "./admin-catalog-route-handlers";

const adminUser: AdminAuthUser = {
  app_metadata: {
    mobel_unique: {
      role: "admin",
    },
  },
  id: "00000000-0000-4000-8000-000000000301",
  user_metadata: {},
};

const nonAdminUser: AdminAuthUser = {
  app_metadata: {},
  id: "00000000-0000-4000-8000-000000000302",
  user_metadata: {},
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
              id: "00000000-0000-4000-8000-000000000303",
            }
          : null;
      },
      async registerDevice() {
        return {
          id: "00000000-0000-4000-8000-000000000304",
        };
      },
      async touchDevice() {},
    },
  });
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/catalog", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

function createFakeStore(): AdminCatalogStore {
  const tags = new Map<
    string,
    {
      id: string;
      public_label: string;
      slug: string;
    }
  >();
  const sofas = new Map<string, Record<string, unknown>>();
  let tagCounter = 0;
  let sofaCounter = 0;

  return {
    async createSofa(input) {
      sofaCounter += 1;
      const sofa = {
        created_at: "2026-04-28T10:00:00.000Z",
        id: `00000000-0000-4000-8000-${String(sofaCounter).padStart(12, "0")}`,
        lifecycle_state: "draft",
        public_slug: null,
        tags: input.tag_ids.map((tagId) => tags.get(tagId)),
        updated_at: "2026-04-28T10:00:00.000Z",
        ...input,
      };
      sofas.set(sofa.id, sofa);

      return sofa;
    },
    async createTag(input) {
      tagCounter += 1;
      const tag = {
        id: `00000000-0000-4000-8000-${String(200 + tagCounter).padStart(
          12,
          "0",
        )}`,
        ...input,
      };
      tags.set(tag.id, tag);

      return tag;
    },
    async deleteTag(tagId) {
      for (const sofa of sofas.values()) {
        const sofaTags = sofa.tags as Array<{ id: string }>;

        if (sofaTags.some((tag) => tag.id === tagId)) {
          return {
            code: "TAG_IN_USE",
            message: "Assigned tags cannot be deleted.",
            status: 409,
          };
        }
      }

      tags.delete(tagId);

      return null;
    },
    async getSofa(sofaId) {
      return sofas.get(sofaId) ?? null;
    },
    async getSofaPublicationReadiness(sofaId) {
      if (!sofas.has(sofaId)) {
        return null;
      }

      return {
        errors: [
          {
            code: "MISSING_PUBLIC_FABRIC",
            message: "At least one active public fabric is required.",
          },
          {
            code: "INCOMPLETE_PUBLIC_RENDER_COVERAGE",
            message: "Public render coverage is incomplete.",
          },
        ],
        ready: false,
      };
    },
    async listSofas() {
      return [...sofas.values()];
    },
    async listTags() {
      return [...tags.values()];
    },
    async updateSofa(sofaId, input) {
      const existing = sofas.get(sofaId);

      if (!existing) {
        return null;
      }

      const next = {
        ...existing,
        ...input,
        tags: input.tag_ids
          ? input.tag_ids.map((tagId) => tags.get(tagId))
          : existing.tags,
        updated_at: "2026-04-28T10:05:00.000Z",
      };
      sofas.set(sofaId, next);

      return next;
    },
    async updateTag(tagId, input) {
      const existing = tags.get(tagId);

      if (!existing) {
        return null;
      }

      const next = {
        ...existing,
        ...input,
      };
      tags.set(tagId, next);

      return next;
    },
  };
}

function createInput(store: AdminCatalogStore, user = adminUser) {
  return {
    adminAuth: createRouteAuth({
      user,
    }),
    authorizationHeader: "Bearer admin-token",
    createStore: vi.fn(() => store),
    trustedDeviceSecret: "trusted-device-secret",
  };
}

describe("admin catalog route handlers", () => {
  it("returns 401 before creating the service store for anonymous requests", async () => {
    const store = createFakeStore();
    const createStore = vi.fn(() => store);
    const response = await handleListSofasRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: undefined,
      createStore,
      trustedDeviceSecret: undefined,
    });

    expect(response.status).toBe(401);
    expect(createStore).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("returns 403 for authenticated non-admin users", async () => {
    const response = await handleListTagsRequest(
      createInput(createFakeStore(), nonAdminUser),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "ADMIN_REQUIRED",
      },
    });
  });

  it("runs the concrete draft sofa and tag flow", async () => {
    const store = createFakeStore();
    const input = createInput(store);

    const createTagResponse = await handleCreateTagRequest({
      ...input,
      request: jsonRequest({
        public_label: "Convertible",
      }),
    });
    expect(createTagResponse.status).toBe(201);
    const createTagBody = await createTagResponse.json();
    expect(createTagBody.data.tag).toMatchObject({
      public_label: "Convertible",
      slug: "convertible",
    });

    const tagId = createTagBody.data.tag.id as string;
    const createSofaResponse = await handleCreateSofaRequest({
      ...input,
      request: jsonRequest({
        internal_name: "Internal sofa",
        public_name: "Public sofa",
        tag_ids: [tagId],
      }),
    });
    expect(createSofaResponse.status).toBe(201);
    const createSofaBody = await createSofaResponse.json();
    expect(createSofaBody.data.sofa).toMatchObject({
      internal_name: "Internal sofa",
      lifecycle_state: "draft",
      tags: [
        {
          id: tagId,
          public_label: "Convertible",
          slug: "convertible",
        },
      ],
    });

    const sofaId = createSofaBody.data.sofa.id as string;
    const getSofaResponse = await handleGetSofaRequest({
      ...input,
      sofaId,
    });
    expect(getSofaResponse.status).toBe(200);
    await expect(getSofaResponse.json()).resolves.toMatchObject({
      data: {
        sofa: {
          id: sofaId,
          internal_name: "Internal sofa",
        },
      },
    });

    const updateSofaResponse = await handleUpdateSofaRequest({
      ...input,
      request: jsonRequest({
        public_description: "Updated public copy",
        tag_ids: [tagId],
      }),
      sofaId,
    });
    expect(updateSofaResponse.status).toBe(200);
    await expect(updateSofaResponse.json()).resolves.toMatchObject({
      data: {
        sofa: {
          id: sofaId,
          public_description: "Updated public copy",
        },
      },
    });

    const listSofasResponse = await handleListSofasRequest(input);
    expect(listSofasResponse.status).toBe(200);
    await expect(listSofasResponse.json()).resolves.toMatchObject({
      data: {
        sofas: [
          {
            id: sofaId,
          },
        ],
      },
    });

    const readinessResponse = await handleGetSofaPublicationReadinessRequest({
      ...input,
      sofaId,
    });
    expect(readinessResponse.status).toBe(200);
    await expect(readinessResponse.json()).resolves.toEqual({
      data: {
        readiness: {
          errors: [
            {
              code: "MISSING_PUBLIC_FABRIC",
              message: "At least one active public fabric is required.",
            },
            {
              code: "INCOMPLETE_PUBLIC_RENDER_COVERAGE",
              message: "Public render coverage is incomplete.",
            },
          ],
          ready: false,
        },
      },
      meta: {},
    });
  });

  it("rejects deleting tags that are assigned to sofas", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createTagBody = await (
      await handleCreateTagRequest({
        ...input,
        request: jsonRequest({
          public_label: "Design",
        }),
      })
    ).json();
    const tagId = createTagBody.data.tag.id as string;

    await handleCreateSofaRequest({
      ...input,
      request: jsonRequest({
        internal_name: "Internal sofa",
        tag_ids: [tagId],
      }),
    });

    const deleteResponse = await handleDeleteTagRequest({
      ...input,
      tagId,
    });

    expect(deleteResponse.status).toBe(409);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      error: {
        code: "TAG_IN_USE",
      },
    });
  });

  it("updates tags through a generated slug", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createTagBody = await (
      await handleCreateTagRequest({
        ...input,
        request: jsonRequest({
          public_label: "Canapé modulable",
        }),
      })
    ).json();
    const tagId = createTagBody.data.tag.id as string;

    const updateResponse = await handleUpdateTagRequest({
      ...input,
      request: jsonRequest({
        public_label: "Angle premium",
      }),
      tagId,
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      data: {
        tag: {
          id: tagId,
          public_label: "Angle premium",
          slug: "angle-premium",
        },
      },
    });
  });
});
