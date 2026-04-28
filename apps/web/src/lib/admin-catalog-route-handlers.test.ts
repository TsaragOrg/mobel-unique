import { describe, expect, it, vi } from "vitest";
import { createAdminAuth, type AdminAuthUser } from "./admin-auth";
import {
  handleArchiveFabricRequest,
  handleAssignSofaFabricRequest,
  handleCompleteUploadRequest,
  handleCreateFabricRequest,
  handleCreateSofaRequest,
  handleCreateTagRequest,
  handleCreateUploadRequest,
  handleDeleteTagRequest,
  handleGetFabricRequest,
  handleGetSofaPublicationReadinessRequest,
  handleGetSofaRequest,
  handleListFabricsRequest,
  handleListSofaFabricsRequest,
  handleListSofasRequest,
  handleListTagsRequest,
  handleRemoveSofaFabricRequest,
  handleUpdateFabricRequest,
  handleUpdateSofaRequest,
  handleUpdateSofaFabricRequest,
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
  const assets = new Map<string, Record<string, unknown>>();
  const fabrics = new Map<string, Record<string, unknown>>();
  const sofaFabrics = new Map<string, Record<string, unknown>>();
  let tagCounter = 0;
  let sofaCounter = 0;
  let fabricCounter = 0;
  const swatchAsset = {
    asset_kind: "fabric_swatch_public",
    byte_size: 1200,
    content_type: "image/png",
    height_px: 256,
    id: "00000000-0000-4000-8000-000000000901",
    lifecycle_state: "active",
    visibility: "public",
    width_px: 256,
  };
  const aiReferenceAsset = {
    asset_kind: "fabric_ai_reference",
    byte_size: 2200,
    content_type: "image/jpeg",
    height_px: 1200,
    id: "00000000-0000-4000-8000-000000000902",
    lifecycle_state: "active",
    visibility: "private",
    width_px: 1600,
  };

  assets.set(swatchAsset.id, swatchAsset);
  assets.set(aiReferenceAsset.id, aiReferenceAsset);

  return {
    async archiveFabric(fabricId) {
      const existing = fabrics.get(fabricId);

      if (!existing) {
        return null;
      }

      const next = {
        ...existing,
        archived_at: "2026-04-28T10:10:00.000Z",
        lifecycle_state: "archived",
        updated_at: "2026-04-28T10:10:00.000Z",
      };
      fabrics.set(fabricId, next);

      return next;
    },
    async assignSofaFabric(sofaId, fabricId, input) {
      const sofa = sofas.get(sofaId);
      const fabric = fabrics.get(fabricId);

      if (!sofa) {
        return {
          code: "SOFA_NOT_FOUND",
          message: "Sofa was not found.",
          status: 404,
        };
      }

      if (!fabric) {
        return {
          code: "FABRIC_NOT_FOUND",
          message: "Fabric was not found.",
          status: 404,
        };
      }

      if (fabric.lifecycle_state === "archived") {
        return {
          code: "FABRIC_ARCHIVED",
          message: "Archived fabrics cannot be assigned to sofas.",
          status: 409,
        };
      }

      const publicOrderConflict = [...sofaFabrics.values()].some(
        (assignment) =>
          assignment.sofa_id === sofaId &&
          assignment.fabric_id !== fabricId &&
          assignment.public_order === input.public_order &&
          input.public_order !== null,
      );

      if (publicOrderConflict) {
        return {
          code: "SOFA_FABRIC_ORDER_CONFLICT",
          message: "Another fabric already uses this public order.",
          status: 409,
        };
      }

      const assignment = {
        assigned_at: "2026-04-28T10:15:00.000Z",
        fabric,
        fabric_id: fabricId,
        public_order: input.public_order,
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:15:00.000Z",
      };
      sofaFabrics.set(`${sofaId}:${fabricId}`, assignment);

      return assignment;
    },
    async completeUpload(uploadId) {
      if (uploadId === "fabric-swatch-upload") {
        return swatchAsset;
      }

      if (uploadId === "fabric-ai-reference-upload") {
        return aiReferenceAsset;
      }

      return {
        code: "UPLOAD_NOT_FOUND",
        message: "Upload was not found.",
        status: 404,
      };
    },
    async createFabric(input) {
      fabricCounter += 1;
      const fabric = {
        ai_reference_asset: assets.get(input.ai_reference_asset_id),
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: `00000000-0000-4000-8000-${String(900 + fabricCounter).padStart(
          12,
          "0",
        )}`,
        lifecycle_state: "active",
        swatch_asset: assets.get(input.swatch_asset_id),
        updated_at: "2026-04-28T10:00:00.000Z",
        ...input,
      };
      fabrics.set(fabric.id, fabric);

      return fabric;
    },
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
    async createUpload(input) {
      return {
        expires_at: "2026-04-28T12:00:00.000Z",
        method: "signed_upload",
        signed_upload_url: `https://storage.example/${input.purpose}`,
        upload_id:
          input.purpose === "fabric_swatch"
            ? "fabric-swatch-upload"
            : "fabric-ai-reference-upload",
      };
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
    async getFabric(fabricId) {
      return fabrics.get(fabricId) ?? null;
    },
    async getSofa(sofaId) {
      return sofas.get(sofaId) ?? null;
    },
    async getSofaPublicationReadiness(sofaId) {
      if (!sofas.has(sofaId)) {
        return null;
      }

      return {
        errors: sofaFabrics.size
          ? [
              {
                code: "INCOMPLETE_PUBLIC_RENDER_COVERAGE",
                message: "Public render coverage is incomplete.",
              },
            ]
          : [
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
    async listFabrics() {
      return [...fabrics.values()];
    },
    async listSofas() {
      return [...sofas.values()];
    },
    async listSofaFabrics(sofaId) {
      if (!sofas.has(sofaId)) {
        return null;
      }

      return [...sofaFabrics.values()].filter(
        (assignment) => assignment.sofa_id === sofaId,
      );
    },
    async listTags() {
      return [...tags.values()];
    },
    async removeSofaFabric(sofaId, fabricId) {
      const key = `${sofaId}:${fabricId}`;

      if (!sofaFabrics.has(key)) {
        return {
          code: "SOFA_FABRIC_NOT_FOUND",
          message: "Sofa fabric assignment was not found.",
          status: 404,
        };
      }

      sofaFabrics.delete(key);

      return null;
    },
    async updateFabric(fabricId, input) {
      const existing = fabrics.get(fabricId);

      if (!existing) {
        return null;
      }

      const next = {
        ...existing,
        ...input,
        ai_reference_asset: input.ai_reference_asset_id
          ? assets.get(input.ai_reference_asset_id)
          : existing.ai_reference_asset,
        swatch_asset: input.swatch_asset_id
          ? assets.get(input.swatch_asset_id)
          : existing.swatch_asset,
        updated_at: "2026-04-28T10:05:00.000Z",
      };
      fabrics.set(fabricId, next);

      return next;
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
    async updateSofaFabric(sofaId, fabricId, input) {
      const existing = sofaFabrics.get(`${sofaId}:${fabricId}`);

      if (!existing) {
        return {
          code: "SOFA_FABRIC_NOT_FOUND",
          message: "Sofa fabric assignment was not found.",
          status: 404,
        };
      }

      const publicOrderConflict = [...sofaFabrics.values()].some(
        (assignment) =>
          assignment.sofa_id === sofaId &&
          assignment.fabric_id !== fabricId &&
          assignment.public_order === input.public_order &&
          input.public_order !== null,
      );

      if (publicOrderConflict) {
        return {
          code: "SOFA_FABRIC_ORDER_CONFLICT",
          message: "Another fabric already uses this public order.",
          status: 409,
        };
      }

      const next = {
        ...existing,
        public_order: input.public_order,
        updated_at: "2026-04-28T10:20:00.000Z",
      };
      sofaFabrics.set(`${sofaId}:${fabricId}`, next);

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

  it("runs the concrete fabric upload, CRUD, assignment, and readiness flow", async () => {
    const store = createFakeStore();
    const input = createInput(store);

    const swatchUploadResponse = await handleCreateUploadRequest({
      ...input,
      request: jsonRequest({
        byte_size: 1200,
        content_type: "image/png",
        purpose: "fabric_swatch",
      }),
    });
    expect(swatchUploadResponse.status).toBe(201);
    const swatchUploadBody = await swatchUploadResponse.json();
    expect(swatchUploadBody.data.upload).toMatchObject({
      method: "signed_upload",
      upload_id: "fabric-swatch-upload",
    });

    const swatchCompleteResponse = await handleCompleteUploadRequest({
      ...input,
      uploadId: "fabric-swatch-upload",
    });
    expect(swatchCompleteResponse.status).toBe(200);
    const swatchCompleteBody = await swatchCompleteResponse.json();
    expect(swatchCompleteBody.data.asset).toMatchObject({
      asset_kind: "fabric_swatch_public",
      id: "00000000-0000-4000-8000-000000000901",
      visibility: "public",
    });

    const aiReferenceCompleteBody = await (
      await handleCompleteUploadRequest({
        ...input,
        uploadId: "fabric-ai-reference-upload",
      })
    ).json();
    const createFabricResponse = await handleCreateFabricRequest({
      ...input,
      request: jsonRequest({
        ai_reference_asset_id: aiReferenceCompleteBody.data.asset.id,
        internal_name: "Internal fabric",
        is_premium: true,
        public_name: "Boucle ivoire",
        swatch_asset_id: swatchCompleteBody.data.asset.id,
      }),
    });
    expect(createFabricResponse.status).toBe(201);
    const createFabricBody = await createFabricResponse.json();
    expect(createFabricBody.data.fabric).toMatchObject({
      internal_name: "Internal fabric",
      is_premium: true,
      lifecycle_state: "active",
      public_name: "Boucle ivoire",
    });
    const fabricId = createFabricBody.data.fabric.id as string;

    const listFabricsResponse = await handleListFabricsRequest(input);
    expect(listFabricsResponse.status).toBe(200);
    await expect(listFabricsResponse.json()).resolves.toMatchObject({
      data: {
        fabrics: [
          {
            id: fabricId,
            swatch_asset: {
              visibility: "public",
            },
          },
        ],
      },
    });

    const getFabricResponse = await handleGetFabricRequest({
      ...input,
      fabricId,
    });
    expect(getFabricResponse.status).toBe(200);

    const updateFabricResponse = await handleUpdateFabricRequest({
      ...input,
      fabricId,
      request: jsonRequest({
        is_premium: false,
        public_name: "Boucle naturel",
      }),
    });
    expect(updateFabricResponse.status).toBe(200);
    await expect(updateFabricResponse.json()).resolves.toMatchObject({
      data: {
        fabric: {
          id: fabricId,
          is_premium: false,
          public_name: "Boucle naturel",
        },
      },
    });

    const createSofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Internal sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const sofaId = createSofaBody.data.sofa.id as string;

    const assignResponse = await handleAssignSofaFabricRequest({
      ...input,
      fabricId,
      request: jsonRequest({
        public_order: 1,
      }),
      sofaId,
    });
    expect(assignResponse.status).toBe(200);
    await expect(assignResponse.json()).resolves.toMatchObject({
      data: {
        sofa_fabric: {
          fabric: {
            id: fabricId,
          },
          fabric_id: fabricId,
          public_order: 1,
          sofa_id: sofaId,
        },
      },
    });

    const listSofaFabricsResponse = await handleListSofaFabricsRequest({
      ...input,
      sofaId,
    });
    expect(listSofaFabricsResponse.status).toBe(200);

    const readinessResponse = await handleGetSofaPublicationReadinessRequest({
      ...input,
      sofaId,
    });
    const readinessBody = await readinessResponse.json();
    expect(readinessBody.data.readiness.errors).not.toContainEqual(
      expect.objectContaining({
        code: "MISSING_PUBLIC_FABRIC",
      }),
    );
    expect(readinessBody.data.readiness.errors).toContainEqual({
      code: "INCOMPLETE_PUBLIC_RENDER_COVERAGE",
      message: "Public render coverage is incomplete.",
    });

    const updateAssignmentResponse = await handleUpdateSofaFabricRequest({
      ...input,
      fabricId,
      request: jsonRequest({
        public_order: null,
      }),
      sofaId,
    });
    expect(updateAssignmentResponse.status).toBe(200);

    const removeAssignmentResponse = await handleRemoveSofaFabricRequest({
      ...input,
      fabricId,
      sofaId,
    });
    expect(removeAssignmentResponse.status).toBe(204);
  });

  it("keeps archived fabrics visible but blocks new sofa assignments", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const fabricBody = await (
      await handleCreateFabricRequest({
        ...input,
        request: jsonRequest({
          ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
          internal_name: "Internal fabric",
          is_premium: false,
          public_name: "Archive me",
          swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        }),
      })
    ).json();
    const fabricId = fabricBody.data.fabric.id as string;

    const archiveResponse = await handleArchiveFabricRequest({
      ...input,
      fabricId,
    });
    expect(archiveResponse.status).toBe(200);
    await expect(archiveResponse.json()).resolves.toMatchObject({
      data: {
        fabric: {
          id: fabricId,
          lifecycle_state: "archived",
        },
      },
    });

    const listResponse = await handleListFabricsRequest(input);
    await expect(listResponse.json()).resolves.toMatchObject({
      data: {
        fabrics: [
          {
            id: fabricId,
            lifecycle_state: "archived",
          },
        ],
      },
    });

    const sofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Internal sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const assignResponse = await handleAssignSofaFabricRequest({
      ...input,
      fabricId,
      request: jsonRequest({
        public_order: 1,
      }),
      sofaId: sofaBody.data.sofa.id,
    });

    expect(assignResponse.status).toBe(409);
    await expect(assignResponse.json()).resolves.toMatchObject({
      error: {
        code: "FABRIC_ARCHIVED",
      },
    });
  });
});
