import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminSofaCreatePage,
  AdminSofaEditPage,
  AdminSofasPage,
  AdminTagsPage,
  createDefaultAdminCatalogDependencies,
  type AdminCatalogPageDependencies,
} from "./AdminCatalogPages";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function createDependencies(
  overrides: Partial<AdminCatalogPageDependencies> = {},
): AdminCatalogPageDependencies {
  return {
    clearTrustedDevice: vi.fn(async () => {}),
    createSofa: vi.fn(async () => ({
      created_at: "2026-04-28T10:00:00.000Z",
      depth_cm: 95,
      footprint_measurements: null,
      footprint_type: null,
      height_cm: 82,
      id: "00000000-0000-4000-8000-000000000701",
      internal_name: "Manual test sofa",
      lifecycle_state: "draft",
      manual_public_order: null,
      public_description: "Manual copy",
      public_name: "Canape test",
      public_slug: null,
      shopify_order_url: "https://example.com/products/manual-test",
      tags: [
        {
          id: "00000000-0000-4000-8000-000000000801",
          public_label: "Convertible",
          slug: "convertible",
        },
      ],
      updated_at: "2026-04-28T10:00:00.000Z",
      length_cm: 220,
    })),
    createTag: vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000801",
      public_label: "Convertible",
      slug: "convertible",
    })),
    deleteTag: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => "admin-token"),
    getSofa: vi.fn(async () => ({
      created_at: "2026-04-28T10:00:00.000Z",
      depth_cm: 95,
      footprint_measurements: null,
      footprint_type: null,
      height_cm: 82,
      id: "00000000-0000-4000-8000-000000000701",
      internal_name: "Manual test sofa",
      lifecycle_state: "draft",
      manual_public_order: null,
      public_description: "Manual copy",
      public_name: "Canape test",
      public_slug: null,
      shopify_order_url: "https://example.com/products/manual-test",
      tags: [
        {
          id: "00000000-0000-4000-8000-000000000801",
          public_label: "Convertible",
          slug: "convertible",
        },
      ],
      updated_at: "2026-04-28T10:00:00.000Z",
      length_cm: 220,
    })),
    getSofaReadiness: vi.fn(async () => ({
      errors: [
        {
          code: "MISSING_PUBLIC_FABRIC",
          message: "At least one active public fabric is required.",
        },
      ],
      ready: false,
    })),
    listSofas: vi.fn(async () => [
      {
        created_at: "2026-04-28T10:00:00.000Z",
        depth_cm: null,
        footprint_measurements: null,
        footprint_type: null,
        height_cm: null,
        id: "00000000-0000-4000-8000-000000000701",
        internal_name: "Manual test sofa",
        lifecycle_state: "draft",
        manual_public_order: null,
        public_description: null,
        public_name: "Canape test",
        public_slug: null,
        shopify_order_url: null,
        tags: [],
        updated_at: "2026-04-28T10:00:00.000Z",
        length_cm: null,
      },
    ]),
    listTags: vi.fn(async () => [
      {
        id: "00000000-0000-4000-8000-000000000801",
        public_label: "Convertible",
        slug: "convertible",
      },
    ]),
    navigate: vi.fn(),
    redirect: vi.fn(),
    refreshAccessToken: vi.fn(async () => null),
    signOut: vi.fn(async () => {}),
    updateSofa: vi.fn(async (_accessToken, _sofaId, input) => ({
      created_at: "2026-04-28T10:00:00.000Z",
      depth_cm: null,
      footprint_measurements: null,
      footprint_type: null,
      height_cm: null,
      id: "00000000-0000-4000-8000-000000000701",
      internal_name: input.internal_name ?? "Manual test sofa",
      lifecycle_state: "draft",
      manual_public_order: null,
      public_description: input.public_description ?? null,
      public_name: input.public_name ?? "Canape test",
      public_slug: null,
      shopify_order_url: null,
      tags: [],
      updated_at: "2026-04-28T10:05:00.000Z",
      length_cm: null,
    })),
    updateTag: vi.fn(async (_accessToken, tagId, input) => ({
      id: tagId,
      public_label: input.public_label,
      slug: "angle-premium",
    })),
    verifyAdminSession: vi.fn(async () => ({
      ok: true,
      status: 200,
    })),
    ...overrides,
  };
}

describe("Admin catalog pages", () => {
  it("redirects anonymous visitors away from catalog pages", async () => {
    const dependencies = createDependencies({
      getAccessToken: vi.fn(async () => null),
    });

    render(<AdminSofasPage dependencies={dependencies} />);

    await waitFor(() => {
      expect(dependencies.redirect).toHaveBeenCalledWith("/admin/login");
    });
    expect(
      screen.queryByRole("heading", { name: "Sofas" }),
    ).not.toBeInTheDocument();
  });

  it("loads sofas through the first-party admin facade abstraction", async () => {
    const dependencies = createDependencies();

    render(<AdminSofasPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Sofas" });
    expect(await screen.findByText("Manual test sofa")).toBeInTheDocument();
    expect(dependencies.listSofas).toHaveBeenCalledWith("admin-token");
  });

  it("creates, edits, and handles assigned-tag delete conflicts", async () => {
    const dependencies = createDependencies({
      deleteTag: vi.fn(async () => {
        throw new Error("TAG_IN_USE");
      }),
    });

    render(<AdminTagsPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Tags" });
    fireEvent.change(screen.getByLabelText("Public label"), {
      target: { value: "Angle premium" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() => {
      expect(dependencies.createTag).toHaveBeenCalledWith("admin-token", {
        public_label: "Angle premium",
      });
    });

    fireEvent.change(screen.getByLabelText("Edit Convertible"), {
      target: { value: "Angle premium" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Convertible" }));

    await waitFor(() => {
      expect(dependencies.updateTag).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Convertible" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm delete Convertible" }),
    );

    await screen.findByRole("alert");
    expect(screen.getByText("TAG_IN_USE")).toBeInTheDocument();
  });

  it("creates a draft sofa and navigates to edit", async () => {
    const dependencies = createDependencies();

    render(<AdminSofaCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create sofa" });
    fireEvent.change(screen.getByLabelText("Internal name"), {
      target: { value: "Manual test sofa" },
    });
    fireEvent.change(screen.getByLabelText("Public name"), {
      target: { value: "Canape test" },
    });
    fireEvent.change(screen.getByLabelText("Shopify order URL"), {
      target: { value: "https://example.com/products/manual-test" },
    });
    fireEvent.click(await screen.findByLabelText("Convertible"));
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => {
      expect(dependencies.createSofa).toHaveBeenCalledWith("admin-token", {
        internal_name: "Manual test sofa",
        public_name: "Canape test",
        shopify_order_url: "https://example.com/products/manual-test",
        tag_ids: ["00000000-0000-4000-8000-000000000801"],
      });
    });
    expect(dependencies.navigate).toHaveBeenCalledWith(
      "/admin/sofas/00000000-0000-4000-8000-000000000701",
    );
  });

  it("edits sofa metadata and shows readiness blockers", async () => {
    const dependencies = createDependencies();

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    expect(screen.getByText("MISSING_PUBLIC_FABRIC")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Public description"), {
      target: { value: "Updated manually" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save sofa" }));

    await waitFor(() => {
      expect(dependencies.updateSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
        expect.objectContaining({
          public_description: "Updated manually",
          tag_ids: ["00000000-0000-4000-8000-000000000801"],
        }),
      );
    });
  });

  it("default API dependencies call only first-party admin facade routes", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/publication-readiness")) {
        return jsonResponse({
          data: {
            readiness: {
              errors: [],
              ready: true,
            },
          },
          meta: {},
        });
      }

      if (requestUrl.endsWith("/api/admin/sofas")) {
        return jsonResponse({
          data: {
            sofa: {
              id: "00000000-0000-4000-8000-000000000701",
            },
            sofas: [],
          },
          meta: {},
        });
      }

      if (requestUrl.includes("/api/admin/sofas/")) {
        return jsonResponse({
          data: {
            sofa: {
              id: "00000000-0000-4000-8000-000000000701",
            },
          },
          meta: {},
        });
      }

      if (requestUrl.endsWith("/api/admin/tags")) {
        return jsonResponse({
          data: {
            tag: {
              id: "00000000-0000-4000-8000-000000000801",
              public_label: "Convertible",
              slug: "convertible",
            },
            tags: [],
          },
          meta: {},
        });
      }

      if (requestUrl.includes("/api/admin/tags/")) {
        return jsonResponse({
          data: {
            tag: {
              id: "00000000-0000-4000-8000-000000000801",
              public_label: "Convertible",
              slug: "convertible",
            },
          },
          meta: {},
        });
      }

      return jsonResponse({
        data: {},
        meta: {},
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const dependencies = createDefaultAdminCatalogDependencies(
      vi.fn(),
      vi.fn(),
    );

    await dependencies.listSofas("admin-token");
    await dependencies.createSofa("admin-token", {
      internal_name: "Manual test sofa",
      tag_ids: [],
    });
    await dependencies.getSofa(
      "admin-token",
      "00000000-0000-4000-8000-000000000701",
    );
    await dependencies.updateSofa(
      "admin-token",
      "00000000-0000-4000-8000-000000000701",
      {
        public_name: "Canape test",
        tag_ids: [],
      },
    );
    await dependencies.getSofaReadiness(
      "admin-token",
      "00000000-0000-4000-8000-000000000701",
    );
    await dependencies.listTags("admin-token");
    await dependencies.createTag("admin-token", {
      public_label: "Convertible",
    });
    await dependencies.updateTag(
      "admin-token",
      "00000000-0000-4000-8000-000000000801",
      {
        public_label: "Convertible",
      },
    );
    await dependencies.deleteTag(
      "admin-token",
      "00000000-0000-4000-8000-000000000801",
    );

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));

    expect(calledUrls).toEqual([
      "/api/admin/sofas",
      "/api/admin/sofas",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/publication-readiness",
      "/api/admin/tags",
      "/api/admin/tags",
      "/api/admin/tags/00000000-0000-4000-8000-000000000801",
      "/api/admin/tags/00000000-0000-4000-8000-000000000801",
    ]);
    expect(calledUrls.join("\n")).not.toContain("supabase");
    expect(calledUrls.join("\n")).not.toContain("functions");
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
