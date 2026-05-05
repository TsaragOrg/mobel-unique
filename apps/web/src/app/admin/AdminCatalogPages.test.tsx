/*
RU: Этот файл проверяет страницы админского каталога.
RU: Во время проверки показаны формы, списки, кнопки загрузки, подготовка картинок и публикация дивана.
RU: Проверки помогают убедиться, что админ может запускать генерацию, выбирать картинку, публиковать и снимать публикацию.
FR: Ce fichier verifie les pages du catalogue admin.
FR: Pendant les tests, on voit les formulaires, listes, boutons d'envoi, preparation d'images et publication du canape.
FR: Les tests aident a verifier que l'admin peut lancer la generation, choisir l'image, publier et retirer la publication.
*/

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareAdminImageUploadFile } from "../../lib/admin-image-upload";
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
  type AdminCatalogSofaFabric,
} from "./AdminCatalogPages";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("../../lib/admin-image-upload", () => ({
  getDefaultFabricSwatchCrop: vi.fn(({ width, height }) => {
    const sourceSize = Math.min(width, height);

    return {
      sourceSize,
      sourceX: Math.round((width - sourceSize) / 2),
      sourceY: Math.round((height - sourceSize) / 2),
    };
  }),
  prepareAdminImageUploadFile: vi.fn(async ({ file }) => ({
    file,
    message: null,
    resized: false,
  })),
}));

// RU: Эта ссылка нужна тестам для ткани с готовым безопасным образцом.
// FR: Ce lien sert aux tests pour un tissu avec un apercu sur.
const swatchPreviewUrl =
  "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png";

// RU: Эта проверка нужна тестам, чтобы окно стояло по центру, как окно картинок.
// FR: Cette verification aide les tests a confirmer que la fenetre reste au centre, comme la fenetre images.
function expectCenteredVisualMatrixDialog(dialog: HTMLElement) {
  expect(dialog).toHaveClass(
    "admin-drawer",
    "admin-render-cell-sheet",
    "admin-render-cell-workbench",
  );
  expect(dialog.parentElement).toHaveClass(
    "admin-dialog-scrim",
    "admin-render-workbench-scrim",
  );
}

// RU: Эта проверка нужна тестам, чтобы форма окна могла ровно ставить кнопку рядом с полями.
// FR: Cette verification aide les tests a confirmer que le formulaire peut aligner le bouton avec les champs.
function expectVisualMatrixDialogFormAlignment(dialog: HTMLElement) {
  expect(dialog.querySelector("form")).toHaveClass(
    "admin-visual-matrix-dialog-form",
  );
}

// RU: Эта проверка нужна тестам, чтобы правая кнопка правки в строке Visual matrix оставалась текстовой.
// FR: Cette verification aide les tests a confirmer que le bouton de modification a droite dans la ligne Visual matrix reste avec du texte.
function expectVisualMatrixRowActions(button: HTMLElement) {
  const actions = button.closest(".admin-visual-matrix-actions");

  expect(actions).not.toBeNull();
  expect(actions).toHaveClass("admin-visual-matrix-action-bar");
  for (const actionButton of within(actions as HTMLElement).getAllByRole(
    "button",
  )) {
    expect(actionButton).toHaveClass("admin-visual-matrix-action-button");
    expect(actionButton).not.toHaveClass("admin-icon-button");
    expect(actionButton).toHaveTextContent("Edit");
    expect(actionButton.querySelector(".admin-edit-icon")).toBe(null);
  }
}

// This keeps the readiness dot beside the workflow step number.
function expectSofaEditTabDotBesideNumber(tab: HTMLElement, number: string) {
  const tabMeta = tab.querySelector(".admin-sofa-edit-tab-meta");

  expect(tabMeta).not.toBeNull();
  expect(tabMeta).toHaveTextContent(number);
  expect(
    (tabMeta as HTMLElement).querySelector(".admin-readiness-dot"),
  ).toBeInTheDocument();
}

// RU: Эта проверка нужна тестам, чтобы у окна была верхняя кнопка закрытия, как в картинках.
// FR: Cette verification aide les tests a confirmer que la fenetre a le bouton fermer en haut, comme dans les images.
function closeCenteredVisualMatrixDialog(dialog: HTMLElement) {
  const closeButton = within(dialog).getByRole("button", {
    name: "Close View columns dialog",
  });

  expect(closeButton).toHaveClass(
    "admin-quiet-button",
    "admin-render-cell-close-button",
  );
  expect(
    within(dialog).queryByRole("button", { name: "Cancel" }),
  ).not.toBeInTheDocument();
  fireEvent.click(closeButton);
}

beforeEach(() => {
  vi.mocked(prepareAdminImageUploadFile).mockImplementation(
    async ({ file }) => ({
      file,
      message: null,
      resized: false,
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
    swatch_preview_url: swatchPreviewUrl,
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
    createSofaRenderExport: vi.fn(async (_accessToken, sofaId) => ({
      asset_id: "00000000-0000-4000-8000-000000000981",
      completed_at: "2026-04-28T11:05:00.000Z",
      created_at: "2026-04-28T11:00:00.000Z",
      download_url: null,
      expires_at: "2026-04-29T11:05:00.000Z",
      id: "00000000-0000-4000-8000-000000000980",
      included_render_count: 2,
      last_error_message: null,
      sofa_id: sofaId,
      status: "succeeded",
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
    createStorageAssetPreviewUrl: vi.fn(
      async (_accessToken, assetId) => `blob:admin-preview/${assetId}`,
    ),
    createFabricRenderJob: vi.fn(async (_accessToken, input) => ({
      attempt_count: 0,
      completed_at: null,
      created_at: "2026-04-28T10:30:00.000Z",
      fabric_id: input.fabric_id,
      generation_mode: input.generation_mode,
      id: "00000000-0000-4000-8000-000000000906",
      last_error_message: null,
      max_attempts: 3,
      prompt_note:
        input.generation_mode === "initial" ? input.prompt_note : null,
      queued_at: "2026-04-28T10:30:00.000Z",
      request_id: "00000000-0000-4000-8000-000000000916",
      refinement_source_asset_id:
        input.generation_mode === "refine"
          ? input.refinement_source_asset_id
          : null,
      refine_prompt:
        input.generation_mode === "refine" ? input.refine_prompt : null,
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: input.sofa_id,
      status: "queued",
      updated_at: "2026-04-28T10:30:00.000Z",
      visual_matrix_column_id: input.visual_matrix_column_id,
    })),
    generateFabricRenderJobsForSofa: vi.fn(async () => ({
      fabric_render_jobs: [],
      job_ids: [],
      request_id: "00000000-0000-4000-8000-000000000916",
      status: "queued" as const,
      total_jobs: 0,
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
      completed_at: "2026-04-28T10:35:00.000Z",
      created_at: "2026-04-28T10:30:00.000Z",
      fabric_id: fabric.id,
      generation_mode: "initial",
      id: "00000000-0000-4000-8000-000000000906",
      last_error_message: null,
      max_attempts: 3,
      prompt_note: null,
      queued_at: "2026-04-28T10:30:00.000Z",
      request_id: "00000000-0000-4000-8000-000000000916",
      refinement_source_asset_id: null,
      refine_prompt: null,
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: "00000000-0000-4000-8000-000000000701",
      status: "succeeded",
      updated_at: "2026-04-28T10:35:00.000Z",
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
    getSofaRenderExport: vi.fn(async (_accessToken, exportId) => ({
      asset_id: "00000000-0000-4000-8000-000000000981",
      completed_at: "2026-04-28T11:05:00.000Z",
      created_at: "2026-04-28T11:00:00.000Z",
      download_url: "https://storage.example/signed/render-export.zip",
      expires_at: "2026-04-29T11:05:00.000Z",
      id: exportId,
      included_render_count: 2,
      last_error_message: null,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      status: "succeeded",
    })),
    publishSofa: vi.fn(async (_accessToken, sofaId) => ({
      created_at: "2026-04-28T10:00:00.000Z",
      depth_cm: 95,
      footprint_measurements: null,
      footprint_type: null,
      height_cm: 82,
      id: sofaId,
      internal_name: "Manual test sofa",
      lifecycle_state: "published",
      manual_public_order: null,
      public_description: "Manual copy",
      public_name: "Canape test",
      public_slug: "canape-test",
      shopify_order_url: "https://example.com/products/manual-test",
      tags: [],
      updated_at: "2026-04-28T10:45:00.000Z",
      length_cm: 220,
    })),
    unpublishSofa: vi.fn(async (_accessToken, sofaId) => ({
      created_at: "2026-04-28T10:00:00.000Z",
      depth_cm: 95,
      footprint_measurements: null,
      footprint_type: null,
      height_cm: 82,
      id: sofaId,
      internal_name: "Manual test sofa",
      lifecycle_state: "draft",
      manual_public_order: null,
      public_description: "Manual copy",
      public_name: "Canape test",
      public_slug: "canape-test",
      shopify_order_url: "https://example.com/products/manual-test",
      tags: [],
      updated_at: "2026-04-28T10:50:00.000Z",
      length_cm: 220,
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
        source_photo_count: 1,
        source_photo_preview_url: "https://storage.example/source-sofa-preview",
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
    revokeStorageAssetPreviewUrl: vi.fn(),
    removeSofaFabric: vi.fn(async () => {}),
    resumeFabricRenderJobs: vi.fn(async () => ({
      request_ids: ["00000000-0000-4000-8000-000000000916"],
      status: "started" as const,
      total_requests: 1,
    })),
    retryFabricRenderJob: vi.fn(async (_accessToken, jobId) => ({
      attempt_count: 0,
      completed_at: null,
      created_at: "2026-04-28T10:45:00.000Z",
      fabric_id: fabric.id,
      generation_mode: "initial",
      id: jobId,
      last_error_message: null,
      max_attempts: 3,
      prompt_note: null,
      queued_at: "2026-04-28T10:45:00.000Z",
      request_id: "00000000-0000-4000-8000-000000000917",
      refinement_source_asset_id: null,
      refine_prompt: null,
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: "00000000-0000-4000-8000-000000000701",
      status: "queued",
      updated_at: "2026-04-28T10:45:00.000Z",
      visual_matrix_column_id: visualMatrixColumn.id,
    })),
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

// RU: Эта помощь дает выбранной картинке размер в проверках.
// FR: Cette aide donne une taille a l'image choisie pendant les tests.
function stubImageDimensions({
  height,
  width,
}: {
  height: number;
  width: number;
}) {
  const close = vi.fn();

  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({
      close,
      height,
      width,
    })),
  );

  return close;
}

// RU: Эта помощь отправляет движение пальца с номером, как это делает браузер.
// FR: Cette aide envoie le mouvement du doigt avec son numero, comme le navigateur.
function firePointerCropEvent(
  element: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  input: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
  },
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });

  for (const [key, value] of Object.entries(input)) {
    Object.defineProperty(event, key, {
      value,
    });
  }

  fireEvent(element, event);
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
    expect(screen.getByText("MOBEL UNIQUE")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", {
        name: "Admin",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New sofa" })).toHaveAttribute(
      "href",
      "/admin/sofas/new",
    );
    expect(await screen.findByText("Manual test sofa")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Source photo for Canape test" }),
    ).toHaveAttribute("src", "https://storage.example/source-sofa-preview");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByText("Shopify missing")).not.toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
    expect(screen.queryByText("Dimensions")).not.toBeInTheDocument();
    expect(screen.getByText("1 source photo")).toBeInTheDocument();
    expect(dependencies.listSofas).toHaveBeenCalledWith("admin-token");
  });

  it("shows sofa list empty and error states", async () => {
    const emptyDependencies = createDependencies({
      listSofas: vi.fn(async () => []),
    });

    render(<AdminSofasPage dependencies={emptyDependencies} />);

    expect(await screen.findByText("No sofa records yet.")).toBeInTheDocument();

    cleanup();

    const errorDependencies = createDependencies({
      listSofas: vi.fn(async () => {
        throw new Error("SOFA_LIST_FAILED");
      }),
    });

    render(<AdminSofasPage dependencies={errorDependencies} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.queryByText("SOFA_LIST_FAILED")).not.toBeInTheDocument();
  });

  it("creates, edits, and handles assigned-tag delete conflicts", async () => {
    const dependencies = createDependencies({
      deleteTag: vi.fn(async () => {
        throw new Error("TAG_IN_USE");
      }),
    });

    render(<AdminTagsPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Tags" });
    fireEvent.change(screen.getByLabelText("New tag"), {
      target: { value: "Angle premium" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() => {
      expect(dependencies.createTag).toHaveBeenCalledWith("admin-token", {
        public_label: "Angle premium",
      });
    });

    const convertibleInput = screen.getByLabelText("Tag name for Convertible");
    const convertibleRow = convertibleInput.closest("form");

    expect(convertibleRow).not.toBeNull();
    expect(
      within(convertibleRow as HTMLElement).getByRole("button", {
        name: "Save Convertible",
      }),
    ).toHaveTextContent("Save");
    const deleteConvertibleButton = within(
      convertibleRow as HTMLElement,
    ).getByRole("button", {
      name: "Delete Convertible",
    });

    expect(deleteConvertibleButton).not.toHaveTextContent("Delete");
    expect(
      deleteConvertibleButton.querySelector(".admin-delete-icon"),
    ).not.toBe(null);
    expect(
      deleteConvertibleButton.querySelectorAll(".admin-delete-icon path"),
    ).toHaveLength(4);
    expect(
      deleteConvertibleButton.querySelector(".admin-delete-icon-mark"),
    ).not.toBe(null);

    fireEvent.change(convertibleInput, {
      target: { value: "Angle premium" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Convertible" }));

    await waitFor(() => {
      expect(dependencies.updateTag).toHaveBeenCalled();
    });

    fireEvent.click(deleteConvertibleButton);
    const confirmDeleteConvertibleButton = screen.getByRole("button", {
      name: "Confirm delete Convertible",
    });

    expect(confirmDeleteConvertibleButton).not.toHaveTextContent("Confirm");
    expect(
      confirmDeleteConvertibleButton.querySelector(".admin-delete-icon"),
    ).not.toBe(null);
    fireEvent.click(confirmDeleteConvertibleButton);

    await screen.findByRole("alert");
    expect(
      screen.getByText(
        "This tag is already assigned to a sofa, so it cannot be deleted.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("TAG_IN_USE")).not.toBeInTheDocument();
  });

  it("loads fabrics through the first-party admin facade abstraction", async () => {
    const dependencies = createDependencies();

    render(<AdminFabricsPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Fabrics" });
    expect(screen.getByText("MOBEL UNIQUE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New fabric" })).toHaveAttribute(
      "href",
      "/admin/fabrics/new",
    );
    expect(await screen.findByText("Internal fabric")).toBeInTheDocument();
    expect(screen.getByText("Boucle ivoire")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Boucle ivoire swatch" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getAllByText("Premium").length).toBeGreaterThan(0);
    expect(dependencies.listFabrics).toHaveBeenCalledWith("admin-token");
  });

  it("creates a fabric through the signed upload facade flow", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const preparedAiReference = new File(["prepared"], "reference.jpg", {
      type: "image/jpeg",
    });
    const selectedSwatch = new File(["swatch"], "swatch.png", {
      type: "image/png",
    });
    const preparedSwatch = new File(["prepared-swatch"], "swatch.png", {
      type: "image/png",
    });
    vi.mocked(prepareAdminImageUploadFile).mockImplementation(
      async ({ fabricSwatchCrop, file, purpose }) =>
        purpose === "fabric_swatch" && fabricSwatchCrop
          ? {
              file: preparedSwatch,
              message: "Swatch cropped to a 512x512 square before upload.",
              resized: true,
            }
          : purpose === "fabric_ai_reference"
            ? {
                file: preparedAiReference,
                message:
                  "Image resized from 4000x3000 to 2048x1536 before upload.",
                resized: true,
              }
            : {
                file,
                message: null,
                resized: false,
              },
    );
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    expect(
      screen.getByText(
        "Create a fabric record with required swatch and AI reference assets.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Internal fabric name"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Public fabric name"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.click(screen.getByLabelText("Premium fabric"));
    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [selectedSwatch],
      },
    });
    expect(
      await screen.findByRole("group", { name: "Swatch crop" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create fabric" }));

    await waitFor(() => {
      expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
        fabricSwatchCrop: {
          sourceSize: 900,
          sourceX: 350,
          sourceY: 0,
        },
        file: selectedSwatch,
        purpose: "fabric_swatch",
      });
    });
    expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
      file: expect.any(File),
      purpose: "fabric_ai_reference",
    });
    expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
      byte_size: preparedSwatch.size,
      content_type: "image/png",
      purpose: "fabric_swatch",
    });
    expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
      byte_size: preparedAiReference.size,
      content_type: "image/jpeg",
      purpose: "fabric_ai_reference",
    });
    expect(dependencies.uploadToSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_id: "swatch-upload",
      }),
      preparedSwatch,
    );
    expect(dependencies.uploadToSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_id: "ai-reference-upload",
      }),
      preparedAiReference,
    );
    expect(
      screen.getByText(
        "Image resized from 4000x3000 to 2048x1536 before upload.",
      ),
    ).toBeInTheDocument();
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
    expect(dependencies.navigate).toHaveBeenCalledWith("/admin/fabrics");
  });

  it("shows crop controls only after a new swatch image is selected", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    expect(
      screen.queryByRole("group", { name: "Swatch crop" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [new File(["swatch"], "swatch.png", { type: "image/png" })],
      },
    });

    expect(
      await screen.findByRole("group", { name: "Swatch crop" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Swatch zoom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save crop" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset crop" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save crop" }));
    expect(
      screen.getByRole("button", { name: "Crop saved" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Swatch zoom"), {
      target: { value: "140" },
    });
    expect(
      screen.getByRole("button", { name: "Save crop" }),
    ).toBeInTheDocument();
  });

  it("shows an AI reference image preview after a file is selected", async () => {
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    expect(
      screen.queryByRole("group", { name: "AI reference preview" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    expect(
      screen.getByRole("group", { name: "AI reference preview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "AI reference image preview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("reference.jpg")).toBeInTheDocument();
  });

  it("keeps a selected swatch crop when save crop is clicked", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const selectedSwatch = new File(["swatch"], "swatch.png", {
      type: "image/png",
    });
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    fireEvent.change(screen.getByLabelText("Internal fabric name"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Public fabric name"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [selectedSwatch],
      },
    });
    await screen.findByRole("group", { name: "Swatch crop" });
    fireEvent.change(screen.getByLabelText("Swatch zoom"), {
      target: { value: "160" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save crop" }));
    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create fabric" }));

    await waitFor(() => {
      expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
        fabricSwatchCrop: {
          sourceSize: 563,
          sourceX: 519,
          sourceY: 169,
        },
        file: selectedSwatch,
        purpose: "fabric_swatch",
      });
    });
  });

  it("zooms the selected swatch crop with the mouse wheel over the preview", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const selectedSwatch = new File(["swatch"], "swatch.png", {
      type: "image/png",
    });
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    fireEvent.change(screen.getByLabelText("Internal fabric name"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Public fabric name"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [selectedSwatch],
      },
    });
    const cropPreview = await screen.findByRole("img", {
      name: "Swatch crop preview",
    });
    fireEvent.wheel(cropPreview, {
      deltaY: -120,
    });
    expect(screen.getByLabelText("Swatch zoom")).toHaveValue("110");
    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create fabric" }));

    await waitFor(() => {
      expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
        fabricSwatchCrop: {
          sourceSize: 818,
          sourceX: 391,
          sourceY: 41,
        },
        file: selectedSwatch,
        purpose: "fabric_swatch",
      });
    });
  });

  it("zooms the selected swatch crop with a two-finger pinch gesture", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const selectedSwatch = new File(["swatch"], "swatch.png", {
      type: "image/png",
    });
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    fireEvent.change(screen.getByLabelText("Internal fabric name"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Public fabric name"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [selectedSwatch],
      },
    });
    const cropPreview = await screen.findByRole("img", {
      name: "Swatch crop preview",
    });
    firePointerCropEvent(cropPreview, "pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    firePointerCropEvent(cropPreview, "pointerdown", {
      clientX: 200,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    firePointerCropEvent(cropPreview, "pointermove", {
      clientX: 250,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    expect(screen.getByLabelText("Swatch zoom")).toHaveValue("150");
    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create fabric" }));

    await waitFor(() => {
      expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
        fabricSwatchCrop: {
          sourceSize: 600,
          sourceX: 500,
          sourceY: 150,
        },
        file: selectedSwatch,
        purpose: "fabric_swatch",
      });
    });
  });

  it("allows swatch crop zoom up to 500 percent", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const selectedSwatch = new File(["swatch"], "swatch.png", {
      type: "image/png",
    });
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    fireEvent.change(screen.getByLabelText("Internal fabric name"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Public fabric name"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [selectedSwatch],
      },
    });
    await screen.findByRole("group", { name: "Swatch crop" });
    expect(screen.getByLabelText("Swatch zoom")).toHaveAttribute("max", "500");
    fireEvent.change(screen.getByLabelText("Swatch zoom"), {
      target: { value: "500" },
    });
    expect(screen.getByLabelText("Swatch zoom")).toHaveValue("500");
    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create fabric" }));

    await waitFor(() => {
      expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
        fabricSwatchCrop: {
          sourceSize: 180,
          sourceX: 710,
          sourceY: 360,
        },
        file: selectedSwatch,
        purpose: "fabric_swatch",
      });
    });
  });

  it("keeps the existing swatch asset when editing without a new swatch image", async () => {
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
          swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        }),
      );
    });
    expect(prepareAdminImageUploadFile).not.toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "fabric_swatch",
      }),
    );
    expect(dependencies.createUpload).not.toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({
        purpose: "fabric_swatch",
      }),
    );
  });

  it("uploads a generated square swatch when editing with a new swatch image", async () => {
    stubImageDimensions({ height: 1400, width: 1000 });
    const selectedSwatch = new File(["new-swatch"], "new-swatch.webp", {
      type: "image/webp",
    });
    const preparedSwatch = new File(
      ["prepared-edit-swatch"],
      "new-swatch.webp",
      {
        type: "image/webp",
      },
    );
    vi.mocked(prepareAdminImageUploadFile).mockImplementation(
      async ({ fabricSwatchCrop, file, purpose }) =>
        purpose === "fabric_swatch" && fabricSwatchCrop
          ? {
              file: preparedSwatch,
              message: "Swatch cropped to a 512x512 square before upload.",
              resized: true,
            }
          : {
              file,
              message: null,
              resized: false,
            },
    );
    const dependencies = createDependencies();

    render(
      <AdminFabricEditPage
        dependencies={dependencies}
        fabricId="00000000-0000-4000-8000-000000000903"
      />,
    );

    await screen.findByRole("heading", { name: "Internal fabric" });
    fireEvent.change(screen.getByLabelText("Swatch image"), {
      target: {
        files: [selectedSwatch],
      },
    });
    await screen.findByRole("group", { name: "Swatch crop" });
    fireEvent.click(screen.getByRole("button", { name: "Save fabric" }));

    await waitFor(() => {
      expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
        fabricSwatchCrop: {
          sourceSize: 1000,
          sourceX: 0,
          sourceY: 200,
        },
        file: selectedSwatch,
        purpose: "fabric_swatch",
      });
    });
    expect(dependencies.uploadToSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_id: "swatch-upload",
      }),
      preparedSwatch,
    );
    expect(dependencies.updateFabric).toHaveBeenCalledWith(
      "admin-token",
      "00000000-0000-4000-8000-000000000903",
      expect.objectContaining({
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
      }),
    );
  });

  it("keeps AI reference upload preparation separate from swatch crop data", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const preparedAiReference = new File(["prepared"], "reference.jpg", {
      type: "image/jpeg",
    });
    vi.mocked(prepareAdminImageUploadFile).mockImplementation(
      async ({ file, purpose }) =>
        purpose === "fabric_ai_reference"
          ? {
              file: preparedAiReference,
              message:
                "Image resized from 4000x3000 to 2048x1536 before upload.",
              resized: true,
            }
          : {
              file,
              message: null,
              resized: false,
            },
    );
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create fabric" });
    expect(
      screen.getByText(
        "Create a fabric record with required swatch and AI reference assets.",
      ),
    ).toBeInTheDocument();
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
    await screen.findByRole("group", { name: "Swatch crop" });
    fireEvent.change(screen.getByLabelText("AI reference image"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create fabric" }));

    await waitFor(() => {
      expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
        file: expect.any(File),
        purpose: "fabric_ai_reference",
      });
    });
    expect(prepareAdminImageUploadFile).not.toHaveBeenCalledWith({
      fabricSwatchCrop: expect.anything(),
      file: expect.any(File),
      purpose: "fabric_ai_reference",
    });
    expect(dependencies.uploadToSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_id: "ai-reference-upload",
      }),
      preparedAiReference,
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
    expect(
      screen.getByText(
        "Update fabric naming, readiness assets, and archive state.",
      ),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText(
        "Create a draft sofa record before assigning fabrics and render coverage.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Internal name"), {
      target: { value: "Manual test sofa" },
    });
    fireEvent.change(screen.getByLabelText("Public name"), {
      target: { value: "Canape test" },
    });
    fireEvent.change(screen.getByLabelText("Shopify order URL"), {
      target: { value: "https://example.com/products/manual-test" },
    });
    fireEvent.change(await screen.findByLabelText("Search tags"), {
      target: { value: "con" },
    });
    fireEvent.click(screen.getByRole("option", { name: "Add Convertible tag" }));
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

  it("searches sofa tags, pins a selected tag, and removes it", async () => {
    // RU: Эти данные дают проверке несколько тегов для поиска и выбора.
    // FR: Ces donnees donnent plusieurs etiquettes a la verification.
    const dependencies = createDependencies({
      listTags: vi.fn(async () => [
        {
          id: "00000000-0000-4000-8000-000000000801",
          public_label: "Convertible",
          slug: "convertible",
        },
        {
          id: "00000000-0000-4000-8000-000000000802",
          public_label: "Red sofa",
          slug: "red-sofa",
        },
        {
          id: "00000000-0000-4000-8000-000000000803",
          public_label: "Top sofa",
          slug: "top-sofa",
        },
      ]),
    });

    render(<AdminSofaCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Create sofa" });
    fireEvent.change(await screen.findByLabelText("Search tags"), {
      target: { value: "r" },
    });
    expect(
      within(screen.getByRole("listbox", { name: "Matching tags" })).getByRole(
        "option",
        { name: "Add Red sofa tag" },
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("listbox", { name: "Matching tags" })).queryByRole(
        "option",
        { name: "Add Top sofa tag" },
      ),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Add Red sofa tag" }));

    expect(screen.getByText("Selected tags")).toBeInTheDocument();
    expect(screen.getByText("Red sofa")).toBeInTheDocument();
    expect(screen.getByLabelText("Search tags")).toHaveValue("");
    expect(
      screen.queryByRole("option", { name: "Add Red sofa tag" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Red sofa tag" }),
    );

    expect(screen.queryByText("Red sofa")).not.toBeInTheDocument();
    expect(screen.getByText("No tags selected yet.")).toBeInTheDocument();
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
    expect(
      screen.getByText(
        "Manage basics, fabric lines, view columns, render coverage, and publishing readiness.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("00000000-0000-4000-8000-000000000701"),
    ).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));
    expect(screen.getByText("No public fabric yet")).toBeInTheDocument();
    expect(screen.queryByText("MISSING_PUBLIC_FABRIC")).not.toBeInTheDocument();
  });

  it("shows sofa edit workflow tabs and keeps publishing inside Publish", async () => {
    const dependencies = createDependencies({
      getSofaReadiness: vi.fn(async () => ({
        errors: [],
        ready: true,
      })),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });

    expect(screen.getByRole("tab", { name: /Basics/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Fabric lines/i }),
    ).toBeInTheDocument();
    const visualMatrixTab = screen.getByRole("tab", {
      name: /View columns/i,
    });

    expect(visualMatrixTab).toBeInTheDocument();
    expectSofaEditTabDotBesideNumber(visualMatrixTab, "03");
    expect(screen.getByRole("tab", { name: /Renders/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Publish/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Sofa test sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Manual test checklist" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));

    expect(
      screen.getByRole("button", { name: "Publish sofa" }),
    ).toBeInTheDocument();
  });

  it("shows sofa edit tabs, readiness chips, and render coverage panel", async () => {
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
        swatch_preview_url: null,
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
    expect(
      screen.queryByRole("navigation", { name: "Sofa test sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Fabric lines Blocked/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Renders Ready/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));

    expect(
      screen.getByRole("heading", {
        name: "Render coverage",
      }),
    ).toBeInTheDocument();
    const readyCellButton = screen.getByRole("button", {
      name: "Boucle ivoire, Front: Ready",
    });
    expect(readyCellButton).toBeInTheDocument();
    expect(screen.getByText("Status key")).toBeInTheDocument();

    fireEvent.click(readyCellButton);

    const renderCellDialog = screen.getByRole("dialog", {
      name: /Render cell/i,
    });
    expect(
      within(renderCellDialog).getByText("AI generated"),
    ).toBeInTheDocument();
  });

  it("shows render coverage status legend and opens a render cell sheet", async () => {
    // RU: Эти значения описывают ткань, позицию и пустую ячейку для вкладки картинок.
    // FR: Ces valeurs decrivent le tissu, la position et une case vide pour l'onglet images.
    const sofaId = "00000000-0000-4000-8000-000000000701";
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
        swatch_preview_url: swatchPreviewUrl,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
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
            sofa_id: sofaId,
            source_photo_id: visualColumn.current_source_photo_id,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));

    expect(screen.getByText("Render coverage")).toBeInTheDocument();
    expect(screen.getByText("Status key")).toBeInTheDocument();
    for (const label of [
      "Ready",
      "Missing",
      "Candidate",
      "Blocked",
      "Queued",
      "Processing",
      "Failed",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }

    const cellButton = screen.getByRole("button", {
      name: /Boucle ivoire, Front: Missing/i,
    });
    fireEvent.click(cellButton);

    const dialog = screen.getByRole("dialog", { name: /Render cell/i });
    const closeButton = within(dialog).getByRole("button", {
      name: "Close render cell",
    });

    await waitFor(() => expect(closeButton).toHaveFocus());

    expect(within(dialog).getByText("Boucle ivoire")).toBeInTheDocument();
    expect(within(dialog).getByText("Front")).toBeInTheDocument();
    expect(within(dialog).getByText("Render missing")).toBeInTheDocument();
    expect(
      within(dialog).getByText("This cell has no current render yet."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("No source yet")).toBeInTheDocument();
    expect(within(dialog).queryByText("AI generated")).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Generate" }),
    ).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);

    expect(cellButton).toHaveFocus();
  });

  it("starts generation from a Missing render cell sheet when no blocker is visible", async () => {
    // RU: Эти значения описывают пустую ячейку без видимых причин остановки.
    // FR: Ces valeurs decrivent une case vide sans raison visible de blocage.
    const sofaId = "00000000-0000-4000-8000-000000000701";
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
        is_premium: true,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_preview_url: swatchPreviewUrl,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          {
            blockers: [],
            can_generate_initial: false,
            candidate_count: 0,
            current_private_asset_id: null,
            current_public_asset_id: null,
            fabric_id: assignedFabric.fabric_id,
            has_private_render: false,
            has_public_render: false,
            id: "00000000-0000-4000-8000-000000000906",
            latest_job: null,
            sofa_id: sofaId,
            source_photo_id: visualColumn.current_source_photo_id,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Missing/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });
    const generationGroup = within(dialog).getByRole("group", {
      name: "Generate action",
    });
    const generateButton = within(generationGroup).getByRole("button", {
      name: "Generate",
    });

    expect(
      within(dialog).queryByLabelText("Prompt note"),
    ).not.toBeInTheDocument();
    expect(
      within(generationGroup).queryByLabelText("Optional note"),
    ).not.toBeInTheDocument();
    expect(
      within(generationGroup).getByRole("button", {
        name: "Add optional note",
      }),
    ).toBeInTheDocument();
    expect(generateButton).toBeEnabled();
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(dependencies.createFabricRenderJob).toHaveBeenCalledWith(
        "admin-token",
        {
          fabric_id: assignedFabric.fabric_id,
          generation_mode: "initial",
          prompt_note: null,
          sofa_id: sofaId,
          visual_matrix_column_id: visualColumn.id,
        },
      );
    });
  });

  it("shows candidate review in an open Missing cell after generation finishes", async () => {
    // RU: Эти данные описывают открытую пустую ячейку, где готовый вариант появляется позже.
    // FR: Ces donnees decrivent une case vide ouverte ou une option prete arrive plus tard.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricId = "00000000-0000-4000-8000-000000000903";
    const columnId = "00000000-0000-4000-8000-000000000904";
    const cellId = "00000000-0000-4000-8000-000000000906";
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
        id: fabricId,
        internal_name: "Internal fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_preview_url: null,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: fabricId,
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: {
        asset: null,
        asset_id: "00000000-0000-4000-8000-000000000905",
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000905",
        original_fabric_id: fabricId,
        preview_url: "https://storage.example/source-photo-preview",
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:00:00.000Z",
        visual_matrix_column_id: columnId,
      },
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: columnId,
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const missingCell = {
      blockers: [],
      can_generate_initial: true,
      candidate_count: 0,
      current_private_asset_id: null,
      current_private_preview_url: null,
      current_public_asset_id: null,
      fabric_id: fabricId,
      has_private_render: false,
      has_public_render: false,
      id: cellId,
      latest_job: null,
      sofa_id: sofaId,
      source_photo_id: visualColumn.current_source_photo_id,
      source_type: "ai_generated",
      updated_at: "2026-04-28T10:00:00.000Z",
      visual_matrix_column_id: columnId,
    };
    const queuedCell = {
      ...missingCell,
      can_generate_initial: false,
      latest_job: {
        attempt_count: 0,
        completed_at: null,
        created_at: "2026-04-28T10:30:00.000Z",
        fabric_id: fabricId,
        generation_mode: "initial",
        id: "00000000-0000-4000-8000-000000000910",
        last_error_message: null,
        max_attempts: 3,
        prompt_note: null,
        queued_at: "2026-04-28T10:30:00.000Z",
        request_id: "00000000-0000-4000-8000-000000000916",
        refinement_source_asset_id: null,
        refine_prompt: null,
        render_cell_id: cellId,
        sofa_id: sofaId,
        status: "queued",
        updated_at: "2026-04-28T10:30:00.000Z",
        visual_matrix_column_id: columnId,
      },
    };
    const candidateCell = {
      ...missingCell,
      candidate_count: 1,
      latest_job: {
        ...queuedCell.latest_job,
        completed_at: "2026-04-28T10:35:00.000Z",
        status: "succeeded",
        updated_at: "2026-04-28T10:35:00.000Z",
      },
    };
    const candidate = {
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
      fabric_id: fabricId,
      generation_mode: "initial",
      id: "00000000-0000-4000-8000-000000000908",
      is_current: false,
      job_id: "00000000-0000-4000-8000-000000000910",
      preview_url: "https://storage.example/candidate-preview",
      prompt_version: "v007",
      provider_model: "mock-fabric-render-v1",
      provider_name: "mock",
      render_cell_id: cellId,
      sofa_id: sofaId,
      visual_matrix_column_id: columnId,
    };
    let onJobChange:
      | ((job: { status: string; sofa_id: string }) => void)
      | null = null;
    let phase: "missing" | "queued" | "candidate" = "missing";
    const dependencies = createDependencies({
      createFabricRenderJob: vi.fn(async () => {
        phase = "queued";

        return queuedCell.latest_job;
      }),
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          phase === "candidate"
            ? candidateCell
            : phase === "queued"
              ? queuedCell
              : missingCell,
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listRenderCellCandidates: vi.fn(async () => [candidate]),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
      subscribeToFabricRenderJobs: vi.fn((_sofaId, callback) => {
        onJobChange = callback;

        return vi.fn();
      }),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Missing/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });
    fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(dependencies.createFabricRenderJob).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          generation_mode: "initial",
        }),
      );
    });

    await act(async () => {
      phase = "candidate";
      onJobChange?.({
        sofa_id: sofaId,
        status: "succeeded",
      });
    });

    expect(
      await within(dialog).findByRole("group", { name: "Review candidates" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Use candidate" }),
    ).toBeInTheDocument();
  });

  it("keeps Processing render cells informational without a job action", async () => {
    // RU: Эти значения описывают ячейку, где создание картинки уже идет.
    // FR: Ces valeurs decrivent une case ou la creation d'image est en cours.
    const sofaId = "00000000-0000-4000-8000-000000000701";
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
        swatch_preview_url: swatchPreviewUrl,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const processingJob = {
      attempt_count: 1,
      completed_at: null,
      created_at: "2026-04-28T10:30:00.000Z",
      fabric_id: assignedFabric.fabric_id,
      generation_mode: "initial",
      id: "00000000-0000-4000-8000-000000000906",
      last_error_message: null,
      max_attempts: 3,
      prompt_note: null,
      queued_at: "2026-04-28T10:30:00.000Z",
      request_id: "00000000-0000-4000-8000-000000000916",
      refinement_source_asset_id: null,
      refine_prompt: null,
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: sofaId,
      status: "processing",
      updated_at: "2026-04-28T10:35:00.000Z",
      visual_matrix_column_id: visualColumn.id,
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          {
            blockers: ["ACTIVE_RENDER_JOB_EXISTS"],
            can_generate_initial: false,
            candidate_count: 0,
            current_private_asset_id: null,
            current_public_asset_id: null,
            fabric_id: assignedFabric.fabric_id,
            has_private_render: false,
            has_public_render: false,
            id: processingJob.render_cell_id,
            latest_job: processingJob,
            sofa_id: sofaId,
            source_photo_id: visualColumn.current_source_photo_id,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Processing/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });

    expect(
      within(dialog).queryByRole("button", { name: "View job progress" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "View job" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Job progress")).not.toBeInTheDocument();
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
        swatch_preview_url: null,
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
            current_private_preview_url:
              "https://storage.example/source-photo-preview",
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
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Grey fabric, Front: Ready/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });

    expect(
      within(dialog).getByText("Source photo is current"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("SOURCE_PHOTO_RENDER_COMPLETE"),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        visualColumn.current_source_photo.asset_id,
      );
    });
    expect(
      within(dialog).getByRole("img", { name: "Current render preview" }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${visualColumn.current_source_photo.asset_id}`,
    );
    expect(
      within(dialog).getByRole("img", { name: "Current render preview" }),
    ).not.toHaveAttribute(
      "src",
      "https://storage.example/source-photo-preview",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "View current render" }),
    );
    const currentRenderDialog = screen.getByRole("dialog", {
      name: /Current render/i,
    });
    expect(
      within(currentRenderDialog).getByRole("img", {
        name: "Current render preview",
      }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${visualColumn.current_source_photo.asset_id}`,
    );
    expect(
      within(dialog).getAllByText("Source photo").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(dialog).queryByRole("button", { name: "Generate" }),
    ).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Upload manual render" }),
    ).toBeInTheDocument();
  });

  it("replaces a source-photo current render after manual upload", async () => {
    // RU: Эти данные описывают готовую ячейку, где исходное фото сейчас является текущей картинкой.
    // FR: Ces donnees decrivent une case prete ou la photo source est l'image actuelle.
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
        swatch_preview_url: null,
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
    const sourcePhotoCell = {
      blockers: ["SOURCE_PHOTO_RENDER_COMPLETE"],
      can_generate_initial: false,
      candidate_count: 0,
      current_private_asset_id: visualColumn.current_source_photo.asset_id,
      current_private_preview_url:
        "https://storage.example/source-photo-preview",
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
    };
    const manualRenderAsset = {
      asset_kind: "fabric_render_private",
      bucket_id: "catalog-private-assets",
      byte_size: 2400,
      content_type: "image/png",
      height_px: 1200,
      id: "00000000-0000-4000-8000-000000000909",
      lifecycle_state: "active",
      object_path: "renders/manual.png",
      visibility: "private",
      width_px: 1600,
    };
    const dependencies = createDependencies({
      completeUpload: vi.fn(async () => manualRenderAsset),
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [sourcePhotoCell],
        sofa_fabrics: [assignedFabric],
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
      setManualRender: vi.fn(async (_accessToken, renderCellId, input) => ({
        ...sourcePhotoCell,
        blockers: [],
        can_generate_initial: false,
        current_private_asset_id: input.asset_id,
        current_private_preview_url:
          "https://storage.example/manual-render-preview",
        id: renderCellId,
        source_photo_id: null,
        source_type: "manual_upload",
        updated_at: "2026-04-28T10:40:00.000Z",
      })),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Grey fabric, Front: Ready/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });

    fireEvent.change(within(dialog).getByLabelText("Manual render"), {
      target: {
        files: [new File(["manual"], "manual.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload manual render" }),
    );

    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000909",
      );
      expect(
        within(dialog).getByRole("img", { name: "Current render preview" }),
      ).toHaveAttribute(
        "src",
        "blob:admin-preview/00000000-0000-4000-8000-000000000909",
      );
    });
    expect(within(dialog).queryByText("Source photo is current")).toBeNull();
    expect(within(dialog).getByText("Manual upload")).toBeInTheDocument();
  });

  it("shows manual upload failures in the render cell sheet", async () => {
    // RU: Эти данные описывают одну ячейку, где ручная картинка не смогла отправиться.
    // FR: Ces donnees decrivent une case ou l'image manuelle ne part pas.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricId = "00000000-0000-4000-8000-000000000903";
    const columnId = "00000000-0000-4000-8000-000000000904";
    const cellId = "00000000-0000-4000-8000-000000000905";
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: null,
      fabric_id: fabricId,
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: null,
      deleted_at: null,
      id: columnId,
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const renderCell = {
      blockers: [],
      can_generate_initial: true,
      candidate_count: 0,
      current_private_asset_id: null,
      current_private_preview_url: null,
      current_public_asset_id: null,
      fabric_id: fabricId,
      has_private_render: false,
      has_public_render: false,
      id: cellId,
      latest_job: null,
      sofa_id: sofaId,
      source_photo_id: null,
      source_type: "ai_generated",
      updated_at: "2026-04-28T10:00:00.000Z",
      visual_matrix_column_id: columnId,
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [renderCell],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
      uploadToSignedUrl: vi.fn(async () => {
        throw new Error("UPLOAD_FAILED");
      }),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(screen.getByRole("button", { name: /Front: Missing/i }));

    const dialog = screen.getByRole("dialog", { name: /Render cell/i });
    fireEvent.change(within(dialog).getByLabelText("Manual render"), {
      target: {
        files: [new File(["manual"], "manual.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload manual render" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The image upload failed. Please try again.",
    );
    expect(within(dialog).queryByText("UPLOAD_FAILED")).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("tab", { name: /Fabric lines/i }));
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
    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));
    expect(
      await screen.findByText("Missing public renders"),
    ).toBeInTheDocument();
    expect(screen.queryByText("MISSING_PUBLIC_FABRIC")).not.toBeInTheDocument();
    expect(
      screen.queryByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).not.toBeInTheDocument();
  });

  it("shows fabric cards and saves public order explicitly", async () => {
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricWithSwatch = {
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
      swatch_preview_url: swatchPreviewUrl,
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
    const fabricWithoutSwatch = {
      ...fabricWithSwatch,
      ai_reference_asset: null,
      ai_reference_asset_id: "00000000-0000-4000-8000-000000000912",
      id: "00000000-0000-4000-8000-000000000913",
      internal_name: "No swatch internal",
      is_premium: false,
      public_name: "Linen Clay",
      swatch_preview_url: null,
      swatch_asset: null,
    };
    const assignments = [fabricWithSwatch, fabricWithoutSwatch].map(
      (fabric, index) => ({
        assigned_at: "2026-04-28T10:15:00.000Z",
        fabric,
        fabric_id: fabric.id,
        public_order: index + 1,
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:15:00.000Z",
      }),
    );
    const dependencies = createDependencies({
      listFabrics: vi.fn(async () => [fabricWithSwatch, fabricWithoutSwatch]),
      listSofaFabrics: vi.fn(async () => assignments),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Fabric lines/i }));

    expect(screen.getByText("Boucle ivoire")).toBeInTheDocument();
    expect(screen.getByText("Internal: Internal fabric")).toBeInTheDocument();
    expect(screen.getByText("AI ref: Ready")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Swatch for Boucle ivoire" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No swatch")).toBeInTheDocument();
    const fabricDeleteButtons = within(
      screen.getByRole("region", { name: "Fabric assignments" }),
    ).getAllByRole("button", { name: /Delete fabric assignment/i });

    expect(fabricDeleteButtons).toHaveLength(2);
    for (const button of fabricDeleteButtons) {
      expect(button).not.toHaveTextContent("Delete");
      expect(button.querySelector(".admin-delete-icon")).not.toBe(null);
    }
    expect(
      within(
        screen.getByRole("region", { name: "Fabric assignments" }),
      ).queryByRole("button", { name: /Unassign/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Public order for Boucle ivoire"), {
      target: { value: "7" },
    });

    expect(dependencies.updateSofaFabric).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save order" }));

    await waitFor(() => {
      expect(dependencies.updateSofaFabric).toHaveBeenCalledWith(
        "admin-token",
        sofaId,
        fabricWithSwatch.id,
        { public_order: 7 },
      );
    });
  });

  it("saves swapped fabric public order without a temporary conflict", async () => {
    // RU: Эти данные задают диван и две ткани с порядком 1 и 2.
    // FR: Ces donnees fixent le canape et deux tissus avec les rangs 1 et 2.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const firstFabric = {
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
      internal_name: "First internal fabric",
      is_premium: false,
      lifecycle_state: "active",
      public_name: "First fabric",
      swatch_preview_url: null,
      swatch_asset: null,
      swatch_asset_id: "00000000-0000-4000-8000-000000000901",
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const secondFabric = {
      ...firstFabric,
      id: "00000000-0000-4000-8000-000000000913",
      internal_name: "Second internal fabric",
      public_name: "Second fabric",
    };

    // RU: Этот список меняется так же, как сервер меняет порядок тканей.
    // FR: Cette liste change comme le serveur change le rang des tissus.
    let assignments: AdminCatalogSofaFabric[] = [firstFabric, secondFabric].map(
      (fabric, index) => ({
        assigned_at: "2026-04-28T10:15:00.000Z",
        fabric,
        fabric_id: fabric.id,
        public_order: index + 1,
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:15:00.000Z",
      }),
    );

    // RU: Эта замена ведет себя как сервер и запрещает два одинаковых номера.
    // FR: Ce remplacement agit comme le serveur et refuse deux numeros egaux.
    const updateSofaFabric = vi.fn(
      async (
        _accessToken: string,
        targetSofaId: string,
        fabricId: string,
        input: { public_order: number | null },
      ) => {
        const conflict = assignments.some(
          (assignment) =>
            assignment.sofa_id === targetSofaId &&
            assignment.fabric_id !== fabricId &&
            assignment.public_order === input.public_order &&
            input.public_order !== null,
        );

        if (conflict) {
          throw new Error("SOFA_FABRIC_ORDER_CONFLICT");
        }

        const nextAssignment = assignments.find(
          (assignment) => assignment.fabric_id === fabricId,
        );

        if (!nextAssignment) {
          throw new Error("SOFA_FABRIC_NOT_FOUND");
        }

        const updatedAssignment = {
          ...nextAssignment,
          public_order: input.public_order,
          updated_at: "2026-04-28T10:20:00.000Z",
        };
        assignments = assignments.map((assignment) =>
          assignment.fabric_id === fabricId ? updatedAssignment : assignment,
        );

        return updatedAssignment;
      },
    );
    const dependencies = createDependencies({
      listFabrics: vi.fn(async () => [firstFabric, secondFabric]),
      listSofaFabrics: vi.fn(async () => assignments),
      updateSofaFabric,
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Fabric lines/i }));
    fireEvent.change(screen.getByLabelText("Public order for First fabric"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Public order for Second fabric"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save order" }));

    await waitFor(() => {
      expect(updateSofaFabric).toHaveBeenCalledWith(
        "admin-token",
        sofaId,
        firstFabric.id,
        { public_order: 2 },
      );
    });
    expect(updateSofaFabric.mock.calls.map((call) => call[3])).toEqual([
      { public_order: null },
      { public_order: null },
      { public_order: 2 },
      { public_order: 1 },
    ]);
    expect(assignments.map((assignment) => assignment.public_order)).toEqual([
      2, 1,
    ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows visual matrix list, centered column dialogs, and delete confirmation", async () => {
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: null,
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000903",
        internal_name: "Original fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Original fabric",
        swatch_preview_url: swatchPreviewUrl,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const reassignedFabric = {
      ...assignedFabric,
      fabric: {
        ...assignedFabric.fabric,
        id: "00000000-0000-4000-8000-000000000908",
        internal_name: "Replacement fabric",
        public_name: "Replacement fabric",
        swatch_preview_url: "https://storage.example/replacement-swatch.png",
      },
      fabric_id: "00000000-0000-4000-8000-000000000908",
    };
    const visualColumn = {
      admin_label: "Front internal",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: {
        asset: null,
        asset_id: "00000000-0000-4000-8000-000000000907",
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000905",
        original_fabric_id: assignedFabric.fabric_id,
        preview_url: "https://storage.example/source-photo-preview",
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:00:00.000Z",
        visual_matrix_column_id: "00000000-0000-4000-8000-000000000904",
      },
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const dependencies = createDependencies({
      listSofaFabrics: vi.fn(async () => [assignedFabric, reassignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /View columns/i }));

    expect(screen.getAllByText("View columns").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Configures positions. Renders shows coverage."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Source ready")).not.toBeInTheDocument();
    expect(
      document.querySelector(".admin-visual-matrix-source-preview img"),
    ).toHaveAttribute("src", "https://storage.example/source-photo-preview");
    const sourceImageButton = screen.getByRole("button", {
      name: "Edit source image column 1",
    });

    expect(sourceImageButton).not.toHaveTextContent("Edit");
    expect(sourceImageButton.querySelector(".admin-edit-icon")).not.toBe(null);
    expect(
      screen.getByRole("img", { name: "Swatch for Original fabric" }),
    ).toHaveAttribute("src", swatchPreviewUrl);
    expectVisualMatrixRowActions(
      screen.getByRole("button", { name: "Edit column 1" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add column" }));
    let dialog = screen.getByRole("dialog", { name: "Add column" });
    expectCenteredVisualMatrixDialog(dialog);
    expectVisualMatrixDialogFormAlignment(dialog);

    closeCenteredVisualMatrixDialog(dialog);
    expect(
      screen.queryByRole("dialog", { name: "Add column" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit column 1" }));
    dialog = screen.getByRole("dialog", { name: "Edit column 1" });
    expectCenteredVisualMatrixDialog(dialog);
    expectVisualMatrixDialogFormAlignment(dialog);
    expect(within(dialog).getByLabelText("Order 1")).toHaveValue(1);
    expect(within(dialog).getByLabelText("Source fabric 1")).toHaveValue(
      assignedFabric.fabric_id,
    );
    expect(
      dialog.querySelector(".admin-view-column-source-preview img"),
    ).toHaveAttribute("src", "https://storage.example/source-photo-preview");

    fireEvent.change(within(dialog).getByLabelText("Source fabric 1"), {
      target: { value: reassignedFabric.fabric_id },
    });
    expect(
      within(dialog).getByRole("img", {
        name: "Swatch for Replacement fabric",
      }),
    ).toHaveAttribute("src", "https://storage.example/replacement-swatch.png");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(dependencies.updateVisualMatrixColumn).toHaveBeenCalledWith(
        "admin-token",
        visualColumn.id,
        {
          admin_label: "Front internal",
          public_label: "Front",
          sequence: 1,
          source_original_fabric_id: reassignedFabric.fabric_id,
        },
      );
    });
    expect(dependencies.createUpload).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Edit column 1" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit column 1" }));
    dialog = screen.getByRole("dialog", { name: "Edit column 1" });
    fireEvent.change(within(dialog).getByLabelText("Source fabric 1"), {
      target: { value: "" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose a source fabric before saving this source image.",
    );

    const deleteColumnButton = within(dialog).getByRole("button", {
      name: "Delete column 1",
    });

    expect(deleteColumnButton).not.toHaveTextContent("Delete");
    expect(deleteColumnButton.querySelector(".admin-delete-icon")).not.toBe(
      null,
    );
    fireEvent.click(deleteColumnButton);
    expect(
      screen.getByText(
        "Deleting this column affects all fabrics for this sofa.",
      ),
    ).toBeInTheDocument();

    const confirmDeleteColumnButton = screen.getByRole("button", {
      name: "Confirm delete column 1",
    });

    expect(confirmDeleteColumnButton).not.toHaveTextContent("Confirm delete");
    expect(
      confirmDeleteColumnButton.querySelector(".admin-delete-icon"),
    ).not.toBe(null);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByText(
        "Deleting this column affects all fabrics for this sofa.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows selected source image and fabric previews before saving a view column", async () => {
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => "blob:selected-source-photo"),
      revokeObjectURL: vi.fn(),
    });

    // RU: Эти данные задают две ткани, чтобы окно могло сразу менять картинку ткани.
    // FR: Ces donnees fixent deux tissus pour que la fenetre change vite l'image du tissu.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const firstFabric = {
      ai_reference_asset: null,
      ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
      archived_at: null,
      created_at: "2026-04-28T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000903",
      internal_name: "Original fabric",
      is_premium: false,
      lifecycle_state: "active",
      public_name: "Original fabric",
      swatch_preview_url: "https://storage.example/original-swatch.png",
      swatch_asset: null,
      swatch_asset_id: "00000000-0000-4000-8000-000000000901",
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const secondFabric = {
      ...firstFabric,
      id: "00000000-0000-4000-8000-000000000908",
      internal_name: "Replacement fabric",
      public_name: "Replacement fabric",
      swatch_preview_url: "https://storage.example/replacement-swatch.png",
    };
    const assignments = [firstFabric, secondFabric].map((fabric, index) => ({
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric,
      fabric_id: fabric.id,
      public_order: index + 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    }));

    // RU: Эта колонка еще без фото, чтобы выбранный файл был виден сразу.
    // FR: Cette colonne n'a pas encore de photo, pour voir tout de suite le fichier choisi.
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: null,
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const dependencies = createDependencies({
      listSofaFabrics: vi.fn(async () => assignments),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /View columns/i }));
    fireEvent.click(screen.getByRole("button", { name: "Edit column 1" }));
    const dialog = screen.getByRole("dialog", { name: "Edit column 1" });

    fireEvent.change(within(dialog).getByLabelText("Source fabric 1"), {
      target: { value: secondFabric.id },
    });
    expect(
      within(dialog).getByRole("img", {
        name: "Swatch for Replacement fabric",
      }),
    ).toHaveAttribute("src", secondFabric.swatch_preview_url);

    // RU: Этот файл выбирают в окне, но кнопку Save пока не нажимают.
    // FR: Ce fichier est choisi dans la fenetre, mais le bouton Save n'est pas encore utilise.
    const selectedFile = new File(["source"], "new-source.png", {
      type: "image/png",
    });

    fireEvent.change(within(dialog).getByLabelText("Source photo 1"), {
      target: {
        files: [selectedFile],
      },
    });

    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(selectedFile);
    expect(
      dialog.querySelector(".admin-view-column-source-preview img"),
    ).toHaveAttribute("src", "blob:selected-source-photo");
    expect(within(dialog).getByText("new-source.png")).toBeInTheDocument();
    expect(dependencies.updateVisualMatrixColumn).not.toHaveBeenCalled();
    expect(dependencies.createUpload).not.toHaveBeenCalled();
  });

  it("queues render preparation work from the sofa edit page", async () => {
    const preparedSourcePhoto = new File(["prepared-source"], "source.jpg", {
      type: "image/jpeg",
    });
    vi.mocked(prepareAdminImageUploadFile).mockImplementation(
      async ({ file, purpose }) =>
        purpose === "sofa_source_photo"
          ? {
              file: preparedSourcePhoto,
              message:
                "Image resized from 4096x3072 to 2048x1536 before upload.",
              resized: true,
            }
          : {
              file,
              message: null,
              resized: false,
            },
    );
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
        swatch_preview_url: null,
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
    let resolveColumnUpdate: ((column: typeof visualColumn) => void) | null =
      null;
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
      updateVisualMatrixColumn: vi.fn(
        () =>
          new Promise<typeof visualColumn>((resolve) => {
            resolveColumnUpdate = resolve;
          }),
      ),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /View columns/i }));
    fireEvent.click(screen.getByRole("button", { name: "Edit column 1" }));
    const sourcePhotoDialog = screen.getByRole("dialog", {
      name: "Edit column 1",
    });
    expectCenteredVisualMatrixDialog(sourcePhotoDialog);
    expect(
      within(sourcePhotoDialog).getByRole("button", {
        name: "Close View columns dialog",
      }),
    ).toBeInTheDocument();
    expect(
      within(sourcePhotoDialog).queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Source fabric 1"), {
      target: { value: assignedFabric.fabric_id },
    });
    fireEvent.change(screen.getByLabelText("Source photo 1"), {
      target: {
        files: [new File(["source"], "source.png", { type: "image/png" })],
      },
    });
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveTextContent("Saving");
    expect(sourcePhotoDialog).toHaveAttribute("aria-busy", "true");
    const finishColumnUpdate = resolveColumnUpdate as
      | ((column: typeof visualColumn) => void)
      | null;
    expect(finishColumnUpdate).not.toBeNull();
    if (!finishColumnUpdate) {
      throw new Error("Column update promise was not started.");
    }
    finishColumnUpdate(visualColumn);

    await waitFor(() => {
      expect(dependencies.updateVisualMatrixColumn).toHaveBeenCalledWith(
        "admin-token",
        visualColumn.id,
        {
          admin_label: "Front",
          public_label: "Front",
          sequence: 1,
        },
      );
      expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
        byte_size: preparedSourcePhoto.size,
        content_type: "image/jpeg",
        original_fabric_id: assignedFabric.fabric_id,
        purpose: "sofa_source_photo",
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_column_id: visualColumn.id,
      });
    });
    expect(dependencies.uploadToSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_id: "source-photo-upload",
      }),
      preparedSourcePhoto,
    );
    expect(
      screen.getByText(
        "Image resized from 4096x3072 to 2048x1536 before upload.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Missing/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });
    const generationGroup = within(dialog).getByRole("group", {
      name: "Generate action",
    });
    fireEvent.click(
      within(generationGroup).getByRole("button", {
        name: "Add optional note",
      }),
    );
    expect(
      within(generationGroup).getByText(
        "The standard generation prompt is used automatically. Add this only when you want an extra instruction.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(within(generationGroup).getByLabelText("Optional note"), {
      target: {
        value: "Keep seams visible",
      },
    });
    fireEvent.click(
      within(generationGroup).getByRole("button", { name: "Generate" }),
    );

    await waitFor(() => {
      expect(dependencies.createFabricRenderJob).toHaveBeenCalledWith(
        "admin-token",
        {
          fabric_id: assignedFabric.fabric_id,
          generation_mode: "initial",
          prompt_note: "Keep seams visible",
          sofa_id: assignedFabric.sofa_id,
          visual_matrix_column_id: visualColumn.id,
        },
      );
    });
    expect(dependencies.getFabricRenderJob).not.toHaveBeenCalled();
  });

  it("refreshes publish blockers after manual render upload", async () => {
    // RU: Эти данные описывают диван, у которого публикацию держит только недостающая картинка.
    // FR: Ces donnees decrivent un canape bloque seulement par une image manquante.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricId = "00000000-0000-4000-8000-000000000903";
    const columnId = "00000000-0000-4000-8000-000000000904";
    const cellId = "00000000-0000-4000-8000-000000000906";
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
        id: fabricId,
        internal_name: "Internal fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_preview_url: null,
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
      },
      fabric_id: fabricId,
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: {
        asset: null,
        asset_id: "00000000-0000-4000-8000-000000000905",
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000905",
        original_fabric_id: fabricId,
        preview_url: "https://storage.example/source-photo-preview",
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:00:00.000Z",
        visual_matrix_column_id: columnId,
      },
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: columnId,
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const missingRenderCell = {
      blockers: [],
      can_generate_initial: true,
      candidate_count: 0,
      current_private_asset_id: null,
      current_private_preview_url: null,
      current_public_asset_id: null,
      fabric_id: fabricId,
      has_private_render: false,
      has_public_render: false,
      id: cellId,
      latest_job: null,
      sofa_id: sofaId,
      source_photo_id: visualColumn.current_source_photo_id,
      source_type: "ai_generated",
      updated_at: "2026-04-28T10:00:00.000Z",
      visual_matrix_column_id: columnId,
    };
    const readyRenderCell = {
      ...missingRenderCell,
      current_private_asset_id: "00000000-0000-4000-8000-000000000907",
      current_private_preview_url:
        "https://storage.example/current-render-preview",
      has_private_render: true,
      source_type: "manual_upload",
      updated_at: "2026-04-28T10:40:00.000Z",
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi
        .fn()
        .mockResolvedValueOnce({
          render_cells: [missingRenderCell],
          sofa_fabrics: [assignedFabric],
          sofa_id: sofaId,
          visual_matrix_columns: [visualColumn],
        })
        .mockResolvedValue({
          render_cells: [readyRenderCell],
          sofa_fabrics: [assignedFabric],
          sofa_id: sofaId,
          visual_matrix_columns: [visualColumn],
        }),
      getSofaReadiness: vi
        .fn()
        .mockResolvedValueOnce({
          errors: [
            {
              code: "INCOMPLETE_PUBLIC_RENDER_COVERAGE",
              message: "Public render coverage is incomplete.",
            },
          ],
          ready: false,
        })
        .mockResolvedValue({
          errors: [],
          ready: true,
        }),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));
    expect(
      screen.getByText("Missing public renders"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish sofa" })).toBeDisabled();

    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Missing/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });

    // RU: Этот файл заменяет недостающую картинку в проверке.
    // FR: Ce fichier remplace l'image manquante dans la verification.
    const manualRenderFile = new File(["manual"], "manual.png", {
      type: "image/png",
    });

    fireEvent.change(within(dialog).getByLabelText("Manual render"), {
      target: {
        files: [manualRenderFile],
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload manual render" }),
    );

    await waitFor(() => {
      expect(dependencies.setManualRender).toHaveBeenCalledWith(
        "admin-token",
        cellId,
        {
          asset_id: "00000000-0000-4000-8000-000000000902",
        },
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));

    expect(
      screen.queryByText("Missing public renders"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Publish sofa" }),
      ).toBeEnabled();
    });
  });

  it("refreshes sofa render coverage from fabric render Realtime updates", async () => {
    let onJobChange:
      | ((job: { status: string; sofa_id: string }) => void)
      | null = null;
    const unsubscribe = vi.fn();
    const subscribeToFabricRenderJobs = vi.fn((_sofaId, callback) => {
      onJobChange = callback;

      return unsubscribe;
    });
    const dependencies = createDependencies({
      subscribeToFabricRenderJobs,
    });
    const sofaId = "00000000-0000-4000-8000-000000000701";

    const { unmount } = render(
      <AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    expect(subscribeToFabricRenderJobs).toHaveBeenCalledWith(
      sofaId,
      expect.any(Function),
    );
    const initialCoverageCalls = vi.mocked(dependencies.getRenderCoverage).mock
      .calls.length;

    await act(async () => {
      onJobChange?.({
        sofa_id: sofaId,
        status: "succeeded",
      });
    });

    await waitFor(() => {
      expect(dependencies.getRenderCoverage).toHaveBeenCalledTimes(
        initialCoverageCalls + 1,
      );
    });

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("offers generate-all, retry, and resume actions from render coverage state", async () => {
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: "00000000-0000-4000-8000-000000000705",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const fabricA = {
      ai_reference_asset: null,
      ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
      archived_at: null,
      created_at: "2026-04-28T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000903",
      internal_name: "Failed fabric",
      is_premium: false,
      lifecycle_state: "active",
      public_name: "Failed fabric",
      swatch_preview_url: null,
      swatch_asset: null,
      swatch_asset_id: "00000000-0000-4000-8000-000000000901",
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const fabricB = {
      ...fabricA,
      id: "00000000-0000-4000-8000-000000000913",
      internal_name: "Queued fabric",
      public_name: "Queued fabric",
    };
    const assignments = [fabricA, fabricB].map((fabric, index) => ({
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric,
      fabric_id: fabric.id,
      public_order: index + 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    }));
    const failedJob = {
      attempt_count: 1,
      completed_at: "2026-04-28T10:35:00.000Z",
      created_at: "2026-04-28T10:30:00.000Z",
      fabric_id: fabricA.id,
      generation_mode: "initial",
      id: "00000000-0000-4000-8000-000000000906",
      last_error_message: "Provider timeout",
      max_attempts: 3,
      prompt_note: null,
      queued_at: "2026-04-28T10:30:00.000Z",
      request_id: "00000000-0000-4000-8000-000000000916",
      refinement_source_asset_id: null,
      refine_prompt: null,
      render_cell_id: "00000000-0000-4000-8000-000000000905",
      sofa_id: sofaId,
      status: "failed",
      updated_at: "2026-04-28T10:35:00.000Z",
      visual_matrix_column_id: visualColumn.id,
    };
    const queuedJob = {
      ...failedJob,
      completed_at: null,
      fabric_id: fabricB.id,
      id: "00000000-0000-4000-8000-000000000916",
      last_error_message: null,
      render_cell_id: "00000000-0000-4000-8000-000000000915",
      request_id: "00000000-0000-4000-8000-000000000917",
      status: "queued",
    };
    const dependencies = createDependencies({
      generateFabricRenderJobsForSofa: vi.fn(async () => ({
        fabric_render_jobs: [],
        job_ids: ["00000000-0000-4000-8000-000000000918"],
        request_id: "00000000-0000-4000-8000-000000000919",
        status: "queued" as const,
        total_jobs: 1,
      })),
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          {
            blockers: [],
            can_generate_initial: true,
            candidate_count: 0,
            current_private_asset_id: null,
            current_public_asset_id: null,
            fabric_id: fabricA.id,
            has_private_render: false,
            has_public_render: false,
            id: failedJob.render_cell_id,
            latest_job: failedJob,
            sofa_id: sofaId,
            source_photo_id: visualColumn.current_source_photo_id,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
          {
            blockers: ["ACTIVE_RENDER_JOB_EXISTS"],
            can_generate_initial: false,
            candidate_count: 0,
            current_private_asset_id: null,
            current_public_asset_id: null,
            fabric_id: fabricB.id,
            has_private_render: false,
            has_public_render: false,
            id: queuedJob.render_cell_id,
            latest_job: queuedJob,
            sofa_id: sofaId,
            source_photo_id: visualColumn.current_source_photo_id,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: assignments,
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listFabrics: vi.fn(async () => [fabricA, fabricB]),
      listSofaFabrics: vi.fn(async () => assignments),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));

    fireEvent.click(screen.getByRole("button", { name: "Generate missing" }));
    await waitFor(() => {
      expect(dependencies.generateFabricRenderJobsForSofa).toHaveBeenCalledWith(
        "admin-token",
        sofaId,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Resume queued jobs" }));
    await waitFor(() => {
      expect(dependencies.resumeFabricRenderJobs).toHaveBeenCalledWith(
        "admin-token",
        {
          request_id: null,
          sofa_id: sofaId,
        },
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Failed fabric, Front: Failed/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });
    expect(within(dialog).getByText("Provider timeout")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Retry generation" }),
    );
    await waitFor(() => {
      expect(dependencies.retryFabricRenderJob).toHaveBeenCalledWith(
        "admin-token",
        failedJob.id,
      );
    });
  });

  it("opens generated candidate review directly and attaches a manual render from coverage", async () => {
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
        swatch_preview_url: null,
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
    const selectedRenderCell = {
      ...renderCell,
      current_private_asset_id: "00000000-0000-4000-8000-000000000907",
      has_private_render: true,
      updated_at: "2026-04-28T10:40:00.000Z",
    };
    let candidateSelected = false;
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [candidateSelected ? selectedRenderCell : renderCell],
        sofa_fabrics: [assignedFabric],
        sofa_id: assignedFabric.sofa_id,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
      useRenderCandidate: vi.fn(async (_accessToken, candidateId) => {
        candidateSelected = true;

        return {
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
          fabric_id: assignedFabric.fabric_id,
          generation_mode: "initial",
          id: candidateId,
          is_current: true,
          job_id: "00000000-0000-4000-8000-000000000906",
          preview_url: "https://storage.example/candidate-preview",
          prompt_version: "v007",
          provider_model: "mock-fabric-render-v1",
          provider_name: "mock",
          render_cell_id: renderCell.id,
          sofa_id: assignedFabric.sofa_id,
          visual_matrix_column_id: visualColumn.id,
        };
      }),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Candidate/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });

    await waitFor(() => {
      expect(dependencies.listRenderCellCandidates).toHaveBeenCalledWith(
        "admin-token",
        renderCell.id,
      );
    });
    await within(dialog).findByAltText(
      "Candidate preview 00000000-0000-4000-8000-000000000908",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Review candidates" }),
    ).not.toBeInTheDocument();
    const candidateCard = within(dialog).getByRole("article", {
      name: /Candidate 00000000-0000-4000-8000-000000000908/i,
    });
    expect(
      within(candidateCard).getByText("initial - v007"),
    ).toBeInTheDocument();
    expect(
      within(candidateCard).getAllByText("Candidate").length,
    ).toBeGreaterThan(0);
    expect(
      within(candidateCard).getByRole("button", { name: "Use candidate" }),
    ).toBeInTheDocument();
    expect(
      within(candidateCard).getByRole("button", { name: "Refine candidate" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("group", {
        name: "Candidate follow-up actions",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText("Refine prompt"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(candidateCard).getByRole("button", { name: "Refine candidate" }),
    );
    expect(within(dialog).getByLabelText("Refine prompt")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cancel refine" }),
    );
    expect(
      within(dialog).queryByLabelText("Refine prompt"),
    ).not.toBeInTheDocument();
    expect(dependencies.createFabricRenderJob).not.toHaveBeenCalled();

    fireEvent.click(
      within(candidateCard).getByRole("button", { name: "Refine candidate" }),
    );
    fireEvent.change(within(dialog).getByLabelText("Refine prompt"), {
      target: {
        value: "Reduce wrinkles on the left arm",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Refine" }));

    await waitFor(() => {
      expect(dependencies.createFabricRenderJob).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          fabric_id: assignedFabric.fabric_id,
          generation_mode: "refine",
          prompt_note: null,
          refine_prompt: "Reduce wrinkles on the left arm",
          refinement_source_asset_id: "00000000-0000-4000-8000-000000000907",
          sofa_id: assignedFabric.sofa_id,
          visual_matrix_column_id: visualColumn.id,
        }),
      );
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Use candidate" }),
    );

    await waitFor(() => {
      expect(dependencies.useRenderCandidate).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000908",
      );
    });
    expect(
      within(dialog).queryByAltText(
        "Candidate preview 00000000-0000-4000-8000-000000000908",
      ),
    ).not.toBeInTheDocument();
    expect(await within(dialog).findByText("Ready")).toBeInTheDocument();

    const readyDialog = screen.getByRole("dialog", { name: /Render cell/i });
    fireEvent.change(within(readyDialog).getByLabelText("Manual render"), {
      target: {
        files: [new File(["manual"], "manual.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      within(readyDialog).getByRole("button", {
        name: "Upload manual render",
      }),
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

  it("keeps existing candidates after manual render upload without a page refresh", async () => {
    // RU: Эти данные описывают диван, ткань и открытую позицию с готовым вариантом.
    // FR: Ces donnees decrivent un canape, un tissu et une position avec une option prete.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricId = "00000000-0000-4000-8000-000000000903";
    const columnId = "00000000-0000-4000-8000-000000000904";
    const cellId = "00000000-0000-4000-8000-000000000906";
    const candidateAssetId = "00000000-0000-4000-8000-000000000907";
    const candidateId = "00000000-0000-4000-8000-000000000908";
    const manualAssetId = "00000000-0000-4000-8000-000000000909";
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
        id: fabricId,
        internal_name: "Internal fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_preview_url: null,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: fabricId,
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: {
        asset: null,
        asset_id: "00000000-0000-4000-8000-000000000905",
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000905",
        original_fabric_id: fabricId,
        preview_url: "https://storage.example/source-photo-preview",
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:00:00.000Z",
        visual_matrix_column_id: columnId,
      },
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: columnId,
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const candidateCell = {
      blockers: [],
      can_generate_initial: true,
      candidate_count: 1,
      current_private_asset_id: null,
      current_private_preview_url: null,
      current_public_asset_id: null,
      fabric_id: fabricId,
      has_private_render: false,
      has_public_render: false,
      id: cellId,
      latest_job: null,
      sofa_id: sofaId,
      source_photo_id: visualColumn.current_source_photo_id,
      source_type: "ai_generated",
      updated_at: "2026-04-28T10:00:00.000Z",
      visual_matrix_column_id: columnId,
    };
    const manualCellFromUpload = {
      ...candidateCell,
      can_generate_initial: false,
      candidate_count: 0,
      current_private_asset_id: manualAssetId,
      current_private_preview_url:
        "https://storage.example/manual-render-preview",
      has_private_render: true,
      source_type: "manual_upload",
      updated_at: "2026-04-28T10:45:00.000Z",
    };
    const refreshedManualCell = {
      ...manualCellFromUpload,
      can_generate_initial: true,
      candidate_count: 1,
    };
    const candidate = {
      accepted_at: null,
      asset: {
        asset_kind: "fabric_render_candidate",
        byte_size: 2400,
        content_type: "image/png",
        height_px: 1200,
        id: candidateAssetId,
        lifecycle_state: "active",
        visibility: "private",
        width_px: 1600,
      },
      asset_id: candidateAssetId,
      created_at: "2026-04-28T10:35:00.000Z",
      fabric_id: fabricId,
      generation_mode: "initial",
      id: candidateId,
      is_current: false,
      job_id: "00000000-0000-4000-8000-000000000910",
      preview_url: "https://storage.example/candidate-preview",
      prompt_version: "v007",
      provider_model: "mock-fabric-render-v1",
      provider_name: "mock",
      render_cell_id: cellId,
      sofa_id: sofaId,
      visual_matrix_column_id: columnId,
    };
    let manualUploadCompleted = false;
    const dependencies = createDependencies({
      completeUpload: vi.fn(async () => ({
        asset_kind: "manual_render",
        byte_size: 1900,
        content_type: "image/png",
        height_px: 1200,
        id: manualAssetId,
        lifecycle_state: "active",
        visibility: "private",
        width_px: 1600,
      })),
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          manualUploadCompleted ? refreshedManualCell : candidateCell,
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listRenderCellCandidates: vi.fn(async () => [candidate]),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
      setManualRender: vi.fn(async () => {
        manualUploadCompleted = true;

        return manualCellFromUpload;
      }),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Candidate/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });

    await within(dialog).findByAltText(`Candidate preview ${candidateId}`);
    fireEvent.change(within(dialog).getByLabelText("Manual render"), {
      target: {
        files: [new File(["manual"], "manual.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload manual render" }),
    );

    await waitFor(() => {
      expect(dependencies.setManualRender).toHaveBeenCalledWith(
        "admin-token",
        cellId,
        {
          asset_id: manualAssetId,
        },
      );
    });
    await within(dialog).findByText("Ready");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close render cell" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Render cell/i }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Ready/i }),
    );
    const reopenedDialog = screen.getByRole("dialog", {
      name: /Render cell/i,
    });

    expect(
      within(reopenedDialog).getByRole("button", {
        name: "Review candidates",
      }),
    ).toBeInTheDocument();
    expect(
      within(reopenedDialog).getByRole("button", {
        name: "Generate new candidate",
      }),
    ).toBeInTheDocument();
  });

  it("compares a generated candidate with the source photo in a separate dialog", async () => {
    // RU: Эти значения описывают ячейку с исходным фото, текущей картинкой и новыми вариантами.
    // FR: Ces valeurs decrivent une case avec la photo source, l'image actuelle et de nouvelles options.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricId = "00000000-0000-4000-8000-000000000903";
    const visualColumn = {
      admin_label: "Front",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: {
        asset: null,
        asset_id: "00000000-0000-4000-8000-000000000911",
        created_at: "2026-04-28T10:05:00.000Z",
        id: "00000000-0000-4000-8000-000000000905",
        original_fabric_id: fabricId,
        preview_url: "https://storage.example/source-photo-preview",
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:05:00.000Z",
        visual_matrix_column_id: "00000000-0000-4000-8000-000000000904",
      },
      current_source_photo_id: "00000000-0000-4000-8000-000000000905",
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: null,
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: fabricId,
        internal_name: "Internal fabric",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_preview_url: null,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: fabricId,
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const renderCell = {
      blockers: [],
      can_generate_initial: true,
      candidate_count: 2,
      current_private_asset_id: "00000000-0000-4000-8000-000000000907",
      current_private_preview_url:
        "https://storage.example/current-render-preview",
      current_public_asset_id: null,
      fabric_id: fabricId,
      has_private_render: true,
      has_public_render: false,
      id: "00000000-0000-4000-8000-000000000906",
      latest_job: null,
      sofa_id: sofaId,
      source_photo_id: visualColumn.current_source_photo_id,
      source_type: "ai_generated",
      updated_at: "2026-04-28T10:40:00.000Z",
      visual_matrix_column_id: visualColumn.id,
    };
    const currentCandidate = {
      accepted_at: "2026-04-28T10:40:00.000Z",
      asset: null,
      asset_id: renderCell.current_private_asset_id,
      created_at: "2026-04-28T10:35:00.000Z",
      fabric_id: fabricId,
      generation_mode: "initial",
      id: "00000000-0000-4000-8000-000000000908",
      is_current: true,
      job_id: "00000000-0000-4000-8000-000000000910",
      preview_url: "https://storage.example/current-render-preview",
      prompt_version: "v007",
      provider_model: "mock-fabric-render-v1",
      provider_name: "mock",
      render_cell_id: renderCell.id,
      sofa_id: sofaId,
      visual_matrix_column_id: visualColumn.id,
    };
    const newCandidate = {
      ...currentCandidate,
      accepted_at: null,
      asset_id: "00000000-0000-4000-8000-000000000909",
      id: "00000000-0000-4000-8000-000000000909",
      is_current: false,
      preview_url: "https://storage.example/new-candidate-preview",
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [renderCell],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listRenderCellCandidates: vi.fn(async () => [
        currentCandidate,
        newCandidate,
      ]),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front: Ready/i }),
    );
    const cellDialog = screen.getByRole("dialog", { name: /Render cell/i });
    expect(
      within(cellDialog).getByRole("button", { name: "Close render cell" }),
    ).toBeInTheDocument();
    expect(
      within(cellDialog).queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        renderCell.current_private_asset_id,
      );
    });
    // RU: Эта картинка нужна, чтобы проверить открытие большого просмотра по клику.
    // FR: Cette image sert a verifier l'ouverture du grand apercu au clic.
    const currentRenderPreview = await within(cellDialog).findByRole("img", {
      name: "Current render preview",
    });
    expect(currentRenderPreview).toHaveAttribute(
      "src",
      `blob:admin-preview/${renderCell.current_private_asset_id}`,
    );

    fireEvent.click(currentRenderPreview);
    const currentImageDialog = screen.getByRole("dialog", {
      name: /Large image: Current render/i,
    });
    expect(
      within(currentImageDialog).getByRole("img", {
        name: "Current render preview",
      }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${renderCell.current_private_asset_id}`,
    );
    fireEvent.click(
      within(currentImageDialog).getByRole("button", {
        name: "Close large image",
      }),
    );

    fireEvent.click(
      within(cellDialog).getByRole("button", { name: "View current render" }),
    );
    const currentRenderDialog = screen.getByRole("dialog", {
      name: /Current render/i,
    });
    expect(
      within(currentRenderDialog).getByRole("button", {
        name: "Close current render",
      }),
    ).toBeInTheDocument();
    expect(
      within(currentRenderDialog).queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(currentRenderDialog).getByRole("button", {
        name: "Generate new candidate",
      }),
    );

    await waitFor(() => {
      expect(dependencies.createFabricRenderJob).toHaveBeenNthCalledWith(
        1,
        "admin-token",
        expect.objectContaining({
          fabric_id: fabricId,
          generation_mode: "initial",
          prompt_note: null,
          sofa_id: sofaId,
          visual_matrix_column_id: visualColumn.id,
        }),
      );
    });

    fireEvent.click(
      within(cellDialog).getByRole("button", { name: "Review candidates" }),
    );

    expect(
      await within(cellDialog).findByAltText(
        "Candidate preview 00000000-0000-4000-8000-000000000909",
      ),
    ).toBeInTheDocument();
    const candidateGenerationGroup = within(cellDialog).getByRole("group", {
      name: "Generate action",
    });
    expect(
      within(candidateGenerationGroup).queryByLabelText("Optional note"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(candidateGenerationGroup).getByRole("button", {
        name: "Add optional note",
      }),
    );
    fireEvent.change(
      within(candidateGenerationGroup).getByLabelText("Optional note"),
      {
        target: {
          value: "Make the fabric a little smoother",
        },
      },
    );
    fireEvent.click(
      within(candidateGenerationGroup).getByRole("button", {
        name: "Generate new candidate",
      }),
    );

    await waitFor(() => {
      expect(dependencies.createFabricRenderJob).toHaveBeenNthCalledWith(
        2,
        "admin-token",
        expect.objectContaining({
          fabric_id: fabricId,
          generation_mode: "initial",
          prompt_note: "Make the fabric a little smoother",
          sofa_id: sofaId,
          visual_matrix_column_id: visualColumn.id,
        }),
      );
    });

    // RU: Эта картинка нужна, чтобы проверить сравнение текущего варианта по клику.
    // FR: Cette image sert a verifier la comparaison de l'option actuelle au clic.
    const currentCandidatePreview = within(cellDialog).getByRole("img", {
      name: "Candidate preview 00000000-0000-4000-8000-000000000908",
    });

    fireEvent.click(currentCandidatePreview);
    const currentCandidateCompareDialog = screen.getByRole("dialog", {
      name: /Compare render candidate 00000000-0000-4000-8000-000000000908/i,
    });
    expect(
      within(currentCandidateCompareDialog).getByRole("button", {
        name: "Use candidate",
      }),
    ).toBeDisabled();
    fireEvent.click(
      within(currentCandidateCompareDialog).getByRole("button", {
        name: "Close comparison",
      }),
    );

    expect(
      within(cellDialog).queryByRole("button", {
        name: "Compare candidate 00000000-0000-4000-8000-000000000909",
      }),
    ).not.toBeInTheDocument();

    // RU: Эта картинка нужна, чтобы проверить сравнение нового варианта по клику.
    // FR: Cette image sert a verifier la comparaison de la nouvelle option au clic.
    const candidatePreview = within(cellDialog).getByRole("img", {
      name: "Candidate preview 00000000-0000-4000-8000-000000000909",
    });

    fireEvent.click(candidatePreview);
    const compareDialog = screen.getByRole("dialog", {
      name: /Compare render candidate/i,
    });

    expect(
      within(compareDialog).getByRole("img", {
        name: "Source photo preview",
      }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${visualColumn.current_source_photo.asset_id}`,
    );
    expect(
      within(compareDialog).getByRole("img", {
        name: "Candidate preview 00000000-0000-4000-8000-000000000909",
      }),
    ).toHaveAttribute("src", `blob:admin-preview/${newCandidate.asset_id}`);

    fireEvent.click(
      within(compareDialog).getByRole("img", {
        name: "Candidate preview 00000000-0000-4000-8000-000000000909",
      }),
    );
    const candidateImageDialog = screen.getByRole("dialog", {
      name: /Large image: Candidate/i,
    });
    expect(
      within(candidateImageDialog).getByRole("img", {
        name: "Candidate preview 00000000-0000-4000-8000-000000000909",
      }),
    ).toHaveAttribute("src", `blob:admin-preview/${newCandidate.asset_id}`);
    fireEvent.click(
      within(candidateImageDialog).getByRole("button", {
        name: "Close large image",
      }),
    );

    fireEvent.click(
      within(compareDialog).getByRole("button", { name: "Use candidate" }),
    );

    await waitFor(() => {
      expect(dependencies.useRenderCandidate).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000909",
      );
    });
  });

  it("links blocked render cells to the View columns tab", async () => {
    // RU: Эти значения описывают заблокированную ячейку для перехода к фото позиции.
    // FR: Ces valeurs decrivent une case bloquee pour aller vers la photo de position.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: null,
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000922",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000923",
        internal_name: "Linen Clay internal",
        is_premium: false,
        lifecycle_state: "active",
        public_name: "Linen Clay",
        swatch_preview_url: null,
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000921",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000923",
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const visualColumn = {
      admin_label: "arm_detail",
      created_at: "2026-04-28T10:00:00.000Z",
      current_source_photo: null,
      current_source_photo_id: null,
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000924",
      public_label: "Arm detail",
      sequence: 2,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [
          {
            blockers: ["SOURCE_PHOTO_MISSING"],
            can_generate_initial: false,
            candidate_count: 0,
            current_private_asset_id: null,
            current_public_asset_id: null,
            fabric_id: assignedFabric.fabric_id,
            has_private_render: false,
            has_public_render: false,
            id: "00000000-0000-4000-8000-000000000925",
            latest_job: null,
            sofa_id: sofaId,
            source_photo_id: null,
            source_type: "ai_generated",
            updated_at: "2026-04-28T10:00:00.000Z",
            visual_matrix_column_id: visualColumn.id,
          },
        ],
        sofa_fabrics: [assignedFabric],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Linen Clay, Arm detail: Blocked/i,
      }),
    );
    const dialog = screen.getByRole("dialog", { name: /Render cell/i });

    expect(within(dialog).getByText("Render blocked")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Complete the missing render input first."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Source photo missing")).toBeInTheDocument();
    expect(
      within(dialog).queryByText("MISSING_SOURCE_PHOTO"),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByText("No source yet")).toBeInTheDocument();
    expect(within(dialog).queryByText("AI generated")).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Go to View columns" }),
    );

    expect(
      screen.getByRole("tabpanel", { name: /View columns/i }),
    ).toBeInTheDocument();
  });

  it("publishes and unpublishes the sofa from the publication section", async () => {
    const dependencies = createDependencies({
      getSofaReadiness: vi
        .fn()
        .mockResolvedValueOnce({
          errors: [],
          ready: true,
        })
        .mockResolvedValue({
          errors: [],
          ready: true,
        }),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));
    expect(
      screen.queryByRole("button", { name: "Unpublish sofa" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish sofa" }));

    await waitFor(() => {
      expect(dependencies.publishSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    });
    expect(
      screen.queryByRole("button", { name: "Publish sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unpublish sofa" }));

    await waitFor(() => {
      expect(dependencies.unpublishSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    });
  });

  it("requests a sofa render ZIP export from the Renders tab", async () => {
    const dependencies = createDependencies();

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));
    expect(
      screen.queryByRole("button", { name: "Create ZIP export" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create ZIP export" }));

    await waitFor(() => {
      expect(dependencies.createSofaRenderExport).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
      );
    });
    await waitFor(() => {
      expect(dependencies.getSofaRenderExport).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000980",
      );
    });

    const downloadLink = await screen.findByRole("link", {
      name: "Download ZIP export",
    });
    expect(downloadLink).toHaveAttribute(
      "href",
      "https://storage.example/signed/render-export.zip",
    );
    expect(screen.getByText("2 renders included.")).toBeInTheDocument();
  });

  it("shows publish blockers with target tab actions", async () => {
    const dependencies = createDependencies({
      getSofaReadiness: vi.fn(async () => ({
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
      })),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    expect(
      screen.queryByRole("button", { name: "Publish sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));

    expect(screen.getByText("No public fabric yet")).toBeInTheDocument();
    expect(screen.getByText("Missing public renders")).toBeInTheDocument();
    expect(screen.queryByText("MISSING_PUBLIC_FABRIC")).not.toBeInTheDocument();
    expect(
      screen.queryByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to Fabric lines" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to Renders" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to Fabric lines" }));

    expect(
      screen.getByRole("tabpanel", { name: /Fabric lines/i }),
    ).toBeInTheDocument();
  });

  it("default API dependencies call only first-party admin facade routes", async () => {
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const fabricId = "00000000-0000-4000-8000-000000000903";
    const tagId = "00000000-0000-4000-8000-000000000801";
    const renderCellId = "00000000-0000-4000-8000-000000000905";
    const candidateId = "00000000-0000-4000-8000-000000000908";
    const assetId = "00000000-0000-4000-8000-000000000907";
    const exportId = "00000000-0000-4000-8000-000000000980";
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => "blob:admin-preview"),
      revokeObjectURL: vi.fn(),
    });
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

        if (
          requestUrl.endsWith(`/api/admin/storage-assets/${assetId}/preview`)
        ) {
          return new Response(new Blob(["preview"], { type: "image/png" }), {
            headers: {
              "Content-Type": "image/png",
            },
            status: 200,
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

        if (requestUrl.endsWith(`/api/admin/sofas/${sofaId}/render-exports`)) {
          return jsonResponse({
            data: {
              render_export: {
                id: exportId,
                included_render_count: 2,
                status: "succeeded",
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith(`/api/admin/render-exports/${exportId}`)) {
          return jsonResponse({
            data: {
              render_export: {
                download_url:
                  "https://storage.example/signed/render-export.zip",
                id: exportId,
                included_render_count: 2,
                status: "succeeded",
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
    await dependencies.publishSofa("admin-token", sofaId);
    await dependencies.unpublishSofa("admin-token", sofaId);
    await dependencies.createSofaRenderExport("admin-token", sofaId);
    await dependencies.getSofaRenderExport("admin-token", exportId);
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
    await dependencies.createStorageAssetPreviewUrl("admin-token", assetId);

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));

    expect(calledUrls).toEqual([
      "/api/admin/sofas",
      "/api/admin/sofas",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/publication-readiness",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/publish",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/unpublish",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/render-exports",
      "/api/admin/render-exports/00000000-0000-4000-8000-000000000980",
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
      "/api/admin/storage-assets/00000000-0000-4000-8000-000000000907/preview",
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
