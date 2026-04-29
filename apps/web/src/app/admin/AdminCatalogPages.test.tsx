import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminFabricCreatePage,
  AdminFabricEditPage,
  AdminFabricsPage,
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
  const fabric = {
    ai_reference_asset: {
      asset_kind: "fabric_ai_reference",
      byte_size: 2200,
      content_type: "image/jpeg",
      height_px: 1200,
      id: "00000000-0000-4000-8000-000000000902",
      lifecycle_state: "active",
      visibility: "private",
      width_px: 1600,
    },
    ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
    archived_at: null,
    created_at: "2026-04-28T10:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000903",
    internal_name: "Internal fabric",
    is_premium: true,
    lifecycle_state: "active",
    public_name: "Boucle ivoire",
    swatch_asset: {
      asset_kind: "fabric_swatch_public",
      byte_size: 1200,
      content_type: "image/png",
      height_px: 256,
      id: "00000000-0000-4000-8000-000000000901",
      lifecycle_state: "active",
      visibility: "public",
      width_px: 256,
    },
    swatch_asset_id: "00000000-0000-4000-8000-000000000901",
    updated_at: "2026-04-28T10:00:00.000Z",
  };
  const visualMatrixColumn = {
    admin_label: "Front",
    created_at: "2026-04-28T10:00:00.000Z",
    current_source_photo: null,
    current_source_photo_id: null,
    deleted_at: null,
    id: "00000000-0000-4000-8000-000000000904",
    public_label: "Front",
    sequence: 1,
    sofa_id: "00000000-0000-4000-8000-000000000701",
    updated_at: "2026-04-28T10:00:00.000Z",
  };
  const renderCoverage = {
    render_cells: [
      {
        blockers: ["MISSING_SOURCE_PHOTO"],
        can_generate_initial: false,
        candidate_count: 0,
        current_private_asset_id: null,
        current_public_asset_id: null,
        fabric_id: fabric.id,
        has_private_render: false,
        has_public_render: false,
        id: "00000000-0000-4000-8000-000000000905",
        latest_job: null,
        sofa_id: "00000000-0000-4000-8000-000000000701",
        source_photo_id: null,
        source_type: "ai_generated",
        updated_at: "2026-04-28T10:00:00.000Z",
        visual_matrix_column_id: visualMatrixColumn.id,
      },
    ],
    sofa_fabrics: [],
    sofa_id: "00000000-0000-4000-8000-000000000701",
    visual_matrix_columns: [visualMatrixColumn],
  };

  return {
    archiveFabric: vi.fn(async (_accessToken, fabricId) => ({
      ...fabric,
      archived_at: "2026-04-28T10:15:00.000Z",
      id: fabricId,
      lifecycle_state: "archived",
    })),
    assignSofaFabric: vi.fn(async (_accessToken, sofaId, fabricId, input) => ({
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric,
      fabric_id: fabricId,
      public_order: input.public_order,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    })),
    clearTrustedDevice: vi.fn(async () => {}),
    completeUpload: vi.fn(async (_accessToken, uploadId) =>
      uploadId === "swatch-upload"
        ? fabric.swatch_asset
        : fabric.ai_reference_asset,
    ),
    createFabric: vi.fn(async (_accessToken, input) => ({
      ...fabric,
      ...input,
    })),
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
    createUpload: vi.fn(async (_accessToken, input) => ({
      expires_at: "2026-04-28T12:00:00.000Z",
      method: "signed_upload" as const,
      signed_upload_url: `https://storage.example/${input.purpose}`,
      upload_id:
        input.purpose === "fabric_swatch"
          ? "swatch-upload"
          : input.purpose === "sofa_source_photo"
            ? "source-photo-upload"
            : input.purpose === "manual_render"
              ? "manual-render-upload"
              : "ai-reference-upload",
    })),
    createFabricRenderJob: vi.fn(async (_accessToken, input) => ({
      attempt_count: 0,
      completed_at: null,
      created_at: "2026-04-28T10:30:00.000Z",
      fabric_id: input.fabric_id,
      generation_mode: input.generation_mode,
      id: "00000000-0000-4000-8000-000000000906",
      last_error_message: null,
      max_attempts: 3,
      prompt_note: input.prompt_note,
      queued_at: "2026-04-28T10:30:00.000Z",
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: input.sofa_id,
      status: "queued",
      updated_at: "2026-04-28T10:30:00.000Z",
      visual_matrix_column_id: input.visual_matrix_column_id,
    })),
    createVisualMatrixColumn: vi.fn(async (_accessToken, sofaId, input) => ({
      ...visualMatrixColumn,
      ...input,
      id: visualMatrixColumn.id,
      sofa_id: sofaId,
    })),
    deleteTag: vi.fn(async () => {}),
    deleteVisualMatrixColumn: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => "admin-token"),
    getFabric: vi.fn(async () => fabric),
    getFabricRenderJob: vi.fn(async () => ({
      attempt_count: 0,
      completed_at: null,
      created_at: "2026-04-28T10:30:00.000Z",
      fabric_id: fabric.id,
      generation_mode: "initial",
      id: "00000000-0000-4000-8000-000000000906",
      last_error_message: null,
      max_attempts: 3,
      prompt_note: null,
      queued_at: "2026-04-28T10:30:00.000Z",
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: "00000000-0000-4000-8000-000000000701",
      status: "queued",
      updated_at: "2026-04-28T10:30:00.000Z",
      visual_matrix_column_id: visualMatrixColumn.id,
    })),
    getRenderCoverage: vi.fn(async () => renderCoverage),
    listRenderCellCandidates: vi.fn(async () => [
      {
        accepted_at: null,
        asset: {
          asset_kind: "fabric_render_candidate",
          byte_size: 2400,
          content_type: "image/png",
          height_px: 1200,
          id: "00000000-0000-4000-8000-000000000907",
          lifecycle_state: "active",
          visibility: "private",
          width_px: 1600,
        },
        asset_id: "00000000-0000-4000-8000-000000000907",
        created_at: "2026-04-28T10:35:00.000Z",
        fabric_id: fabric.id,
        generation_mode: "initial",
        id: "00000000-0000-4000-8000-000000000908",
        is_current: false,
        job_id: "00000000-0000-4000-8000-000000000906",
        preview_url: "https://storage.example/candidate-preview",
        prompt_version: "v007",
        provider_model: "mock-fabric-render-v1",
        provider_name: "mock",
        render_cell_id: "00000000-0000-4000-8000-000000000905",
        sofa_id: "00000000-0000-4000-8000-000000000701",
        visual_matrix_column_id: visualMatrixColumn.id,
      },
    ]),
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
    listFabrics: vi.fn(async () => [fabric]),
    listSofaFabrics: vi.fn(async () => []),
    listTags: vi.fn(async () => [
      {
        id: "00000000-0000-4000-8000-000000000801",
        public_label: "Convertible",
        slug: "convertible",
      },
    ]),
    listVisualMatrixColumns: vi.fn(async () => [visualMatrixColumn]),
    navigate: vi.fn(),
    redirect: vi.fn(),
    refreshAccessToken: vi.fn(async () => null),
    removeSofaFabric: vi.fn(async () => {}),
    setManualRender: vi.fn(async (_accessToken, renderCellId, input) => ({
      blockers: [],
      can_generate_initial: true,
      candidate_count: 0,
      current_private_asset_id: input.asset_id,
      current_public_asset_id: null,
      fabric_id: fabric.id,
      has_private_render: true,
      has_public_render: false,
      id: renderCellId,
      latest_job: null,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      source_photo_id: null,
      source_type: "manual_upload",
      updated_at: "2026-04-28T10:40:00.000Z",
      visual_matrix_column_id: visualMatrixColumn.id,
    })),
    signOut: vi.fn(async () => {}),
    updateFabric: vi.fn(async (_accessToken, fabricId, input) => ({
      ...fabric,
      ...input,
      id: fabricId,
    })),
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
    updateSofaFabric: vi.fn(async (_accessToken, sofaId, fabricId, input) => ({
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric,
      fabric_id: fabricId,
      public_order: input.public_order,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:20:00.000Z",
    })),
    updateVisualMatrixColumn: vi.fn(async (_accessToken, columnId, input) => ({
      ...visualMatrixColumn,
      ...input,
      id: columnId,
    })),
    useRenderCandidate: vi.fn(async (_accessToken, candidateId) => ({
      accepted_at: "2026-04-28T10:40:00.000Z",
      asset: {
        asset_kind: "fabric_render_candidate",
        byte_size: 2400,
        content_type: "image/png",
        height_px: 1200,
        id: "00000000-0000-4000-8000-000000000907",
        lifecycle_state: "active",
        visibility: "private",
        width_px: 1600,
      },
      asset_id: "00000000-0000-4000-8000-000000000907",
      created_at: "2026-04-28T10:35:00.000Z",
      fabric_id: fabric.id,
      generation_mode: "initial",
      id: candidateId,
      is_current: true,
      job_id: "00000000-0000-4000-8000-000000000906",
      preview_url: "https://storage.example/candidate-preview",
      prompt_version: "v007",
      provider_model: "mock-fabric-render-v1",
      provider_name: "mock",
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: "00000000-0000-4000-8000-000000000701",
      visual_matrix_column_id: visualMatrixColumn.id,
    })),
    uploadToSignedUrl: vi.fn(async () => {}),
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

  it("loads fabrics through the first-party admin facade abstraction", async () => {
    const dependencies = createDependencies();

    render(<AdminFabricsPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Fabrics" });
    expect(await screen.findByText("Internal fabric")).toBeInTheDocument();
    expect(screen.getByText("Boucle ivoire")).toBeInTheDocument();
    expect(screen.getAllByText("Premium").length).toBeGreaterThan(0);
    expect(dependencies.listFabrics).toHaveBeenCalledWith("admin-token");
  });

  it("creates a fabric through the signed upload facade flow", async () => {
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    fireEvent.change(screen.getByLabelText("Internal fabric name"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Public fabric name"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.click(screen.getByLabelText("Premium fabric"));
    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [new File(["swatch"], "swatch.png", { type: "image/png" })],
      },
    });
    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create fabric" }));

    await waitFor(() => {
      expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
        byte_size: 6,
        content_type: "image/png",
        purpose: "fabric_swatch",
      });
    });
    expect(dependencies.uploadToSignedUrl).toHaveBeenCalledTimes(2);
    expect(dependencies.completeUpload).toHaveBeenCalledWith(
      "admin-token",
      "swatch-upload",
    );
    expect(dependencies.createFabric).toHaveBeenCalledWith("admin-token", {
      ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
      internal_name: "Internal fabric",
      is_premium: true,
      public_name: "Boucle ivoire",
      swatch_asset_id: "00000000-0000-4000-8000-000000000901",
    });
    expect(dependencies.navigate).toHaveBeenCalledWith(
      "/admin/fabrics/00000000-0000-4000-8000-000000000903",
    );
  });

  it("edits and archives a fabric", async () => {
    const dependencies = createDependencies();

    render(
      <AdminFabricEditPage
        dependencies={dependencies}
        fabricId="00000000-0000-4000-8000-000000000903"
      />,
    );

    await screen.findByRole("heading", { name: "Internal fabric" });
    fireEvent.change(screen.getByLabelText("Public fabric name"), {
      target: { value: "Boucle naturel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save fabric" }));

    await waitFor(() => {
      expect(dependencies.updateFabric).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000903",
        expect.objectContaining({
          public_name: "Boucle naturel",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Archive fabric" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() => {
      expect(dependencies.archiveFabric).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000903",
      );
    });
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

  it("shows sofa edit test navigation, checklist state, and grouped render coverage", async () => {
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: null,
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000903",
        internal_name: "Internal fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          {
            blockers: [],
            can_generate_initial: true,
            candidate_count: 2,
            current_private_asset_id: "00000000-0000-4000-8000-000000000907",
            current_public_asset_id: null,
            fabric_id: assignedFabric.fabric_id,
            has_private_render: true,
            has_public_render: false,
            id: "00000000-0000-4000-8000-000000000906",
            latest_job: null,
            sofa_id: assignedFabric.sofa_id,
            source_photo_id: visualColumn.current_source_photo_id,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_columns: [visualColumn],
      })),
      getSofaReadiness: vi.fn(async () => ({
        errors: [],
        ready: true,
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });

    const navigation = screen.getByRole("navigation", {
      name: "Sofa test sections",
    });
    expect(
      within(navigation).getByRole("link", { name: "Fabric assignments" }),
    ).toHaveAttribute("href", "#fabric-assignments");
    expect(
      within(navigation).getByRole("link", { name: "Render coverage" }),
    ).toHaveAttribute("href", "#render-coverage");

    const checklist = screen.getByRole("list", {
      name: "Manual sofa test checklist",
    });
    expect(
      within(checklist).getByRole("listitem", {
        name: "Fabric assigned: Done",
      }),
    ).toHaveTextContent("1 assigned");
    expect(
      within(checklist).getByRole("listitem", {
        name: "Generated candidate: Done",
      }),
    ).toHaveTextContent("2 candidates");
    expect(
      within(checklist).getByRole("listitem", {
        name: "Publication readiness: Done",
      }),
    ).toHaveTextContent("Ready");

    expect(
      screen.getByRole("heading", {
        name: "Render coverage",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Render status")).toBeInTheDocument();
    expect(screen.getByText("Private ready")).toBeInTheDocument();
    expect(screen.getByText("AI generated")).toBeInTheDocument();
  });

  it("shows source-photo-complete render cells without the normal generate action", async () => {
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: null,
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000903",
        internal_name: "Grey fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Grey fabric",
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: {
        asset: null,
        asset_id: "00000000-0000-4000-8000-000000000907",
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000905",
        original_fabric_id: assignedFabric.fabric_id,
        sofa_id: assignedFabric.sofa_id,
        updated_at: "2026-04-28T10:00:00.000Z",
        visual_matrix_column_id: "00000000-0000-4000-8000-000000000904",
      },
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: assignedFabric.sofa_id,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          {
            blockers: ["SOURCE_PHOTO_RENDER_COMPLETE"],
            can_generate_initial: false,
            candidate_count: 0,
            current_private_asset_id:
              visualColumn.current_source_photo.asset_id,
            current_public_asset_id: null,
            fabric_id: assignedFabric.fabric_id,
            has_private_render: true,
            has_public_render: false,
            id: "00000000-0000-4000-8000-000000000906",
            latest_job: null,
            sofa_id: assignedFabric.sofa_id,
            source_photo_id: visualColumn.current_source_photo.id,
            source_type: "source_photo",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });

    expect(screen.getByText("Private ready")).toBeInTheDocument();
    expect(screen.getAllByText("Source photo").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.queryByRole("button", { name: "Generate" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Upload manual render" }),
    ).toBeInTheDocument();
  });

  it("assigns a fabric to a sofa and refreshes readiness", async () => {
    const dependencies = createDependencies({
      getSofaReadiness: vi
        .fn()
        .mockResolvedValueOnce({
          errors: [
            {
              code: "MISSING_PUBLIC_FABRIC",
              message: "At least one active public fabric is required.",
            },
          ],
          ready: false,
        })
        .mockResolvedValueOnce({
          errors: [
            {
              code: "INCOMPLETE_PUBLIC_RENDER_COVERAGE",
              message: "Public render coverage is incomplete.",
            },
          ],
          ready: false,
        }),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.change(screen.getByLabelText("Assign fabric"), {
      target: { value: "00000000-0000-4000-8000-000000000903" },
    });
    fireEvent.change(screen.getByLabelText("Public order"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign fabric" }));

    await waitFor(() => {
      expect(dependencies.assignSofaFabric).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
        "00000000-0000-4000-8000-000000000903",
        {
          public_order: 1,
        },
      );
    });
    expect(
      await screen.findByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).toBeInTheDocument();
    expect(screen.queryByText("MISSING_PUBLIC_FABRIC")).not.toBeInTheDocument();
  });

  it("queues render preparation work from the sofa edit page", async () => {
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: {
          asset_kind: "fabric_ai_reference",
          byte_size: 2200,
          content_type: "image/jpeg",
          height_px: 1200,
          id: "00000000-0000-4000-8000-000000000902",
          lifecycle_state: "active",
          visibility: "private",
          width_px: 1600,
        },
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000903",
        internal_name: "Internal fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          {
            blockers: [],
            can_generate_initial: true,
            candidate_count: 0,
            current_private_asset_id: null,
            current_public_asset_id: null,
            fabric_id: assignedFabric.fabric_id,
            has_private_render: false,
            has_public_render: false,
            id: "00000000-0000-4000-8000-000000000906",
            latest_job: null,
            sofa_id: assignedFabric.sofa_id,
            source_photo_id: visualColumn.current_source_photo_id,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.change(screen.getByLabelText("Original fabric 1"), {
      target: { value: assignedFabric.fabric_id },
    });
    fireEvent.change(screen.getByLabelText("Source photo 1"), {
      target: {
        files: [new File(["source"], "source.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload source 1" }));

    await waitFor(() => {
      expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
        byte_size: 6,
        content_type: "image/png",
        original_fabric_id: assignedFabric.fabric_id,
        purpose: "sofa_source_photo",
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_column_id: visualColumn.id,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(dependencies.createFabricRenderJob).toHaveBeenCalledWith(
        "admin-token",
        {
          fabric_id: assignedFabric.fabric_id,
          generation_mode: "initial",
          prompt_note: null,
          sofa_id: assignedFabric.sofa_id,
          visual_matrix_column_id: visualColumn.id,
        },
      );
    });
  });

  it("reviews generated candidates and attaches a manual render from coverage", async () => {
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: null,
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000903",
        internal_name: "Internal fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const renderCell = {
      blockers: [],
      can_generate_initial: true,
      candidate_count: 1,
      current_private_asset_id: null,
      current_public_asset_id: null,
      fabric_id: assignedFabric.fabric_id,
      has_private_render: false,
      has_public_render: false,
      id: "00000000-0000-4000-8000-000000000906",
      latest_job: null,
      sofa_id: assignedFabric.sofa_id,
      source_photo_id: visualColumn.current_source_photo_id,
      source_type: "ai_generated",
      updated_at: "2026-04-28T10:00:00.000Z",
      visual_matrix_column_id: visualColumn.id,
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [renderCell],
        sofa_fabrics: [assignedFabric],
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("button", { name: "Review candidates" }));

    await screen.findByAltText(
      "Candidate preview 00000000-0000-4000-8000-000000000908",
    );
    fireEvent.click(screen.getByRole("button", { name: "Use candidate" }));

    await waitFor(() => {
      expect(dependencies.useRenderCandidate).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000908",
      );
    });

    fireEvent.change(screen.getByLabelText("Manual render"), {
      target: {
        files: [new File(["manual"], "manual.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Upload manual render" }),
    );

    await waitFor(() => {
      expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
        byte_size: 6,
        content_type: "image/png",
        purpose: "manual_render",
        render_cell_id: renderCell.id,
      });
    });
    expect(dependencies.setManualRender).toHaveBeenCalledWith(
      "admin-token",
      renderCell.id,
      {
        asset_id: "00000000-0000-4000-8000-000000000902",
      },
    );
  });

  it("default API dependencies call only first-party admin facade routes", async () => {
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricId = "00000000-0000-4000-8000-000000000903";
    const tagId = "00000000-0000-4000-8000-000000000801";
    const renderCellId = "00000000-0000-4000-8000-000000000905";
    const candidateId = "00000000-0000-4000-8000-000000000908";
    const fetchMock = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const requestUrl = String(url);
        const method = init?.method ?? "GET";

        if (requestUrl.endsWith("/api/admin/uploads")) {
          return jsonResponse({
            data: {
              upload: {
                expires_at: "2026-04-28T12:00:00.000Z",
                method: "signed_upload",
                signed_upload_url: "https://storage.example/upload",
                upload_id: "fabric-upload",
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith("/api/admin/uploads/fabric-upload/complete")) {
          return jsonResponse({
            data: {
              asset: {
                asset_kind: "fabric_swatch_public",
                byte_size: 1200,
                content_type: "image/png",
                height_px: 256,
                id: "00000000-0000-4000-8000-000000000901",
                lifecycle_state: "active",
                visibility: "public",
                width_px: 256,
              },
            },
            meta: {},
          });
        }

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

        if (requestUrl.endsWith(`/api/admin/sofas/${sofaId}/fabrics`)) {
          return jsonResponse({
            data: {
              sofa_fabrics: [],
            },
            meta: {},
          });
        }

        if (
          requestUrl.endsWith(
            `/api/admin/sofas/${sofaId}/visual-matrix-columns`,
          )
        ) {
          return jsonResponse({
            data: {
              visual_matrix_column: {
                id: "00000000-0000-4000-8000-000000000904",
              },
              visual_matrix_columns: [],
            },
            meta: {},
          });
        }

        if (
          requestUrl.endsWith(
            "/api/admin/visual-matrix-columns/00000000-0000-4000-8000-000000000904",
          )
        ) {
          if (method === "DELETE") {
            return new Response(null, {
              status: 204,
            });
          }

          return jsonResponse({
            data: {
              visual_matrix_column: {
                id: "00000000-0000-4000-8000-000000000904",
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith(`/api/admin/sofas/${sofaId}/render-coverage`)) {
          return jsonResponse({
            data: {
              render_coverage: {
                render_cells: [],
                sofa_fabrics: [],
                sofa_id: sofaId,
                visual_matrix_columns: [],
              },
            },
            meta: {},
          });
        }

        if (
          requestUrl.endsWith(
            `/api/admin/render-cells/${renderCellId}/candidates`,
          )
        ) {
          return jsonResponse({
            data: {
              render_candidates: [
                {
                  id: candidateId,
                  is_current: false,
                  preview_url: "https://storage.example/candidate-preview",
                  render_cell_id: renderCellId,
                },
              ],
            },
            meta: {},
          });
        }

        if (
          requestUrl.endsWith(
            `/api/admin/render-cells/${renderCellId}/manual-render`,
          )
        ) {
          return jsonResponse({
            data: {
              render_cell: {
                current_private_asset_id:
                  "00000000-0000-4000-8000-000000000909",
                id: renderCellId,
                source_type: "manual_upload",
              },
            },
            meta: {},
          });
        }

        if (
          requestUrl.endsWith(
            `/api/admin/render-candidates/${candidateId}/use-as-current`,
          )
        ) {
          return jsonResponse({
            data: {
              render_candidate: {
                id: candidateId,
                is_current: true,
                render_cell_id: renderCellId,
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith("/api/admin/fabric-render-jobs")) {
          return jsonResponse({
            data: {
              fabric_render_job: {
                id: "00000000-0000-4000-8000-000000000906",
                status: "queued",
              },
            },
            meta: {},
          });
        }

        if (
          requestUrl.endsWith(
            "/api/admin/fabric-render-jobs/00000000-0000-4000-8000-000000000906",
          )
        ) {
          return jsonResponse({
            data: {
              fabric_render_job: {
                id: "00000000-0000-4000-8000-000000000906",
                status: "queued",
              },
            },
            meta: {},
          });
        }

        if (
          requestUrl.endsWith(`/api/admin/sofas/${sofaId}/fabrics/${fabricId}`)
        ) {
          if (method === "DELETE") {
            return new Response(null, {
              status: 204,
            });
          }

          return jsonResponse({
            data: {
              sofa_fabric: {
                assigned_at: "2026-04-28T10:15:00.000Z",
                fabric_id: fabricId,
                public_order: 1,
                sofa_id: sofaId,
                updated_at: "2026-04-28T10:15:00.000Z",
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith("/api/admin/sofas")) {
          return jsonResponse({
            data: {
              sofa: {
                id: sofaId,
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
                id: sofaId,
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith("/api/admin/fabrics")) {
          return jsonResponse({
            data: {
              fabric: {
                id: fabricId,
              },
              fabrics: [],
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith(`/api/admin/fabrics/${fabricId}/archive`)) {
          return jsonResponse({
            data: {
              fabric: {
                id: fabricId,
                lifecycle_state: "archived",
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith(`/api/admin/fabrics/${fabricId}`)) {
          return jsonResponse({
            data: {
              fabric: {
                id: fabricId,
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith("/api/admin/tags")) {
          return jsonResponse({
            data: {
              tag: {
                id: tagId,
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
                id: tagId,
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
      },
    );
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
    await dependencies.deleteTag("admin-token", tagId);
    await dependencies.createUpload("admin-token", {
      byte_size: 1200,
      content_type: "image/png",
      purpose: "fabric_swatch",
    });
    await dependencies.completeUpload("admin-token", "fabric-upload");
    await dependencies.listFabrics("admin-token");
    await dependencies.createFabric("admin-token", {
      ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
      internal_name: "Internal fabric",
      is_premium: false,
      public_name: "Boucle ivoire",
      swatch_asset_id: "00000000-0000-4000-8000-000000000901",
    });
    await dependencies.getFabric("admin-token", fabricId);
    await dependencies.updateFabric("admin-token", fabricId, {
      public_name: "Boucle naturel",
    });
    await dependencies.archiveFabric("admin-token", fabricId);
    await dependencies.listSofaFabrics("admin-token", sofaId);
    await dependencies.assignSofaFabric("admin-token", sofaId, fabricId, {
      public_order: 1,
    });
    await dependencies.updateSofaFabric("admin-token", sofaId, fabricId, {
      public_order: null,
    });
    await dependencies.removeSofaFabric("admin-token", sofaId, fabricId);
    await dependencies.listVisualMatrixColumns("admin-token", sofaId);
    await dependencies.createVisualMatrixColumn("admin-token", sofaId, {
      admin_label: "Front",
      public_label: "Front",
      sequence: 1,
    });
    await dependencies.updateVisualMatrixColumn(
      "admin-token",
      "00000000-0000-4000-8000-000000000904",
      {
        public_label: "Front",
      },
    );
    await dependencies.deleteVisualMatrixColumn(
      "admin-token",
      "00000000-0000-4000-8000-000000000904",
    );
    await dependencies.getRenderCoverage("admin-token", sofaId);
    await dependencies.createFabricRenderJob("admin-token", {
      fabric_id: fabricId,
      generation_mode: "initial",
      prompt_note: null,
      sofa_id: sofaId,
      visual_matrix_column_id: "00000000-0000-4000-8000-000000000904",
    });
    await dependencies.getFabricRenderJob(
      "admin-token",
      "00000000-0000-4000-8000-000000000906",
    );
    await dependencies.listRenderCellCandidates("admin-token", renderCellId);
    await dependencies.useRenderCandidate("admin-token", candidateId);
    await dependencies.setManualRender("admin-token", renderCellId, {
      asset_id: "00000000-0000-4000-8000-000000000909",
    });

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
      "/api/admin/uploads",
      "/api/admin/uploads/fabric-upload/complete",
      "/api/admin/fabrics",
      "/api/admin/fabrics",
      "/api/admin/fabrics/00000000-0000-4000-8000-000000000903",
      "/api/admin/fabrics/00000000-0000-4000-8000-000000000903",
      "/api/admin/fabrics/00000000-0000-4000-8000-000000000903/archive",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/fabrics",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/fabrics/00000000-0000-4000-8000-000000000903",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/fabrics/00000000-0000-4000-8000-000000000903",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/fabrics/00000000-0000-4000-8000-000000000903",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/visual-matrix-columns",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/visual-matrix-columns",
      "/api/admin/visual-matrix-columns/00000000-0000-4000-8000-000000000904",
      "/api/admin/visual-matrix-columns/00000000-0000-4000-8000-000000000904",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/render-coverage",
      "/api/admin/fabric-render-jobs",
      "/api/admin/fabric-render-jobs/00000000-0000-4000-8000-000000000906",
      "/api/admin/render-cells/00000000-0000-4000-8000-000000000905/candidates",
      "/api/admin/render-candidates/00000000-0000-4000-8000-000000000908/use-as-current",
      "/api/admin/render-cells/00000000-0000-4000-8000-000000000905/manual-render",
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
