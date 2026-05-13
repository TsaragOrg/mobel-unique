/*
RU: Этот файл проверяет страницы админского каталога.
RU: Во время проверки показаны формы, списки, фильтры, кнопки загрузки, подготовка картинок, публикация и архив дивана.
RU: Проверки помогают убедиться, что админ может фильтровать списки, запускать генерацию, выбирать картинку, публиковать, снимать публикацию, архивировать и возвращать из архива.
FR: Ce fichier verifie les pages du catalogue admin.
FR: Pendant les tests, on voit les formulaires, listes, filtres, boutons d'envoi, preparation d'images, publication et archive du canape.
FR: Les tests aident a verifier que l'admin peut filtrer les listes, lancer la generation, choisir l'image, publier, retirer la publication, archiver et remettre depuis l'archive.
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
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// RU: Эта проверка нужна тестам, чтобы правая кнопка правки в строке колонок вида оставалась текстовой.
// FR: Cette verification aide les tests a confirmer que le bouton de modification a droite dans la ligne des colonnes reste avec du texte.
function expectVisualMatrixRowActions(button: HTMLElement) {
  const actions = button.closest(".admin-visual-matrix-actions");

  expect(actions).not.toBeNull();
  expect(actions).toHaveClass("admin-visual-matrix-action-bar");
  for (const actionButton of within(actions as HTMLElement).getAllByRole(
    "button",
  )) {
    expect(actionButton).toHaveClass("admin-visual-matrix-action-button");
    expect(actionButton).not.toHaveClass("admin-icon-button");
    expect(actionButton).toHaveTextContent("Modifier");
    expect(actionButton.querySelector(".admin-edit-icon")).toBe(null);
  }
}

// RU: Эта проверка держит точку готовности рядом с номером шага.
// FR: Cette verification garde le point de preparation pres du numero.
function expectSofaEditTabDotBesideNumber(tab: HTMLElement, number: string) {
  const tabMeta = tab.querySelector(".admin-sofa-edit-tab-meta");

  expect(tabMeta).not.toBeNull();
  expect(tabMeta).toHaveTextContent(number);
  expect(
    (tabMeta as HTMLElement).querySelector(".admin-readiness-dot"),
  ).toBeInTheDocument();
}

// RU: Эта проверка нужна тестам, чтобы кнопка закрытия была маленькой и без слова Close.
// FR: Cette verification aide les tests a confirmer que le bouton de fermeture reste petit et sans le mot Close.
function expectCloseIconButton(button: HTMLElement) {
  expect(button).toHaveClass("admin-icon-button");
  expect(button).not.toHaveTextContent("Close");
  expect(button.querySelector(".admin-close-icon")).not.toBe(null);
}

// RU: Эта проверка нужна тестам, чтобы переход между вариантами был маленькой стрелкой.
// FR: Cette verification aide les tests a confirmer que le passage entre les options reste une petite fleche.
function expectCandidateArrowButton(
  button: HTMLElement,
  direction: "previous" | "next",
) {
  expect(button).toHaveClass("admin-icon-button");
  expect(button).not.toHaveTextContent(
    direction === "previous" ? "Variante précédente" : "Variante suivante",
  );
  expect(button.querySelector(`.admin-arrow-icon-${direction}`)).not.toBe(null);
}

function openManualRenderUpload(dialog: HTMLElement) {
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Remplacer manuellement" }),
  );

  return within(dialog).getByLabelText("Rendu manuel");
}

// RU: Эта проверка нужна тестам, чтобы у окна была верхняя кнопка закрытия, как в картинках.
// FR: Cette verification aide les tests a confirmer que la fenetre a le bouton fermer en haut, comme dans les images.
function closeCenteredVisualMatrixDialog(dialog: HTMLElement) {
  const closeButton = within(dialog).getByRole("button", {
    name: "Fermer la fenêtre des colonnes",
  });

  expect(closeButton).toHaveClass(
    "admin-quiet-button",
    "admin-render-cell-close-button",
  );
  expectCloseIconButton(closeButton);
  expect(
    within(dialog).queryByRole("button", { name: "Annuler" }),
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
    archiveSofa: vi.fn(async (_accessToken, sofaId) => ({
      archived_at: "2026-04-28T10:55:00.000Z",
      created_at: "2026-04-28T10:00:00.000Z",
      depth_cm: 95,
      footprint_measurements: null,
      footprint_type: null,
      height_cm: 82,
      id: sofaId,
      internal_name: "Manual test sofa",
      lifecycle_state: "archived",
      manual_public_order: null,
      public_description: "Manual copy",
      public_name: "Canape test",
      public_slug: "canape-test",
      shopify_order_url: "https://example.com/products/manual-test",
      tags: [],
      updated_at: "2026-04-28T10:55:00.000Z",
      length_cm: 220,
    })),
    unarchiveSofa: vi.fn(async (_accessToken, sofaId) => ({
      archived_at: null,
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
      updated_at: "2026-04-28T11:05:00.000Z",
      length_cm: 220,
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
      archived_at: null,
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
      async (_accessToken, assetId, _variant = "original") =>
        `blob:admin-preview/${assetId}`,
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
      archived_at: null,
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
      archived_at: null,
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
      archived_at: null,
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
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        depth_cm: null,
        footprint_measurements: null,
        footprint_type: null,
        height_cm: null,
        id: "00000000-0000-4000-8000-000000000701",
        internal_name: "Manual test sofa",
        lifecycle_state: "draft",
        manual_public_order: null,
        price_cents: 129900,
        price_currency: "EUR",
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
      archived_at: null,
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
  it("sends public and private signed upload cache times from the upload record", async () => {
    // RU: Эта проверка смотрит, какое время кеша уходит вместе с файлом.
    // FR: Cette verification regarde quel temps de cache part avec le fichier.
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // RU: Эти данные имитируют две ссылки: открытую картинку ткани и закрытую картинку для админа.
    // FR: Ces donnees imitent deux liens: une image de tissu publique et une image privee pour l'admin.
    const dependencies = createDefaultAdminCatalogDependencies(vi.fn(), vi.fn());
    const publicUpload = {
      cache_control_seconds: "31536000",
      expires_at: "2026-04-28T12:00:00.000Z",
      method: "signed_upload" as const,
      signed_upload_url: "https://storage.example/public-swatch",
      upload_id: "public-swatch-upload",
    };
    const privateUpload = {
      cache_control_seconds: "3600",
      expires_at: "2026-04-28T12:00:00.000Z",
      method: "signed_upload" as const,
      signed_upload_url: "https://storage.example/private-reference",
      upload_id: "private-reference-upload",
    };

    await dependencies.uploadToSignedUrl(
      publicUpload,
      new File(["swatch"], "swatch.png", { type: "image/png" }),
    );
    await dependencies.uploadToSignedUrl(
      privateUpload,
      new File(["reference"], "reference.png", { type: "image/png" }),
    );

    // RU: Эти формы дают проверить число, которое браузер отправил в Storage.
    // FR: Ces formulaires permettent de verifier le nombre envoye a Storage par le navigateur.
    const publicBody = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const privateBody = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(publicBody.get("cacheControl")).toBe("31536000");
    expect(privateBody.get("cacheControl")).toBe("3600");
  });

  it("redirects anonymous visitors away from catalog pages", async () => {
    const dependencies = createDependencies({
      getAccessToken: vi.fn(async () => null),
    });

    render(<AdminSofasPage dependencies={dependencies} />);

    await waitFor(() => {
      expect(dependencies.redirect).toHaveBeenCalledWith("/admin/login");
    });
    expect(
      screen.queryByRole("heading", { name: "Canapés" }),
    ).not.toBeInTheDocument();
  });

  it("loads sofas through the first-party admin facade abstraction", async () => {
    const dependencies = createDependencies();

    render(<AdminSofasPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Canapés" });
    expect(screen.getByText("MOBEL UNIQUE")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", {
        name: "Administration",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nouveau canapé" }),
    ).toHaveAttribute("href", "/admin/sofas/new");
    expect(await screen.findByText("Manual test sofa")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Photo source pour Canape test" }),
    ).toHaveAttribute("src", "https://storage.example/source-sofa-preview");
    expect(
      within(
        screen.getByRole("link", { name: "Ouvrir Canape test" }),
      ).getByText("Brouillon"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Shopify missing")).not.toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
    expect(screen.queryByText("Dimensions")).not.toBeInTheDocument();
    expect(screen.getByText("1 photo source")).toBeInTheDocument();
    expect(screen.getByText("1 299 €")).toBeInTheDocument();
    expect(dependencies.listSofas).toHaveBeenCalledWith("admin-token");
  });

  it("loads sofa list source previews through the small protected preview", async () => {
    // RU: Эти данные дают дивану закрытое фото и старую временную ссылку.
    // FR: Ces donnees donnent au canape une photo privee et un ancien lien temporaire.
    const sourcePhotoAssetId = "00000000-0000-4000-8000-000000000904";
    const dependencies = createDependencies({
      createStorageAssetPreviewUrl: vi.fn(
        async (_accessToken, assetId, variant = "original") =>
          `blob:admin-preview/${assetId}/${variant}`,
      ),
      listSofas: vi.fn(async () => [
        {
          archived_at: null,
          created_at: "2026-04-28T10:00:00.000Z",
          depth_cm: null,
          footprint_measurements: null,
          footprint_type: null,
          height_cm: null,
          id: "00000000-0000-4000-8000-000000000701",
          internal_name: "Manual test sofa",
          lifecycle_state: "draft",
          manual_public_order: null,
          price_cents: 129900,
          price_currency: "EUR",
          public_description: null,
          public_name: "Canape test",
          public_slug: null,
          shopify_order_url: null,
          source_photo_count: 1,
          source_photo_preview_asset_id: sourcePhotoAssetId,
          source_photo_preview_url:
            "https://storage.example/original-source-photo",
          tags: [],
          updated_at: "2026-04-28T10:00:00.000Z",
          length_cm: null,
        },
      ]),
    });

    render(<AdminSofasPage dependencies={dependencies} />);

    expect(
      await screen.findByRole("img", { name: "Photo source pour Canape test" }),
    ).toHaveAttribute("src", `blob:admin-preview/${sourcePhotoAssetId}/small`);
    expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
      "admin-token",
      sourcePhotoAssetId,
      "small",
    );
  });

  it("hides archived sofas until the archive list toggle is enabled", async () => {
    const dependencies = createDependencies({
      listSofas: vi.fn(async () => [
        {
          archived_at: null,
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
          source_photo_preview_url:
            "https://storage.example/source-sofa-preview",
          tags: [],
          updated_at: "2026-04-28T10:00:00.000Z",
          length_cm: null,
        },
        {
          archived_at: "2026-04-28T10:55:00.000Z",
          created_at: "2026-04-28T09:00:00.000Z",
          depth_cm: null,
          footprint_measurements: null,
          footprint_type: null,
          height_cm: null,
          id: "00000000-0000-4000-8000-000000000702",
          internal_name: "Old internal sofa",
          lifecycle_state: "archived",
          manual_public_order: null,
          public_description: null,
          public_name: "Archived sofa",
          public_slug: "archived-sofa",
          shopify_order_url: null,
          source_photo_count: 0,
          source_photo_preview_url: null,
          tags: [],
          updated_at: "2026-04-28T10:55:00.000Z",
          length_cm: null,
        },
      ]),
    });

    render(<AdminSofasPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Canapés" });
    expect(
      await screen.findByRole("link", { name: "Ouvrir Canape test" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ouvrir Archived sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(
      screen.getByRole("link", { name: "Ouvrir Archived sofa" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("link", { name: "Ouvrir Archived sofa" }),
      ).getByText("Archivé"),
    ).toBeInTheDocument();
  });

  it("filters the sofa list by lifecycle status above the list", async () => {
    const dependencies = createDependencies({
      listSofas: vi.fn(async () => [
        {
          archived_at: null,
          created_at: "2026-04-28T10:00:00.000Z",
          depth_cm: null,
          footprint_measurements: null,
          footprint_type: null,
          height_cm: null,
          id: "00000000-0000-4000-8000-000000000701",
          internal_name: "Draft internal sofa",
          lifecycle_state: "draft",
          manual_public_order: null,
          public_description: null,
          public_name: "Draft sofa",
          public_slug: null,
          shopify_order_url: null,
          source_photo_count: 1,
          source_photo_preview_url:
            "https://storage.example/source-sofa-preview",
          tags: [],
          updated_at: "2026-04-28T10:00:00.000Z",
          length_cm: null,
        },
        {
          archived_at: null,
          created_at: "2026-04-28T09:30:00.000Z",
          depth_cm: null,
          footprint_measurements: null,
          footprint_type: null,
          height_cm: null,
          id: "00000000-0000-4000-8000-000000000702",
          internal_name: "Published internal sofa",
          lifecycle_state: "published",
          manual_public_order: null,
          public_description: null,
          public_name: "Published sofa",
          public_slug: "published-sofa",
          shopify_order_url: null,
          source_photo_count: 2,
          source_photo_preview_url: null,
          tags: [],
          updated_at: "2026-04-28T09:30:00.000Z",
          length_cm: null,
        },
        {
          archived_at: "2026-04-28T10:55:00.000Z",
          created_at: "2026-04-28T09:00:00.000Z",
          depth_cm: null,
          footprint_measurements: null,
          footprint_type: null,
          height_cm: null,
          id: "00000000-0000-4000-8000-000000000703",
          internal_name: "Archived internal sofa",
          lifecycle_state: "archived",
          manual_public_order: null,
          public_description: null,
          public_name: "Archived sofa",
          public_slug: "archived-sofa",
          shopify_order_url: null,
          source_photo_count: 0,
          source_photo_preview_url: null,
          tags: [],
          updated_at: "2026-04-28T10:55:00.000Z",
          length_cm: null,
        },
      ]),
    });

    render(<AdminSofasPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Canapés" });
    const statusFilter = await screen.findByLabelText("Filtres des canapés");
    const sofaList = screen.getByRole("list");

    expect(within(statusFilter).getByText("Filtres")).toBeInTheDocument();
    expect(
      statusFilter.compareDocumentPosition(sofaList) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      await screen.findByRole("link", { name: "Ouvrir Draft sofa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ouvrir Published sofa" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ouvrir Archived sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Brouillon" }));

    expect(
      screen.getByRole("link", { name: "Ouvrir Draft sofa" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ouvrir Published sofa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ouvrir Archived sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publié" }));

    expect(
      screen.queryByRole("link", { name: "Ouvrir Draft sofa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ouvrir Published sofa" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ouvrir Archived sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archivé" }));

    expect(
      screen.queryByRole("link", { name: "Ouvrir Draft sofa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ouvrir Published sofa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ouvrir Archived sofa" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archivé" }));

    expect(
      screen.getByRole("link", { name: "Ouvrir Draft sofa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ouvrir Published sofa" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ouvrir Archived sofa" }),
    ).not.toBeInTheDocument();
  });

  it("shows a status-filter empty message when no sofas match the selected status", async () => {
    const dependencies = createDependencies({
      listSofas: vi.fn(async () => [
        {
          archived_at: null,
          created_at: "2026-04-28T10:00:00.000Z",
          depth_cm: null,
          footprint_measurements: null,
          footprint_type: null,
          height_cm: null,
          id: "00000000-0000-4000-8000-000000000701",
          internal_name: "Draft internal sofa",
          lifecycle_state: "draft",
          manual_public_order: null,
          public_description: null,
          public_name: "Draft sofa",
          public_slug: null,
          shopify_order_url: null,
          source_photo_count: 1,
          source_photo_preview_url: null,
          tags: [],
          updated_at: "2026-04-28T10:00:00.000Z",
          length_cm: null,
        },
      ]),
    });

    render(<AdminSofasPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Canapés" });
    fireEvent.click(await screen.findByRole("button", { name: "Publié" }));

    expect(
      screen.getByText("Aucun canapé ne correspond au statut sélectionné."),
    ).toBeInTheDocument();
  });

  it("shows sofa list empty and error states", async () => {
    const emptyDependencies = createDependencies({
      listSofas: vi.fn(async () => []),
    });

    render(<AdminSofasPage dependencies={emptyDependencies} />);

    expect(
      await screen.findByText("Aucun canapé pour le moment."),
    ).toBeInTheDocument();

    cleanup();

    const errorDependencies = createDependencies({
      listSofas: vi.fn(async () => {
        throw new Error("SOFA_LIST_FAILED");
      }),
    });

    render(<AdminSofasPage dependencies={errorDependencies} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Une erreur est survenue. Réessayez.",
    );
    expect(screen.queryByText("SOFA_LIST_FAILED")).not.toBeInTheDocument();
  });

  it("shows a newly created tag immediately when the list reload is stale", async () => {
    // RU: Эти данные имитируют создание тега, когда новый список еще пришел старым.
    // FR: Ces donnees imitent la creation d'une etiquette quand la nouvelle liste reste ancienne.
    const dependencies = createDependencies({
      createTag: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000811",
        public_label: "Angle premium",
        slug: "angle-premium",
      })),
      listTags: vi.fn(async () => []),
    });

    render(<AdminTagsPage dependencies={dependencies} />);

    await screen.findByText("Aucune étiquette.");
    fireEvent.change(screen.getByLabelText("Nouvelle étiquette"), {
      target: { value: "Angle premium" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer l'étiquette" }));

    expect(
      await screen.findByLabelText("Nom de l'étiquette Angle premium"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse angle-premium")).toBeInTheDocument();
  });

  it("creates, edits, and handles assigned-tag delete conflicts", async () => {
    const dependencies = createDependencies({
      deleteTag: vi.fn(async () => {
        throw new Error("TAG_IN_USE");
      }),
    });

    render(<AdminTagsPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Étiquettes" });
    fireEvent.change(screen.getByLabelText("Nouvelle étiquette"), {
      target: { value: "Angle premium" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer l'étiquette" }));

    await waitFor(() => {
      expect(dependencies.createTag).toHaveBeenCalledWith("admin-token", {
        public_label: "Angle premium",
      });
    });

    const convertibleInput = screen.getByLabelText(
      "Nom de l'étiquette Convertible",
    );
    const convertibleRow = convertibleInput.closest("form");

    expect(convertibleRow).not.toBeNull();
    expect(
      within(convertibleRow as HTMLElement).getByRole("button", {
        name: "Enregistrer Convertible",
      }),
    ).toHaveTextContent("Enregistrer");
    const deleteConvertibleButton = within(
      convertibleRow as HTMLElement,
    ).getByRole("button", {
      name: "Supprimer Convertible",
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
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer Convertible" }),
    );

    await waitFor(() => {
      expect(dependencies.updateTag).toHaveBeenCalled();
    });

    fireEvent.click(deleteConvertibleButton);
    const confirmDeleteConvertibleButton = screen.getByRole("button", {
      name: "Confirmer la suppression de Convertible",
    });

    expect(confirmDeleteConvertibleButton).not.toHaveTextContent("Confirm");
    expect(
      confirmDeleteConvertibleButton.querySelector(".admin-delete-icon"),
    ).not.toBe(null);
    fireEvent.click(confirmDeleteConvertibleButton);

    await screen.findByRole("alert");
    expect(
      screen.getByText(
        "Cette étiquette est déjà utilisée par un canapé et ne peut pas être supprimée.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("TAG_IN_USE")).not.toBeInTheDocument();
  });

  it("loads fabrics through the first-party admin facade abstraction", async () => {
    const dependencies = createDependencies();

    render(<AdminFabricsPage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Tissus" });
    expect(screen.getByText("MOBEL UNIQUE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nouveau tissu" })).toHaveAttribute(
      "href",
      "/admin/fabrics/new",
    );
    expect(await screen.findByText("Internal fabric")).toBeInTheDocument();
    expect(screen.getByText("Boucle ivoire")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Boucle ivoire swatch" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
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
              message:
                "L'échantillon a été recadré en carré 512x512 avant l'envoi.",
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

    await screen.findByRole("heading", { name: "Créer un tissu" });
    expect(
      screen.getByText(
        "Créez une fiche tissu avec un échantillon et une image de référence IA.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nom interne du tissu"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.click(screen.getByLabelText("Tissu premium"));
    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [selectedSwatch],
      },
    });
    expect(
      await screen.findByRole("group", { name: "Recadrage de l'échantillon" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Image de référence IA"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer un tissu" }));

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

    await screen.findByRole("heading", { name: "Créer un tissu" });
    expect(
      screen.queryByRole("group", { name: "Recadrage de l'échantillon" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [new File(["swatch"], "swatch.png", { type: "image/png" })],
      },
    });

    expect(
      await screen.findByRole("group", { name: "Recadrage de l'échantillon" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom de l'échantillon")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enregistrer le recadrage" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset crop" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le recadrage" }),
    );
    expect(
      screen.getByRole("button", { name: "Recadrage enregistré" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Zoom de l'échantillon"), {
      target: { value: "140" },
    });
    expect(
      screen.getByRole("button", { name: "Enregistrer le recadrage" }),
    ).toBeInTheDocument();
  });

  it("shows an AI reference image preview after a file is selected", async () => {
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Créer un tissu" });
    expect(
      screen.queryByRole("group", { name: "Aperçu de la référence IA" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Image de référence IA"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    expect(
      screen.getByRole("group", { name: "Aperçu de la référence IA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Aperçu de la référence IA" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("reference.jpg").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("keeps a selected swatch crop when save crop is clicked", async () => {
    stubImageDimensions({ height: 900, width: 1600 });
    const selectedSwatch = new File(["swatch"], "swatch.png", {
      type: "image/png",
    });
    const dependencies = createDependencies();

    render(<AdminFabricCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Créer un tissu" });
    fireEvent.change(screen.getByLabelText("Nom interne du tissu"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [selectedSwatch],
      },
    });
    await screen.findByRole("group", { name: "Recadrage de l'échantillon" });
    fireEvent.change(screen.getByLabelText("Zoom de l'échantillon"), {
      target: { value: "160" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le recadrage" }),
    );
    fireEvent.change(screen.getByLabelText("Image de référence IA"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer un tissu" }));

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

    await screen.findByRole("heading", { name: "Créer un tissu" });
    fireEvent.change(screen.getByLabelText("Nom interne du tissu"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [selectedSwatch],
      },
    });
    const cropPreview = await screen.findByRole("img", {
      name: "Aperçu du recadrage de l'échantillon",
    });
    fireEvent.wheel(cropPreview, {
      deltaY: -120,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Zoom de l'échantillon")).toHaveValue("110");
    });
    fireEvent.change(screen.getByLabelText("Image de référence IA"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer un tissu" }));

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

    await screen.findByRole("heading", { name: "Créer un tissu" });
    fireEvent.change(screen.getByLabelText("Nom interne du tissu"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [selectedSwatch],
      },
    });
    const cropPreview = await screen.findByRole("img", {
      name: "Aperçu du recadrage de l'échantillon",
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
    expect(screen.getByLabelText("Zoom de l'échantillon")).toHaveValue("150");
    fireEvent.change(screen.getByLabelText("Image de référence IA"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer un tissu" }));

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

    await screen.findByRole("heading", { name: "Créer un tissu" });
    fireEvent.change(screen.getByLabelText("Nom interne du tissu"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [selectedSwatch],
      },
    });
    await screen.findByRole("group", { name: "Recadrage de l'échantillon" });
    expect(screen.getByLabelText("Zoom de l'échantillon")).toHaveAttribute(
      "max",
      "500",
    );
    fireEvent.change(screen.getByLabelText("Zoom de l'échantillon"), {
      target: { value: "500" },
    });
    expect(screen.getByLabelText("Zoom de l'échantillon")).toHaveValue("500");
    fireEvent.change(screen.getByLabelText("Image de référence IA"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer un tissu" }));

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
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle naturel" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le tissu" }),
    );

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
              message:
                "L'échantillon a été recadré en carré 512x512 avant l'envoi.",
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
    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [selectedSwatch],
      },
    });
    await screen.findByRole("group", { name: "Recadrage de l'échantillon" });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le tissu" }),
    );

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

    await screen.findByRole("heading", { name: "Créer un tissu" });
    expect(
      screen.getByText(
        "Créez une fiche tissu avec un échantillon et une image de référence IA.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nom interne du tissu"), {
      target: { value: "Internal fabric" },
    });
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle ivoire" },
    });
    fireEvent.click(screen.getByLabelText("Tissu premium"));
    fireEvent.change(screen.getByLabelText("Image d'échantillon"), {
      target: {
        files: [new File(["swatch"], "swatch.png", { type: "image/png" })],
      },
    });
    await screen.findByRole("group", { name: "Recadrage de l'échantillon" });
    fireEvent.change(screen.getByLabelText("Image de référence IA"), {
      target: {
        files: [
          new File(["reference"], "reference.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer un tissu" }));

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
        "Mettez à jour les noms, les images nécessaires et l'état d'archive du tissu.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nom public du tissu"), {
      target: { value: "Boucle naturel" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le tissu" }),
    );

    await waitFor(() => {
      expect(dependencies.updateFabric).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000903",
        expect.objectContaining({
          public_name: "Boucle naturel",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Archiver le tissu" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l'archivage" }),
    );

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

    await screen.findByRole("heading", { name: "Créer un canapé" });
    expect(
      screen.getByText(
        "Créez un brouillon avant d'associer les tissus et les rendus.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nom interne"), {
      target: { value: "Manual test sofa" },
    });
    fireEvent.change(screen.getByLabelText("Nom public"), {
      target: { value: "Canape test" },
    });
    fireEvent.change(screen.getByLabelText("URL de commande Shopify"), {
      target: { value: "https://example.com/products/manual-test" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Prix" }), {
      target: { value: "1299" },
    });
    fireEvent.change(
      await screen.findByLabelText("Rechercher des étiquettes"),
      {
        target: { value: "con" },
      },
    );
    fireEvent.click(
      screen.getByRole("option", { name: "Ajouter l'étiquette Convertible" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Créer le brouillon" }));

    await waitFor(() => {
      expect(dependencies.createSofa).toHaveBeenCalledWith("admin-token", {
        internal_name: "Manual test sofa",
        price_cents: 129900,
        public_name: "Canape test",
        shopify_order_url: "https://example.com/products/manual-test",
        tag_ids: ["00000000-0000-4000-8000-000000000801"],
      });
    });
    expect(dependencies.navigate).toHaveBeenCalledWith(
      "/admin/sofas/00000000-0000-4000-8000-000000000701",
    );
  });

  it("rejects a decimal sofa price before create", async () => {
    // RU: Эти проверки показывают ошибку, если админ ввел цену с центами.
    // FR: Ces verifications montrent une erreur si l'admin ecrit un prix avec des centimes.
    const dependencies = createDependencies();

    render(<AdminSofaCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Créer un canapé" });
    fireEvent.change(screen.getByLabelText("Nom interne"), {
      target: { value: "Manual test sofa" },
    });
    const priceInput = screen.getByRole("textbox", {
      name: "Prix",
    }) as HTMLInputElement;

    fireEvent.change(priceInput, {
      target: { value: "1299.99" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer le brouillon" }));

    expect(priceInput.checkValidity()).toBe(false);
    expect(dependencies.createSofa).not.toHaveBeenCalled();
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

    await screen.findByRole("heading", { name: "Créer un canapé" });
    fireEvent.change(
      await screen.findByLabelText("Rechercher des étiquettes"),
      {
        target: { value: "r" },
      },
    );
    expect(
      within(
        screen.getByRole("listbox", { name: "Étiquettes trouvées" }),
      ).getByRole("option", { name: "Ajouter l'étiquette Red sofa" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("listbox", { name: "Étiquettes trouvées" }),
      ).queryByRole("option", { name: "Ajouter l'étiquette Top sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("option", { name: "Ajouter l'étiquette Red sofa" }),
    );

    expect(screen.getByText("Étiquettes sélectionnées")).toBeInTheDocument();
    expect(screen.getByText("Red sofa")).toBeInTheDocument();
    expect(screen.getByLabelText("Rechercher des étiquettes")).toHaveValue("");
    expect(
      screen.queryByRole("option", { name: "Ajouter l'étiquette Red sofa" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Retirer l'étiquette Red sofa" }),
    );

    expect(screen.queryByText("Red sofa")).not.toBeInTheDocument();
    expect(
      screen.getByText("Aucune étiquette sélectionnée."),
    ).toBeInTheDocument();
  });

  it("keeps many selected sofa tags in one horizontal rail", async () => {
    const tagFixtures = [
      {
        id: "00000000-0000-4000-8000-000000000811",
        public_label: "Small spaces",
        slug: "small-spaces",
      },
      {
        id: "00000000-0000-4000-8000-000000000812",
        public_label: "Corner lounge",
        slug: "corner-lounge",
      },
      {
        id: "00000000-0000-4000-8000-000000000813",
        public_label: "Family sofa",
        slug: "family-sofa",
      },
      {
        id: "00000000-0000-4000-8000-000000000814",
        public_label: "Tissu premium",
        slug: "premium-fabric",
      },
      {
        id: "00000000-0000-4000-8000-000000000815",
        public_label: "Fast delivery",
        slug: "fast-delivery",
      },
    ];
    const dependencies = createDependencies({
      listTags: vi.fn(async () => tagFixtures),
    });

    render(<AdminSofaCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Créer un canapé" });
    for (const tag of tagFixtures) {
      fireEvent.change(
        await screen.findByLabelText("Rechercher des étiquettes"),
        {
          target: { value: tag.public_label },
        },
      );
      fireEvent.click(
        screen.getByRole("option", {
          name: `Ajouter l'étiquette ${tag.public_label}`,
        }),
      );
    }

    const selectedTags = screen.getByRole("list", {
      name: "Étiquettes sélectionnées",
    });

    expect(selectedTags).toHaveClass(
      "admin-tag-chip-list",
      "admin-tag-chip-rail",
    );
    expect(selectedTags).toHaveAttribute("tabindex", "0");
    for (const tag of tagFixtures) {
      expect(
        within(selectedTags).getByText(tag.public_label),
      ).toBeInTheDocument();
    }
  });

  it("lets admins drag the selected sofa tag rail without grabbing a scrollbar", async () => {
    const tagFixtures = [
      {
        id: "00000000-0000-4000-8000-000000000821",
        public_label: "Small spaces",
        slug: "small-spaces",
      },
      {
        id: "00000000-0000-4000-8000-000000000822",
        public_label: "Corner lounge",
        slug: "corner-lounge",
      },
      {
        id: "00000000-0000-4000-8000-000000000823",
        public_label: "Family sofa",
        slug: "family-sofa",
      },
      {
        id: "00000000-0000-4000-8000-000000000824",
        public_label: "Tissu premium",
        slug: "premium-fabric",
      },
    ];
    const dependencies = createDependencies({
      listTags: vi.fn(async () => tagFixtures),
    });

    render(<AdminSofaCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Créer un canapé" });
    for (const tag of tagFixtures) {
      fireEvent.change(
        await screen.findByLabelText("Rechercher des étiquettes"),
        {
          target: { value: tag.public_label },
        },
      );
      fireEvent.click(
        screen.getByRole("option", {
          name: `Ajouter l'étiquette ${tag.public_label}`,
        }),
      );
    }

    const selectedTags = screen.getByRole("list", {
      name: "Étiquettes sélectionnées",
    }) as HTMLDivElement;

    selectedTags.scrollLeft = 40;
    firePointerCropEvent(selectedTags, "pointerdown", {
      clientX: 240,
      clientY: 20,
      pointerId: 7,
      pointerType: "mouse",
    });
    firePointerCropEvent(selectedTags, "pointermove", {
      clientX: 160,
      clientY: 20,
      pointerId: 7,
      pointerType: "mouse",
    });
    firePointerCropEvent(selectedTags, "pointerup", {
      clientX: 160,
      clientY: 20,
      pointerId: 7,
      pointerType: "mouse",
    });

    expect(selectedTags.scrollLeft).toBe(120);
    expect(selectedTags).not.toHaveAttribute("data-dragging");
  });

  it("shows a short separate visual scrollbar for the selected sofa tag rail", async () => {
    const tagFixtures = [
      {
        id: "00000000-0000-4000-8000-000000000831",
        public_label: "Small spaces",
        slug: "small-spaces",
      },
      {
        id: "00000000-0000-4000-8000-000000000832",
        public_label: "Corner lounge",
        slug: "corner-lounge",
      },
      {
        id: "00000000-0000-4000-8000-000000000833",
        public_label: "Family sofa",
        slug: "family-sofa",
      },
      {
        id: "00000000-0000-4000-8000-000000000834",
        public_label: "Tissu premium",
        slug: "premium-fabric",
      },
    ];
    const dependencies = createDependencies({
      listTags: vi.fn(async () => tagFixtures),
    });

    render(<AdminSofaCreatePage dependencies={dependencies} />);

    await screen.findByRole("heading", { name: "Créer un canapé" });
    for (const tag of tagFixtures) {
      fireEvent.change(
        await screen.findByLabelText("Rechercher des étiquettes"),
        {
          target: { value: tag.public_label },
        },
      );
      fireEvent.click(
        screen.getByRole("option", {
          name: `Ajouter l'étiquette ${tag.public_label}`,
        }),
      );
    }

    const selectedTags = screen.getByRole("list", {
      name: "Étiquettes sélectionnées",
    }) as HTMLDivElement;
    const visualScrollbar = selectedTags.parentElement?.querySelector(
      ".admin-tag-rail-scrollbar",
    ) as HTMLDivElement | null;

    expect(visualScrollbar).toBeInTheDocument();
    expect(visualScrollbar).toHaveAttribute("aria-hidden", "true");

    Object.defineProperty(selectedTags, "clientWidth", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(selectedTags, "scrollWidth", {
      configurable: true,
      value: 500,
    });
    selectedTags.scrollLeft = 150;
    fireEvent.scroll(selectedTags);

    await waitFor(() => {
      expect(
        visualScrollbar?.style.getPropertyValue("--admin-tag-rail-thumb-left"),
      ).toBe("30%");
    });
    expect(
      visualScrollbar?.style.getPropertyValue("--admin-tag-rail-thumb-width"),
    ).toBe("40%");
  });

  it("keeps selected sofa tag rail styles compact", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.admin-tag-chip-rail\s*{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s,
    );
    expect(css).toMatch(
      /\.admin-tag-chip-rail\s*{[^}]*cursor:\s*grab;[^}]*scrollbar-width:\s*none;[^}]*touch-action:\s*pan-x;/s,
    );
    expect(css).toMatch(
      /\.admin-tag-chip-rail::-webkit-scrollbar\s*{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\.admin-tag-rail-scrollbar\s*{[^}]*border:\s*0;[^}]*width:\s*min\(112px,\s*34%\);/s,
    );
    expect(css).toMatch(
      /\.admin-tag-rail-scrollbar::after\s*{[^}]*left:\s*var\(--admin-tag-rail-thumb-left\);/s,
    );
    expect(css).toMatch(
      /\.admin-tag-chip\s*{[^}]*flex:\s*0 0 auto;[^}]*max-width:/s,
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
    expect(
      screen.getByText(
        "Gérez les infos, les tissus, les colonnes de vue, les rendus et la préparation à la publication.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("00000000-0000-4000-8000-000000000701"),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Description publique"), {
      target: { value: "Updated manually" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Prix" }), {
      target: { value: "1499" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le canapé" }),
    );

    await waitFor(() => {
      expect(dependencies.updateSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
        expect.objectContaining({
          price_cents: 149900,
          public_description: "Updated manually",
          tag_ids: ["00000000-0000-4000-8000-000000000801"],
        }),
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));
    expect(screen.getByText("Aucun tissu public")).toBeInTheDocument();
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

    expect(
      screen.getByRole("tab", { name: /Infos du canap\u00e9/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Tissus associ\u00e9s/i }),
    ).toBeInTheDocument();
    const visualMatrixTab = screen.getByRole("tab", {
      name: /Colonnes de vue/i,
    });

    expect(visualMatrixTab).toBeInTheDocument();
    expectSofaEditTabDotBesideNumber(visualMatrixTab, "03");
    expect(screen.getByRole("tab", { name: /Rendus/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Publication/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Sofa test sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Manual test checklist" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publier le canapé" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));

    expect(
      screen.getByRole("button", { name: "Publier le canapé" }),
    ).toBeInTheDocument();
  });

  it("shows assigned fabrics as a compact state workspace", async () => {
    const assignedFabric = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric: {
        ai_reference_asset: null,
        ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        id: "00000000-0000-4000-8000-000000000903",
        internal_name: "Internal fabric",
        is_premium: true,
        lifecycle_state: "active",
        public_name: "Boucle ivoire",
        swatch_preview_url: "https://storage.example/swatch-preview.png",
        swatch_asset: null,
        swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        updated_at: "2026-04-28T10:00:00.000Z",
      },
      fabric_id: "00000000-0000-4000-8000-000000000903",
      public_order: 1,
      sofa_id: "00000000-0000-4000-8000-000000000701",
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const dependencies = createDependencies({
      listSofaFabrics: vi.fn(async () => [assignedFabric]),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Tissus associés/i }));

    const workspace = screen.getByRole("list", {
      name: "Tissus associés au canapé",
    });
    const row = within(workspace).getByRole("listitem", {
      name: /Boucle ivoire/i,
    });

    expect(within(row).getByText("Boucle ivoire")).toBeInTheDocument();
    expect(
      within(row).getByText("Interne : Internal fabric"),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("img", { name: /Échantillon pour Boucle ivoire/i }),
    ).toHaveAttribute("src", "https://storage.example/swatch-preview.png");
    expect(within(row).getByText("IA manquante")).toHaveAttribute(
      "data-state",
      "blocked",
    );
    expect(within(row).getByText("Premium")).toHaveAttribute(
      "data-state",
      "selected",
    );
    expect(within(row).getByText("Ordre 1")).toHaveAttribute(
      "data-state",
      "current",
    );
    expect(
      within(row).getByRole("textbox", {
        name: "Ordre public pour Boucle ivoire",
      }),
    ).toHaveValue("1");
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
      screen.getByRole("tab", { name: /Tissus associ\u00e9s Bloqu\u00e9/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Rendus Prêt/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));

    expect(
      screen.getByRole("heading", {
        name: "Couverture des rendus",
      }),
    ).toBeInTheDocument();
    const readyCellButton = screen.getByRole("button", {
      name: "Boucle ivoire, Front : Prêt",
    });
    expect(readyCellButton).toBeInTheDocument();
    expect(screen.getByText("Légende des statuts")).toBeInTheDocument();

    fireEvent.click(readyCellButton);

    const renderCellDialog = screen.getByRole("dialog", {
      name: /Cellule de rendu/i,
    });
    expect(
      within(renderCellDialog).getByText("Généré par IA"),
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));

    expect(screen.getByText("Couverture des rendus")).toBeInTheDocument();
    expect(screen.getByText("Légende des statuts")).toBeInTheDocument();
    for (const label of [
      "Prêt",
      "Manquant",
      "Variante",
      "Bloqué",
      "En file",
      "En cours",
      "Échec",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const [label, marker] of [
      ["Prêt", "R"],
      ["Manquant", "M"],
      ["Variante", "C"],
      ["Bloqué", "B"],
      ["En file", "Q"],
      ["En cours", "P"],
      ["Échec", "F"],
    ]) {
      const chip = screen
        .getAllByText(label)
        .find((node) => node.closest(".admin-status-chip"))
        ?.closest(".admin-status-chip");

      expect(chip).not.toBeUndefined();
      expect(chip).toHaveTextContent(new RegExp(`^${label}$`));
      expect(chip).not.toHaveTextContent(`${marker}${label}`);
    }

    const cellButton = screen.getByRole("button", {
      name: /Boucle ivoire, Front : Manquant/i,
    });
    fireEvent.click(cellButton);

    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });
    const closeButton = within(dialog).getByRole("button", {
      name: "Fermer la cellule de rendu",
    });

    await waitFor(() => expect(closeButton).toHaveFocus());

    expect(within(dialog).getByText("Boucle ivoire")).toBeInTheDocument();
    expect(within(dialog).getByText("Front")).toBeInTheDocument();
    expect(within(dialog).getByText("Rendu manquant")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Cette cellule n'a pas encore de rendu actuel."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Aucune source pour le moment"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Généré par IA")).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Générer" }),
    ).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();
    expectCloseIconButton(closeButton);

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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Manquant/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });
    const generationGroup = within(dialog).getByRole("group", {
      name: "Action de génération",
    });
    const generateButton = within(generationGroup).getByRole("button", {
      name: "Générer",
    });

    expect(
      within(dialog).queryByLabelText("Prompt note"),
    ).not.toBeInTheDocument();
    expect(
      within(generationGroup).queryByLabelText("Note facultative"),
    ).not.toBeInTheDocument();
    expect(
      within(generationGroup).getByRole("button", {
        name: "Ajouter une note",
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Manquant/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });
    fireEvent.click(within(dialog).getByRole("button", { name: "Générer" }));

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
      await within(dialog).findByRole("group", { name: "Voir les variantes" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Utiliser la variante" }),
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : En cours/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    // RU: Эта кнопка помогает проверить, что исходное фото отмечено знаком в углу клетки.
    // FR: Ce bouton aide a verifier que la photo source est marquee dans le coin de la case.
    const sourcePhotoCellButton = screen.getByRole("button", {
      name: /Grey fabric, Front : Prêt/i,
    });
    const sourceImageMarker = within(sourcePhotoCellButton).getByText("SI");

    expect(sourceImageMarker).toBeInTheDocument();
    expect(sourceImageMarker.parentElement).toBe(sourcePhotoCellButton);
    expect(
      within(sourcePhotoCellButton).queryByText("Photo source"),
    ).not.toBeInTheDocument();
    expect(
      within(sourcePhotoCellButton).queryByText("No generation needed"),
    ).not.toBeInTheDocument();

    fireEvent.click(sourcePhotoCellButton);
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

    expect(
      within(dialog).getByText("La photo source est le rendu actuel"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("SOURCE_PHOTO_RENDER_COMPLETE"),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        visualColumn.current_source_photo.asset_id,
        "medium",
      );
    });
    expect(
      within(dialog).getByRole("img", { name: "Aperçu du rendu actuel" }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${visualColumn.current_source_photo.asset_id}`,
    );
    expect(
      within(dialog).getByRole("img", { name: "Aperçu du rendu actuel" }),
    ).not.toHaveAttribute(
      "src",
      "https://storage.example/source-photo-preview",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Voir le rendu actuel" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("img", { name: "Aperçu du rendu actuel" }),
    );
    const currentRenderDialog = screen.getByRole("dialog", {
      name: /Grande image : Rendu actuel/i,
    });
    expect(
      within(currentRenderDialog).getByRole("img", {
        name: "Aperçu du rendu actuel",
      }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${visualColumn.current_source_photo.asset_id}`,
    );
    expect(
      within(dialog).getAllByText("Photo source").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(dialog).queryByRole("button", { name: "Générer" }),
    ).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Remplacer manuellement" }),
    ).toBeInTheDocument();
  });

  it("marks manual upload current render cells with the source image badge", async () => {
    // RU: Эти значения описывают готовую ячейку, где админ загрузил картинку вручную.
    // FR: Ces valeurs decrivent une case prete ou l'admin a envoye une image manuelle.
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
      current_source_photo: null,
      current_source_photo_id: null,
      deleted_at: null,
      id: "00000000-0000-4000-8000-000000000904",
      public_label: "Front",
      sequence: 1,
      sofa_id: assignedFabric.sofa_id,
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const manualUploadCell = {
      blockers: [],
      can_generate_initial: true,
      candidate_count: 0,
      current_private_asset_id: "00000000-0000-4000-8000-000000000909",
      current_private_preview_url:
        "https://storage.example/manual-render-preview",
      current_public_asset_id: null,
      fabric_id: assignedFabric.fabric_id,
      has_private_render: true,
      has_public_render: false,
      id: "00000000-0000-4000-8000-000000000906",
      latest_job: null,
      sofa_id: assignedFabric.sofa_id,
      source_photo_id: null,
      source_type: "manual_upload",
      updated_at: "2026-04-28T10:40:00.000Z",
      visual_matrix_column_id: visualColumn.id,
    };
    const dependencies = createDependencies({
      getRenderCoverage: vi.fn(async () => ({
        render_cells: [manualUploadCell],
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    const manualUploadCellButton = screen.getByRole("button", {
      name: /Grey fabric, Front :/i,
    });
    const sourceImageMarker = within(manualUploadCellButton).getByText("SI");

    expect(sourceImageMarker).toHaveClass("admin-render-cell-source-badge");
    expect(sourceImageMarker.parentElement).toBe(manualUploadCellButton);
    expect(
      within(manualUploadCellButton).queryByText("Envoi manuel"),
    ).not.toBeInTheDocument();

    fireEvent.click(manualUploadCellButton);
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

    expect(within(dialog).getByText("Envoi manuel")).toBeInTheDocument();
    expect(
      within(dialog).queryByText("La photo source est le rendu actuel"),
    ).not.toBeInTheDocument();
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
    const selectedManualRender = new File(
      ["manual-large-original"],
      "manual_render_front.png",
      {
        type: "image/png",
      },
    );
    const preparedManualRender = new File(
      ["manual-large-prepared"],
      "manual_render_front.png",
      {
        type: "image/png",
      },
    );
    vi.mocked(prepareAdminImageUploadFile).mockImplementation(
      async ({ file, purpose }) =>
        purpose === "manual_render"
          ? {
              file: preparedManualRender,
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    const sourcePhotoCellButton = screen.getByRole("button", {
      name: /Grey fabric, Front :/i,
    });
    fireEvent.click(sourcePhotoCellButton);
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

    const manualRenderInput = openManualRenderUpload(dialog);
    expect(within(dialog).getByText("Choisir un rendu")).toBeInTheDocument();
    fireEvent.change(manualRenderInput, {
      target: {
        files: [selectedManualRender],
      },
    });
    expect(
      within(dialog).getByText("manual_render_front.png"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remplacer par ce rendu" }),
    );

    await waitFor(() => {
      expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
        byte_size: preparedManualRender.size,
        content_type: "image/png",
        purpose: "manual_render",
        render_cell_id: sourcePhotoCell.id,
      });
      expect(dependencies.uploadToSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          upload_id: "manual-render-upload",
        }),
        preparedManualRender,
      );
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000909",
        "medium",
      );
      expect(
        within(dialog).getByRole("img", { name: "Aperçu du rendu actuel" }),
      ).toHaveAttribute(
        "src",
        "blob:admin-preview/00000000-0000-4000-8000-000000000909",
      );
    });
    expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
      file: selectedManualRender,
      purpose: "manual_render",
    });
    expect(
      screen.getByText(
        "Image resized from 4096x3072 to 2048x1536 before upload.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("La photo source est le rendu actuel"),
    ).toBeNull();
    expect(within(dialog).getByText("Envoi manuel")).toBeInTheDocument();
    expect(within(sourcePhotoCellButton).getByText("SI")).toHaveClass(
      "admin-render-cell-source-badge",
    );
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(screen.getByRole("button", { name: /Front : Manquant/i }));

    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });
    const manualRenderInput = openManualRenderUpload(dialog);
    fireEvent.change(manualRenderInput, {
      target: {
        files: [new File(["manual"], "manual.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remplacer par ce rendu" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "L'envoi de l'image a échoué. Réessayez.",
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
    fireEvent.click(screen.getByRole("tab", { name: /Tissus associ\u00e9s/i }));
    fireEvent.change(screen.getByLabelText("Associer un tissu"), {
      target: { value: "00000000-0000-4000-8000-000000000903" },
    });
    fireEvent.change(screen.getByLabelText("Ordre public"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Associer un tissu" }));

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
    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));
    expect(
      await screen.findByText("Rendus publics manquants"),
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
    fireEvent.click(screen.getByRole("tab", { name: /Tissus associ\u00e9s/i }));

    expect(screen.getByText("Boucle ivoire")).toBeInTheDocument();
    expect(screen.getByText("Interne : Internal fabric")).toBeInTheDocument();
    expect(screen.getByText("IA prête")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("IA manquante")).toHaveAttribute(
      "data-state",
      "blocked",
    );
    expect(screen.getByText("Ordre 1")).toHaveAttribute(
      "data-state",
      "current",
    );
    expect(
      screen.getByRole("img", { name: "Échantillon pour Boucle ivoire" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Aucun échantillon")).toBeInTheDocument();
    const fabricDeleteButtons = within(
      screen.getByRole("region", { name: "Tissus associés" }),
    ).getAllByRole("button", { name: /Supprimer l'association du tissu/i });

    expect(fabricDeleteButtons).toHaveLength(2);
    for (const button of fabricDeleteButtons) {
      expect(button).not.toHaveTextContent("Delete");
      expect(button.querySelector(".admin-delete-icon")).not.toBe(null);
    }
    expect(
      within(
        screen.getByRole("region", { name: "Tissus associés" }),
      ).queryByRole("button", { name: /Détacher/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ordre public pour Boucle ivoire"), {
      target: { value: "7" },
    });

    expect(dependencies.updateSofaFabric).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer l'ordre" }),
    );

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
    fireEvent.click(screen.getByRole("tab", { name: /Tissus associ\u00e9s/i }));
    fireEvent.change(screen.getByLabelText("Ordre public pour First fabric"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Ordre public pour Second fabric"), {
      target: { value: "1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer l'ordre" }),
    );

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
      createStorageAssetPreviewUrl: vi.fn(
        async (_accessToken, assetId, variant = "original") =>
          `blob:admin-preview/${assetId}/${variant}`,
      ),
      listSofaFabrics: vi.fn(async () => [assignedFabric, reassignedFabric]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Colonnes de vue/i }));

    expect(screen.getAllByText("Colonnes de vue").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Configure les positions. Rendus montre la couverture."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Source ready")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        document.querySelector(".admin-visual-matrix-source-preview img"),
      ).toHaveAttribute(
        "src",
        `blob:admin-preview/${visualColumn.current_source_photo.asset_id}/small`,
      );
    });
    expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
      "admin-token",
      visualColumn.current_source_photo.asset_id,
      "small",
    );
    const sourceImageButton = screen.getByRole("button", {
      name: "Modifier l'image source de la colonne 1",
    });

    expect(sourceImageButton).not.toHaveTextContent("Edit");
    expect(sourceImageButton.querySelector(".admin-edit-icon")).not.toBe(null);
    expect(
      screen.getByRole("img", { name: "Échantillon pour Original fabric" }),
    ).toHaveAttribute("src", swatchPreviewUrl);
    expectVisualMatrixRowActions(
      screen.getByRole("button", { name: "Modifier la colonne 1" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter une colonne" }),
    );
    let dialog = screen.getByRole("dialog", { name: "Ajouter une colonne" });
    expectCenteredVisualMatrixDialog(dialog);
    expectVisualMatrixDialogFormAlignment(dialog);

    closeCenteredVisualMatrixDialog(dialog);
    expect(
      screen.queryByRole("dialog", { name: "Ajouter une colonne" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Modifier la colonne 1" }),
    );
    dialog = screen.getByRole("dialog", { name: "Modifier la colonne 1" });
    expectCenteredVisualMatrixDialog(dialog);
    expectVisualMatrixDialogFormAlignment(dialog);
    expect(within(dialog).getByLabelText("Ordre 1")).toHaveValue(1);
    expect(within(dialog).getByLabelText("Tissu source 1")).toHaveValue(
      assignedFabric.fabric_id,
    );
    await waitFor(() => {
      expect(
        dialog.querySelector(".admin-view-column-source-preview img"),
      ).toHaveAttribute(
        "src",
        `blob:admin-preview/${visualColumn.current_source_photo.asset_id}/medium`,
      );
    });
    expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
      "admin-token",
      visualColumn.current_source_photo.asset_id,
      "medium",
    );

    fireEvent.change(within(dialog).getByLabelText("Tissu source 1"), {
      target: { value: reassignedFabric.fabric_id },
    });
    expect(
      within(dialog).getByRole("img", {
        name: "Échantillon pour Replacement fabric",
      }),
    ).toHaveAttribute("src", "https://storage.example/replacement-swatch.png");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Enregistrer" }),
    );

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
      screen.queryByRole("dialog", { name: "Modifier la colonne 1" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Modifier la colonne 1" }),
    );
    dialog = screen.getByRole("dialog", { name: "Modifier la colonne 1" });
    fireEvent.change(within(dialog).getByLabelText("Tissu source 1"), {
      target: { value: "" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Enregistrer" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choisissez un tissu source avant d'enregistrer cette image source.",
    );

    const deleteColumnButton = within(dialog).getByRole("button", {
      name: "Supprimer la colonne 1",
    });

    expect(deleteColumnButton).not.toHaveTextContent("Delete");
    expect(deleteColumnButton.querySelector(".admin-delete-icon")).not.toBe(
      null,
    );
    fireEvent.click(deleteColumnButton);
    expect(
      screen.getByText(
        "Supprimer cette colonne touche tous les tissus de ce canapé.",
      ),
    ).toBeInTheDocument();

    const confirmDeleteColumnButton = screen.getByRole("button", {
      name: "Confirmer la suppression de la colonne 1",
    });

    expect(confirmDeleteColumnButton).not.toHaveTextContent("Confirm delete");
    expect(
      confirmDeleteColumnButton.querySelector(".admin-delete-icon"),
    ).not.toBe(null);

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(
      screen.queryByText(
        "Supprimer cette colonne touche tous les tissus de ce canapé.",
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
    fireEvent.click(screen.getByRole("tab", { name: /Colonnes de vue/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Modifier la colonne 1" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Modifier la colonne 1",
    });

    fireEvent.change(within(dialog).getByLabelText("Tissu source 1"), {
      target: { value: secondFabric.id },
    });
    expect(
      within(dialog).getByRole("img", {
        name: "Échantillon pour Replacement fabric",
      }),
    ).toHaveAttribute("src", secondFabric.swatch_preview_url);

    // RU: Этот файл выбирают в окне, но кнопку сохранения пока не нажимают.
    // FR: Ce fichier est choisi dans la fenetre, mais le bouton d'enregistrement n'est pas encore utilise.
    const selectedFile = new File(["source"], "new-source.png", {
      type: "image/png",
    });

    fireEvent.change(within(dialog).getByLabelText("Photo source 1"), {
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
    const preparedManualRender = new File(["prepared-manual"], "manual.jpg", {
      type: "image/jpeg",
    });
    vi.mocked(prepareAdminImageUploadFile).mockImplementation(
      async ({ file, purpose }) =>
        purpose === "sofa_source_photo"
          ? {
              file: preparedSourcePhoto,
              message: "L'image a été convertie de WebP en JPEG avant l'envoi.",
              resized: true,
            }
          : purpose === "manual_render"
            ? {
                file: preparedManualRender,
                message:
                  "L'image a été convertie de WebP en JPEG avant l'envoi.",
                resized: true,
              }
            : {
                file,
                message: null,
                resized: false,
              },
    );
    const selectedSourcePhoto = new File(["source"], "source.webp", {
      type: "image/webp",
    });
    const selectedManualRender = new File(
      ["manual"],
      "manual_render_front.webp",
      {
        type: "image/webp",
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
    fireEvent.click(screen.getByRole("tab", { name: /Colonnes de vue/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Modifier la colonne 1" }),
    );
    const sourcePhotoDialog = screen.getByRole("dialog", {
      name: "Modifier la colonne 1",
    });
    expectCenteredVisualMatrixDialog(sourcePhotoDialog);
    expect(
      within(sourcePhotoDialog).getByRole("button", {
        name: "Fermer la fenêtre des colonnes",
      }),
    ).toBeInTheDocument();
    expect(
      within(sourcePhotoDialog).queryByRole("button", { name: "Annuler" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tissu source 1"), {
      target: { value: assignedFabric.fabric_id },
    });
    fireEvent.change(screen.getByLabelText("Photo source 1"), {
      target: {
        files: [selectedSourcePhoto],
      },
    });
    const saveButton = screen.getByRole("button", { name: "Enregistrer" });
    fireEvent.click(saveButton);

    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveTextContent("Enregistrement");
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
    expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
      file: selectedSourcePhoto,
      purpose: "sofa_source_photo",
    });
    expect(
      screen.getByText(
        "L'image a été convertie de WebP en JPEG avant l'envoi.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Manquant/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });
    const generationGroup = within(dialog).getByRole("group", {
      name: "Action de génération",
    });
    fireEvent.click(
      within(generationGroup).getByRole("button", {
        name: "Ajouter une note",
      }),
    );
    expect(
      within(generationGroup).getByText(
        "La demande standard est utilisée automatiquement. Ajoutez ceci seulement si une indication en plus est nécessaire.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(
      within(generationGroup).getByLabelText("Note facultative"),
      {
        target: {
          value: "Keep seams visible",
        },
      },
    );
    fireEvent.click(
      within(generationGroup).getByRole("button", { name: "Générer" }),
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
    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));
    expect(screen.getByText("Rendus publics manquants")).toBeInTheDocument();
    expect(
      screen.queryByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publier le canapé" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Manquant/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

    // RU: Этот файл заменяет недостающую картинку в проверке.
    // FR: Ce fichier remplace l'image manquante dans la verification.
    const manualRenderFile = new File(["manual"], "manual.png", {
      type: "image/png",
    });

    fireEvent.change(openManualRenderUpload(dialog), {
      target: {
        files: [manualRenderFile],
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remplacer par ce rendu" }),
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

    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));

    expect(
      screen.queryByText("Rendus publics manquants"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Publier le canapé" }),
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));

    fireEvent.click(
      screen.getByRole("button", { name: "Générer les rendus manquants" }),
    );
    await waitFor(() => {
      expect(dependencies.generateFabricRenderJobsForSofa).toHaveBeenCalledWith(
        "admin-token",
        sofaId,
      );
    });

    expect(
      screen.queryByRole("button", { name: "Reprendre les tâches en file" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Queued fabric, Front : En file/i }),
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: /Cellule de rendu/i }),
      ).getByRole("button", {
        name: "Reprendre la génération",
      }),
    );
    await waitFor(() => {
      expect(dependencies.resumeFabricRenderJobs).toHaveBeenCalledWith(
        "admin-token",
        {
          render_cell_id: queuedJob.render_cell_id,
        },
      );
    });
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: /Cellule de rendu/i }),
      ).getByRole("button", { name: "Fermer la cellule de rendu" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Failed fabric, Front : Échec/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });
    expect(within(dialog).getByText("Provider timeout")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Relancer la génération" }),
    );
    await waitFor(() => {
      expect(dependencies.retryFabricRenderJob).toHaveBeenCalledWith(
        "admin-token",
        failedJob.id,
      );
    });
  });

  it("shows a conflict message when a selected queued cell cannot resume while another job is processing", async () => {
    // RU: Эти значения описывают ячейку в очереди, которую админ пытается запустить вручную.
    // FR: Ces valeurs decrivent une case en attente que l'admin essaie de lancer a la main.
    const sofaId = "00000000-0000-4000-8000-000000000701";
    const visualColumn = {
      admin_label: "front",
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
    const fabric = {
      ai_reference_asset: null,
      ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
      archived_at: null,
      created_at: "2026-04-28T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000913",
      internal_name: "Queued fabric",
      is_premium: false,
      lifecycle_state: "active",
      public_name: "Queued fabric",
      swatch_preview_url: null,
      swatch_asset: null,
      swatch_asset_id: "00000000-0000-4000-8000-000000000901",
      updated_at: "2026-04-28T10:00:00.000Z",
    };
    const assignment = {
      assigned_at: "2026-04-28T10:15:00.000Z",
      fabric,
      fabric_id: fabric.id,
      public_order: 1,
      sofa_id: sofaId,
      updated_at: "2026-04-28T10:15:00.000Z",
    };
    const queuedJob = {
      attempt_count: 0,
      completed_at: null,
      created_at: "2026-04-28T10:30:00.000Z",
      fabric_id: fabric.id,
      generation_mode: "initial",
      id: "00000000-0000-4000-8000-000000000916",
      last_error_message: null,
      max_attempts: 3,
      prompt_note: null,
      queued_at: "2026-04-28T10:30:00.000Z",
      request_id: "00000000-0000-4000-8000-000000000917",
      refinement_source_asset_id: null,
      refine_prompt: null,
      render_cell_id: "00000000-0000-4000-8000-000000000915",
      sofa_id: sofaId,
      status: "queued",
      updated_at: "2026-04-28T10:30:00.000Z",
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
            fabric_id: fabric.id,
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
        sofa_fabrics: [assignment],
        sofa_id: sofaId,
        visual_matrix_columns: [visualColumn],
      })),
      listFabrics: vi.fn(async () => [fabric]),
      listSofaFabrics: vi.fn(async () => [assignment]),
      listVisualMatrixColumns: vi.fn(async () => [visualColumn]),
      resumeFabricRenderJobs: vi.fn(async () => {
        throw new Error("FABRIC_RENDER_SOFA_PROCESSING_CONFLICT");
      }),
    });

    render(<AdminSofaEditPage dependencies={dependencies} sofaId={sofaId} />);

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Queued fabric, Front : En file/i }),
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: /Cellule de rendu/i }),
      ).getByRole("button", { name: "Reprendre la génération" }),
    );

    await waitFor(() => {
      expect(dependencies.resumeFabricRenderJobs).toHaveBeenCalledWith(
        "admin-token",
        {
          render_cell_id: queuedJob.render_cell_id,
        },
      );
    });
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) =>
          alert.textContent?.includes(
            "Une autre génération est déjà en cours. Attendez qu'elle se termine avant de relancer une cellule en file.",
          ),
        ),
    ).toBe(true);
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
    const selectedManualRender = new File(
      ["manual"],
      "manual_render_front.webp",
      {
        type: "image/webp",
      },
    );
    const preparedManualRender = new File(["prepared-manual"], "manual.jpg", {
      type: "image/jpeg",
    });
    vi.mocked(prepareAdminImageUploadFile).mockImplementation(
      async ({ file, purpose }) =>
        purpose === "manual_render"
          ? {
              file: preparedManualRender,
              message: "L'image a été convertie de WebP en JPEG avant l'envoi.",
              resized: true,
            }
          : {
              file,
              message: null,
              resized: false,
            },
    );
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Variante/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

    await waitFor(() => {
      expect(dependencies.listRenderCellCandidates).toHaveBeenCalledWith(
        "admin-token",
        renderCell.id,
      );
    });
    await within(dialog).findByAltText(
      "Aperçu de la variante 00000000-0000-4000-8000-000000000908",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Voir les variantes" }),
    ).not.toBeInTheDocument();
    const candidateCard = within(dialog).getByRole("article", {
      name: /Variante 00000000-0000-4000-8000-000000000908/i,
    });
    expect(
      within(candidateCard).getByText("initial - v007"),
    ).toBeInTheDocument();
    expect(within(candidateCard).getByText("À sélectionner")).toHaveAttribute(
      "data-state",
      "ready",
    );
    expect(
      within(candidateCard).getByRole("button", {
        name: "Utiliser la variante",
      }),
    ).toBeInTheDocument();
    expect(
      within(candidateCard).getByRole("button", {
        name: "Améliorer la variante",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("group", {
        name: "Actions suivantes pour les variantes",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText("Demande d'amélioration"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(candidateCard).getByRole("button", {
        name: "Améliorer la variante",
      }),
    );
    expect(
      within(dialog).getByLabelText("Demande d'amélioration"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Annuler l'amélioration" }),
    );
    expect(
      within(dialog).queryByLabelText("Demande d'amélioration"),
    ).not.toBeInTheDocument();
    expect(dependencies.createFabricRenderJob).not.toHaveBeenCalled();

    fireEvent.click(
      within(candidateCard).getByRole("button", {
        name: "Améliorer la variante",
      }),
    );
    fireEvent.change(within(dialog).getByLabelText("Demande d'amélioration"), {
      target: {
        value: "Reduce wrinkles on the left arm",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Améliorer" }));

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
      within(dialog).getByRole("button", { name: "Utiliser la variante" }),
    );

    await waitFor(() => {
      expect(dependencies.useRenderCandidate).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000908",
      );
    });
    expect(
      within(dialog).queryByAltText(
        "Aperçu de la variante 00000000-0000-4000-8000-000000000908",
      ),
    ).not.toBeInTheDocument();
    expect(await within(dialog).findByText("Prêt")).toBeInTheDocument();

    const readyDialog = screen.getByRole("dialog", {
      name: /Cellule de rendu/i,
    });
    fireEvent.change(openManualRenderUpload(readyDialog), {
      target: {
        files: [selectedManualRender],
      },
    });
    fireEvent.click(
      within(readyDialog).getByRole("button", {
        name: "Remplacer par ce rendu",
      }),
    );

    await waitFor(() => {
      expect(dependencies.createUpload).toHaveBeenCalledWith("admin-token", {
        byte_size: preparedManualRender.size,
        content_type: "image/jpeg",
        purpose: "manual_render",
        render_cell_id: renderCell.id,
      });
    });
    expect(prepareAdminImageUploadFile).toHaveBeenCalledWith({
      file: selectedManualRender,
      purpose: "manual_render",
    });
    expect(dependencies.uploadToSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_id: "manual-render-upload",
      }),
      preparedManualRender,
    );
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Variante/i }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

    await within(dialog).findByAltText(`Aperçu de la variante ${candidateId}`);
    fireEvent.change(openManualRenderUpload(dialog), {
      target: {
        files: [new File(["manual"], "manual.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remplacer par ce rendu" }),
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
    await within(dialog).findByText("Prêt");

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Fermer la cellule de rendu",
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Cellule de rendu/i }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Prêt/i }),
    );
    const reopenedDialog = screen.getByRole("dialog", {
      name: /Cellule de rendu/i,
    });

    expect(
      within(reopenedDialog).getByRole("button", {
        name: "Voir les variantes",
      }),
    ).toBeInTheDocument();
    expect(
      within(reopenedDialog).getByRole("button", {
        name: "Générer une nouvelle variante",
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Boucle ivoire, Front : Prêt/i }),
    );
    const cellDialog = screen.getByRole("dialog", {
      name: /Cellule de rendu/i,
    });
    const cellCloseButton = within(cellDialog).getByRole("button", {
      name: "Fermer la cellule de rendu",
    });

    expect(cellCloseButton).toBeInTheDocument();
    expectCloseIconButton(cellCloseButton);
    expect(
      within(cellDialog).queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        renderCell.current_private_asset_id,
        "medium",
      );
    });
    // RU: Эта картинка нужна, чтобы проверить открытие большого просмотра по клику.
    // FR: Cette image sert a verifier l'ouverture du grand apercu au clic.
    const currentRenderPreview = await within(cellDialog).findByRole("img", {
      name: "Aperçu du rendu actuel",
    });
    expect(currentRenderPreview).toHaveAttribute(
      "src",
      `blob:admin-preview/${renderCell.current_private_asset_id}`,
    );

    fireEvent.click(currentRenderPreview);
    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        renderCell.current_private_asset_id,
        "original",
      );
    });
    const currentImageDialog = screen.getByRole("dialog", {
      name: /Grande image : Rendu actuel/i,
    });
    expect(
      within(currentImageDialog).getByRole("img", {
        name: "Aperçu du rendu actuel",
      }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${renderCell.current_private_asset_id}`,
    );
    const currentImageCloseButton = within(currentImageDialog).getByRole(
      "button",
      {
        name: "Fermer la grande image",
      },
    );

    expectCloseIconButton(currentImageCloseButton);
    fireEvent.click(currentImageCloseButton);

    expect(
      within(cellDialog).queryByRole("button", {
        name: "Voir le rendu actuel",
      }),
    ).not.toBeInTheDocument();
    const readyGenerationGroup = within(cellDialog).getByRole("group", {
      name: "Action de génération",
    });
    fireEvent.click(
      within(readyGenerationGroup).getByRole("button", {
        name: "Générer une nouvelle variante",
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
      within(cellDialog).getByRole("button", { name: "Voir les variantes" }),
    );

    expect(
      await within(cellDialog).findByAltText(
        "Aperçu de la variante 00000000-0000-4000-8000-000000000909",
      ),
    ).toBeInTheDocument();
    expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
      "admin-token",
      newCandidate.asset_id,
      "small",
    );
    const candidateGenerationGroup = within(cellDialog).getByRole("group", {
      name: "Action de génération",
    });
    expect(
      within(candidateGenerationGroup).queryByLabelText("Note facultative"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(candidateGenerationGroup).getByRole("button", {
        name: "Ajouter une note",
      }),
    );
    fireEvent.change(
      within(candidateGenerationGroup).getByLabelText("Note facultative"),
      {
        target: {
          value: "Make the fabric a little smoother",
        },
      },
    );
    fireEvent.click(
      within(candidateGenerationGroup).getByRole("button", {
        name: "Générer une nouvelle variante",
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
      name: "Aperçu de la variante 00000000-0000-4000-8000-000000000908",
    });
    const currentCandidateCard = within(cellDialog).getByRole("article", {
      name: /Variante 00000000-0000-4000-8000-000000000908/i,
    });
    const newCandidateCard = within(cellDialog).getByRole("article", {
      name: /Variante 00000000-0000-4000-8000-000000000909/i,
    });

    expect(currentCandidateCard).toHaveAttribute("aria-current", "true");
    expect(
      within(currentCandidateCard).getByText("Sélection actuelle"),
    ).toHaveAttribute("data-state", "current");
    expect(
      within(newCandidateCard).getByText("À sélectionner"),
    ).toHaveAttribute("data-state", "ready");
    expect(
      within(newCandidateCard).getByRole("button", { name: "Comparer" }),
    ).toBeInTheDocument();

    fireEvent.click(currentCandidatePreview);
    const currentCandidateCompareDialog = screen.getByRole("dialog", {
      name: /Comparer la variante de rendu 00000000-0000-4000-8000-000000000908/i,
    });
    expect(
      within(currentCandidateCompareDialog).getByRole("button", {
        name: "Utiliser la variante",
      }),
    ).toBeDisabled();
    const currentCandidateCloseButton = within(
      currentCandidateCompareDialog,
    ).getByRole("button", {
      name: "Fermer la comparaison",
    });

    expectCloseIconButton(currentCandidateCloseButton);
    fireEvent.click(currentCandidateCloseButton);

    expect(
      within(cellDialog).queryByRole("button", {
        name: "Compare candidate 00000000-0000-4000-8000-000000000909",
      }),
    ).not.toBeInTheDocument();

    // RU: Эта картинка нужна, чтобы проверить сравнение нового варианта по клику.
    // FR: Cette image sert a verifier la comparaison de la nouvelle option au clic.
    const candidatePreview = within(cellDialog).getByRole("img", {
      name: "Aperçu de la variante 00000000-0000-4000-8000-000000000909",
    });

    fireEvent.click(candidatePreview);
    const compareDialog = screen.getByRole("dialog", {
      name: /Comparer la variante de rendu/i,
    });
    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        visualColumn.current_source_photo.asset_id,
        "medium",
      );
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        newCandidate.asset_id,
        "medium",
      );
    });
    const previousCandidateButton = within(compareDialog).getByRole("button", {
      name: "Variante précédente",
    });
    const nextCandidateButton = within(compareDialog).getByRole("button", {
      name: "Variante suivante",
    });

    expectCandidateArrowButton(previousCandidateButton, "previous");
    expectCandidateArrowButton(nextCandidateButton, "next");

    expect(
      within(compareDialog).getByRole("img", {
        name: "Aperçu de la photo source",
      }),
    ).toHaveAttribute(
      "src",
      `blob:admin-preview/${visualColumn.current_source_photo.asset_id}`,
    );
    expect(
      within(compareDialog).getByRole("img", {
        name: "Aperçu de la variante 00000000-0000-4000-8000-000000000909",
      }),
    ).toHaveAttribute("src", `blob:admin-preview/${newCandidate.asset_id}`);

    fireEvent.click(
      within(compareDialog).getByRole("img", {
        name: "Aperçu de la variante 00000000-0000-4000-8000-000000000909",
      }),
    );
    await waitFor(() => {
      expect(dependencies.createStorageAssetPreviewUrl).toHaveBeenCalledWith(
        "admin-token",
        newCandidate.asset_id,
        "original",
      );
    });
    const candidateImageDialog = screen.getByRole("dialog", {
      name: /Grande image : Variante/i,
    });
    expect(
      within(candidateImageDialog).getByRole("img", {
        name: "Aperçu de la variante 00000000-0000-4000-8000-000000000909",
      }),
    ).toHaveAttribute("src", `blob:admin-preview/${newCandidate.asset_id}`);
    const candidateImageCloseButton = within(candidateImageDialog).getByRole(
      "button",
      {
        name: "Fermer la grande image",
      },
    );

    expectCloseIconButton(candidateImageCloseButton);
    fireEvent.click(candidateImageCloseButton);

    fireEvent.click(
      within(compareDialog).getByRole("button", {
        name: "Utiliser la variante",
      }),
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
    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Linen Clay, Arm detail : Bloqu\u00e9/i,
      }),
    );
    const dialog = screen.getByRole("dialog", { name: /Cellule de rendu/i });

    expect(within(dialog).getByText("Rendu bloqué")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Complétez d'abord l'entrée de rendu manquante.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Photo source manquante"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("MISSING_SOURCE_PHOTO"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("Aucune source pour le moment"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Généré par IA")).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Aller à Colonnes de vue" }),
    );

    expect(
      screen.getByRole("tabpanel", { name: /Colonnes de vue/i }),
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
    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));
    expect(
      screen.queryByRole("button", { name: "Retirer la publication" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publier le canapé" }));

    await waitFor(() => {
      expect(dependencies.publishSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Publié").length).toBeGreaterThan(0);
    });
    expect(
      screen.queryByRole("button", { name: "Publier le canapé" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Retirer la publication" }),
    );

    await waitFor(() => {
      expect(dependencies.unpublishSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Brouillon").length).toBeGreaterThan(0);
    });
  });

  it("archives a published sofa from the publication section", async () => {
    const dependencies = createDependencies({
      getSofa: vi.fn(async () => ({
        archived_at: null,
        created_at: "2026-04-28T10:00:00.000Z",
        depth_cm: 95,
        footprint_measurements: null,
        footprint_type: null,
        height_cm: 82,
        id: "00000000-0000-4000-8000-000000000701",
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
    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));
    fireEvent.click(screen.getByRole("button", { name: "Archiver le canapé" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l'archivage" }),
    );

    await waitFor(() => {
      expect(dependencies.archiveSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Archivé").length).toBeGreaterThan(0);
    });
    expect(
      screen.queryByRole("button", { name: "Retirer la publication" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archiver le canapé" }),
    ).not.toBeInTheDocument();
  });

  it("restores an archived sofa from the publication section", async () => {
    const dependencies = createDependencies({
      getSofa: vi.fn(async () => ({
        archived_at: "2026-04-28T10:55:00.000Z",
        created_at: "2026-04-28T10:00:00.000Z",
        depth_cm: 95,
        footprint_measurements: null,
        footprint_type: null,
        height_cm: 82,
        id: "00000000-0000-4000-8000-000000000701",
        internal_name: "Manual test sofa",
        lifecycle_state: "archived",
        manual_public_order: null,
        public_description: "Manual copy",
        public_name: "Canape test",
        public_slug: "canape-test",
        shopify_order_url: "https://example.com/products/manual-test",
        tags: [],
        updated_at: "2026-04-28T10:55:00.000Z",
        length_cm: 220,
      })),
    });

    render(
      <AdminSofaEditPage
        dependencies={dependencies}
        sofaId="00000000-0000-4000-8000-000000000701"
      />,
    );

    await screen.findByRole("heading", { name: "Manual test sofa" });
    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));
    expect(
      screen.queryByRole("button", { name: "Archiver le canapé" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Restaurer depuis l'archive" }),
    );

    await waitFor(() => {
      expect(dependencies.unarchiveSofa).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000701",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Brouillon").length).toBeGreaterThan(0);
    });
    expect(
      screen.queryByRole("button", { name: "Restaurer depuis l'archive" }),
    ).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));
    expect(
      screen.queryByRole("button", { name: "Créer l'export ZIP" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Rendus/i }));
    fireEvent.click(screen.getByRole("button", { name: "Créer l'export ZIP" }));

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
      name: "Télécharger l'export ZIP",
    });
    expect(downloadLink).toHaveAttribute(
      "href",
      "https://storage.example/signed/render-export.zip",
    );
    expect(screen.getByText("2 rendus inclus.")).toBeInTheDocument();
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
      screen.queryByRole("button", { name: "Publier le canapé" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Publication/i }));

    expect(screen.getByText("Aucun tissu public")).toBeInTheDocument();
    expect(screen.getByText("Rendus publics manquants")).toBeInTheDocument();
    expect(screen.queryByText("MISSING_PUBLIC_FABRIC")).not.toBeInTheDocument();
    expect(
      screen.queryByText("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Aller à Tissus associés" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Aller à Rendus" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Aller à Tissus associés" }),
    );

    expect(
      screen.getByRole("tabpanel", { name: /Tissus associ\u00e9s/i }),
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
          requestUrl.endsWith(
            `/api/admin/storage-assets/${assetId}/preview?variant=original`,
          )
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

        if (requestUrl.endsWith(`/api/admin/sofas/${sofaId}/archive`)) {
          return jsonResponse({
            data: {
              sofa: {
                archived_at: "2026-04-28T10:55:00.000Z",
                id: sofaId,
                lifecycle_state: "archived",
              },
            },
            meta: {},
          });
        }

        if (requestUrl.endsWith(`/api/admin/sofas/${sofaId}/unarchive`)) {
          return jsonResponse({
            data: {
              sofa: {
                archived_at: null,
                id: sofaId,
                lifecycle_state: "draft",
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
    await dependencies.archiveSofa("admin-token", sofaId);
    await dependencies.unarchiveSofa("admin-token", sofaId);
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
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/archive",
      "/api/admin/sofas/00000000-0000-4000-8000-000000000701/unarchive",
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
      "/api/admin/storage-assets/00000000-0000-4000-8000-000000000907/preview?variant=original",
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
