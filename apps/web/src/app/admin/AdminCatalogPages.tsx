"use client";

/*
RU: Этот файл нужен для страниц админского каталога.
RU: На экране админ видит диваны, ткани, формы, загрузку фото, подготовку изображений и публикацию.
RU: Здесь можно менять данные, запускать создание изображений, улучшать вариант, выбирать готовую картинку, публиковать и снимать публикацию.
FR: Ce fichier sert aux pages du catalogue admin.
FR: A l'ecran, l'admin voit les canapes, tissus, formulaires, envois de photos, preparation d'images et publication.
FR: Ici, on peut modifier les donnees, lancer la creation d'images, ameliorer une option, choisir l'image finale, publier et retirer la publication.
*/

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  FormEvent,
  ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getDefaultFabricSwatchCrop,
  prepareAdminImageUploadFile,
  type FabricSwatchCrop,
} from "../../lib/admin-image-upload";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import {
  buildSofaEditTabReadiness,
  getPublicationBlockerTarget,
  getRenderCellDisplayBlockers,
  getRenderCellDisplayStatus,
  getRenderCellPrimaryAction,
  type RenderCellDisplayStatus,
  type SofaEditReadinessKind,
  type SofaEditTabKey,
} from "./admin-sofa-edit-model";
import {
  formatAdminApiErrorMessage,
  formatAdminErrorMessage,
  formatAdminPublicationBlockerLabel,
  formatRenderCellBlockerLabel,
} from "./admin-error-messages";
import { AdminPageHeader, AdminShell } from "./AdminShell";

type AdminPageState = "checking" | "forbidden" | "ready";

// RU: Это число задает самый большой зум для выбора образца ткани.
// FR: Ce nombre fixe le plus grand zoom pour choisir l'echantillon de tissu.
const FABRIC_SWATCH_ZOOM_MAX_PERCENT = 500;

// RU: Это число ограничивает список найденных тегов, чтобы он не стал слишком длинным.
// FR: Ce nombre limite la liste des etiquettes trouvees pour qu'elle reste courte.
const TAG_SEARCH_RESULT_LIMIT = 8;

export interface AdminCatalogTag {
  id: string;
  public_label: string;
  slug: string;
}

export interface AdminCatalogSofa {
  created_at: string;
  depth_cm: number | null;
  footprint_measurements: unknown;
  footprint_type: string | null;
  height_cm: number | null;
  id: string;
  internal_name: string;
  lifecycle_state: string;
  manual_public_order: number | null;
  public_description: string | null;
  public_name: string | null;
  public_slug: string | null;
  shopify_order_url: string | null;
  source_photo_count?: number | null;
  source_photo_preview_url?: string | null;
  tags: AdminCatalogTag[];
  updated_at: string;
  length_cm: number | null;
}

export interface AdminCatalogReadiness {
  errors: Array<{
    code: string;
    message: string;
  }>;
  ready: boolean;
}

export interface AdminCatalogAsset {
  asset_kind: string;
  byte_size: number | null;
  content_type: string;
  height_px: number | null;
  id: string;
  lifecycle_state: string;
  visibility: string;
  width_px: number | null;
}

export interface AdminCatalogFabric {
  ai_reference_asset: AdminCatalogAsset | null;
  ai_reference_asset_id: string;
  archived_at: string | null;
  created_at: string;
  id: string;
  internal_name: string;
  is_premium: boolean;
  lifecycle_state: string;
  public_name: string;
  swatch_preview_url: string | null;
  swatch_asset: AdminCatalogAsset | null;
  swatch_asset_id: string;
  updated_at: string;
}

export interface AdminCatalogUpload {
  expires_at: string;
  method: "signed_upload";
  signed_upload_url: string;
  upload_id: string;
}

export interface AdminCatalogSofaFabric {
  assigned_at: string;
  fabric: AdminCatalogFabric | null;
  fabric_id: string;
  public_order: number | null;
  sofa_id: string;
  updated_at: string;
}

export interface AdminCatalogSofaSourcePhoto {
  asset: AdminCatalogAsset | null;
  asset_id: string;
  created_at: string;
  id: string;
  original_fabric_id: string;
  preview_url?: string | null;
  sofa_id: string;
  updated_at: string;
  visual_matrix_column_id: string;
}

// RU: Этот список задает шаги страницы дивана в верхней панели.
// FR: Cette liste fixe les etapes de la page du canape dans la barre du haut.
const SOFA_EDIT_TABS = [
  { key: "basics", label: "Basics" },
  { key: "fabrics", label: "Fabric lines" },
  { key: "visual_matrix", label: "View columns" },
  { key: "renders", label: "Renders" },
  { key: "publish", label: "Publish" },
] as const;

// RU: Эти подписи показывают, в каком положении находится ячейка картинки.
// FR: Ces libelles indiquent la situation d'une case image.
const RENDER_CELL_STATUS_LABELS: Record<RenderCellDisplayStatus, string> = {
  blocked: "Blocked",
  candidate: "Candidate",
  failed: "Failed",
  missing: "Missing",
  processing: "Processing",
  queued: "Queued",
  ready: "Ready",
};

// RU: Этот порядок держит легенду одинаковой на каждом экране.
// FR: Cet ordre garde la legende identique sur chaque ecran.
const RENDER_CELL_STATUS_ORDER: RenderCellDisplayStatus[] = [
  "ready",
  "missing",
  "candidate",
  "blocked",
  "queued",
  "processing",
  "failed",
];

// RU: Эти короткие знаки помогают отличать ячейки без опоры только на цвет.
// FR: Ces signes courts aident a distinguer les cases sans compter seulement sur la couleur.
const RENDER_CELL_STATUS_MARKERS: Record<RenderCellDisplayStatus, string> = {
  blocked: "B",
  candidate: "C",
  failed: "F",
  missing: "M",
  processing: "P",
  queued: "Q",
  ready: "R",
};

export interface AdminCatalogVisualMatrixColumn {
  admin_label: string | null;
  created_at: string;
  current_source_photo: AdminCatalogSofaSourcePhoto | null;
  current_source_photo_id: string | null;
  deleted_at: string | null;
  id: string;
  public_label: string | null;
  sequence: number;
  sofa_id: string;
  updated_at: string;
}

export interface AdminCatalogFabricRenderJob {
  attempt_count: number;
  completed_at: string | null;
  created_at: string;
  fabric_id: string;
  generation_mode: string;
  id: string;
  last_error_message: string | null;
  max_attempts: number;
  prompt_note: string | null;
  queued_at: string | null;
  request_id: string;
  refinement_source_asset_id: string | null;
  refine_prompt: string | null;
  render_cell_id: string;
  sofa_id: string;
  status: string;
  updated_at: string;
  visual_matrix_column_id: string;
}

export interface AdminCatalogRenderCandidate {
  accepted_at: string | null;
  asset: AdminCatalogAsset | null;
  asset_id: string;
  created_at: string;
  fabric_id: string;
  generation_mode: string;
  id: string;
  is_current: boolean;
  job_id: string;
  preview_url: string | null;
  prompt_version: string;
  provider_model: string;
  provider_name: string;
  render_cell_id: string;
  sofa_id: string;
  visual_matrix_column_id: string;
}

export interface AdminCatalogRenderCell {
  blockers: string[];
  can_generate_initial: boolean;
  candidate_count: number;
  current_private_asset_id: string | null;
  current_private_preview_url?: string | null;
  current_public_asset_id: string | null;
  fabric_id: string;
  has_private_render: boolean;
  has_public_render: boolean;
  id: string;
  latest_job: AdminCatalogFabricRenderJob | null;
  sofa_id: string;
  source_photo_id: string | null;
  source_type: string;
  updated_at: string;
  visual_matrix_column_id: string;
}

export interface AdminCatalogRenderCoverage {
  render_cells: AdminCatalogRenderCell[];
  sofa_fabrics: AdminCatalogSofaFabric[];
  sofa_id: string;
  visual_matrix_columns: AdminCatalogVisualMatrixColumn[];
}

export interface AdminSofaRenderExport {
  asset_id: string | null;
  completed_at: string | null;
  created_at: string;
  download_url: string | null;
  expires_at: string | null;
  id: string;
  included_render_count: number | null;
  last_error_message: string | null;
  sofa_id: string;
  status: string;
}

type AdminLargeImagePreview = {
  alt: string;
  src: string;
  title: string;
};

type AdminBadgeTone = "danger" | "muted" | "neutral" | "ready" | "warning";

export interface SofaMutationInput {
  depth_cm?: number;
  height_cm?: number;
  internal_name?: string;
  manual_public_order?: number;
  public_description?: string;
  public_name?: string;
  shopify_order_url?: string;
  tag_ids: string[];
  length_cm?: number;
}

export interface TagMutationInput {
  public_label: string;
}

export interface FabricMutationInput {
  ai_reference_asset_id: string;
  internal_name: string;
  is_premium: boolean;
  public_name: string;
  swatch_asset_id: string;
}

export type FabricPatchInput = Partial<FabricMutationInput>;

interface FabricSwatchCropSelection {
  crop: FabricSwatchCrop;
  fileName: string;
  imageHeight: number;
  imageWidth: number;
  previewUrl: string;
  zoomPercent: number;
}

interface FabricImagePreview {
  canRevoke: boolean;
  fileName: string;
  previewUrl: string;
}

interface FabricSwatchPointerPoint {
  clientX: number;
  clientY: number;
}

export interface UploadCreateInput {
  byte_size: number;
  content_type: string;
  original_fabric_id?: string;
  purpose:
    | "fabric_swatch"
    | "fabric_ai_reference"
    | "sofa_source_photo"
    | "manual_render";
  render_cell_id?: string;
  sofa_id?: string;
  visual_matrix_column_id?: string;
}

export interface SofaFabricMutationInput {
  public_order: number | null;
}

export interface VisualMatrixColumnMutationInput {
  admin_label: string | null;
  public_label: string | null;
  sequence: number;
}

export type VisualMatrixColumnPatchInput =
  Partial<VisualMatrixColumnMutationInput> & {
    source_original_fabric_id?: string;
  };

export type FabricRenderJobCreateInput =
  | {
      fabric_id: string;
      generation_mode: "initial";
      idempotency_key?: string;
      prompt_note: string | null;
      refinement_source_asset_id?: null;
      refine_prompt?: null;
      sofa_id: string;
      visual_matrix_column_id: string;
    }
  | {
      fabric_id: string;
      generation_mode: "refine";
      idempotency_key?: string;
      prompt_note?: null;
      refinement_source_asset_id: string;
      refine_prompt: string;
      sofa_id: string;
      visual_matrix_column_id: string;
    };

export interface FabricRenderJobBatchResult {
  fabric_render_jobs: AdminCatalogFabricRenderJob[];
  job_ids: string[];
  request_id: string | null;
  status: "noop" | "queued";
  total_jobs: number;
}

export type FabricRenderResumeInput =
  | {
      request_id: string;
      sofa_id?: null;
    }
  | {
      request_id?: null;
      sofa_id: string;
    };

export interface FabricRenderResumeResult {
  request_ids: string[];
  status: "noop" | "started";
  total_requests: number;
}

export interface AdminCatalogPageDependencies {
  archiveFabric(
    accessToken: string,
    fabricId: string,
  ): Promise<AdminCatalogFabric>;
  assignSofaFabric(
    accessToken: string,
    sofaId: string,
    fabricId: string,
    input: SofaFabricMutationInput,
  ): Promise<AdminCatalogSofaFabric>;
  clearTrustedDevice(): Promise<void>;
  completeUpload(
    accessToken: string,
    uploadId: string,
  ): Promise<AdminCatalogAsset>;
  createFabric(
    accessToken: string,
    input: FabricMutationInput,
  ): Promise<AdminCatalogFabric>;
  createSofa(
    accessToken: string,
    input: SofaMutationInput,
  ): Promise<AdminCatalogSofa>;
  createSofaRenderExport(
    accessToken: string,
    sofaId: string,
  ): Promise<AdminSofaRenderExport>;
  createTag(
    accessToken: string,
    input: TagMutationInput,
  ): Promise<AdminCatalogTag>;
  createUpload(
    accessToken: string,
    input: UploadCreateInput,
  ): Promise<AdminCatalogUpload>;
  createStorageAssetPreviewUrl(
    accessToken: string,
    assetId: string,
  ): Promise<string>;
  createFabricRenderJob(
    accessToken: string,
    input: FabricRenderJobCreateInput,
  ): Promise<AdminCatalogFabricRenderJob>;
  generateFabricRenderJobsForSofa(
    accessToken: string,
    sofaId: string,
  ): Promise<FabricRenderJobBatchResult>;
  createVisualMatrixColumn(
    accessToken: string,
    sofaId: string,
    input: VisualMatrixColumnMutationInput,
  ): Promise<AdminCatalogVisualMatrixColumn>;
  deleteVisualMatrixColumn(
    accessToken: string,
    columnId: string,
  ): Promise<void>;
  deleteTag(accessToken: string, tagId: string): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getFabric(accessToken: string, fabricId: string): Promise<AdminCatalogFabric>;
  getFabricRenderJob(
    accessToken: string,
    jobId: string,
  ): Promise<AdminCatalogFabricRenderJob>;
  getRenderCoverage(
    accessToken: string,
    sofaId: string,
  ): Promise<AdminCatalogRenderCoverage>;
  listRenderCellCandidates(
    accessToken: string,
    renderCellId: string,
  ): Promise<AdminCatalogRenderCandidate[]>;
  getSofa(accessToken: string, sofaId: string): Promise<AdminCatalogSofa>;
  getSofaReadiness(
    accessToken: string,
    sofaId: string,
  ): Promise<AdminCatalogReadiness>;
  getSofaRenderExport(
    accessToken: string,
    exportId: string,
  ): Promise<AdminSofaRenderExport>;
  publishSofa(accessToken: string, sofaId: string): Promise<AdminCatalogSofa>;
  listFabrics(accessToken: string): Promise<AdminCatalogFabric[]>;
  listSofas(accessToken: string): Promise<AdminCatalogSofa[]>;
  listSofaFabrics(
    accessToken: string,
    sofaId: string,
  ): Promise<AdminCatalogSofaFabric[]>;
  listTags(accessToken: string): Promise<AdminCatalogTag[]>;
  listVisualMatrixColumns(
    accessToken: string,
    sofaId: string,
  ): Promise<AdminCatalogVisualMatrixColumn[]>;
  navigate(path: string): void;
  redirect(path: string): void;
  refreshAccessToken(): Promise<string | null>;
  removeSofaFabric(
    accessToken: string,
    sofaId: string,
    fabricId: string,
  ): Promise<void>;
  revokeStorageAssetPreviewUrl(url: string): void;
  resumeFabricRenderJobs(
    accessToken: string,
    input: FabricRenderResumeInput,
  ): Promise<FabricRenderResumeResult>;
  retryFabricRenderJob(
    accessToken: string,
    jobId: string,
  ): Promise<AdminCatalogFabricRenderJob>;
  unpublishSofa(accessToken: string, sofaId: string): Promise<AdminCatalogSofa>;
  setManualRender(
    accessToken: string,
    renderCellId: string,
    input: {
      asset_id: string;
    },
  ): Promise<AdminCatalogRenderCell>;
  signOut(): Promise<void>;
  updateFabric(
    accessToken: string,
    fabricId: string,
    input: FabricPatchInput,
  ): Promise<AdminCatalogFabric>;
  updateSofa(
    accessToken: string,
    sofaId: string,
    input: SofaMutationInput,
  ): Promise<AdminCatalogSofa>;
  updateSofaFabric(
    accessToken: string,
    sofaId: string,
    fabricId: string,
    input: SofaFabricMutationInput,
  ): Promise<AdminCatalogSofaFabric>;
  updateTag(
    accessToken: string,
    tagId: string,
    input: TagMutationInput,
  ): Promise<AdminCatalogTag>;
  updateVisualMatrixColumn(
    accessToken: string,
    columnId: string,
    input: VisualMatrixColumnPatchInput,
  ): Promise<AdminCatalogVisualMatrixColumn>;
  subscribeToFabricRenderJobs?(
    sofaId: string,
    onJobChange: (job: Partial<AdminCatalogFabricRenderJob>) => void,
  ): () => void;
  useRenderCandidate(
    accessToken: string,
    candidateId: string,
  ): Promise<AdminCatalogRenderCandidate>;
  uploadToSignedUrl(upload: AdminCatalogUpload, file: File): Promise<void>;
  verifyAdminSession(accessToken: string): Promise<{
    ok: boolean;
    status: number;
  }>;
}

export function AdminSofasPage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <SofaListContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function AdminSofaCreatePage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <SofaCreateContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function AdminSofaEditPage({
  dependencies,
  sofaId,
}: {
  dependencies?: AdminCatalogPageDependencies;
  sofaId: string;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <SofaEditContent
          accessToken={accessToken}
          dependencies={activeDependencies}
          sofaId={sofaId}
        />
      )}
    />
  );
}

export function AdminFabricsPage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <FabricListContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function AdminFabricCreatePage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <FabricCreateContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function AdminFabricEditPage({
  dependencies,
  fabricId,
}: {
  dependencies?: AdminCatalogPageDependencies;
  fabricId: string;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <FabricEditContent
          accessToken={accessToken}
          dependencies={activeDependencies}
          fabricId={fabricId}
        />
      )}
    />
  );
}

export function AdminTagsPage({
  dependencies,
}: {
  dependencies?: AdminCatalogPageDependencies;
}) {
  return (
    <ProtectedAdminCatalogPage
      dependencies={dependencies}
      render={(accessToken, activeDependencies) => (
        <TagManagerContent
          accessToken={accessToken}
          dependencies={activeDependencies}
        />
      )}
    />
  );
}

export function createDefaultAdminCatalogDependencies(
  navigate: (path: string) => void,
  redirect: (path: string) => void,
): AdminCatalogPageDependencies {
  return {
    async archiveFabric(accessToken, fabricId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/fabrics/${fabricId}/archive`,
        {
          method: "POST",
        },
      );

      return data.fabric as AdminCatalogFabric;
    },
    async assignSofaFabric(accessToken, sofaId, fabricId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/fabrics/${fabricId}`,
        {
          body: JSON.stringify(input),
          method: "PUT",
        },
      );

      return data.sofa_fabric as AdminCatalogSofaFabric;
    },
    async clearTrustedDevice() {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    },
    async completeUpload(accessToken, uploadId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/uploads/${encodeURIComponent(uploadId)}/complete`,
        {
          method: "POST",
        },
      );

      return data.asset as AdminCatalogAsset;
    },
    async createFabric(accessToken, input) {
      const data = await requestAdminJson(accessToken, "/api/admin/fabrics", {
        body: JSON.stringify(input),
        method: "POST",
      });

      return data.fabric as AdminCatalogFabric;
    },
    async createSofa(accessToken, input) {
      const data = await requestAdminJson(accessToken, "/api/admin/sofas", {
        body: JSON.stringify(input),
        method: "POST",
      });

      return data.sofa as AdminCatalogSofa;
    },
    async createSofaRenderExport(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/render-exports`,
        {
          method: "POST",
        },
      );

      return data.render_export as AdminSofaRenderExport;
    },
    async createTag(accessToken, input) {
      const data = await requestAdminJson(accessToken, "/api/admin/tags", {
        body: JSON.stringify(input),
        method: "POST",
      });

      return data.tag as AdminCatalogTag;
    },
    async createUpload(accessToken, input) {
      const data = await requestAdminJson(accessToken, "/api/admin/uploads", {
        body: JSON.stringify(input),
        method: "POST",
      });

      return data.upload as AdminCatalogUpload;
    },
    async createStorageAssetPreviewUrl(accessToken, assetId) {
      const response = await fetch(
        `/api/admin/storage-assets/${encodeURIComponent(assetId)}/preview`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("ASSET_PREVIEW_UNAVAILABLE");
      }

      return globalThis.URL.createObjectURL(await response.blob());
    },
    async createFabricRenderJob(accessToken, input) {
      const data = await requestAdminJson(
        accessToken,
        "/api/admin/fabric-render-jobs",
        {
          body: JSON.stringify(input),
          method: "POST",
        },
      );

      return data.fabric_render_job as AdminCatalogFabricRenderJob;
    },
    async generateFabricRenderJobsForSofa(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/fabric-render-jobs/generate-all`,
        {
          method: "POST",
        },
      );

      return data as FabricRenderJobBatchResult;
    },
    async createVisualMatrixColumn(accessToken, sofaId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/visual-matrix-columns`,
        {
          body: JSON.stringify(input),
          method: "POST",
        },
      );

      return data.visual_matrix_column as AdminCatalogVisualMatrixColumn;
    },
    async deleteVisualMatrixColumn(accessToken, columnId) {
      await requestAdminJson(
        accessToken,
        `/api/admin/visual-matrix-columns/${columnId}`,
        {
          method: "DELETE",
        },
      );
    },
    async deleteTag(accessToken, tagId) {
      await requestAdminJson(accessToken, `/api/admin/tags/${tagId}`, {
        method: "DELETE",
      });
    },
    async getAccessToken() {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();

      return data.session?.access_token ?? null;
    },
    async getFabric(accessToken, fabricId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/fabrics/${fabricId}`,
      );

      return data.fabric as AdminCatalogFabric;
    },
    async getFabricRenderJob(accessToken, jobId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/fabric-render-jobs/${jobId}`,
      );

      return data.fabric_render_job as AdminCatalogFabricRenderJob;
    },
    async getRenderCoverage(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/render-coverage`,
      );

      return data.render_coverage as AdminCatalogRenderCoverage;
    },
    async listRenderCellCandidates(accessToken, renderCellId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/render-cells/${renderCellId}/candidates`,
      );

      return data.render_candidates as AdminCatalogRenderCandidate[];
    },
    async getSofa(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}`,
      );

      return data.sofa as AdminCatalogSofa;
    },
    async getSofaReadiness(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/publication-readiness`,
      );

      return data.readiness as AdminCatalogReadiness;
    },
    async getSofaRenderExport(accessToken, exportId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/render-exports/${exportId}`,
      );

      return data.render_export as AdminSofaRenderExport;
    },
    async publishSofa(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/publish`,
        {
          method: "POST",
        },
      );

      return data.sofa as AdminCatalogSofa;
    },
    async listSofas(accessToken) {
      const data = await requestAdminJson(accessToken, "/api/admin/sofas");

      return data.sofas as AdminCatalogSofa[];
    },
    async listFabrics(accessToken) {
      const data = await requestAdminJson(accessToken, "/api/admin/fabrics");

      return data.fabrics as AdminCatalogFabric[];
    },
    async listSofaFabrics(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/fabrics`,
      );

      return data.sofa_fabrics as AdminCatalogSofaFabric[];
    },
    async listTags(accessToken) {
      const data = await requestAdminJson(accessToken, "/api/admin/tags");

      return data.tags as AdminCatalogTag[];
    },
    async listVisualMatrixColumns(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/visual-matrix-columns`,
      );

      return data.visual_matrix_columns as AdminCatalogVisualMatrixColumn[];
    },
    navigate,
    redirect,
    async refreshAccessToken() {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        return null;
      }

      return data.session?.access_token ?? null;
    },
    async removeSofaFabric(accessToken, sofaId, fabricId) {
      await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/fabrics/${fabricId}`,
        {
          method: "DELETE",
        },
      );
    },
    revokeStorageAssetPreviewUrl(url) {
      globalThis.URL.revokeObjectURL(url);
    },
    async resumeFabricRenderJobs(accessToken, input) {
      const data = await requestAdminJson(
        accessToken,
        "/api/admin/fabric-render-jobs/resume",
        {
          body: JSON.stringify(input),
          method: "POST",
        },
      );

      return data as FabricRenderResumeResult;
    },
    async retryFabricRenderJob(accessToken, jobId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/fabric-render-jobs/${jobId}/retry`,
        {
          method: "POST",
        },
      );

      return data.fabric_render_job as AdminCatalogFabricRenderJob;
    },
    async unpublishSofa(accessToken, sofaId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/unpublish`,
        {
          method: "POST",
        },
      );

      return data.sofa as AdminCatalogSofa;
    },
    async setManualRender(accessToken, renderCellId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/render-cells/${renderCellId}/manual-render`,
        {
          body: JSON.stringify(input),
          method: "POST",
        },
      );

      return data.render_cell as AdminCatalogRenderCell;
    },
    async signOut() {
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut();
    },
    async updateFabric(accessToken, fabricId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/fabrics/${fabricId}`,
        {
          body: JSON.stringify(input),
          method: "PATCH",
        },
      );

      return data.fabric as AdminCatalogFabric;
    },
    async updateSofa(accessToken, sofaId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}`,
        {
          body: JSON.stringify(input),
          method: "PATCH",
        },
      );

      return data.sofa as AdminCatalogSofa;
    },
    async updateSofaFabric(accessToken, sofaId, fabricId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/sofas/${sofaId}/fabrics/${fabricId}`,
        {
          body: JSON.stringify(input),
          method: "PATCH",
        },
      );

      return data.sofa_fabric as AdminCatalogSofaFabric;
    },
    async updateTag(accessToken, tagId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/tags/${tagId}`,
        {
          body: JSON.stringify(input),
          method: "PATCH",
        },
      );

      return data.tag as AdminCatalogTag;
    },
    async updateVisualMatrixColumn(accessToken, columnId, input) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/visual-matrix-columns/${columnId}`,
        {
          body: JSON.stringify(input),
          method: "PATCH",
        },
      );

      return data.visual_matrix_column as AdminCatalogVisualMatrixColumn;
    },
    subscribeToFabricRenderJobs(sofaId, onJobChange) {
      const supabase = getBrowserSupabaseClient();
      const channel = supabase
        .channel(`admin:fabric-render-jobs:${sofaId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `sofa_id=eq.${sofaId}`,
            schema: "public",
            table: "fabric_render_jobs",
          },
          (payload) => {
            if (
              payload.new &&
              typeof payload.new === "object" &&
              !Array.isArray(payload.new)
            ) {
              onJobChange(payload.new as Partial<AdminCatalogFabricRenderJob>);
            }
          },
        )
        .on("system", {}, (payload) => {
          if (payload?.status === "error") {
            console.warn(
              "Fabric render Realtime subscription failed.",
              payload,
            );
          }
        });

      void channel.subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "Fabric render Realtime channel could not subscribe.",
            error,
          );
        }
      });

      return () => {
        void supabase.removeChannel(channel);
      };
    },
    async useRenderCandidate(accessToken, candidateId) {
      const data = await requestAdminJson(
        accessToken,
        `/api/admin/render-candidates/${candidateId}/use-as-current`,
        {
          method: "POST",
        },
      );

      return data.render_candidate as AdminCatalogRenderCandidate;
    },
    async uploadToSignedUrl(upload, file) {
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);

      const response = await fetch(upload.signed_upload_url, {
        body,
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("UPLOAD_FAILED");
      }
    },
    async verifyAdminSession(accessToken) {
      return fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },
  };
}

function ProtectedAdminCatalogPage({
  dependencies,
  render,
}: {
  dependencies?: AdminCatalogPageDependencies;
  render(
    accessToken: string,
    dependencies: AdminCatalogPageDependencies,
  ): ReactNode;
}) {
  const router = useRouter();
  const defaultDependencies = useMemo(
    () =>
      createDefaultAdminCatalogDependencies(
        (path) => router.push(path),
        (path) => router.replace(path),
      ),
    [router],
  );
  const activeDependencies = dependencies ?? defaultDependencies;
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pageState, setPageState] = useState<AdminPageState>("checking");

  useEffect(() => {
    let isCurrent = true;

    async function validateAdminSession() {
      let currentAccessToken: string | null;

      try {
        currentAccessToken = await activeDependencies.getAccessToken();
      } catch {
        activeDependencies.redirect("/admin/login");
        return;
      }

      if (!currentAccessToken) {
        await activeDependencies.clearTrustedDevice();
        activeDependencies.redirect("/admin/login");
        return;
      }

      let response =
        await activeDependencies.verifyAdminSession(currentAccessToken);

      if (response.status === 401) {
        const refreshedAccessToken =
          await activeDependencies.refreshAccessToken();

        if (refreshedAccessToken) {
          currentAccessToken = refreshedAccessToken;
          response =
            await activeDependencies.verifyAdminSession(refreshedAccessToken);
        }
      }

      if (!isCurrent) {
        return;
      }

      if (response.ok) {
        setAccessToken(currentAccessToken);
        setPageState("ready");
        return;
      }

      await activeDependencies.signOut();
      await activeDependencies.clearTrustedDevice();

      if (response.status === 403) {
        setPageState("forbidden");
        return;
      }

      activeDependencies.redirect("/admin/login");
    }

    void validateAdminSession();

    return () => {
      isCurrent = false;
    };
  }, [activeDependencies]);

  if (pageState === "checking") {
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section className="admin-auth-card" aria-live="polite">
          <p className="admin-status-text" role="status">
            Checking admin session.
          </p>
        </section>
      </AdminShell>
    );
  }

  if (pageState === "forbidden") {
    return (
      <AdminShell showNavigation={false} variant="auth">
        <section
          className="admin-auth-card"
          aria-labelledby="admin-denied-title"
        >
          <AdminPageHeader
            description="This account is not authorized for the admin area."
            eyebrow="Secure workspace"
            title="Admin access unavailable"
            titleId="admin-denied-title"
          />
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      {accessToken ? render(accessToken, activeDependencies) : null}
    </AdminShell>
  );
}

function SofaListContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sofas, setSofas] = useState<AdminCatalogSofa[]>([]);

  useEffect(() => {
    let isCurrent = true;

    async function loadSofas() {
      try {
        const nextSofas = await dependencies.listSofas(accessToken);

        if (isCurrent) {
          setSofas(nextSofas);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(readErrorMessage(error));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadSofas();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, dependencies]);

  return (
    <section
      aria-labelledby="sofas-title"
      className="admin-section admin-list-page"
    >
      <AdminPageHeader
        actions={
          <Link className="admin-primary-link" href="/admin/sofas/new">
            New sofa
          </Link>
        }
        description="Review sofa records, source imagery, publishing state, and recent catalog updates."
        eyebrow="Catalog"
        title="Sofas"
        titleId="sofas-title"
      />
      {errorMessage ? (
        <p className="form-error admin-list-feedback" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLoading ? (
        <p className="admin-list-feedback" role="status">
          Loading sofas.
        </p>
      ) : null}
      {!isLoading && sofas.length === 0 ? (
        <p className="admin-list-feedback">No sofa records yet.</p>
      ) : null}
      {sofas.length > 0 ? (
        <div className="admin-sofa-list" role="list">
          {sofas.map((sofa) => {
            const sofaDisplayName = sofa.public_name ?? sofa.internal_name;
            const sourcePhotoCount = sofa.source_photo_count ?? 0;

            return (
              <article
                className="admin-sofa-list-card"
                key={sofa.id}
                role="listitem"
              >
                <Link
                  aria-label={`Open ${sofaDisplayName}`}
                  className="admin-sofa-list-link"
                  href={`/admin/sofas/${sofa.id}`}
                >
                  <span className="admin-sofa-list-preview">
                    {sofa.source_photo_preview_url ? (
                      <img
                        alt={`Source photo for ${sofaDisplayName}`}
                        src={sofa.source_photo_preview_url}
                      />
                    ) : (
                      <span>No source image</span>
                    )}
                  </span>
                  <span className="admin-sofa-list-body">
                    <span className="admin-sofa-list-title-row">
                      <span className="admin-sofa-list-title">
                        <strong>
                          {sofa.internal_name || sofa.public_name}
                        </strong>
                        {sofa.public_name ? (
                          <span>{sofa.public_name}</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="admin-sofa-list-details">
                      <span>
                        <small>Status</small>
                        <span
                          className={`admin-sofa-list-lifecycle admin-sofa-list-lifecycle-${sofa.lifecycle_state}`}
                        >
                          {formatLifecycleState(sofa.lifecycle_state)}
                        </span>
                      </span>
                      <span>
                        <small>Sources</small>
                        <span>
                          {sourcePhotoCount > 0
                            ? `${sourcePhotoCount} source ${
                                sourcePhotoCount === 1 ? "photo" : "photos"
                              }`
                            : "No source photo"}
                        </span>
                      </span>
                      <span>
                        <small>Updated</small>
                        <span>{formatTimestamp(sofa.updated_at)}</span>
                      </span>
                    </span>
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function FabricListContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fabrics, setFabrics] = useState<AdminCatalogFabric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    async function loadFabrics() {
      try {
        const nextFabrics = await dependencies.listFabrics(accessToken);

        if (isCurrent) {
          setFabrics(nextFabrics);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(readErrorMessage(error));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadFabrics();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, dependencies]);

  return (
    <section
      aria-labelledby="fabrics-title"
      className="admin-section admin-list-page"
    >
      <AdminPageHeader
        actions={
          <Link className="admin-primary-link" href="/admin/fabrics/new">
            New fabric
          </Link>
        }
        description="Review fabric swatches, catalog names, lifecycle state, and AI readiness."
        eyebrow="Catalog"
        title="Fabrics"
        titleId="fabrics-title"
      />
      {errorMessage ? (
        <p className="form-error admin-list-feedback" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLoading ? (
        <p className="admin-list-feedback" role="status">
          Loading fabrics.
        </p>
      ) : null}
      {!isLoading && fabrics.length === 0 ? (
        <p className="admin-list-feedback">No fabric records yet.</p>
      ) : null}
      {fabrics.length > 0 ? (
        <div className="admin-fabric-list" role="list">
          {fabrics.map((fabric) => {
            const fabricDisplayName =
              fabric.public_name || fabric.internal_name;

            return (
              <article
                className="admin-fabric-list-card"
                key={fabric.id}
                role="listitem"
              >
                <Link
                  aria-label={`Open ${fabricDisplayName}`}
                  className="admin-fabric-list-link"
                  href={`/admin/fabrics/${fabric.id}`}
                >
                  <span className="admin-fabric-list-preview">
                    {fabric.swatch_preview_url ? (
                      <img
                        alt={`${fabric.public_name} swatch`}
                        src={fabric.swatch_preview_url}
                      />
                    ) : (
                      <span>No swatch</span>
                    )}
                  </span>
                  <span className="admin-fabric-list-body">
                    <span className="admin-fabric-list-title">
                      <strong>{fabric.public_name}</strong>
                      <span>{fabric.internal_name}</span>
                    </span>
                    <span className="admin-fabric-list-details">
                      <span>
                        <small>Status</small>
                        <span
                          className={`admin-sofa-list-lifecycle admin-sofa-list-lifecycle-${fabric.lifecycle_state}`}
                        >
                          {formatLifecycleState(fabric.lifecycle_state)}
                        </span>
                      </span>
                      <span>
                        <small>AI reference</small>
                        <span
                          className={`admin-fabric-list-readiness ${
                            fabric.ai_reference_asset
                              ? "is-ready"
                              : "is-missing"
                          }`}
                        >
                          {fabric.ai_reference_asset ? "Ready" : "Missing"}
                        </span>
                      </span>
                      <span>
                        <small>Type</small>
                        <span>
                          {fabric.is_premium ? "Premium" : "Standard"}
                        </span>
                      </span>
                    </span>
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function FabricCreateContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  // RU: Эти значения показывают ошибку, заметку про фото и отправку формы.
  // FR: Ces valeurs affichent une erreur, une note sur la photo et l'envoi du formulaire.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadInfoMessage, setUploadInfoMessage] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // RU: Эти данные хранят выбранный квадрат для нового образца ткани.
  // FR: Ces donnees gardent le carre choisi pour le nouvel echantillon de tissu.
  const [selectedSwatchCrop, setSelectedSwatchCrop] =
    useState<FabricSwatchCropSelection | null>(null);

  // RU: Этот автоматический блок убирает временную ссылку на выбранную картинку.
  // FR: Ce bloc automatique supprime le lien temporaire vers l'image choisie.
  useEffect(() => {
    const previewUrl = selectedSwatchCrop?.previewUrl;

    return () => {
      if (previewUrl && globalThis.URL?.revokeObjectURL) {
        globalThis.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [selectedSwatchCrop?.previewUrl]);

  // RU: Это действие сохраняет новую ткань и может уменьшить большое фото перед отправкой.
  // FR: Cette action enregistre un tissu et peut reduire une grande image avant l'envoi.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setUploadInfoMessage(null);
    setIsSubmitting(true);

    try {
      const payload = await buildFabricPayload({
        accessToken,
        dependencies,
        form: event.currentTarget,
        onUploadInfo: setUploadInfoMessage,
        requireFiles: true,
        swatchCrop: selectedSwatchCrop?.crop,
      });
      await dependencies.createFabric(accessToken, payload);
      // RU: После создания админ возвращается к списку тканей и видит новую запись там.
      // FR: Apres la creation, l'admin revient a la liste des tissus et voit la nouvelle ligne.
      dependencies.navigate("/admin/fabrics");
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="create-fabric-title"
      className="admin-section admin-form-page"
    >
      <AdminPageHeader
        description="Create a fabric record with required swatch and AI reference assets."
        eyebrow="Catalog"
        title="Create fabric"
        titleId="create-fabric-title"
      />
      <FabricForm
        buttonLabel={isSubmitting ? "Creating" : "Create fabric"}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        selectedSwatchCrop={selectedSwatchCrop}
        onSelectedSwatchCropChange={setSelectedSwatchCrop}
        uploadInfoMessage={uploadInfoMessage}
      />
    </section>
  );
}

function FabricEditContent({
  accessToken,
  dependencies,
  fabricId,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  fabricId: string;
}) {
  // RU: Эти значения показывают ошибку, заметку про фото, данные ткани и действия формы.
  // FR: Ces valeurs affichent une erreur, une note sur la photo, les donnees du tissu et les actions du formulaire.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadInfoMessage, setUploadInfoMessage] = useState<string | null>(
    null,
  );
  const [fabric, setFabric] = useState<AdminCatalogFabric | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingArchive, setPendingArchive] = useState(false);
  // RU: Эти данные хранят выбранный квадрат, если админ выбрал новую картинку ткани.
  // FR: Ces donnees gardent le carre choisi si l'admin a choisi une nouvelle image de tissu.
  const [selectedSwatchCrop, setSelectedSwatchCrop] =
    useState<FabricSwatchCropSelection | null>(null);

  // RU: Этот автоматический блок убирает временную ссылку на новую картинку ткани.
  // FR: Ce bloc automatique supprime le lien temporaire vers la nouvelle image de tissu.
  useEffect(() => {
    const previewUrl = selectedSwatchCrop?.previewUrl;

    return () => {
      if (previewUrl && globalThis.URL?.revokeObjectURL) {
        globalThis.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [selectedSwatchCrop?.previewUrl]);

  // RU: Этот автоматический блок загружает ткань при открытии страницы.
  // FR: Ce bloc automatique charge le tissu a l'ouverture de la page.
  useEffect(() => {
    let isCurrent = true;

    void dependencies
      .getFabric(accessToken, fabricId)
      .then((nextFabric) => {
        if (isCurrent) {
          setFabric(nextFabric);
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setErrorMessage(readErrorMessage(error));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, dependencies, fabricId]);

  // RU: Это действие сохраняет ткань и может уменьшить новое большое фото перед отправкой.
  // FR: Cette action enregistre le tissu et peut reduire une nouvelle grande image avant l'envoi.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fabric) {
      return;
    }

    setErrorMessage(null);
    setUploadInfoMessage(null);
    setIsSubmitting(true);

    try {
      const payload = await buildFabricPayload({
        accessToken,
        dependencies,
        existingFabric: fabric,
        form: event.currentTarget,
        onUploadInfo: setUploadInfoMessage,
        requireFiles: false,
        swatchCrop: selectedSwatchCrop?.crop,
      });
      const nextFabric = await dependencies.updateFabric(
        accessToken,
        fabricId,
        payload,
      );
      setFabric(nextFabric);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    setErrorMessage(null);
    setIsArchiving(true);

    try {
      const nextFabric = await dependencies.archiveFabric(
        accessToken,
        fabricId,
      );
      setFabric(nextFabric);
      setPendingArchive(false);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsArchiving(false);
    }
  }

  if (!fabric && !errorMessage) {
    return (
      <section className="admin-section" aria-live="polite">
        <p role="status">Loading fabric.</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="edit-fabric-title"
      className="admin-section admin-form-page"
    >
      <AdminPageHeader
        description="Update fabric naming, readiness assets, and archive state."
        eyebrow="Catalog"
        title={fabric?.internal_name ?? "Fabric"}
        titleId="edit-fabric-title"
      />
      {fabric ? (
        <div className="admin-grid">
          <FabricForm
            buttonLabel={isSubmitting ? "Saving" : "Save fabric"}
            errorMessage={errorMessage}
            fabric={fabric}
            onSubmit={handleSubmit}
            selectedSwatchCrop={selectedSwatchCrop}
            onSelectedSwatchCropChange={setSelectedSwatchCrop}
            uploadInfoMessage={uploadInfoMessage}
          />
          <aside className="admin-aside" aria-labelledby="fabric-state-title">
            <h2 id="fabric-state-title">Fabric state</h2>
            <p>{fabric.lifecycle_state}</p>
            <p>
              Swatch: {fabric.swatch_asset ? "Ready" : "Missing"}
              <br />
              AI reference: {fabric.ai_reference_asset ? "Ready" : "Missing"}
            </p>
            {fabric.lifecycle_state === "active" ? (
              pendingArchive ? (
                <button
                  disabled={isArchiving}
                  onClick={() => void handleArchive()}
                  type="button"
                >
                  Confirm archive
                </button>
              ) : (
                <button onClick={() => setPendingArchive(true)} type="button">
                  Archive fabric
                </button>
              )
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function SofaCreateContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  // RU: Эти значения показывают ошибку, отправку формы, список тегов и выбранные теги.
  // FR: Ces valeurs affichent une erreur, l'envoi du formulaire, la liste des tags et les tags choisis.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<AdminCatalogTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    void dependencies
      .listTags(accessToken)
      .then(setTags)
      .catch((error) => setErrorMessage(readErrorMessage(error)));
  }, [accessToken, dependencies]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = buildSofaPayload(formData, selectedTagIds);

    try {
      const sofa = await dependencies.createSofa(accessToken, payload);
      dependencies.navigate(`/admin/sofas/${sofa.id}`);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="create-sofa-title"
      className="admin-section admin-form-page"
    >
      <AdminPageHeader
        description="Create a draft sofa record before assigning fabrics and render coverage."
        eyebrow="Catalog"
        title="Create sofa"
        titleId="create-sofa-title"
      />
      <SofaForm
        buttonLabel={isSubmitting ? "Creating" : "Create draft"}
        errorMessage={errorMessage}
        onSelectedTagIdsChange={setSelectedTagIds}
        onSubmit={handleSubmit}
        selectedTagIds={selectedTagIds}
        tags={tags}
      />
    </section>
  );
}

function SofaEditContent({
  accessToken,
  dependencies,
  sofaId,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  sofaId: string;
}) {
  // RU: Это значение выбирает открытый шаг страницы дивана.
  // FR: Cette valeur choisit l'etape ouverte sur la page du canape.
  const [activeTab, setActiveTab] = useState<SofaEditTabKey>("basics");

  // RU: Эти значения хранят сообщения, списки и выборы для страницы дивана.
  // FR: Ces valeurs gardent les messages, listes et choix pour la page du canape.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fabrics, setFabrics] = useState<AdminCatalogFabric[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [readiness, setReadiness] = useState<AdminCatalogReadiness | null>(
    null,
  );
  const [renderCoverage, setRenderCoverage] =
    useState<AdminCatalogRenderCoverage | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [sofa, setSofa] = useState<AdminCatalogSofa | null>(null);
  const [sofaFabrics, setSofaFabrics] = useState<AdminCatalogSofaFabric[]>([]);
  const [tags, setTags] = useState<AdminCatalogTag[]>([]);
  const [visualMatrixColumns, setVisualMatrixColumns] = useState<
    AdminCatalogVisualMatrixColumn[]
  >([]);

  // RU: Эти метки показывают, какие шаги готовы, а где нужна работа.
  // FR: Ces marques montrent les etapes pretes et celles qui demandent du travail.
  const tabReadiness = useMemo(
    () =>
      sofa
        ? buildSofaEditTabReadiness({
            publicationReadiness: readiness,
            renderCells: renderCoverage?.render_cells ?? null,
            sofa,
            sofaFabrics,
            visualMatrixColumns,
          })
        : null,
    [readiness, renderCoverage, sofa, sofaFabrics, visualMatrixColumns],
  );

  // RU: Этот автоматический блок загружает данные дивана при открытии страницы.
  // FR: Ce bloc automatique charge les donnees du canape a l'ouverture de la page.
  useEffect(() => {
    let isCurrent = true;

    async function loadSofa() {
      try {
        const [nextSofa, nextTags, nextReadiness] = await Promise.all([
          dependencies.getSofa(accessToken, sofaId),
          dependencies.listTags(accessToken),
          dependencies.getSofaReadiness(accessToken, sofaId),
        ]);
        const [nextFabrics, nextSofaFabrics, nextColumns, nextCoverage] =
          await Promise.all([
            dependencies.listFabrics(accessToken),
            dependencies.listSofaFabrics(accessToken, sofaId),
            dependencies.listVisualMatrixColumns(accessToken, sofaId),
            dependencies.getRenderCoverage(accessToken, sofaId),
          ]);

        if (isCurrent) {
          setFabrics(nextFabrics);
          setRenderCoverage(nextCoverage);
          setSofa(nextSofa);
          setSofaFabrics(nextSofaFabrics);
          setTags(nextTags);
          setReadiness(nextReadiness);
          setSelectedTagIds(nextSofa.tags.map((tag) => tag.id));
          setVisualMatrixColumns(nextColumns);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(readErrorMessage(error));
        }
      }
    }

    void loadSofa();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, dependencies, sofaId]);

  // RU: Это действие сохраняет основные данные дивана.
  // FR: Cette action enregistre les donnees principales du canape.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = buildSofaPayload(formData, selectedTagIds);

    try {
      const nextSofa = await dependencies.updateSofa(
        accessToken,
        sofaId,
        payload,
      );
      const nextReadiness = await dependencies.getSofaReadiness(
        accessToken,
        sofaId,
      );
      setSofa(nextSofa);
      setReadiness(nextReadiness);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  // RU: Это действие заново получает позиции и готовые картинки.
  // FR: Cette action recharge les positions et les images pretes.
  const refreshRenderPreparation = useCallback(async () => {
    const [nextColumns, nextCoverage] = await Promise.all([
      dependencies.listVisualMatrixColumns(accessToken, sofaId),
      dependencies.getRenderCoverage(accessToken, sofaId),
    ]);

    setVisualMatrixColumns(nextColumns);
    setRenderCoverage(nextCoverage);
  }, [accessToken, dependencies, sofaId]);

  // RU: Это действие заново получает позиции, готовые картинки и проверку публикации.
  // FR: Cette action recharge les positions, les images pretes et la verification de publication.
  const refreshRenderPreparationAndReadiness = useCallback(async () => {
    const [nextColumns, nextCoverage, nextReadiness] = await Promise.all([
      dependencies.listVisualMatrixColumns(accessToken, sofaId),
      dependencies.getRenderCoverage(accessToken, sofaId),
      dependencies.getSofaReadiness(accessToken, sofaId),
    ]);

    setVisualMatrixColumns(nextColumns);
    setRenderCoverage(nextCoverage);
    setReadiness(nextReadiness);
  }, [accessToken, dependencies, sofaId]);

  // RU: Это действие сразу меняет одну ячейку картинки после успешной ручной загрузки.
  // FR: Cette action change tout de suite une case image apres un envoi manuel reussi.
  function handleRenderCellChange(nextCell: AdminCatalogRenderCell) {
    setRenderCoverage((currentCoverage) => {
      if (!currentCoverage) {
        return currentCoverage;
      }

      return {
        ...currentCoverage,
        render_cells: currentCoverage.render_cells.map((cell) =>
          cell.id === nextCell.id
            ? mergeManualRenderCellChange(cell, nextCell)
            : cell,
        ),
      };
    });
  }

  useEffect(() => {
    if (!dependencies.subscribeToFabricRenderJobs) {
      return;
    }

    let isCurrent = true;
    let isRefreshing = false;
    let needsRefresh = false;

    async function refreshFromRealtime() {
      if (!isCurrent) {
        return;
      }

      if (isRefreshing) {
        needsRefresh = true;
        return;
      }

      isRefreshing = true;

      try {
        await refreshRenderPreparationAndReadiness();
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(readErrorMessage(error));
        }
      } finally {
        isRefreshing = false;

        if (needsRefresh) {
          needsRefresh = false;
          void refreshFromRealtime();
        }
      }
    }

    const unsubscribe = dependencies.subscribeToFabricRenderJobs(
      sofaId,
      (job) => {
        if (
          typeof job.status === "string" &&
          (job.status === "queued" ||
            job.status === "processing" ||
            isTerminalFabricRenderJobStatus(job.status))
        ) {
          void refreshFromRealtime();
        }
      },
    );

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [dependencies, refreshRenderPreparationAndReadiness, sofaId]);

  if (!sofa && !errorMessage) {
    return (
      <section className="admin-section" aria-live="polite">
        <p role="status">Loading sofa.</p>
      </section>
    );
  }

  const aggregateReadiness = tabReadiness
    ? getSofaEditAggregateReadiness(tabReadiness)
    : null;

  return (
    <section
      aria-labelledby="edit-sofa-title"
      className="admin-section admin-sofa-edit-workflow"
    >
      {sofa ? (
        <>
          <AdminPageHeader
            actions={
              aggregateReadiness ? (
                <div className="admin-sofa-edit-readiness">
                  <span>Workflow</span>
                  <span
                    className={`admin-readiness-chip admin-readiness-chip-${aggregateReadiness}`}
                  >
                    {formatReadinessKind(aggregateReadiness)}
                  </span>
                </div>
              ) : undefined
            }
            description="Manage basics, fabric lines, view columns, render coverage, and publishing readiness."
            eyebrow="Catalog"
            title={sofa.internal_name}
            titleId="edit-sofa-title"
          />
          <div className="admin-sofa-edit-header-meta">
            <span className="admin-lifecycle-badge">
              {formatLifecycleState(sofa.lifecycle_state)}
            </span>
            <span>{sofa.public_name ?? "No public name"}</span>
          </div>

          <div
            aria-label="Sofa edit workflow"
            className="admin-sofa-edit-tabs"
            role="tablist"
          >
            {SOFA_EDIT_TABS.map((tab, index) => {
              const readinessKind = tabReadiness?.[tab.key] ?? "missing";

              return (
                <button
                  aria-label={`${tab.label} ${formatReadinessKind(
                    readinessKind,
                  )}`}
                  aria-controls={`sofa-edit-panel-${tab.key}`}
                  aria-selected={activeTab === tab.key}
                  className="admin-sofa-edit-tab"
                  id={`sofa-edit-tab-${tab.key}`}
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  type="button"
                >
                  <span aria-hidden="true" className="admin-sofa-edit-tab-meta">
                    <span className="admin-sofa-edit-tab-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`admin-readiness-dot admin-readiness-dot-${readinessKind}`}
                    />
                  </span>
                  <span className="admin-sofa-edit-tab-label">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* This area renders the selected workflow tab. */}
          <div
            aria-labelledby={`sofa-edit-tab-${activeTab}`}
            className="admin-sofa-edit-panel"
            id={`sofa-edit-panel-${activeTab}`}
            role="tabpanel"
          >
            {activeTab === "basics" ? (
              <section
                aria-labelledby="sofa-basics-title"
                className="admin-subsection"
                id="sofa-basics"
              >
                <SectionStepHeading
                  headingId="sofa-basics-title"
                  number="1"
                  title="Sofa basics"
                />
                <SofaForm
                  buttonLabel={isSubmitting ? "Saving" : "Save sofa"}
                  errorMessage={errorMessage}
                  onSelectedTagIdsChange={setSelectedTagIds}
                  onSubmit={handleSubmit}
                  selectedTagIds={selectedTagIds}
                  sofa={sofa}
                  tags={tags}
                />
              </section>
            ) : null}
            {activeTab === "fabrics" ? (
              <SofaFabricAssignmentSection
                accessToken={accessToken}
                dependencies={dependencies}
                fabrics={fabrics}
                onReadinessChange={setReadiness}
                onRenderPreparationRefresh={refreshRenderPreparation}
                onSofaFabricsChange={setSofaFabrics}
                sofaFabrics={sofaFabrics}
                sofaId={sofaId}
              />
            ) : null}
            {activeTab === "visual_matrix" ? (
              <VisualMatrixSection
                accessToken={accessToken}
                columns={visualMatrixColumns}
                dependencies={dependencies}
                onRefresh={refreshRenderPreparationAndReadiness}
                sofaFabrics={sofaFabrics}
                sofaId={sofaId}
              />
            ) : null}
            {activeTab === "renders" ? (
              <RenderCoverageSection
                accessToken={accessToken}
                coverage={renderCoverage}
                dependencies={dependencies}
                onRenderCellChange={handleRenderCellChange}
                onRefresh={refreshRenderPreparationAndReadiness}
                onSelectTab={setActiveTab}
                sofaFabrics={sofaFabrics}
                visualMatrixColumns={visualMatrixColumns}
              />
            ) : null}
            {activeTab === "publish" ? (
              <PublicationReadinessSection
                accessToken={accessToken}
                dependencies={dependencies}
                onReadinessChange={setReadiness}
                onSelectTab={setActiveTab}
                onSofaChange={setSofa}
                readiness={readiness}
                sofa={sofa}
                sofaId={sofaId}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function formatLifecycleState(lifecycleState: string) {
  return lifecycleState
    .split("_")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function AdminStateBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: AdminBadgeTone;
}) {
  return (
    <span className={`admin-state-badge admin-state-badge-${tone}`}>
      {children}
    </span>
  );
}

function getLifecycleBadgeTone(lifecycleState: string): AdminBadgeTone {
  switch (lifecycleState) {
    case "active":
    case "published":
      return "ready";
    case "archived":
      return "muted";
    case "draft":
      return "warning";
    default:
      return "neutral";
  }
}

function getReadinessBadgeTone(isReady: boolean): AdminBadgeTone {
  return isReady ? "ready" : "warning";
}

function formatReadinessKind(kind: SofaEditReadinessKind) {
  switch (kind) {
    case "blocked":
      return "Blocked";
    case "missing":
      return "Missing";
    case "partial":
      return "Partial";
    case "ready":
      return "Ready";
  }
}

function getSofaEditAggregateReadiness(
  readiness: Record<SofaEditTabKey, SofaEditReadinessKind>,
) {
  const values = Object.values(readiness);

  if (values.some((value) => value === "blocked")) {
    return "blocked";
  }

  if (values.some((value) => value === "missing")) {
    return "missing";
  }

  if (values.some((value) => value === "partial")) {
    return "partial";
  }

  return "ready";
}

function PublicationReadinessSection({
  accessToken,
  dependencies,
  onReadinessChange,
  onSelectTab,
  onSofaChange,
  readiness,
  sofa,
  sofaId,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  onReadinessChange(readiness: AdminCatalogReadiness): void;
  onSelectTab(tab: SofaEditTabKey): void;
  onSofaChange(sofa: AdminCatalogSofa): void;
  readiness: AdminCatalogReadiness | null;
  sofa: AdminCatalogSofa;
  sofaId: string;
}) {
  // RU: Эти значения показывают ошибку и занятость кнопок публикации.
  // FR: Ces valeurs affichent l'erreur et l'occupation des boutons de publication.
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const [isPublicationActionBusy, setIsPublicationActionBusy] = useState(false);

  // RU: Эти данные говорят, виден ли диван на публичном сайте.
  // FR: Ces donnees indiquent si le canape est visible sur le site public.
  const isPublished = sofa.lifecycle_state === "published";
  const lifecycleLabel = isPublished ? "Published" : "Draft";

  // RU: Это действие обновляет проверку готовности после публикации.
  // FR: Cette action actualise la verification apres la publication.
  async function refreshReadiness() {
    const nextReadiness = await dependencies.getSofaReadiness(
      accessToken,
      sofaId,
    );
    onReadinessChange(nextReadiness);
  }

  // RU: Это действие делает диван видимым на публичном сайте.
  // FR: Cette action rend le canape visible sur le site public.
  async function handlePublish() {
    setActionErrorMessage(null);
    setIsPublicationActionBusy(true);

    try {
      const nextSofa = await dependencies.publishSofa(accessToken, sofaId);
      onSofaChange(nextSofa);
      await refreshReadiness();
    } catch (error) {
      setActionErrorMessage(readErrorMessage(error));
    } finally {
      setIsPublicationActionBusy(false);
    }
  }

  // RU: Это действие убирает диван с публичного сайта.
  // FR: Cette action retire le canape du site public.
  async function handleUnpublish() {
    setActionErrorMessage(null);
    setIsPublicationActionBusy(true);

    try {
      const nextSofa = await dependencies.unpublishSofa(accessToken, sofaId);
      onSofaChange(nextSofa);
      await refreshReadiness();
    } catch (error) {
      setActionErrorMessage(readErrorMessage(error));
    } finally {
      setIsPublicationActionBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="readiness-title"
      className="admin-subsection admin-publish-panel"
      id="publication-readiness"
    >
      <SectionStepHeading
        headingId="readiness-title"
        title="Publication readiness"
      />
      {actionErrorMessage ? (
        <p className="form-error" role="alert">
          {actionErrorMessage}
        </p>
      ) : null}
      <dl className="admin-cell-details">
        <div>
          <dt>Status</dt>
          <dd>{lifecycleLabel}</dd>
        </div>
      </dl>
      {readiness?.ready ? <p>Ready</p> : <p>Blocked</p>}
      {readiness?.errors.length ? (
        <ul className="admin-list">
          {readiness.errors.map((error) => {
            const targetTab = getPublicationBlockerTarget(error.code);

            return (
              <li className="admin-publish-blocker" key={error.code}>
                <div>
                  <strong>
                    {formatAdminPublicationBlockerLabel(error.code)}
                  </strong>
                  <span>{formatAdminErrorMessage(error.message)}</span>
                </div>
                <button
                  className="admin-secondary-button"
                  onClick={() => onSelectTab(targetTab)}
                  type="button"
                >
                  Go to {getSofaEditTabLabel(targetTab)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="admin-actions">
        {!isPublished ? (
          <button
            className="admin-primary-button"
            disabled={isPublicationActionBusy || !readiness?.ready}
            onClick={() => void handlePublish()}
            type="button"
          >
            {isPublicationActionBusy ? "Publishing" : "Publish sofa"}
          </button>
        ) : (
          <button
            className="admin-danger-button"
            disabled={isPublicationActionBusy}
            onClick={() => void handleUnpublish()}
            type="button"
          >
            {isPublicationActionBusy ? "Unpublishing" : "Unpublish sofa"}
          </button>
        )}
      </div>
    </section>
  );
}

function SectionStepHeading({
  headingId,
  title,
}: {
  headingId: string;
  number?: string;
  title: string;
}) {
  return (
    <div className="admin-section-heading">
      <h2 id={headingId}>{title}</h2>
    </div>
  );
}

// RU: Этот знак показывает правку без слова Edit на маленьких кнопках.
// FR: Ce signe montre la modification sans le mot Edit sur les petits boutons.
function AdminEditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="admin-edit-icon">
      <path d="M14.25 4.75H6.5a2 2 0 0 0-2 2v10.75a2 2 0 0 0 2 2h10.75a2 2 0 0 0 2-2V9.75" />
      <path d="M13.4 16.15 8.2 17.6l1.45-5.2 7.65-7.65a1.85 1.85 0 0 1 2.62 0l.43.43a1.85 1.85 0 0 1 0 2.62l-7.65 7.65Z" />
      <path d="m15.95 6.1 2.35 2.35" />
      <path d="m9.65 12.4 3.05 3.05" />
    </svg>
  );
}
function TagManagerContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<string | null>(
    null,
  );
  const [submittingTagId, setSubmittingTagId] = useState<string | null>(null);
  const [tags, setTags] = useState<AdminCatalogTag[]>([]);

  async function loadTags() {
    setIsLoading(true);

    try {
      const nextTags = await dependencies.listTags(accessToken);
      setTags(nextTags);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTags().catch((error) => setErrorMessage(readErrorMessage(error)));
  }, [accessToken, dependencies]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const publicLabel = String(formData.get("public_label") ?? "").trim();

    try {
      await dependencies.createTag(accessToken, {
        public_label: publicLabel,
      });
      event.currentTarget.reset();
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(tag: AdminCatalogTag, form: HTMLFormElement) {
    setErrorMessage(null);
    setSubmittingTagId(tag.id);
    const formData = new FormData(form);
    const publicLabel = String(formData.get(`tag-${tag.id}`) ?? "").trim();

    try {
      await dependencies.updateTag(accessToken, tag.id, {
        public_label: publicLabel,
      });
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setSubmittingTagId(null);
    }
  }

  async function handleDelete(tag: AdminCatalogTag) {
    setErrorMessage(null);
    setSubmittingTagId(tag.id);

    try {
      await dependencies.deleteTag(accessToken, tag.id);
      setPendingDeleteTagId(null);
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setSubmittingTagId(null);
    }
  }

  return (
    <section
      aria-labelledby="tags-title"
      className="admin-section admin-list-page"
    >
      <AdminPageHeader
        description="Create and maintain the public tags used to organize catalog filters."
        eyebrow="Catalog"
        title="Tags"
        titleId="tags-title"
      />
      {errorMessage ? (
        <p className="form-error admin-list-feedback" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <form
        aria-busy={isSubmitting}
        className="admin-inline-form admin-tag-create-form"
        onSubmit={handleCreate}
      >
        <label className="field admin-tag-create-field">
          <span>New tag</span>
          <input name="public_label" required />
        </label>
        <button
          aria-label="Create tag"
          className="admin-primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating" : "Create"}
        </button>
      </form>
      {isLoading ? (
        <p className="admin-list-feedback" role="status">
          Loading tags.
        </p>
      ) : null}
      {!isLoading && tags.length === 0 ? (
        <p className="admin-list-feedback">No tags yet.</p>
      ) : null}
      {tags.length > 0 ? (
        <div className="admin-list admin-tag-list">
          {tags.map((tag) => {
            const isTagSubmitting = submittingTagId === tag.id;
            const isConfirmingDelete = pendingDeleteTagId === tag.id;

            return (
              <form
                aria-busy={isTagSubmitting}
                aria-label={`Edit tag ${tag.public_label}`}
                className="admin-list-row admin-tag-row"
                key={tag.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleUpdate(tag, event.currentTarget);
                }}
              >
                <label className="field admin-tag-name-field">
                  <span>Name</span>
                  <input
                    aria-label={`Tag name for ${tag.public_label}`}
                    defaultValue={tag.public_label}
                    disabled={isTagSubmitting}
                    name={`tag-${tag.id}`}
                    required
                  />
                </label>
                <span
                  aria-label={`Slug ${tag.slug}`}
                  className="admin-tag-slug"
                >
                  <span>Slug</span>
                  <code>{tag.slug}</code>
                </span>
                <div className="admin-row-actions admin-tag-row-actions">
                  <button
                    aria-label={`Save ${tag.public_label}`}
                    className="admin-quiet-button"
                    disabled={isTagSubmitting}
                    type="submit"
                  >
                    {isTagSubmitting ? "Saving" : "Save"}
                  </button>
                  {isConfirmingDelete ? (
                    <>
                      <button
                        aria-label={`Confirm delete ${tag.public_label}`}
                        className="admin-danger-button"
                        disabled={isTagSubmitting}
                        onClick={() => void handleDelete(tag)}
                        type="button"
                      >
                        {isTagSubmitting ? "Deleting" : "Confirm"}
                      </button>
                      <button
                        aria-label={`Cancel delete ${tag.public_label}`}
                        className="admin-secondary-button admin-tag-cancel-button"
                        disabled={isTagSubmitting}
                        onClick={() => setPendingDeleteTagId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      aria-label={`Delete ${tag.public_label}`}
                      className="admin-quiet-button"
                      disabled={isTagSubmitting}
                      onClick={() => setPendingDeleteTagId(tag.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SofaFabricAssignmentSection({
  accessToken,
  dependencies,
  fabrics,
  onReadinessChange,
  onRenderPreparationRefresh,
  onSofaFabricsChange,
  sofaFabrics,
  sofaId,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  fabrics: AdminCatalogFabric[];
  onReadinessChange(readiness: AdminCatalogReadiness): void;
  onRenderPreparationRefresh(): Promise<void>;
  onSofaFabricsChange(assignments: AdminCatalogSofaFabric[]): void;
  sofaFabrics: AdminCatalogSofaFabric[];
  sofaId: string;
}) {
  // RU: Эти значения показывают ошибку, отправку формы и список назначенных тканей.
  // FR: Ces valeurs affichent une erreur, l'envoi du formulaire et la liste des tissus assignes.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // RU: Эти значения держат числа порядка до нажатия кнопки сохранения.
  // FR: Ces valeurs gardent les nombres d'ordre avant le bouton d'enregistrement.
  const [orderValues, setOrderValues] = useState<Record<string, string>>({});

  // RU: Этот автоматический блок обновляет числа порядка после загрузки тканей.
  // FR: Ce bloc automatique met a jour les nombres d'ordre apres le chargement des tissus.
  useEffect(() => {
    setOrderValues(buildSofaFabricOrderValues(sofaFabrics));
  }, [sofaFabrics]);

  const assignedFabricIds = new Set(
    sofaFabrics.map((assignment) => assignment.fabric_id),
  );
  const assignableFabrics = fabrics.filter(
    (fabric) =>
      fabric.lifecycle_state === "active" && !assignedFabricIds.has(fabric.id),
  );

  // RU: Это действие снова получает назначенные ткани и готовность дивана.
  // FR: Cette action recharge les tissus assignes et l'etat du canape.
  async function refreshAssignmentsAndReadiness() {
    const [nextAssignments, nextReadiness] = await Promise.all([
      dependencies.listSofaFabrics(accessToken, sofaId),
      dependencies.getSofaReadiness(accessToken, sofaId),
    ]);
    onSofaFabricsChange(nextAssignments);
    onReadinessChange(nextReadiness);
    await onRenderPreparationRefresh();
  }

  // RU: Это действие назначает новую ткань дивану.
  // FR: Cette action ajoute un nouveau tissu au canape.
  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fabricId = String(formData.get("fabric_id") ?? "");
    const publicOrderValue = String(formData.get("public_order") ?? "").trim();

    try {
      await dependencies.assignSofaFabric(accessToken, sofaId, fabricId, {
        public_order: publicOrderValue ? Number(publicOrderValue) : null,
      });
      form.reset();
      await refreshAssignmentsAndReadiness();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  // RU: Это действие меняет число порядка только на экране.
  // FR: Cette action change le nombre d'ordre seulement a l'ecran.
  function handleOrderValueChange(fabricId: string, value: string) {
    setOrderValues((currentValues) => ({
      ...currentValues,
      [fabricId]: value,
    }));
  }

  // RU: Это действие сохраняет измененные числа порядка.
  // FR: Cette action enregistre les nombres d'ordre modifies.
  async function handleSaveOrder() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const changedAssignments = sofaFabrics.filter((assignment) => {
      const nextValue = orderValues[assignment.fabric_id] ?? "";
      const currentValue =
        assignment.public_order === null ? "" : String(assignment.public_order);

      return nextValue.trim() !== currentValue;
    });

    try {
      // RU: Эти данные помогают понять, какие ткани меняют порядок.
      // FR: Ces donnees aident a savoir quels tissus changent de rang.
      const changedFabricIds = new Set(
        changedAssignments.map((assignment) => assignment.fabric_id),
      );

      // RU: Эти данные показывают будущий порядок перед отправкой.
      // FR: Ces donnees montrent le futur rang avant l'envoi.
      const desiredOrders = sofaFabrics.map((assignment) => {
        return {
          fabricId: assignment.fabric_id,
          publicOrder: changedFabricIds.has(assignment.fabric_id)
            ? readSofaFabricOrderValue(orderValues[assignment.fabric_id])
            : assignment.public_order,
        };
      });
      const duplicateOrder = findDuplicateSofaFabricPublicOrder(desiredOrders);

      if (duplicateOrder !== null) {
        setErrorMessage("Another fabric already uses this public order.");

        return;
      }

      // RU: Эти данные помогают временно освободить занятые номера.
      // FR: Ces donnees aident a liberer les numeros deja pris.
      const changedCurrentOrders = new Set(
        changedAssignments
          .map((assignment) => assignment.public_order)
          .filter((order): order is number => order !== null),
      );
      const needsTemporaryClear = changedAssignments.some((assignment) => {
        const nextOrder = readSofaFabricOrderValue(
          orderValues[assignment.fabric_id],
        );

        return (
          nextOrder !== null &&
          nextOrder !== assignment.public_order &&
          changedCurrentOrders.has(nextOrder)
        );
      });
      const clearAssignments = needsTemporaryClear
        ? changedAssignments.filter(
            (assignment) => assignment.public_order !== null,
          )
        : [];
      const finalAssignments = needsTemporaryClear
        ? changedAssignments.filter(
            (assignment) =>
              readSofaFabricOrderValue(orderValues[assignment.fabric_id]) !==
              null,
          )
        : changedAssignments;

      await Promise.all(
        clearAssignments.map((assignment) =>
          dependencies.updateSofaFabric(
            accessToken,
            sofaId,
            assignment.fabric_id,
            {
              public_order: null,
            },
          ),
        ),
      );
      await Promise.all(
        finalAssignments.map((assignment) => {
          const publicOrder = readSofaFabricOrderValue(
            orderValues[assignment.fabric_id],
          );

          return dependencies.updateSofaFabric(
            accessToken,
            sofaId,
            assignment.fabric_id,
            {
              public_order: publicOrder,
            },
          );
        }),
      );
      if (changedAssignments.length > 0) {
        await refreshAssignmentsAndReadiness();
      }
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  // RU: Это действие возвращает числа порядка к последним данным.
  // FR: Cette action remet les nombres d'ordre aux dernieres donnees.
  function handleResetOrder() {
    setOrderValues(buildSofaFabricOrderValues(sofaFabrics));
  }

  // RU: Это действие убирает ткань с дивана.
  // FR: Cette action retire le tissu du canape.
  async function handleRemove(assignment: AdminCatalogSofaFabric) {
    setErrorMessage(null);

    try {
      await dependencies.removeSofaFabric(
        accessToken,
        sofaId,
        assignment.fabric_id,
      );
      await refreshAssignmentsAndReadiness();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  return (
    <section
      aria-labelledby="sofa-fabrics-title"
      className="admin-subsection"
      id="fabric-assignments"
    >
      <SectionStepHeading
        headingId="sofa-fabrics-title"
        title="Fabric assignments"
      />
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {sofaFabrics.length === 0 ? <p>No assigned fabrics.</p> : null}
      {sofaFabrics.length > 0 ? (
        <>
          <div className="admin-fabric-order-row">
            <button
              className="admin-secondary-button"
              disabled={isSubmitting}
              onClick={() => void handleSaveOrder()}
              type="button"
            >
              Save order
            </button>
            <button
              className="admin-quiet-button"
              onClick={handleResetOrder}
              type="button"
            >
              Reset order
            </button>
          </div>
          {/* RU: Этот список показывает ткани дивана и их порядок.
              FR: Cette liste montre les tissus du canape et leur rang. */}
          <div className="admin-list admin-fabric-card-list">
            {sofaFabrics.map((assignment) => {
              const fabricLabel =
                assignment.fabric?.public_name ??
                assignment.fabric?.internal_name ??
                assignment.fabric_id;

              return (
                <div
                  className="admin-list-row admin-fabric-row"
                  key={assignment.fabric_id}
                >
                  {assignment.fabric ? (
                    <AdminFabricCard fabric={assignment.fabric} />
                  ) : (
                    <span>{assignment.fabric_id}</span>
                  )}
                  <label className="field admin-order-field">
                    <span>Order</span>
                    <input
                      aria-label={`Public order for ${fabricLabel}`}
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        handleOrderValueChange(
                          assignment.fabric_id,
                          event.currentTarget.value,
                        )
                      }
                      pattern="[0-9]*"
                      type="text"
                      value={orderValues[assignment.fabric_id] ?? ""}
                    />
                  </label>
                  <button
                    className="admin-danger-button"
                    onClick={() => void handleRemove(assignment)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <form className="admin-add-fabric-form" onSubmit={handleAssign}>
        <label className="field">
          <span>Assign fabric</span>
          <select name="fabric_id" required>
            <option value="">Select fabric</option>
            {assignableFabrics.map((fabric) => (
              <option key={fabric.id} value={fabric.id}>
                {fabric.internal_name}
              </option>
            ))}
          </select>
        </label>
        <label className="field admin-order-field">
          <span>Public order</span>
          <input
            inputMode="numeric"
            min="0"
            name="public_order"
            pattern="[0-9]*"
            type="text"
          />
        </label>
        <button
          className="admin-primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          Assign fabric
        </button>
      </form>
    </section>
  );
}

function buildSofaFabricOrderValues(sofaFabrics: AdminCatalogSofaFabric[]) {
  return Object.fromEntries(
    sofaFabrics.map((assignment) => [
      assignment.fabric_id,
      assignment.public_order === null ? "" : String(assignment.public_order),
    ]),
  );
}

// RU: Эта проверка превращает пустое поле в отсутствие номера.
// FR: Cette verification transforme un champ vide en absence de numero.
function readSofaFabricOrderValue(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue ? Number(trimmedValue) : null;
}

// RU: Эта проверка находит повтор номера перед отправкой.
// FR: Cette verification trouve un numero repete avant l'envoi.
function findDuplicateSofaFabricPublicOrder(
  orders: Array<{
    fabricId: string;
    publicOrder: number | null;
  }>,
) {
  const seenOrders = new Map<number, string>();

  for (const order of orders) {
    if (order.publicOrder === null) {
      continue;
    }

    if (seenOrders.has(order.publicOrder)) {
      return order.publicOrder;
    }

    seenOrders.set(order.publicOrder, order.fabricId);
  }

  return null;
}

function AdminFabricCard({ fabric }: { fabric: AdminCatalogFabric }) {
  return (
    <article className="admin-fabric-card">
      {fabric.swatch_preview_url ? (
        <img
          alt={`Swatch for ${fabric.public_name}`}
          className="admin-fabric-swatch"
          src={fabric.swatch_preview_url}
        />
      ) : (
        <span className="admin-fabric-swatch-empty">No swatch</span>
      )}
      <div className="admin-fabric-card-body">
        <strong className="admin-fabric-name">{fabric.public_name}</strong>
        <span className="admin-fabric-meta">
          Internal: {fabric.internal_name}
        </span>
        <span className="admin-fabric-meta">
          AI ref: {fabric.ai_reference_asset ? "Ready" : "Missing"}
        </span>
        {fabric.is_premium ? (
          <span className="admin-fabric-premium">Premium</span>
        ) : null}
      </div>
    </article>
  );
}

function AdminFabricCompact({ fabric }: { fabric: AdminCatalogFabric }) {
  return (
    <article className="admin-fabric-compact">
      {fabric.swatch_preview_url ? (
        <img
          alt={`Swatch for ${fabric.public_name}`}
          className="admin-fabric-compact-swatch"
          src={fabric.swatch_preview_url}
        />
      ) : (
        <span className="admin-fabric-compact-swatch admin-fabric-compact-empty">
          No swatch
        </span>
      )}
      <div>
        <strong>{fabric.public_name}</strong>
        <span>{fabric.ai_reference_asset ? "AI ready" : "AI missing"}</span>
      </div>
    </article>
  );
}

function VisualMatrixSection({
  accessToken,
  columns,
  dependencies,
  onRefresh,
  sofaFabrics,
  sofaId,
}: {
  accessToken: string;
  columns: AdminCatalogVisualMatrixColumn[];
  dependencies: AdminCatalogPageDependencies;
  onRefresh(): Promise<void>;
  sofaFabrics: AdminCatalogSofaFabric[];
  sofaId: string;
}) {
  // RU: Эти значения показывают ошибку, заметку про фото и отправку формы.
  // FR: Ces valeurs affichent une erreur, une note sur la photo et l'envoi du formulaire.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadInfoMessage, setUploadInfoMessage] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // RU: Эти значения показывают файл и быстрый вид выбранного исходного фото.
  // FR: Ces valeurs montrent le fichier et l'apercu rapide de la photo source choisie.
  const [selectedSourcePhotoFileName, setSelectedSourcePhotoFileName] =
    useState<string | null>(null);
  const [selectedSourcePhotoPreviewUrl, setSelectedSourcePhotoPreviewUrl] =
    useState<string | null>(null);

  // RU: Это значение сразу меняет картинку ткани в окне изменения колонки.
  // FR: Cette valeur change tout de suite l'image du tissu dans la fenetre de changement.
  const [selectedSourceFabricId, setSelectedSourceFabricId] = useState<
    string | null
  >(null);

  // RU: Эти значения выбирают окно для добавления, изменения или фото.
  // FR: Ces valeurs choisissent la fenetre pour ajouter, changer ou envoyer une photo.
  const [activeColumnDrawerMode, setActiveColumnDrawerMode] = useState<
    "add" | "edit" | null
  >(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<
    string | null
  >(null);

  // RU: Эти записи показывают выбранную колонку для окна и удаления.
  // FR: Ces donnees montrent la colonne choisie pour la fenetre et la suppression.
  const activeColumn = activeColumnId
    ? columns.find((column) => column.id === activeColumnId)
    : null;
  const pendingDeleteColumn = pendingDeleteColumnId
    ? columns.find((column) => column.id === pendingDeleteColumnId)
    : null;

  // RU: Этот автоматический блок убирает быстрый адрес фото, когда он уже не нужен.
  // FR: Ce bloc automatique retire l'adresse rapide de la photo quand elle n'est plus utile.
  useEffect(() => {
    return () => {
      if (selectedSourcePhotoPreviewUrl && globalThis.URL?.revokeObjectURL) {
        globalThis.URL.revokeObjectURL(selectedSourcePhotoPreviewUrl);
      }
    };
  }, [selectedSourcePhotoPreviewUrl]);

  // RU: Это действие открывает центральное окно для колонки.
  // FR: Cette action ouvre la fenetre centrale pour une colonne.
  function openColumnDrawer(
    mode: "add" | "edit",
    column?: AdminCatalogVisualMatrixColumn,
  ) {
    setErrorMessage(null);
    setUploadInfoMessage(null);
    setSelectedSourcePhotoFileName(null);
    setSelectedSourcePhotoPreviewUrl(null);
    setSelectedSourceFabricId(
      mode === "edit"
        ? (column?.current_source_photo?.original_fabric_id ?? "")
        : null,
    );
    setActiveColumnDrawerMode(mode);
    setActiveColumnId(column?.id ?? null);
  }

  // RU: Это действие прячет центральное окно Visual matrix.
  // FR: Cette action cache la fenetre centrale de Visual matrix.
  function closeColumnDrawer() {
    setErrorMessage(null);
    setSelectedSourcePhotoFileName(null);
    setSelectedSourcePhotoPreviewUrl(null);
    setSelectedSourceFabricId(null);
    setActiveColumnDrawerMode(null);
    setActiveColumnId(null);
  }

  // RU: Это действие добавляет новую колонку после заполнения формы.
  // FR: Cette action ajoute une nouvelle colonne apres le formulaire rempli.
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      await dependencies.createVisualMatrixColumn(accessToken, sofaId, {
        admin_label: nullableFormString(formData, "admin_label"),
        public_label: nullableFormString(formData, "public_label"),
        sequence: Number(formData.get("sequence")),
      });
      form.reset();
      closeColumnDrawer();
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  // RU: Это действие запоминает выбранный файл и сразу показывает его в окне.
  // FR: Cette action garde le fichier choisi et le montre tout de suite dans la fenetre.
  function handleSourcePhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    setSelectedSourcePhotoFileName(file?.name ?? null);

    if (!file || !globalThis.URL?.createObjectURL) {
      setSelectedSourcePhotoPreviewUrl(null);
      return;
    }

    setSelectedSourcePhotoPreviewUrl(globalThis.URL.createObjectURL(file));
  }

  // RU: Это действие сразу меняет выбранную ткань рядом с исходным фото.
  // FR: Cette action change tout de suite le tissu choisi pres de la photo source.
  function handleSourceFabricChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedSourceFabricId(event.currentTarget.value);
  }

  // RU: Это действие отправляет выбранное исходное фото после сохранения окна.
  // FR: Cette action envoie la photo source choisie apres la sauvegarde de la fenetre.
  async function uploadSourcePhoto(
    column: AdminCatalogVisualMatrixColumn,
    originalFabricId: string,
    file: File,
  ) {
    const preparedUpload = await prepareAdminImageUploadFile({
      file,
      purpose: "sofa_source_photo",
    });
    const uploadFile = preparedUpload.file;

    if (preparedUpload.message) {
      setUploadInfoMessage(preparedUpload.message);
    }

    const upload = await dependencies.createUpload(accessToken, {
      byte_size: uploadFile.size,
      content_type: uploadFile.type,
      original_fabric_id: originalFabricId,
      purpose: "sofa_source_photo",
      sofa_id: sofaId,
      visual_matrix_column_id: column.id,
    });
    await dependencies.uploadToSignedUrl(upload, uploadFile);
    await dependencies.completeUpload(accessToken, upload.upload_id);
  }

  // RU: Это действие сохраняет подписи колонки, порядок, ткань и новое исходное фото.
  // FR: Cette action sauvegarde les textes, l'ordre, le tissu et la nouvelle photo source.
  async function handleSaveColumn(
    column: AdminCatalogVisualMatrixColumn,
    form: HTMLFormElement,
  ) {
    setErrorMessage(null);
    setUploadInfoMessage(null);
    setIsSubmitting(true);
    const formData = new FormData(form);
    const originalFabricId = String(
      formData.get(`source_fabric_${column.id}`) ?? "",
    );
    const currentOriginalFabricId =
      column.current_source_photo?.original_fabric_id ?? "";
    const file = readFileField(form, formData, `source_photo_${column.id}`);
    const sourceFabricChanged = originalFabricId !== currentOriginalFabricId;

    if (!originalFabricId && (file || column.current_source_photo)) {
      setErrorMessage(
        "Choose a source fabric before saving this source image.",
      );
      setIsSubmitting(false);
      return;
    }

    if (!file && sourceFabricChanged && !column.current_source_photo) {
      setErrorMessage(
        "Upload a source image before assigning a source fabric to this view column.",
      );
      setIsSubmitting(false);
      return;
    }

    try {
      await dependencies.updateVisualMatrixColumn(accessToken, column.id, {
        admin_label: nullableFormString(formData, `admin_label_${column.id}`),
        public_label: nullableFormString(formData, `public_label_${column.id}`),
        sequence: Number(formData.get(`sequence_${column.id}`)),
        ...(!file && sourceFabricChanged
          ? { source_original_fabric_id: originalFabricId }
          : {}),
      });

      if (file && originalFabricId) {
        await uploadSourcePhoto(column, originalFabricId, file);
      }

      closeColumnDrawer();
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  // RU: Это действие удаляет выбранную колонку после подтверждения.
  // FR: Cette action supprime la colonne choisie apres confirmation.
  async function handleDelete(column: AdminCatalogVisualMatrixColumn) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await dependencies.deleteVisualMatrixColumn(accessToken, column.id);
      setPendingDeleteColumnId(null);
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function getFabricAssignmentById(fabricId?: string | null) {
    return sofaFabrics.find((sofaFabric) => sofaFabric.fabric_id === fabricId);
  }

  function getOriginalFabricAssignment(column: AdminCatalogVisualMatrixColumn) {
    const originalFabricId = column.current_source_photo?.original_fabric_id;

    return getFabricAssignmentById(originalFabricId);
  }

  function getFabricAssignmentName(assignment?: AdminCatalogSofaFabric | null) {
    return (
      assignment?.fabric?.public_name ??
      assignment?.fabric?.internal_name ??
      "No original fabric"
    );
  }

  function getOriginalFabricName(column: AdminCatalogVisualMatrixColumn) {
    const assignment = getOriginalFabricAssignment(column);

    return getFabricAssignmentName(assignment);
  }

  // RU: Эти данные показывают в окне выбранную ткань и исходное фото до сохранения.
  // FR: Ces donnees montrent dans la fenetre le tissu choisi et la photo source avant la sauvegarde.
  const activeSelectedSourceFabricId =
    selectedSourceFabricId ??
    activeColumn?.current_source_photo?.original_fabric_id ??
    "";
  const activeOriginalFabricAssignment = activeColumn
    ? getFabricAssignmentById(activeSelectedSourceFabricId)
    : null;
  const activeOriginalFabric = activeOriginalFabricAssignment?.fabric ?? null;
  const activeOriginalFabricName = getFabricAssignmentName(
    activeOriginalFabricAssignment,
  );
  const activeSourcePhotoPreviewUrl =
    selectedSourcePhotoPreviewUrl ??
    activeColumn?.current_source_photo?.preview_url ??
    null;

  // RU: Это значение решает, где показывать сообщение: в окне или над списком.
  // FR: Cette valeur decide ou montrer le message: dans la fenetre ou au-dessus de la liste.
  const shouldShowSectionFeedback =
    !activeColumnDrawerMode && !pendingDeleteColumnId;

  return (
    <section
      aria-labelledby="visual-matrix-title"
      className="admin-subsection"
      id="visual-matrix"
    >
      <SectionStepHeading
        headingId="visual-matrix-title"
        title="View columns"
      />
      {shouldShowSectionFeedback && errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {shouldShowSectionFeedback && uploadInfoMessage ? (
        <p className="form-info" role="status">
          {uploadInfoMessage}
        </p>
      ) : null}
      <div className="admin-visual-matrix-toolbar">
        <div>
          <h3>View columns</h3>
          <p>Configures positions. Renders shows coverage.</p>
        </div>
        <button
          className="admin-secondary-button"
          onClick={() => openColumnDrawer("add")}
          type="button"
        >
          Add column
        </button>
      </div>
      {columns.length === 0 ? <p>No visual columns.</p> : null}
      {columns.length > 0 ? (
        <div className="admin-visual-matrix-list">
          {columns.map((column) => {
            const originalFabricAssignment =
              getOriginalFabricAssignment(column);
            const originalFabric = originalFabricAssignment?.fabric ?? null;
            const originalFabricName = getOriginalFabricName(column);
            const sourcePhotoPreviewUrl =
              column.current_source_photo?.preview_url ?? null;

            return (
              <article className="admin-visual-matrix-row" key={column.id}>
                <button
                  aria-label={`Edit source image column ${column.sequence}`}
                  className="admin-visual-matrix-source-preview admin-visual-matrix-source-button"
                  onClick={() => openColumnDrawer("edit", column)}
                  type="button"
                >
                  {sourcePhotoPreviewUrl ? (
                    <img alt="" src={sourcePhotoPreviewUrl} />
                  ) : (
                    <span className="admin-visual-matrix-source-empty">
                      Upload
                    </span>
                  )}
                  <span
                    className={
                      sourcePhotoPreviewUrl
                        ? "admin-visual-matrix-source-action admin-visual-matrix-source-action--icon"
                        : "admin-visual-matrix-source-action"
                    }
                  >
                    {sourcePhotoPreviewUrl ? <AdminEditIcon /> : "Upload"}
                  </span>
                </button>
                <div className="admin-visual-matrix-copy">
                  <span className="admin-visual-matrix-kicker">
                    Position {String(column.sequence).padStart(2, "0")}
                  </span>
                  <strong>
                    {column.public_label ?? `Column ${column.sequence}`}
                  </strong>
                  <span>{column.admin_label ?? "No admin label"}</span>
                </div>
                <div
                  aria-label={`Source fabric ${originalFabricName}`}
                  className="admin-visual-matrix-fabric-preview"
                >
                  {originalFabric?.swatch_preview_url ? (
                    <img
                      alt={`Swatch for ${originalFabricName}`}
                      src={originalFabric.swatch_preview_url}
                    />
                  ) : (
                    <span>{originalFabric ? "No swatch" : "No fabric"}</span>
                  )}
                </div>
                <div className="admin-visual-matrix-actions admin-visual-matrix-action-bar">
                  <button
                    aria-label={`Edit column ${column.sequence}`}
                    className="admin-quiet-button admin-visual-matrix-action-button"
                    onClick={() => openColumnDrawer("edit", column)}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      {activeColumnDrawerMode === "add" ? (
        <div className="admin-dialog-scrim admin-render-workbench-scrim">
          <div
            aria-label="Add column"
            aria-modal="true"
            aria-busy={isSubmitting}
            className="admin-drawer admin-render-cell-sheet admin-render-cell-workbench"
            role="dialog"
          >
            <header className="admin-render-cell-sheet-header">
              <div>
                <p className="eyebrow">View columns</p>
                <h3>Add column</h3>
              </div>
              <button
                aria-label="Close View columns dialog"
                className="admin-quiet-button admin-render-cell-close-button"
                disabled={isSubmitting}
                onClick={closeColumnDrawer}
                type="button"
              >
                Close
              </button>
            </header>
            <form
              aria-busy={isSubmitting}
              className="admin-inline-form admin-inline-form-wide admin-visual-matrix-dialog-form"
              onSubmit={handleCreate}
            >
              {errorMessage ? (
                <p className="form-error admin-dialog-feedback" role="alert">
                  {errorMessage}
                </p>
              ) : null}
              <fieldset
                className="admin-view-column-fieldset"
                disabled={isSubmitting}
              >
                <label className="field">
                  <span>Order</span>
                  <input min="1" name="sequence" required type="number" />
                </label>
                <label className="field">
                  <span>Admin label</span>
                  <input name="admin_label" />
                </label>
                <label className="field">
                  <span>Public label</span>
                  <input name="public_label" />
                </label>
                <div className="admin-actions">
                  <button className="admin-primary-button" type="submit">
                    {isSubmitting ? "Adding" : "Add column"}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      ) : null}
      {activeColumnDrawerMode === "edit" && activeColumn ? (
        <div className="admin-dialog-scrim admin-render-workbench-scrim">
          <div
            aria-label={`Edit column ${activeColumn.sequence}`}
            aria-modal="true"
            aria-busy={isSubmitting}
            className="admin-drawer admin-render-cell-sheet admin-render-cell-workbench"
            role="dialog"
          >
            <header className="admin-render-cell-sheet-header">
              <div>
                <p className="eyebrow">View columns</p>
                <h3>Edit column {activeColumn.sequence}</h3>
                <p className="admin-muted">
                  {activeColumn.public_label ??
                    `Column ${activeColumn.sequence}`}
                </p>
              </div>
              <button
                aria-label="Close View columns dialog"
                className="admin-quiet-button admin-render-cell-close-button"
                disabled={isSubmitting}
                onClick={closeColumnDrawer}
                type="button"
              >
                Close
              </button>
            </header>
            <form
              aria-busy={isSubmitting}
              className="admin-inline-form admin-inline-form-wide admin-visual-matrix-dialog-form admin-view-column-editor-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveColumn(activeColumn, event.currentTarget);
              }}
            >
              {errorMessage ? (
                <p className="form-error admin-dialog-feedback" role="alert">
                  {errorMessage}
                </p>
              ) : null}
              {uploadInfoMessage ? (
                <p className="form-info admin-dialog-feedback" role="status">
                  {uploadInfoMessage}
                </p>
              ) : null}
              <fieldset
                className="admin-view-column-fieldset"
                disabled={isSubmitting}
              >
                <div className="admin-view-column-editor-layout">
                  <div className="admin-view-column-media-panel">
                    <div className="admin-view-column-editor-media">
                      <label className="admin-view-column-source-preview admin-view-column-source-upload">
                        <span className="admin-view-column-source-frame">
                          {activeSourcePhotoPreviewUrl ? (
                            <img alt="" src={activeSourcePhotoPreviewUrl} />
                          ) : (
                            <span>No source image</span>
                          )}
                        </span>
                        <span className="admin-view-column-source-action">
                          <strong>
                            {activeSourcePhotoPreviewUrl
                              ? "Edit image"
                              : "Upload image"}
                          </strong>
                          <small>
                            {selectedSourcePhotoFileName ?? "PNG, JPG, WEBP"}
                          </small>
                        </span>
                        <input
                          accept="image/png,image/jpeg,image/webp"
                          aria-label={`Source photo ${activeColumn.sequence}`}
                          className="admin-view-column-file-input"
                          name={`source_photo_${activeColumn.id}`}
                          onChange={handleSourcePhotoFileChange}
                          type="file"
                        />
                      </label>
                      <div
                        aria-label={`Current source fabric ${activeOriginalFabricName}`}
                        className="admin-view-column-fabric-preview"
                      >
                        {activeOriginalFabric?.swatch_preview_url ? (
                          <img
                            alt={`Swatch for ${activeOriginalFabricName}`}
                            src={activeOriginalFabric.swatch_preview_url}
                          />
                        ) : (
                          <span>
                            {activeOriginalFabric ? "No swatch" : "No fabric"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className="admin-view-column-fields"
                    aria-label={`Column ${activeColumn.sequence} settings`}
                  >
                    <label className="field">
                      <span>Order {activeColumn.sequence}</span>
                      <input
                        defaultValue={activeColumn.sequence}
                        min="1"
                        name={`sequence_${activeColumn.id}`}
                        type="number"
                      />
                    </label>
                    <label className="field">
                      <span>Public label {activeColumn.sequence}</span>
                      <input
                        defaultValue={activeColumn.public_label ?? ""}
                        name={`public_label_${activeColumn.id}`}
                      />
                    </label>
                    <label className="field">
                      <span>Admin label {activeColumn.sequence}</span>
                      <input
                        defaultValue={activeColumn.admin_label ?? ""}
                        name={`admin_label_${activeColumn.id}`}
                      />
                    </label>
                    <label className="field">
                      <span>Source fabric {activeColumn.sequence}</span>
                      <select
                        onChange={handleSourceFabricChange}
                        value={activeSelectedSourceFabricId}
                        name={`source_fabric_${activeColumn.id}`}
                      >
                        <option value="">Select fabric</option>
                        {sofaFabrics.map((assignment) => (
                          <option
                            key={assignment.fabric_id}
                            value={assignment.fabric_id}
                          >
                            {assignment.fabric?.internal_name ??
                              assignment.fabric_id}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="admin-actions admin-view-column-editor-actions">
                  <button className="admin-primary-button" type="submit">
                    {isSubmitting ? "Saving" : "Save"}
                  </button>
                  <button
                    className="admin-danger-button"
                    onClick={() => {
                      closeColumnDrawer();
                      setPendingDeleteColumnId(activeColumn.id);
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      ) : null}
      {pendingDeleteColumn ? (
        <div className="admin-dialog-scrim">
          <div
            aria-label={`Delete column ${pendingDeleteColumn.sequence}`}
            aria-modal="true"
            aria-busy={isSubmitting}
            className="admin-alert-dialog"
            role="alertdialog"
          >
            <h3>Delete column {pendingDeleteColumn.sequence}</h3>
            <p>Deleting this column affects all fabrics for this sofa.</p>
            {errorMessage ? (
              <p className="form-error admin-dialog-feedback" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className="admin-actions">
              <button
                className="admin-danger-button"
                disabled={isSubmitting}
                onClick={() => void handleDelete(pendingDeleteColumn)}
                type="button"
              >
                {isSubmitting
                  ? "Deleting"
                  : `Confirm delete column ${pendingDeleteColumn.sequence}`}
              </button>
              <button
                className="admin-secondary-button"
                disabled={isSubmitting}
                onClick={() => setPendingDeleteColumnId(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function renderSourceTypeLabel(sourceType: string) {
  if (sourceType === "source_photo") {
    return "Source photo";
  }

  if (sourceType === "manual_upload") {
    return "Manual upload";
  }

  if (sourceType === "ai_generated") {
    return "AI generated";
  }

  return sourceType || "Unknown";
}

function renderCellSourceDetailLabel(
  cell: AdminCatalogRenderCell,
  status: RenderCellDisplayStatus,
) {
  if (status === "missing" || status === "blocked") {
    return "No source yet";
  }

  return renderSourceTypeLabel(cell.source_type);
}

function getRenderCellStatusLabel(status: RenderCellDisplayStatus) {
  return RENDER_CELL_STATUS_LABELS[status];
}

function getVisualMatrixColumnLabel(column: AdminCatalogVisualMatrixColumn) {
  return (
    column.public_label ?? column.admin_label ?? `Column ${column.sequence}`
  );
}

function getSofaFabricDisplayName(assignment: AdminCatalogSofaFabric) {
  return (
    assignment.fabric?.public_name ??
    assignment.fabric?.internal_name ??
    assignment.fabric_id
  );
}

function getSofaEditTabLabel(tab: SofaEditTabKey) {
  return SOFA_EDIT_TABS.find((entry) => entry.key === tab)?.label ?? tab;
}

function RenderStatusChip({ status }: { status: RenderCellDisplayStatus }) {
  return (
    <span className={`admin-status-chip admin-status-chip-${status}`}>
      <span aria-hidden="true" className="admin-status-chip-marker">
        {RENDER_CELL_STATUS_MARKERS[status]}
      </span>
      {getRenderCellStatusLabel(status)}
    </span>
  );
}

function RenderCellEmptyPreview({
  hasCurrentAsset,
  status,
}: {
  hasCurrentAsset: boolean;
  status: RenderCellDisplayStatus;
}) {
  // RU: Эти слова объясняют, почему слева пока нет готовой картинки.
  // FR: Ces mots expliquent pourquoi il n'y a pas encore d'image finale a gauche.
  const emptyPreviewCopy = hasCurrentAsset
    ? {
        description: "The image exists, but the preview cannot be loaded here.",
        title: "Preview unavailable",
      }
    : status === "blocked"
      ? {
          description: "Complete the missing render input first.",
          title: "Render blocked",
        }
      : status === "missing"
        ? {
            description: "This cell has no current render yet.",
            title: "Render missing",
          }
        : {
            description: "No current preview is available for this cell.",
            title: "Render unavailable",
          };

  // RU: Этот блок рисует спокойную заглушку вместо пустого места.
  // FR: Ce bloc montre un repere simple a la place de la zone vide.
  return (
    <figure
      className={`admin-render-empty-preview admin-render-empty-preview-${status}`}
    >
      <div className="admin-render-empty-preview-frame" aria-hidden="true">
        <span />
      </div>
      <figcaption className="admin-render-empty-preview-copy">
        <span className="admin-render-empty-preview-title">
          {emptyPreviewCopy.title}
        </span>
        <span>{emptyPreviewCopy.description}</span>
      </figcaption>
    </figure>
  );
}

function RenderCellButtonContent({
  cell,
  previewUrl,
  status,
}: {
  cell: AdminCatalogRenderCell;
  previewUrl: string | null;
  status: RenderCellDisplayStatus;
}) {
  const hasPreview = Boolean(previewUrl);
  const latestJobStatus = cell.latest_job?.status ?? null;
  const displayBlockers = getRenderCellDisplayBlockers(cell.blockers);

  return (
    <span className="admin-render-cell-content">
      <span className="admin-render-cell-media" aria-hidden="true">
        {hasPreview ? <img alt="" src={previewUrl ?? ""} /> : <span />}
      </span>
      <span className="admin-render-cell-copy">
        <RenderStatusChip status={status} />
        <span className="admin-render-cell-meta">
          {cell.candidate_count > 0
            ? `${cell.candidate_count} candidates`
            : latestJobStatus
              ? `Job ${latestJobStatus}`
              : displayBlockers.length > 0
                ? `${displayBlockers.length} blockers`
                : hasPreview
                  ? "Current render"
                  : "Open details"}
        </span>
      </span>
    </span>
  );
}

function isSourcePhotoCompleteCell(cell: AdminCatalogRenderCell) {
  return (
    cell.source_type === "source_photo" &&
    cell.has_private_render &&
    Boolean(cell.source_photo_id)
  );
}

function mergeManualRenderCellChange(
  currentCell: AdminCatalogRenderCell,
  nextCell: AdminCatalogRenderCell,
): AdminCatalogRenderCell {
  if (nextCell.source_type !== "manual_upload") {
    return nextCell;
  }

  return {
    ...nextCell,
    can_generate_initial:
      currentCell.can_generate_initial || nextCell.can_generate_initial,
    candidate_count: Math.max(
      currentCell.candidate_count,
      nextCell.candidate_count,
    ),
  };
}

function isTerminalFabricRenderJobStatus(status: string) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function assetPreviewUrlFor(
  urls: Record<string, string>,
  assetId: string | null | undefined,
) {
  return assetId ? (urls[assetId] ?? null) : null;
}

function RenderCoverageSection({
  accessToken,
  coverage,
  dependencies,
  onRenderCellChange,
  onRefresh,
  onSelectTab,
  sofaFabrics,
  visualMatrixColumns,
}: {
  accessToken: string;
  coverage: AdminCatalogRenderCoverage | null;
  dependencies: AdminCatalogPageDependencies;
  onRenderCellChange(cell: AdminCatalogRenderCell): void;
  onRefresh(): Promise<void>;
  onSelectTab?(tab: SofaEditTabKey): void;
  sofaFabrics: AdminCatalogSofaFabric[];
  visualMatrixColumns: AdminCatalogVisualMatrixColumn[];
}) {
  // RU: Эти значения хранят сообщение, выбранную ячейку и список картинок для проверки.
  // FR: Ces valeurs gardent le message, la case choisie et la liste d'images a verifier.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [reviewCellId, setReviewCellId] = useState<string | null>(null);
  const [reviewCandidates, setReviewCandidates] = useState<
    AdminCatalogRenderCandidate[]
  >([]);
  // RU: Это значение хранит вариант, для которого показано поле улучшения.
  // FR: Cette valeur garde l'option dont le champ d'amelioration est visible.
  const [openRefineCandidateId, setOpenRefineCandidateId] = useState<
    string | null
  >(null);
  // RU: Это значение хранит вариант, который открыт для сравнения с исходным фото.
  // FR: Cette valeur garde l'option ouverte pour comparaison avec la photo source.
  const [compareCandidateId, setCompareCandidateId] = useState<string | null>(
    null,
  );
  // RU: Это значение показывает, открыто ли отдельное окно текущей картинки.
  // FR: Cette valeur indique si la fenetre de l'image actuelle est ouverte.
  const [isCurrentRenderPreviewOpen, setIsCurrentRenderPreviewOpen] =
    useState(false);
  // RU: Это значение хранит картинку, которую админ открыл крупно.
  // FR: Cette valeur garde l'image que l'admin a ouverte en grand.
  const [largeImagePreview, setLargeImagePreview] =
    useState<AdminLargeImagePreview | null>(null);
  // RU: Эти записи держат короткие подсказки админа для нового изображения.
  // FR: Ces textes gardent les notes courtes de l'admin pour une nouvelle image.
  const [initialPromptNotes, setInitialPromptNotes] = useState<
    Record<string, string>
  >({});
  // RU: Эти отметки показывают, где админ открыл необязательное уточнение для создания картинки.
  // FR: Ces reperes montrent ou l'admin a ouvert la note facultative pour creer une image.
  const [openPromptNoteCellIds, setOpenPromptNoteCellIds] = useState<
    Record<string, boolean>
  >({});
  const [isRenderExportBusy, setIsRenderExportBusy] = useState(false);
  const [renderExport, setRenderExport] =
    useState<AdminSofaRenderExport | null>(null);
  // RU: Эти адреса показывают закрытые картинки без временных ссылок Supabase.
  // FR: Ces adresses montrent les images privees sans liens temporaires Supabase.
  const [assetPreviewUrls, setAssetPreviewUrls] = useState<
    Record<string, string>
  >({});

  // RU: Этот флажок нужен, чтобы остановить проверку, если админ ушел со страницы.
  // FR: Ce repere sert a stopper la verification si l'admin quitte la page.
  const isAliveRef = useRef(true);
  // RU: Этот список помогает закрывать старые адреса, когда картинка больше не нужна.
  // FR: Cette liste aide a fermer les anciennes adresses quand l'image n'est plus utile.
  const assetPreviewUrlsRef = useRef<Record<string, string>>({});
  // Return keyboard focus to the cell that opened the sheet after close.
  const renderCellOpenerRef = useRef<HTMLButtonElement | null>(null);
  const renderCellCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  // RU: Этот автоматический блок включает флажок при открытии секции и выключает при уходе.
  // FR: Ce bloc automatique active le repere a l'ouverture et le desactive au depart.
  useEffect(() => {
    isAliveRef.current = true;

    return () => {
      isAliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCellId) {
      return;
    }

    // Move focus into the dialog as soon as the render cell sheet opens.
    renderCellCloseButtonRef.current?.focus();
  }, [selectedCellId]);

  // RU: Это действие запоминает короткую подсказку для выбранной ячейки.
  // FR: Cette action garde une note courte pour la case choisie.
  function handlePromptNoteChange(cellId: string, value: string) {
    setInitialPromptNotes((current) => ({
      ...current,
      [cellId]: value,
    }));
  }

  // RU: Это действие открывает или прячет необязательное уточнение рядом с кнопкой создания.
  // FR: Cette action ouvre ou cache la note facultative pres du bouton de creation.
  function handleTogglePromptNote(cellId: string) {
    setOpenPromptNoteCellIds((current) => ({
      ...current,
      [cellId]: !current[cellId],
    }));
  }

  // RU: Это действие показывает поле улучшения для выбранного варианта.
  // FR: Cette action affiche le champ d'amelioration pour l'option choisie.
  function handleOpenRefineCandidate(candidateId: string) {
    setErrorMessage(null);
    setOpenRefineCandidateId(candidateId);
  }

  // RU: Это действие прячет поле улучшения, если админ передумал.
  // FR: Cette action cache le champ d'amelioration si l'admin change d'avis.
  function handleCloseRefineCandidate() {
    setErrorMessage(null);
    setOpenRefineCandidateId(null);
  }

  // RU: Это действие открывает подробности выбранной ячейки картинки.
  // FR: Cette action ouvre les details de la case image choisie.
  // RU: Если в ячейке есть готовые варианты, список появляется сразу.
  // FR: Si la case a des options pretes, la liste apparait tout de suite.
  function handleOpenRenderCell(
    cell: AdminCatalogRenderCell,
    opener: HTMLButtonElement,
  ) {
    // RU: Этот флажок говорит, надо ли сразу показать список готовых вариантов.
    // FR: Ce repere dit si la liste des options pretes doit apparaitre tout de suite.
    const shouldOpenCandidateReview =
      getRenderCellDisplayStatus(cell) === "candidate";

    renderCellOpenerRef.current = opener;
    setSelectedCellId(cell.id);
    setReviewCellId(null);
    setReviewCandidates([]);
    setOpenRefineCandidateId(null);
    setCompareCandidateId(null);
    setIsCurrentRenderPreviewOpen(false);
    setLargeImagePreview(null);

    if (shouldOpenCandidateReview) {
      void handleReviewCandidates(cell);
    }
  }

  // RU: Это действие закрывает подробности ячейки картинки.
  // FR: Cette action ferme les details de la case image.
  function handleCloseRenderCell() {
    const opener = renderCellOpenerRef.current;

    setSelectedCellId(null);
    setReviewCellId(null);
    setReviewCandidates([]);
    setOpenRefineCandidateId(null);
    setCompareCandidateId(null);
    setIsCurrentRenderPreviewOpen(false);
    setLargeImagePreview(null);
    opener?.focus();
  }

  const renderCells = coverage?.render_cells ?? [];
  // RU: Эти номера говорят, какие закрытые картинки нужны открытому экрану.
  // FR: Ces numeros disent quelles images privees sont utiles a l'ecran ouvert.
  const previewAssetIds = useMemo(() => {
    const assetIds = new Set<string>();

    for (const cell of renderCells) {
      if (cell.current_private_asset_id) {
        assetIds.add(cell.current_private_asset_id);
      }
    }

    for (const column of visualMatrixColumns) {
      const sourceAssetId = column.current_source_photo?.asset_id;

      if (sourceAssetId) {
        assetIds.add(sourceAssetId);
      }
    }

    for (const candidate of reviewCandidates) {
      if (candidate.asset_id) {
        assetIds.add(candidate.asset_id);
      }
    }

    return [...assetIds].sort();
  }, [renderCells, reviewCandidates, visualMatrixColumns]);

  // RU: Этот автоматический блок загружает закрытые картинки через защищенный путь.
  // FR: Ce bloc automatique charge les images privees par le chemin protege.
  useEffect(() => {
    let isCurrent = true;
    const neededAssetIds = new Set(previewAssetIds);
    const currentUrls = assetPreviewUrlsRef.current;
    const nextUrls = { ...currentUrls };
    let hasChanged = false;

    for (const [assetId, url] of Object.entries(currentUrls)) {
      if (!neededAssetIds.has(assetId)) {
        dependencies.revokeStorageAssetPreviewUrl(url);
        delete nextUrls[assetId];
        hasChanged = true;
      }
    }

    if (hasChanged) {
      assetPreviewUrlsRef.current = nextUrls;
      setAssetPreviewUrls(nextUrls);
    }

    for (const assetId of previewAssetIds) {
      if (nextUrls[assetId]) {
        continue;
      }

      void dependencies
        .createStorageAssetPreviewUrl(accessToken, assetId)
        .then((url) => {
          if (!isCurrent) {
            dependencies.revokeStorageAssetPreviewUrl(url);
            return;
          }

          assetPreviewUrlsRef.current = {
            ...assetPreviewUrlsRef.current,
            [assetId]: url,
          };
          setAssetPreviewUrls(assetPreviewUrlsRef.current);
        })
        .catch(() => {});
    }

    return () => {
      isCurrent = false;
    };
  }, [accessToken, dependencies, previewAssetIds]);

  // RU: Этот автоматический блок закрывает локальные адреса при уходе со страницы.
  // FR: Ce bloc automatique ferme les adresses locales au depart de la page.
  useEffect(() => {
    return () => {
      for (const url of Object.values(assetPreviewUrlsRef.current)) {
        dependencies.revokeStorageAssetPreviewUrl(url);
      }

      assetPreviewUrlsRef.current = {};
    };
  }, [dependencies]);

  const canGenerateAll = renderCells.some(
    (cell) => cell.can_generate_initial && !cell.current_private_asset_id,
  );
  const hasQueuedJobs = renderCells.some(
    (cell) => cell.latest_job?.status === "queued",
  );
  const hasProcessingJobs = renderCells.some(
    (cell) => cell.latest_job?.status === "processing",
  );
  const canResumeQueuedJobs = Boolean(
    coverage && hasQueuedJobs && !hasProcessingJobs,
  );
  const renderStatusCounts = RENDER_CELL_STATUS_ORDER.reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0,
    }),
    {} as Record<RenderCellDisplayStatus, number>,
  );

  for (const cell of renderCells) {
    renderStatusCounts[getRenderCellDisplayStatus(cell)] += 1;
  }

  const totalRenderCellCount = renderCells.length;
  // RU: Эти данные находят открытую ячейку, ее ткань, позицию и подпись.
  // FR: Ces donnees retrouvent la case ouverte, son tissu, sa position et son libelle.
  const selectedCell =
    selectedCellId === null
      ? null
      : (renderCells.find((cell) => cell.id === selectedCellId) ?? null);
  const selectedAssignment = selectedCell
    ? (sofaFabrics.find(
        (assignment) => assignment.fabric_id === selectedCell.fabric_id,
      ) ?? null)
    : null;
  const selectedColumn = selectedCell
    ? (visualMatrixColumns.find(
        (column) => column.id === selectedCell.visual_matrix_column_id,
      ) ?? null)
    : null;
  // RU: Этот адрес показывает исходное фото для выбранной позиции.
  // FR: Cette adresse montre la photo source de la position choisie.
  const selectedSourcePhotoPreviewUrl = assetPreviewUrlFor(
    assetPreviewUrls,
    selectedColumn?.current_source_photo?.asset_id,
  );
  // RU: Этот адрес показывает текущую картинку выбранной ячейки.
  // FR: Cette adresse montre l'image actuelle de la case choisie.
  const selectedCellPreviewUrl = assetPreviewUrlFor(
    assetPreviewUrls,
    selectedCell?.current_private_asset_id,
  );
  const selectedStatus = selectedCell
    ? getRenderCellDisplayStatus(selectedCell)
    : null;
  const isReviewingSelectedCell = Boolean(
    selectedCell && reviewCellId === selectedCell.id,
  );
  // RU: Это значение решает, нужна ли главная кнопка для открытой ячейки.
  // FR: Cette valeur decide si la case ouverte a besoin du bouton principal.
  const selectedPrimaryAction = selectedStatus
    ? getRenderCellPrimaryAction(selectedStatus)
    : null;
  // RU: Это значение решает, можно ли попросить еще один вариант картинки.
  // FR: Cette valeur decide si on peut demander une autre option d'image.
  const canGenerateNewCandidate = Boolean(
    selectedCell &&
    selectedStatus &&
    selectedCell.can_generate_initial &&
    selectedStatus !== "missing" &&
    selectedStatus !== "blocked" &&
    selectedStatus !== "queued" &&
    selectedStatus !== "processing",
  );
  // RU: Эти данные находят видимые причины остановки и варианты для сравнения.
  // FR: Ces donnees retrouvent les raisons visibles et les options a comparer.
  const selectedDisplayBlockers = selectedCell
    ? getRenderCellDisplayBlockers(selectedCell.blockers).map(
        formatRenderCellBlockerLabel,
      )
    : [];
  const comparableCandidates = selectedCell
    ? reviewCandidates.filter(
        (candidate) =>
          candidate.render_cell_id === selectedCell.id &&
          Boolean(assetPreviewUrlFor(assetPreviewUrls, candidate.asset_id)),
      )
    : [];
  const compareCandidate =
    compareCandidateId === null
      ? null
      : (comparableCandidates.find(
          (candidate) => candidate.id === compareCandidateId,
        ) ?? null);
  const compareCandidatePreviewUrl = assetPreviewUrlFor(
    assetPreviewUrls,
    compareCandidate?.asset_id,
  );
  async function handleGenerateAll() {
    if (!coverage) {
      return;
    }

    setErrorMessage(null);
    setActiveCellId("__generate_all__");

    try {
      await dependencies.generateFabricRenderJobsForSofa(
        accessToken,
        coverage.sofa_id,
      );
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Этот автоматический блок открывает готовые варианты, если пустая ячейка стала ячейкой с вариантами.
  // FR: Ce bloc automatique ouvre les options pretes si une case vide devient une case avec options.
  useEffect(() => {
    if (
      !selectedCell ||
      selectedStatus !== "candidate" ||
      reviewCellId === selectedCell.id ||
      activeCellId === selectedCell.id
    ) {
      return;
    }

    void handleReviewCandidates(selectedCell);
  }, [activeCellId, reviewCellId, selectedCell, selectedStatus]);

  async function handleResumeQueuedJobs() {
    if (!coverage) {
      return;
    }

    setErrorMessage(null);
    setActiveCellId("__resume__");

    try {
      await dependencies.resumeFabricRenderJobs(accessToken, {
        request_id: null,
        sofa_id: coverage.sofa_id,
      });
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  async function handleCreateRenderExport() {
    if (!coverage) {
      return;
    }

    setErrorMessage(null);
    setIsRenderExportBusy(true);

    try {
      const createdExport = await dependencies.createSofaRenderExport(
        accessToken,
        coverage.sofa_id,
      );
      const nextExport = await dependencies.getSofaRenderExport(
        accessToken,
        createdExport.id,
      );
      setRenderExport(nextExport);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsRenderExportBusy(false);
    }
  }

  async function handleRetryJob(job: AdminCatalogFabricRenderJob) {
    setErrorMessage(null);
    setActiveCellId(job.render_cell_id);

    try {
      await dependencies.retryFabricRenderJob(accessToken, job.id);
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Это действие ставит задачу в очередь и потом само проверяет готовность.
  // FR: Cette action place la tache en file puis verifie seule quand elle est prete.
  async function handleGenerate(cell: AdminCatalogRenderCell) {
    setErrorMessage(null);
    setActiveCellId(cell.id);

    try {
      const promptNote = openPromptNoteCellIds[cell.id]
        ? initialPromptNotes[cell.id]?.trim() || null
        : null;
      await dependencies.createFabricRenderJob(accessToken, {
        fabric_id: cell.fabric_id,
        generation_mode: "initial",
        prompt_note: promptNote,
        sofa_id: cell.sofa_id,
        visual_matrix_column_id: cell.visual_matrix_column_id,
      });
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Это действие просит еще один вариант картинки для выбранной ячейки.
  // FR: Cette action demande une autre option d'image pour la case choisie.
  async function handleGenerateNewCandidate(cell: AdminCatalogRenderCell) {
    setOpenRefineCandidateId(null);
    setCompareCandidateId(null);
    setIsCurrentRenderPreviewOpen(false);
    setLargeImagePreview(null);
    await handleGenerate(cell);
  }

  // RU: Это действие открывает список готовых вариантов для выбранной ячейки.
  // FR: Cette action ouvre la liste des options pretes pour la case choisie.
  async function handleReviewCandidates(cell: AdminCatalogRenderCell) {
    setErrorMessage(null);
    setActiveCellId(cell.id);

    try {
      const candidates = await dependencies.listRenderCellCandidates(
        accessToken,
        cell.id,
      );
      setReviewCandidates(candidates);
      setReviewCellId(cell.id);
      setOpenRefineCandidateId(null);
      setCompareCandidateId(null);
      setIsCurrentRenderPreviewOpen(false);
      setLargeImagePreview(null);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Это действие открывает сравнение исходного фото и варианта после клика по фото.
  // FR: Cette action ouvre la comparaison entre la photo source et l'option apres un clic sur l'image.
  function handleCompareCandidate(candidate: AdminCatalogRenderCandidate) {
    if (!selectedSourcePhotoPreviewUrl) {
      return;
    }

    setOpenRefineCandidateId(null);
    setIsCurrentRenderPreviewOpen(false);
    setLargeImagePreview(null);
    setCompareCandidateId(candidate.id);
  }

  // RU: Это действие открывает большое окно текущей картинки.
  // FR: Cette action ouvre la grande fenetre de l'image actuelle.
  function handleOpenCurrentRenderPreview() {
    setOpenRefineCandidateId(null);
    setCompareCandidateId(null);
    setLargeImagePreview(null);
    setIsCurrentRenderPreviewOpen(true);
  }

  // RU: Это действие закрывает большое окно текущей картинки.
  // FR: Cette action ferme la grande fenetre de l'image actuelle.
  function handleCloseCurrentRenderPreview() {
    setIsCurrentRenderPreviewOpen(false);
  }

  // RU: Это действие закрывает окно сравнения вариантов.
  // FR: Cette action ferme la fenetre de comparaison des options.
  function handleCloseCompareCandidate() {
    setCompareCandidateId(null);
  }

  // RU: Это действие открывает выбранную картинку почти на весь экран.
  // FR: Cette action ouvre l'image choisie presque sur tout l'ecran.
  function handleOpenLargeImagePreview(preview: AdminLargeImagePreview) {
    setLargeImagePreview(preview);
  }

  // RU: Это действие закрывает большое окно картинки.
  // FR: Cette action ferme la grande fenetre de l'image.
  function handleCloseLargeImagePreview() {
    setLargeImagePreview(null);
  }

  // RU: Это действие переключает вариант в окне сравнения.
  // FR: Cette action change l'option dans la fenetre de comparaison.
  function handleMoveCompareCandidate(direction: -1 | 1) {
    if (comparableCandidates.length === 0) {
      return;
    }

    const currentIndex = comparableCandidates.findIndex(
      (candidate) => candidate.id === compareCandidateId,
    );
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + comparableCandidates.length) %
          comparableCandidates.length;

    setCompareCandidateId(comparableCandidates[nextIndex].id);
  }

  // RU: Это действие выбирает одну готовую картинку как текущую.
  // FR: Cette action choisit une image prete comme image actuelle.
  async function handleUseCandidate(candidate: AdminCatalogRenderCandidate) {
    setErrorMessage(null);
    setActiveCellId(candidate.render_cell_id);
    setOpenRefineCandidateId(null);
    setLargeImagePreview(null);

    try {
      const nextCandidate = await dependencies.useRenderCandidate(
        accessToken,
        candidate.id,
      );
      setReviewCandidates((current) =>
        current.map((entry) =>
          entry.id === nextCandidate.id
            ? nextCandidate
            : {
                ...entry,
                is_current: false,
              },
        ),
      );
      await onRefresh();
      setReviewCellId(null);
      setReviewCandidates([]);
      setOpenRefineCandidateId(null);
      setCompareCandidateId(null);
      setIsCurrentRenderPreviewOpen(false);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Это действие ставит выбранную картинку в очередь на улучшение.
  // FR: Cette action place l'image choisie en file pour l'ameliorer.
  async function handleRefineCandidate(
    cell: AdminCatalogRenderCell,
    candidate: AdminCatalogRenderCandidate,
    form: HTMLFormElement,
  ) {
    const formData = new FormData(form);
    const refinePrompt = String(formData.get("refine_prompt") ?? "").trim();

    if (!refinePrompt) {
      setErrorMessage(formatAdminErrorMessage("REFINE_PROMPT_REQUIRED"));
      return;
    }

    setErrorMessage(null);
    setActiveCellId(cell.id);

    try {
      await dependencies.createFabricRenderJob(accessToken, {
        fabric_id: cell.fabric_id,
        generation_mode: "refine",
        prompt_note: null,
        refinement_source_asset_id: candidate.asset_id,
        refine_prompt: refinePrompt,
        sofa_id: cell.sofa_id,
        visual_matrix_column_id: cell.visual_matrix_column_id,
      });
      form.reset();
      setOpenRefineCandidateId(null);
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Это действие загружает картинку вручную для выбранной ячейки.
  // FR: Cette action envoie une image manuelle pour la case choisie.
  async function handleManualRenderUpload(
    cell: AdminCatalogRenderCell,
    form: HTMLFormElement,
  ) {
    setErrorMessage(null);
    setActiveCellId(cell.id);

    const formData = new FormData(form);
    const file = readFileField(form, formData, `manual_render_${cell.id}`);

    if (!file) {
      setErrorMessage(formatAdminErrorMessage("MANUAL_RENDER_REQUIRED"));
      setActiveCellId(null);
      return;
    }

    try {
      const upload = await dependencies.createUpload(accessToken, {
        byte_size: file.size,
        content_type: file.type,
        purpose: "manual_render",
        render_cell_id: cell.id,
      });
      await dependencies.uploadToSignedUrl(upload, file);
      const asset = await dependencies.completeUpload(
        accessToken,
        upload.upload_id,
      );
      const nextCell = await dependencies.setManualRender(
        accessToken,
        cell.id,
        {
          asset_id: asset.id,
        },
      );
      onRenderCellChange(nextCell);
      form.reset();
      await onRefresh();
      onRenderCellChange(nextCell);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Это действие запускает главную кнопку в подробностях ячейки картинки.
  // FR: Cette action lance le bouton principal dans les details de la case image.
  function handleRenderCellPrimaryAction(
    cell: AdminCatalogRenderCell,
    status: RenderCellDisplayStatus,
  ) {
    const primaryAction = getRenderCellPrimaryAction(status);

    if (!primaryAction) {
      return;
    }

    if (primaryAction.targetTab) {
      onSelectTab?.(primaryAction.targetTab);
      handleCloseRenderCell();
      return;
    }

    if (status === "candidate") {
      void handleReviewCandidates(cell);
      return;
    }

    if (
      status === "ready" &&
      assetPreviewUrlFor(assetPreviewUrls, cell.current_private_asset_id)
    ) {
      handleOpenCurrentRenderPreview();
      return;
    }

    if (status === "failed" && cell.latest_job) {
      void handleRetryJob(cell.latest_job);
      return;
    }

    if (status === "missing") {
      void handleGenerate(cell);
    }
  }

  function findCell(fabricId: string, columnId: string) {
    return coverage?.render_cells.find(
      (cell) =>
        cell.fabric_id === fabricId &&
        cell.visual_matrix_column_id === columnId,
    );
  }

  // RU: Этот участок показывает главную кнопку создания и прячет дополнительный текст за маленькой ссылкой.
  // FR: Cette zone montre le bouton principal de creation et cache le texte en plus derriere un petit lien.
  function buildGenerateAction({
    busyLabel,
    cell,
    label,
    onGenerate,
  }: {
    busyLabel: string;
    cell: AdminCatalogRenderCell;
    label: string;
    onGenerate: () => void;
  }) {
    // RU: Эти значения выбирают, видно ли поле уточнения и как оно связано с подписью.
    // FR: Ces valeurs choisissent si le champ de note est visible et comment il est relie au libelle.
    const isPromptNoteOpen = Boolean(openPromptNoteCellIds[cell.id]);
    const promptNoteId = `prompt_note_${cell.id}`;

    return (
      <div
        aria-label="Generate action"
        className="admin-generation-action"
        role="group"
      >
        <button
          className="admin-primary-button"
          disabled={activeCellId === cell.id}
          onClick={onGenerate}
          type="button"
        >
          {activeCellId === cell.id ? busyLabel : label}
        </button>
        <button
          aria-controls={isPromptNoteOpen ? promptNoteId : undefined}
          aria-expanded={isPromptNoteOpen}
          className="admin-quiet-button admin-optional-note-toggle"
          onClick={() => handleTogglePromptNote(cell.id)}
          type="button"
        >
          {isPromptNoteOpen ? "Hide optional note" : "Add optional note"}
        </button>
        {isPromptNoteOpen ? (
          <div className="admin-optional-note-panel">
            <p className="admin-muted">
              The standard generation prompt is used automatically. Add this
              only when you want an extra instruction.
            </p>
            <label className="field" htmlFor={promptNoteId}>
              <span>Optional note</span>
              <textarea
                id={promptNoteId}
                name={promptNoteId}
                onChange={(event) =>
                  handlePromptNoteChange(cell.id, event.currentTarget.value)
                }
                rows={2}
                value={initialPromptNotes[cell.id] ?? ""}
              />
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="render-coverage-title"
      className="admin-subsection"
      id="render-coverage"
    >
      <SectionStepHeading
        headingId="render-coverage-title"
        title="Render coverage"
      />
      <div className="admin-render-operations">
        <div
          aria-label="Render coverage summary"
          className="admin-render-summary"
        >
          <div>
            <strong>{renderStatusCounts.ready}</strong>
            <span>Ready</span>
          </div>
          <div>
            <strong>{renderStatusCounts.candidate}</strong>
            <span>Candidates</span>
          </div>
          <div>
            <strong>{renderStatusCounts.missing}</strong>
            <span>Missing</span>
          </div>
          <div>
            <strong>{renderStatusCounts.blocked}</strong>
            <span>Blocked</span>
          </div>
          <div>
            <strong>
              {renderStatusCounts.queued + renderStatusCounts.processing}
            </strong>
            <span>Active jobs</span>
          </div>
          <div>
            <strong>{totalRenderCellCount}</strong>
            <span>Total</span>
          </div>
        </div>
        <div className="admin-render-command-bar">
          {canGenerateAll ? (
            <button
              className="admin-primary-button"
              disabled={activeCellId === "__generate_all__"}
              onClick={() => void handleGenerateAll()}
              type="button"
            >
              {activeCellId === "__generate_all__"
                ? "Queueing"
                : "Generate missing"}
            </button>
          ) : null}
          {canResumeQueuedJobs ? (
            <button
              className="admin-secondary-button"
              disabled={activeCellId === "__resume__"}
              onClick={() => void handleResumeQueuedJobs()}
              type="button"
            >
              {activeCellId === "__resume__"
                ? "Resuming"
                : "Resume queued jobs"}
            </button>
          ) : null}
        </div>
      </div>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {!coverage ||
      sofaFabrics.length === 0 ||
      visualMatrixColumns.length === 0 ? (
        <p>No render coverage.</p>
      ) : (
        <>
          {/* RU: Эта секция показывает компактную таблицу готовности картинок. */}
          {/* FR: Cette section montre le tableau compact des images. */}
          <div className="admin-render-matrix-wrap">
            <table className="admin-render-matrix">
              <thead>
                <tr>
                  <th>Fabric</th>
                  {visualMatrixColumns.map((column) => (
                    <th key={column.id}>
                      {getVisualMatrixColumnLabel(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sofaFabrics.map((assignment) => (
                  <tr key={assignment.fabric_id}>
                    <td>
                      {assignment.fabric ? (
                        <AdminFabricCompact fabric={assignment.fabric} />
                      ) : (
                        getSofaFabricDisplayName(assignment)
                      )}
                    </td>
                    {visualMatrixColumns.map((column) => {
                      const cell = findCell(assignment.fabric_id, column.id);
                      const status = cell
                        ? getRenderCellDisplayStatus(cell)
                        : null;

                      return (
                        <td key={column.id}>
                          {cell && status ? (
                            <button
                              aria-label={`${getSofaFabricDisplayName(
                                assignment,
                              )}, ${getVisualMatrixColumnLabel(
                                column,
                              )}: ${getRenderCellStatusLabel(status)}`}
                              className="admin-render-cell-button"
                              onClick={(event) =>
                                handleOpenRenderCell(cell, event.currentTarget)
                              }
                              type="button"
                            >
                              <RenderCellButtonContent
                                cell={cell}
                                previewUrl={assetPreviewUrlFor(
                                  assetPreviewUrls,
                                  cell.current_private_asset_id,
                                )}
                                status={status}
                              />
                            </button>
                          ) : (
                            <RenderStatusChip status="missing" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-render-mobile-groups">
            {sofaFabrics.map((assignment) => (
              <article
                className="admin-render-fabric-group"
                key={assignment.fabric_id}
              >
                {assignment.fabric ? (
                  <AdminFabricCompact fabric={assignment.fabric} />
                ) : (
                  <strong>{getSofaFabricDisplayName(assignment)}</strong>
                )}
                <div className="admin-render-fabric-group-cells">
                  {visualMatrixColumns.map((column) => {
                    const cell = findCell(assignment.fabric_id, column.id);
                    const status = cell
                      ? getRenderCellDisplayStatus(cell)
                      : "missing";

                    return (
                      <button
                        aria-label={`Mobile cell ${getVisualMatrixColumnLabel(
                          column,
                        )} for ${getSofaFabricDisplayName(
                          assignment,
                        )} is ${getRenderCellStatusLabel(status)}`}
                        className="admin-render-cell-button"
                        disabled={!cell}
                        key={column.id}
                        onClick={(event) => {
                          if (cell) {
                            handleOpenRenderCell(cell, event.currentTarget);
                          }
                        }}
                        type="button"
                      >
                        <span className="admin-render-mobile-cell-label">
                          {getVisualMatrixColumnLabel(column)}
                        </span>
                        {cell ? (
                          <RenderCellButtonContent
                            cell={cell}
                            previewUrl={assetPreviewUrlFor(
                              assetPreviewUrls,
                              cell.current_private_asset_id,
                            )}
                            status={status}
                          />
                        ) : (
                          <RenderStatusChip status={status} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          <details className="admin-status-key">
            <summary>Status key</summary>
            <div aria-label="Status key details">
              {RENDER_CELL_STATUS_ORDER.map((status) => (
                <RenderStatusChip key={status} status={status} />
              ))}
            </div>
          </details>
          {selectedCell &&
          selectedAssignment &&
          selectedColumn &&
          selectedStatus ? (
            <div className="admin-dialog-scrim admin-render-workbench-scrim">
              <aside
                aria-label={`Render cell: ${getSofaFabricDisplayName(
                  selectedAssignment,
                )}, ${getVisualMatrixColumnLabel(selectedColumn)}`}
                className={`admin-drawer admin-render-cell-sheet admin-render-cell-workbench${
                  isReviewingSelectedCell
                    ? " admin-render-cell-workbench-review"
                    : ""
                }`}
                role="dialog"
              >
                <header className="admin-render-cell-sheet-header">
                  <div>
                    <p className="eyebrow">Render cell</p>
                    <h3>
                      {getSofaFabricDisplayName(selectedAssignment)} /{" "}
                      {getVisualMatrixColumnLabel(selectedColumn)}
                    </h3>
                  </div>
                  <button
                    aria-label="Close render cell"
                    className="admin-quiet-button admin-render-cell-close-button"
                    onClick={handleCloseRenderCell}
                    ref={renderCellCloseButtonRef}
                    type="button"
                  >
                    Close
                  </button>
                </header>
                <div className="admin-render-cell-sheet-body">
                  <div className="admin-render-cell-preview-pane">
                    {/* This block shows the current ready image for the selected cell. */}
                    {selectedCellPreviewUrl ? (
                      <figure className="admin-current-render-preview">
                        <figcaption>Current render</figcaption>
                        <button
                          aria-label="Open current render preview larger"
                          className="admin-image-preview-button"
                          onClick={() =>
                            handleOpenLargeImagePreview({
                              alt: "Current render preview",
                              src: selectedCellPreviewUrl,
                              title: "Current render",
                            })
                          }
                          type="button"
                        >
                          <img
                            alt="Current render preview"
                            className="admin-preview-image"
                            src={selectedCellPreviewUrl}
                          />
                        </button>
                      </figure>
                    ) : selectedCell.current_private_asset_id ? (
                      <RenderCellEmptyPreview
                        hasCurrentAsset={true}
                        status={selectedStatus}
                      />
                    ) : (
                      <RenderCellEmptyPreview
                        hasCurrentAsset={false}
                        status={selectedStatus}
                      />
                    )}
                  </div>
                  <div className="admin-render-cell-controls-pane">
                    {selectedAssignment.fabric ? (
                      <AdminFabricCard fabric={selectedAssignment.fabric} />
                    ) : (
                      <p>{getSofaFabricDisplayName(selectedAssignment)}</p>
                    )}
                    <div className="admin-render-cell-status-row">
                      <span>{getVisualMatrixColumnLabel(selectedColumn)}</span>
                      <RenderStatusChip status={selectedStatus} />
                    </div>
                    <dl className="admin-cell-details">
                      <div>
                        <dt>Source</dt>
                        <dd>
                          {renderCellSourceDetailLabel(
                            selectedCell,
                            selectedStatus,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Job</dt>
                        <dd>{selectedCell.latest_job?.status ?? "No job"}</dd>
                      </div>
                      <div>
                        <dt>Candidates</dt>
                        <dd>{selectedCell.candidate_count}</dd>
                      </div>
                    </dl>
                    {selectedCell.candidate_count > 0 &&
                    selectedStatus !== "candidate" &&
                    reviewCellId !== selectedCell.id ? (
                      <button
                        className="admin-secondary-button"
                        disabled={activeCellId === selectedCell.id}
                        onClick={() =>
                          void handleReviewCandidates(selectedCell)
                        }
                        type="button"
                      >
                        Review candidates
                      </button>
                    ) : null}
                    {errorMessage ? (
                      <p className="form-error" role="alert">
                        {errorMessage}
                      </p>
                    ) : null}
                    {canGenerateNewCandidate &&
                    reviewCellId !== selectedCell.id ? (
                      <>
                        {/* The primary generation action stays visible while optional instructions stay collapsed. */}
                        {buildGenerateAction({
                          busyLabel: "Queueing",
                          cell: selectedCell,
                          label: "Generate new candidate",
                          onGenerate: () =>
                            void handleGenerateNewCandidate(selectedCell),
                        })}
                      </>
                    ) : null}
                    {selectedDisplayBlockers.length > 0 ? (
                      <div className="admin-cell-blockers">
                        <strong>Blockers</strong>
                        <span>{selectedDisplayBlockers.join(", ")}</span>
                      </div>
                    ) : null}
                    {selectedCell.latest_job?.status === "failed" ? (
                      <div className="admin-cell-blockers">
                        <strong>Generation failed</strong>
                        <span>
                          {formatAdminErrorMessage(
                            selectedCell.latest_job.last_error_message ??
                              "FABRIC_RENDER_JOB_FAILED",
                          )}
                        </span>
                      </div>
                    ) : null}
                    {isSourcePhotoCompleteCell(selectedCell) ? (
                      <span className="admin-muted">
                        Source photo is current
                      </span>
                    ) : null}
                    {selectedStatus === "missing" && selectedPrimaryAction ? (
                      <>
                        {/* Creation starts immediately, while the optional note remains collapsed. */}
                        {buildGenerateAction({
                          busyLabel: "Working",
                          cell: selectedCell,
                          label: selectedPrimaryAction.label,
                          onGenerate: () =>
                            handleRenderCellPrimaryAction(
                              selectedCell,
                              selectedStatus,
                            ),
                        })}
                      </>
                    ) : null}
                    {/* This list shows ready candidate options for the selected cell. */}
                    {reviewCellId === selectedCell.id ? (
                      <div
                        aria-label="Review candidates"
                        className="admin-candidate-list"
                        role="group"
                      >
                        <div className="admin-candidate-list-header">
                          <div>
                            <h4>Candidates</h4>
                            <p className="admin-muted">
                              Choose the image that should become current, or
                              ask for a focused refinement.
                            </p>
                          </div>
                          <span>{reviewCandidates.length}</span>
                        </div>
                        {reviewCandidates.length === 0 ? (
                          <span className="admin-muted">No candidates</span>
                        ) : null}
                        {reviewCandidates.map((candidate) => {
                          const candidatePreviewUrl = assetPreviewUrlFor(
                            assetPreviewUrls,
                            candidate.asset_id,
                          );

                          return (
                            <article
                              aria-label={`Candidate ${candidate.id}`}
                              className="admin-candidate-row"
                              key={candidate.id}
                            >
                              <div className="admin-candidate-media">
                                {candidatePreviewUrl ? (
                                  selectedSourcePhotoPreviewUrl ? (
                                    <button
                                      aria-label={`Open candidate preview ${candidate.id} in comparison`}
                                      className="admin-image-preview-button admin-candidate-compare-button"
                                      onClick={() =>
                                        handleCompareCandidate(candidate)
                                      }
                                      type="button"
                                    >
                                      <img
                                        alt={`Candidate preview ${candidate.id}`}
                                        className="admin-preview-image"
                                        src={candidatePreviewUrl}
                                      />
                                    </button>
                                  ) : (
                                    <img
                                      alt={`Candidate preview ${candidate.id}`}
                                      className="admin-preview-image"
                                      src={candidatePreviewUrl}
                                    />
                                  )
                                ) : (
                                  <span className="admin-preview-image admin-preview-image-empty">
                                    {candidate.asset_id
                                      ? "Preview loading"
                                      : "No preview"}
                                  </span>
                                )}
                              </div>
                              <div className="admin-candidate-body">
                                <strong>
                                  {candidate.is_current
                                    ? "Current candidate"
                                    : "Candidate"}
                                </strong>
                                <span>
                                  {candidate.generation_mode} -{" "}
                                  {candidate.prompt_version}
                                </span>
                                <span className="admin-muted">
                                  {candidate.is_current
                                    ? "Current"
                                    : "Candidate"}
                                </span>
                                <div className="admin-candidate-actions">
                                  <button
                                    className="admin-secondary-button"
                                    disabled={
                                      candidate.is_current ||
                                      activeCellId === selectedCell.id
                                    }
                                    onClick={() =>
                                      void handleUseCandidate(candidate)
                                    }
                                    type="button"
                                  >
                                    Use candidate
                                  </button>
                                  {openRefineCandidateId !== candidate.id ? (
                                    <button
                                      className="admin-quiet-button"
                                      disabled={
                                        activeCellId === selectedCell.id
                                      }
                                      onClick={() =>
                                        handleOpenRefineCandidate(candidate.id)
                                      }
                                      type="button"
                                    >
                                      Refine candidate
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {openRefineCandidateId === candidate.id ? (
                                <>
                                  {/* RU: Эта форма отправляет выбранный вариант на улучшение. */}
                                  {/* FR: Ce formulaire envoie l'option choisie pour amelioration. */}
                                  <form
                                    className="admin-cell-form"
                                    onSubmit={(event) => {
                                      event.preventDefault();
                                      void handleRefineCandidate(
                                        selectedCell,
                                        candidate,
                                        event.currentTarget,
                                      );
                                    }}
                                  >
                                    <label className="field">
                                      <span>Refine prompt</span>
                                      <textarea
                                        name="refine_prompt"
                                        required
                                        rows={2}
                                      />
                                    </label>
                                    <button
                                      className="admin-primary-button"
                                      disabled={
                                        activeCellId === selectedCell.id
                                      }
                                      type="submit"
                                    >
                                      Refine
                                    </button>
                                    <button
                                      className="admin-secondary-button"
                                      disabled={
                                        activeCellId === selectedCell.id
                                      }
                                      onClick={handleCloseRefineCandidate}
                                      type="button"
                                    >
                                      Cancel refine
                                    </button>
                                  </form>
                                </>
                              ) : null}
                            </article>
                          );
                        })}
                        {canGenerateNewCandidate ? (
                          <div
                            aria-label="Candidate follow-up actions"
                            className="admin-candidate-followup-action"
                            role="group"
                          >
                            <div>
                              <strong>Need another option?</strong>
                              <p className="admin-muted">
                                Queue a new candidate without changing the
                                current selection.
                              </p>
                            </div>
                            {/* The admin can request another option and optionally add guidance. */}
                            {buildGenerateAction({
                              busyLabel: "Queueing",
                              cell: selectedCell,
                              label: "Generate new candidate",
                              onGenerate: () =>
                                void handleGenerateNewCandidate(selectedCell),
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {isSourcePhotoCompleteCell(selectedCell) ||
                    (selectedStatus !== "blocked" &&
                      selectedStatus !== "queued" &&
                      selectedStatus !== "processing") ? (
                      <form
                        className="admin-cell-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleManualRenderUpload(
                            selectedCell,
                            event.currentTarget,
                          );
                        }}
                      >
                        <label className="field">
                          <span>Manual render</span>
                          <input
                            accept="image/png,image/jpeg,image/webp"
                            name={`manual_render_${selectedCell.id}`}
                            type="file"
                          />
                        </label>
                        <button
                          className="admin-secondary-button"
                          disabled={activeCellId === selectedCell.id}
                          type="submit"
                        >
                          Upload manual render
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                {selectedPrimaryAction &&
                selectedStatus !== "missing" &&
                reviewCellId !== selectedCell.id ? (
                  <footer className="admin-render-cell-sheet-footer">
                    <button
                      className="admin-secondary-button"
                      disabled={
                        activeCellId === selectedCell.id ||
                        (selectedStatus === "failed" &&
                          !selectedCell.latest_job) ||
                        (selectedStatus === "ready" && !selectedCellPreviewUrl)
                      }
                      onClick={() =>
                        handleRenderCellPrimaryAction(
                          selectedCell,
                          selectedStatus,
                        )
                      }
                      type="button"
                    >
                      {activeCellId === selectedCell.id
                        ? "Working"
                        : selectedPrimaryAction.label}
                    </button>
                  </footer>
                ) : null}
              </aside>
              {/* RU: Это окно показывает выбранную картинку крупно по центру. */}
              {/* FR: Cette fenetre montre l'image choisie en grand au centre. */}
              {largeImagePreview ? (
                <section
                  aria-label={`Large image: ${largeImagePreview.title}`}
                  className="admin-alert-dialog admin-image-lightbox-dialog"
                  role="dialog"
                >
                  <header className="admin-render-cell-sheet-header">
                    <div>
                      <p className="eyebrow">Large image</p>
                      <h3>{largeImagePreview.title}</h3>
                    </div>
                    <button
                      className="admin-quiet-button"
                      aria-label="Close large image"
                      onClick={handleCloseLargeImagePreview}
                      type="button"
                    >
                      Close
                    </button>
                  </header>
                  <figure className="admin-image-lightbox-frame">
                    <figcaption>{largeImagePreview.title}</figcaption>
                    <img
                      alt={largeImagePreview.alt}
                      className="admin-image-lightbox-image"
                      src={largeImagePreview.src}
                    />
                  </figure>
                </section>
              ) : null}
              {isCurrentRenderPreviewOpen && selectedCellPreviewUrl ? (
                <section
                  aria-label={`Current render: ${getSofaFabricDisplayName(
                    selectedAssignment,
                  )}, ${getVisualMatrixColumnLabel(selectedColumn)}`}
                  className="admin-alert-dialog admin-render-compare-dialog"
                  role="dialog"
                >
                  <header className="admin-render-cell-sheet-header">
                    <div>
                      <p className="eyebrow">Current render</p>
                      <h3>
                        {getSofaFabricDisplayName(selectedAssignment)} /{" "}
                        {getVisualMatrixColumnLabel(selectedColumn)}
                      </h3>
                    </div>
                    <button
                      className="admin-quiet-button"
                      aria-label="Close current render"
                      onClick={handleCloseCurrentRenderPreview}
                      type="button"
                    >
                      Close
                    </button>
                  </header>
                  <figure className="admin-render-compare-frame">
                    <figcaption>Current render</figcaption>
                    <button
                      aria-label="Open current render preview larger"
                      className="admin-image-preview-button"
                      onClick={() =>
                        handleOpenLargeImagePreview({
                          alt: "Current render preview",
                          src: selectedCellPreviewUrl,
                          title: "Current render",
                        })
                      }
                      type="button"
                    >
                      <img
                        alt="Current render preview"
                        className="admin-preview-image"
                        src={selectedCellPreviewUrl}
                      />
                    </button>
                  </figure>
                  {canGenerateNewCandidate ? (
                    <footer className="admin-render-cell-sheet-footer">
                      <button
                        className="admin-primary-button"
                        disabled={activeCellId === selectedCell.id}
                        onClick={() =>
                          void handleGenerateNewCandidate(selectedCell)
                        }
                        type="button"
                      >
                        {activeCellId === selectedCell.id
                          ? "Queueing"
                          : "Generate new candidate"}
                      </button>
                    </footer>
                  ) : null}
                </section>
              ) : null}
              {compareCandidate &&
              selectedSourcePhotoPreviewUrl &&
              compareCandidatePreviewUrl ? (
                <section
                  aria-label={`Compare render candidate ${compareCandidate.id}`}
                  className="admin-alert-dialog admin-render-compare-dialog"
                  role="dialog"
                >
                  <header className="admin-render-cell-sheet-header">
                    <div>
                      <p className="eyebrow">Compare render candidate</p>
                      <h3>
                        {getSofaFabricDisplayName(selectedAssignment)} /{" "}
                        {getVisualMatrixColumnLabel(selectedColumn)}
                      </h3>
                    </div>
                    <button
                      className="admin-quiet-button"
                      aria-label="Close comparison"
                      onClick={handleCloseCompareCandidate}
                      type="button"
                    >
                      Close
                    </button>
                  </header>
                  <div className="admin-render-compare-grid">
                    <figure className="admin-render-compare-frame">
                      <figcaption>Source photo</figcaption>
                      <button
                        aria-label="Open source photo preview larger"
                        className="admin-image-preview-button"
                        onClick={() =>
                          handleOpenLargeImagePreview({
                            alt: "Source photo preview",
                            src: selectedSourcePhotoPreviewUrl,
                            title: "Source photo",
                          })
                        }
                        type="button"
                      >
                        <img
                          alt="Source photo preview"
                          className="admin-preview-image"
                          src={selectedSourcePhotoPreviewUrl}
                        />
                      </button>
                    </figure>
                    <figure className="admin-render-compare-frame">
                      <figcaption>Candidate</figcaption>
                      <button
                        aria-label={`Open candidate preview ${compareCandidate.id} larger`}
                        className="admin-image-preview-button"
                        onClick={() =>
                          handleOpenLargeImagePreview({
                            alt: `Candidate preview ${compareCandidate.id}`,
                            src: compareCandidatePreviewUrl,
                            title: "Candidate",
                          })
                        }
                        type="button"
                      >
                        <img
                          alt={`Candidate preview ${compareCandidate.id}`}
                          className="admin-preview-image"
                          src={compareCandidatePreviewUrl}
                        />
                      </button>
                    </figure>
                  </div>
                  <footer className="admin-render-cell-sheet-footer">
                    <button
                      className="admin-secondary-button"
                      disabled={comparableCandidates.length < 2}
                      onClick={() => handleMoveCompareCandidate(-1)}
                      type="button"
                    >
                      Previous candidate
                    </button>
                    <button
                      className="admin-secondary-button"
                      disabled={comparableCandidates.length < 2}
                      onClick={() => handleMoveCompareCandidate(1)}
                      type="button"
                    >
                      Next candidate
                    </button>
                    <button
                      className="admin-primary-button"
                      disabled={
                        compareCandidate.is_current ||
                        activeCellId === selectedCell.id
                      }
                      onClick={() => void handleUseCandidate(compareCandidate)}
                      type="button"
                    >
                      Use candidate
                    </button>
                  </footer>
                </section>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      <div
        aria-label="Render ZIP export"
        className="admin-render-export-panel"
        role="group"
      >
        <div className="admin-render-export-copy">
          <strong>Export ZIP</strong>
          <span>Current render assets</span>
        </div>
        <button
          className="admin-quiet-button admin-render-export-button"
          disabled={!coverage || isRenderExportBusy}
          onClick={() => void handleCreateRenderExport()}
          type="button"
        >
          {isRenderExportBusy ? "Preparing ZIP export" : "Create ZIP export"}
        </button>
        {renderExport ? (
          <div className="admin-export-result">
            <p>
              {renderExport.included_render_count ?? 0}{" "}
              {(renderExport.included_render_count ?? 0) === 1
                ? "render"
                : "renders"}{" "}
              included.
            </p>
            {renderExport.download_url ? (
              <a
                className="admin-table-link"
                href={renderExport.download_url}
                rel="noreferrer"
                target="_blank"
              >
                Download ZIP export
              </a>
            ) : (
              <p className="admin-muted">
                Export status: {renderExport.status}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
function FabricForm({
  buttonLabel,
  errorMessage,
  fabric,
  onSelectedSwatchCropChange,
  onSubmit,
  selectedSwatchCrop,
  uploadInfoMessage,
}: {
  buttonLabel: string;
  errorMessage: string | null;
  fabric?: AdminCatalogFabric;
  onSelectedSwatchCropChange(crop: FabricSwatchCropSelection | null): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  selectedSwatchCrop: FabricSwatchCropSelection | null;
  uploadInfoMessage: string | null;
}) {
  // RU: Эти данные запоминают место пальца или мыши при движении картинки.
  // FR: Ces donnees gardent la place du doigt ou de la souris quand l'image bouge.
  const swatchDragStartRef = useRef<{
    crop: FabricSwatchCrop;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  // RU: Эти данные хранят пальцы на рамке, чтобы менять размер двумя пальцами.
  // FR: Ces donnees gardent les doigts sur le cadre pour changer la taille avec deux doigts.
  const swatchActivePointersRef = useRef<Map<number, FabricSwatchPointerPoint>>(
    new Map(),
  );
  // RU: Эти данные запоминают начало жеста двумя пальцами.
  // FR: Ces donnees gardent le debut du geste avec deux doigts.
  const swatchPinchStartRef = useRef<{
    distance: number;
    zoomPercent: number;
  } | null>(null);
  // RU: Эти данные дают прямой доступ к квадратной рамке для колесика мыши.
  // FR: Ces donnees donnent un acces direct au cadre carre pour la molette de la souris.
  const swatchCropFrameRef = useRef<HTMLDivElement | null>(null);
  // RU: Эти данные показывают, что админ уже подтвердил выбранный квадрат.
  // FR: Ces donnees montrent que l'admin a deja confirme le carre choisi.
  const [isSwatchCropSaved, setIsSwatchCropSaved] = useState(false);
  // RU: Эти данные показывают выбранную AI reference картинку прямо в форме.
  // FR: Ces donnees montrent l'image AI reference choisie directement dans le formulaire.
  const [selectedAiReferencePreview, setSelectedAiReferencePreview] =
    useState<FabricImagePreview | null>(null);

  // RU: Эти данные ставят картинку так, чтобы в рамке был виден выбранный квадрат.
  // FR: Ces donnees placent l'image pour voir le carre choisi dans le cadre.
  const swatchPreviewImageStyle = selectedSwatchCrop
    ? {
        height: `${(selectedSwatchCrop.imageHeight / selectedSwatchCrop.crop.sourceSize) * 100}%`,
        left: `${(-selectedSwatchCrop.crop.sourceX / selectedSwatchCrop.crop.sourceSize) * 100}%`,
        top: `${(-selectedSwatchCrop.crop.sourceY / selectedSwatchCrop.crop.sourceSize) * 100}%`,
        width: `${(selectedSwatchCrop.imageWidth / selectedSwatchCrop.crop.sourceSize) * 100}%`,
      }
    : undefined;

  // RU: Этот автоматический блок включает колесико мыши над квадратной рамкой.
  // FR: Ce bloc automatique active la molette de la souris au-dessus du cadre carre.
  useEffect(() => {
    const cropFrame = swatchCropFrameRef.current;

    if (!cropFrame || !selectedSwatchCrop) {
      return;
    }

    const activeSwatchCrop = selectedSwatchCrop;

    function handleWheel(event: WheelEvent) {
      if (event.deltaY === 0) {
        return;
      }

      event.preventDefault();
      const zoomStep = event.deltaY < 0 ? 10 : -10;

      setIsSwatchCropSaved(false);
      onSelectedSwatchCropChange(
        updateFabricSwatchSelectionZoom(
          activeSwatchCrop,
          activeSwatchCrop.zoomPercent + zoomStep,
        ),
      );
    }

    cropFrame.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      cropFrame.removeEventListener("wheel", handleWheel);
    };
  }, [onSelectedSwatchCropChange, selectedSwatchCrop]);

  // RU: Этот автоматический блок убирает временную ссылку на AI reference картинку.
  // FR: Ce bloc automatique supprime le lien temporaire vers l'image AI reference.
  useEffect(() => {
    const preview = selectedAiReferencePreview;

    return () => {
      if (preview?.canRevoke && globalThis.URL?.revokeObjectURL) {
        globalThis.URL.revokeObjectURL(preview.previewUrl);
      }
    };
  }, [selectedAiReferencePreview]);

  // RU: Это действие читает новую картинку ткани и готовит квадрат для выбора.
  // FR: Cette action lit la nouvelle image de tissu et prepare le carre a choisir.
  async function handleSwatchFileChange(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    if (!file) {
      setIsSwatchCropSaved(false);
      onSelectedSwatchCropChange(null);
      return;
    }

    try {
      const dimensions = await readFabricSwatchImageDimensions(file);
      const previewUrl = globalThis.URL?.createObjectURL
        ? globalThis.URL.createObjectURL(file)
        : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

      setIsSwatchCropSaved(false);
      onSelectedSwatchCropChange(
        buildFabricSwatchCropSelection({
          file,
          imageHeight: dimensions.height,
          imageWidth: dimensions.width,
          previewUrl,
        }),
      );
    } catch {
      setIsSwatchCropSaved(false);
      onSelectedSwatchCropChange(null);
    }
  }

  // RU: Это действие меняет приближение картинки в квадратной рамке.
  // FR: Cette action change le niveau de vue de l'image dans le cadre carre.
  function handleSwatchZoomChange(event: FormEvent<HTMLInputElement>) {
    if (!selectedSwatchCrop) {
      return;
    }

    const zoomPercent = Number(event.currentTarget.value);

    setIsSwatchCropSaved(false);
    onSelectedSwatchCropChange(
      updateFabricSwatchSelectionZoom(selectedSwatchCrop, zoomPercent),
    );
  }

  // RU: Это действие подтверждает текущий квадрат и оставляет его для сохранения формы.
  // FR: Cette action confirme le carre actuel et le garde pour enregistrer le formulaire.
  function handleSaveSwatchCrop() {
    if (!selectedSwatchCrop) {
      return;
    }

    onSelectedSwatchCropChange(selectedSwatchCrop);
    setIsSwatchCropSaved(true);
  }

  // RU: Это действие показывает выбранную AI reference картинку под полем файла.
  // FR: Cette action montre l'image AI reference choisie sous le champ fichier.
  function handleAiReferenceFileChange(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      setSelectedAiReferencePreview(null);
      return;
    }

    const canCreatePreview = Boolean(globalThis.URL?.createObjectURL);
    const previewUrl = canCreatePreview
      ? globalThis.URL.createObjectURL(file)
      : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    setSelectedAiReferencePreview({
      canRevoke: canCreatePreview,
      fileName: file.name,
      previewUrl,
    });
  }

  // RU: Это действие начинает движение картинки внутри квадратной рамки.
  // FR: Cette action commence le mouvement de l'image dans le cadre carre.
  function handleSwatchCropPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!selectedSwatchCrop) {
      return;
    }

    event.preventDefault();
    swatchActivePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // RU: Захват указателя может не сработать для искусственного движения.
        // FR: La capture du pointeur peut echouer pour un mouvement artificiel.
      }
    }

    const pinchDistance = getFabricSwatchPointerDistance(
      swatchActivePointersRef.current,
    );

    if (pinchDistance !== null) {
      swatchDragStartRef.current = null;
      swatchPinchStartRef.current = {
        distance: pinchDistance,
        zoomPercent: selectedSwatchCrop.zoomPercent,
      };
      return;
    }

    swatchDragStartRef.current = {
      crop: selectedSwatchCrop.crop,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  // RU: Это действие двигает выбранный квадрат, пока админ тянет картинку.
  // FR: Cette action deplace le carre choisi pendant que l'admin tire l'image.
  function handleSwatchCropPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (swatchActivePointersRef.current.has(event.pointerId)) {
      swatchActivePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    if (selectedSwatchCrop && swatchPinchStartRef.current) {
      const pinchDistance = getFabricSwatchPointerDistance(
        swatchActivePointersRef.current,
      );

      if (pinchDistance !== null && swatchPinchStartRef.current.distance > 0) {
        event.preventDefault();
        const zoomPercent = Math.round(
          (swatchPinchStartRef.current.zoomPercent * pinchDistance) /
            swatchPinchStartRef.current.distance,
        );

        onSelectedSwatchCropChange(
          updateFabricSwatchSelectionZoom(selectedSwatchCrop, zoomPercent),
        );
        setIsSwatchCropSaved(false);
        return;
      }
    }

    const dragStart = swatchDragStartRef.current;

    if (
      !selectedSwatchCrop ||
      !dragStart ||
      dragStart.pointerId !== event.pointerId
    ) {
      return;
    }

    const frameWidth = event.currentTarget.getBoundingClientRect().width;

    if (frameWidth <= 0) {
      return;
    }

    const imagePixelsPerFramePixel = dragStart.crop.sourceSize / frameWidth;
    const nextCrop = clampFabricSwatchCrop({
      crop: {
        sourceSize: dragStart.crop.sourceSize,
        sourceX: Math.round(
          dragStart.crop.sourceX -
            (event.clientX - dragStart.startX) * imagePixelsPerFramePixel,
        ),
        sourceY: Math.round(
          dragStart.crop.sourceY -
            (event.clientY - dragStart.startY) * imagePixelsPerFramePixel,
        ),
      },
      imageHeight: selectedSwatchCrop.imageHeight,
      imageWidth: selectedSwatchCrop.imageWidth,
    });

    setIsSwatchCropSaved(false);
    onSelectedSwatchCropChange({
      ...selectedSwatchCrop,
      crop: nextCrop,
    });
  }

  // RU: Это действие заканчивает движение картинки.
  // FR: Cette action termine le mouvement de l'image.
  function handleSwatchCropPointerEnd(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    swatchActivePointersRef.current.delete(event.pointerId);

    if (swatchActivePointersRef.current.size < 2) {
      swatchPinchStartRef.current = null;
    }

    if (swatchDragStartRef.current?.pointerId === event.pointerId) {
      swatchDragStartRef.current = null;
    }
  }

  return (
    <form className="admin-form admin-form-wide" onSubmit={onSubmit}>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {uploadInfoMessage ? (
        <p className="form-info" role="status">
          {uploadInfoMessage}
        </p>
      ) : null}
      <label className="field">
        <span>Internal fabric name</span>
        <input
          defaultValue={fabric?.internal_name ?? ""}
          name="internal_name"
          required
        />
      </label>
      <label className="field">
        <span>Public fabric name</span>
        <input
          defaultValue={fabric?.public_name ?? ""}
          name="public_name"
          required
        />
      </label>
      <label className="admin-checkbox-label">
        <input
          defaultChecked={fabric?.is_premium ?? false}
          name="is_premium"
          type="checkbox"
        />
        <span>Premium fabric</span>
      </label>
      <label className="field">
        <span>Swatch image</span>
        <input
          accept="image/png,image/jpeg,image/webp"
          name="swatch_file"
          onChange={handleSwatchFileChange}
          type="file"
        />
      </label>
      {/* RU: Этот большой блок показывает квадратный выбор для нового образца ткани. */}
      {/* FR: Ce grand bloc montre le choix carre pour le nouvel echantillon de tissu. */}
      {selectedSwatchCrop ? (
        <fieldset className="admin-fieldset admin-swatch-cropper">
          <legend>Swatch crop</legend>
          <div className="admin-swatch-cropper-grid">
            <div
              aria-label="Swatch crop preview"
              className="admin-swatch-crop-frame"
              onPointerCancel={handleSwatchCropPointerEnd}
              onPointerDown={handleSwatchCropPointerDown}
              onPointerMove={handleSwatchCropPointerMove}
              onPointerUp={handleSwatchCropPointerEnd}
              ref={swatchCropFrameRef}
              role="img"
            >
              <img
                alt=""
                className="admin-swatch-crop-image"
                draggable={false}
                src={selectedSwatchCrop.previewUrl}
                style={swatchPreviewImageStyle}
              />
              <div className="admin-swatch-crop-overlay" aria-hidden="true" />
            </div>
            <div className="admin-swatch-crop-controls">
              <label className="field admin-swatch-zoom-field">
                <span>Swatch zoom</span>
                <input
                  max={FABRIC_SWATCH_ZOOM_MAX_PERCENT}
                  min="100"
                  onChange={handleSwatchZoomChange}
                  step="1"
                  type="range"
                  value={selectedSwatchCrop.zoomPercent}
                />
              </label>
              <button
                aria-live="polite"
                className={`admin-secondary-button admin-swatch-save-button${
                  isSwatchCropSaved ? " admin-swatch-save-button-saved" : ""
                }`}
                onClick={handleSaveSwatchCrop}
                type="button"
              >
                {isSwatchCropSaved ? "Crop saved" : "Save crop"}
              </button>
            </div>
          </div>
        </fieldset>
      ) : null}
      <label className="field">
        <span>AI reference image</span>
        <input
          accept="image/png,image/jpeg,image/webp"
          name="ai_reference_file"
          onChange={handleAiReferenceFileChange}
          type="file"
        />
      </label>
      {/* RU: Этот большой блок показывает выбранную AI reference картинку перед сохранением ткани. */}
      {/* FR: Ce grand bloc montre l'image AI reference choisie avant d'enregistrer le tissu. */}
      {selectedAiReferencePreview ? (
        <fieldset className="admin-fieldset admin-ai-reference-preview">
          <legend>AI reference preview</legend>
          <div className="admin-ai-reference-preview-grid">
            <div
              aria-label="AI reference image preview"
              className="admin-ai-reference-preview-frame"
              role="img"
            >
              <img
                alt=""
                className="admin-ai-reference-preview-image"
                src={selectedAiReferencePreview.previewUrl}
              />
            </div>
            <div className="admin-ai-reference-preview-copy">
              <strong>{selectedAiReferencePreview.fileName}</strong>
              <span>Selected AI reference image</span>
            </div>
          </div>
        </fieldset>
      ) : null}
      <button type="submit">{buttonLabel}</button>
    </form>
  );
}

function buildFabricSwatchCropSelection(input: {
  file?: File;
  fileName?: string;
  imageHeight: number;
  imageWidth: number;
  previewUrl: string;
}): FabricSwatchCropSelection {
  const crop = getDefaultFabricSwatchCrop({
    height: input.imageHeight,
    width: input.imageWidth,
  });

  return {
    crop,
    fileName: input.fileName ?? input.file?.name ?? "swatch",
    imageHeight: input.imageHeight,
    imageWidth: input.imageWidth,
    previewUrl: input.previewUrl,
    zoomPercent: 100,
  };
}

function updateFabricSwatchSelectionZoom(
  selection: FabricSwatchCropSelection,
  zoomPercent: number,
): FabricSwatchCropSelection {
  const safeZoomPercent = clampNumber(
    Math.round(zoomPercent),
    100,
    FABRIC_SWATCH_ZOOM_MAX_PERCENT,
  );

  return {
    ...selection,
    crop: zoomFabricSwatchCrop(selection, safeZoomPercent),
    zoomPercent: safeZoomPercent,
  };
}

async function readFabricSwatchImageDimensions(file: File) {
  if (typeof globalThis.createImageBitmap === "function") {
    const bitmap = await globalThis.createImageBitmap(file);

    try {
      return {
        height: bitmap.height,
        width: bitmap.width,
      };
    } finally {
      bitmap.close();
    }
  }

  return readFabricSwatchHtmlImageDimensions(file);
}

async function readFabricSwatchHtmlImageDimensions(file: File) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    if (!globalThis.URL?.createObjectURL) {
      reject(new Error("IMAGE_PREPARATION_UNAVAILABLE"));
      return;
    }

    const objectUrl = globalThis.URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      globalThis.URL.revokeObjectURL(objectUrl);
      resolve({
        height: image.naturalHeight || image.height,
        width: image.naturalWidth || image.width,
      });
    };
    image.onerror = () => {
      globalThis.URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    image.src = objectUrl;
  });
}

function zoomFabricSwatchCrop(
  selection: FabricSwatchCropSelection,
  zoomPercent: number,
): FabricSwatchCrop {
  const defaultCrop = getDefaultFabricSwatchCrop({
    height: selection.imageHeight,
    width: selection.imageWidth,
  });
  const safeZoomPercent = clampNumber(
    Math.round(zoomPercent),
    100,
    FABRIC_SWATCH_ZOOM_MAX_PERCENT,
  );
  const sourceSize = Math.max(
    1,
    Math.round(defaultCrop.sourceSize / (safeZoomPercent / 100)),
  );
  const centerX = selection.crop.sourceX + selection.crop.sourceSize / 2;
  const centerY = selection.crop.sourceY + selection.crop.sourceSize / 2;

  return clampFabricSwatchCrop({
    crop: {
      sourceSize,
      sourceX: Math.round(centerX - sourceSize / 2),
      sourceY: Math.round(centerY - sourceSize / 2),
    },
    imageHeight: selection.imageHeight,
    imageWidth: selection.imageWidth,
  });
}

function clampFabricSwatchCrop(input: {
  crop: FabricSwatchCrop;
  imageHeight: number;
  imageWidth: number;
}): FabricSwatchCrop {
  const sourceSize = clampNumber(
    Math.round(input.crop.sourceSize),
    1,
    Math.max(1, Math.min(input.imageWidth, input.imageHeight)),
  );

  return {
    sourceSize,
    sourceX: clampNumber(
      Math.round(input.crop.sourceX),
      0,
      input.imageWidth - sourceSize,
    ),
    sourceY: clampNumber(
      Math.round(input.crop.sourceY),
      0,
      input.imageHeight - sourceSize,
    ),
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFabricSwatchPointerDistance(
  pointers: Map<number, FabricSwatchPointerPoint>,
) {
  const [firstPoint, secondPoint] = Array.from(pointers.values());

  if (!firstPoint || !secondPoint) {
    return null;
  }

  return Math.hypot(
    secondPoint.clientX - firstPoint.clientX,
    secondPoint.clientY - firstPoint.clientY,
  );
}

function SofaForm({
  buttonLabel,
  errorMessage,
  onSelectedTagIdsChange,
  onSubmit,
  selectedTagIds,
  sofa,
  tags,
}: {
  buttonLabel: string;
  errorMessage: string | null;
  onSelectedTagIdsChange(tagIds: string[]): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  selectedTagIds: string[];
  sofa?: AdminCatalogSofa;
  tags: AdminCatalogTag[];
}) {
  // RU: Это значение хранит текст, который админ пишет для поиска тега.
  // FR: Cette valeur garde le texte que l'admin ecrit pour chercher une etiquette.
  const [tagSearch, setTagSearch] = useState("");

  // RU: Эти данные помогают быстро находить выбранные теги и не показывать их в подсказках.
  // FR: Ces donnees aident a retrouver les etiquettes choisies et a les cacher des suggestions.
  const selectedTagIdSet = useMemo(
    () => new Set(selectedTagIds),
    [selectedTagIds],
  );

  // RU: Эти данные связывают номер тега с его названием для красивых плашек.
  // FR: Ces donnees relient l'identifiant de l'etiquette a son nom pour de jolies pastilles.
  const tagsById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  // RU: Этот список показывает только выбранные теги, которые еще есть в общей базе тегов.
  // FR: Cette liste montre seulement les etiquettes choisies encore presentes dans la base.
  const selectedTags = useMemo(
    () =>
      selectedTagIds
        .map((tagId) => tagsById.get(tagId))
        .filter((tag): tag is AdminCatalogTag => Boolean(tag)),
    [selectedTagIds, tagsById],
  );

  // RU: Этот текст нужен для поиска без учета больших и маленьких букв.
  // FR: Ce texte sert a chercher sans tenir compte des majuscules et minuscules.
  const normalizedTagSearch = tagSearch.trim().toLowerCase();

  // RU: Этот список показывает подходящие теги, кроме тех, которые уже выбраны.
  // FR: Cette liste montre les etiquettes utiles, sauf celles deja choisies.
  const matchingTags = useMemo(() => {
    if (!normalizedTagSearch) {
      return [];
    }

    return tags
      .filter(
        (tag) =>
          !selectedTagIdSet.has(tag.id) &&
          `${tag.public_label} ${tag.slug}`
            .toLowerCase()
            .includes(normalizedTagSearch),
      )
      .slice(0, TAG_SEARCH_RESULT_LIMIT);
  }, [normalizedTagSearch, selectedTagIdSet, tags]);

  // RU: Эта команда обновляет текст поиска, когда админ печатает в поле.
  // FR: Cette action met a jour le texte de recherche quand l'admin ecrit.
  function handleTagSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setTagSearch(event.target.value);
  }

  // RU: Эта команда добавляет найденный тег в выбранные и очищает поле поиска.
  // FR: Cette action ajoute l'etiquette trouvee aux choix et vide le champ.
  function handleTagSelect(tagId: string) {
    if (selectedTagIdSet.has(tagId)) {
      return;
    }

    onSelectedTagIdsChange([...selectedTagIds, tagId]);
    setTagSearch("");
  }

  // RU: Эта команда убирает закрепленный тег из выбранных.
  // FR: Cette action retire une etiquette epinglee des choix.
  function handleTagRemove(tagId: string) {
    onSelectedTagIdsChange(selectedTagIds.filter((id) => id !== tagId));
  }

  return (
    <form className="admin-form admin-sofa-form" onSubmit={onSubmit}>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <section className="admin-form-section" aria-labelledby="sofa-identity">
        <div className="admin-form-section-header">
          <h3 id="sofa-identity">Identity</h3>
          <p>Internal naming and the public product label.</p>
        </div>
        <div className="admin-form-two-column">
          <label className="field">
            <span>Internal name</span>
            <input
              defaultValue={sofa?.internal_name ?? ""}
              name="internal_name"
              required
            />
          </label>
          <label className="field">
            <span>Public name</span>
            <input defaultValue={sofa?.public_name ?? ""} name="public_name" />
          </label>
        </div>
      </section>
      <section className="admin-form-section" aria-labelledby="sofa-public">
        <div className="admin-form-section-header">
          <h3 id="sofa-public">Public content</h3>
          <p>Content reused by the storefront and operational handoff.</p>
        </div>
        <label className="field">
          <span>Shopify order URL</span>
          <input
            defaultValue={sofa?.shopify_order_url ?? ""}
            name="shopify_order_url"
            type="url"
          />
        </label>
        <label className="field">
          <span>Public description</span>
          <textarea
            defaultValue={sofa?.public_description ?? ""}
            name="public_description"
            rows={4}
          />
        </label>
      </section>
      <section className="admin-form-section" aria-labelledby="sofa-dimensions">
        <div className="admin-form-section-header">
          <h3 id="sofa-dimensions">Dimensions</h3>
          <p>Centimeter values used for catalog checks.</p>
        </div>
        <div className="admin-form-grid admin-dimension-grid">
          <label className="field admin-unit-field">
            <span>Length</span>
            <span className="admin-unit-control">
              <input
                defaultValue={sofa?.length_cm ?? ""}
                inputMode="numeric"
                min="1"
                name="length_cm"
                pattern="[0-9]*"
                type="text"
              />
              <span aria-hidden="true">cm</span>
            </span>
          </label>
          <label className="field admin-unit-field">
            <span>Depth</span>
            <span className="admin-unit-control">
              <input
                defaultValue={sofa?.depth_cm ?? ""}
                inputMode="numeric"
                min="1"
                name="depth_cm"
                pattern="[0-9]*"
                type="text"
              />
              <span aria-hidden="true">cm</span>
            </span>
          </label>
          <label className="field admin-unit-field">
            <span>Height</span>
            <span className="admin-unit-control">
              <input
                defaultValue={sofa?.height_cm ?? ""}
                inputMode="numeric"
                min="1"
                name="height_cm"
                pattern="[0-9]*"
                type="text"
              />
              <span aria-hidden="true">cm</span>
            </span>
          </label>
        </div>
      </section>
      {/* RU: Этот раздел дает поиск по тегам и показывает выбранные метки. */}
      {/* FR: Cette partie donne la recherche des etiquettes et montre les choix. */}
      <section className="admin-form-section" aria-labelledby="sofa-tags">
        <div className="admin-form-section-header">
          <h3 id="sofa-tags">Tags</h3>
          <p>Public grouping and readiness behavior.</p>
        </div>
        {tags.length === 0 ? (
          <p className="admin-tag-picker-empty">No tags.</p>
        ) : (
          <div className="admin-tag-picker">
            <div className="admin-selected-tags" aria-live="polite">
              <p className="admin-tag-picker-label">Selected tags</p>
              {selectedTags.length > 0 ? (
                <div className="admin-tag-chip-list" aria-label="Selected tags">
                  {selectedTags.map((tag) => (
                    <span className="admin-tag-chip" key={tag.id}>
                      <span>{tag.public_label}</span>
                      <button
                        aria-label={`Remove ${tag.public_label} tag`}
                        className="admin-tag-chip-remove"
                        onClick={() => handleTagRemove(tag.id)}
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="admin-tag-picker-empty">
                  No tags selected yet.
                </p>
              )}
            </div>
            <label className="field admin-tag-search-field">
              <span>Search tags</span>
              <input
                aria-controls="sofa-tag-results"
                aria-expanded={Boolean(normalizedTagSearch)}
                autoComplete="off"
                onChange={handleTagSearchChange}
                placeholder="Type a tag name"
                type="search"
                value={tagSearch}
              />
            </label>
            {normalizedTagSearch ? (
              <div
                aria-label="Matching tags"
                className="admin-tag-results"
                id="sofa-tag-results"
                role="listbox"
              >
                {matchingTags.length > 0 ? (
                  matchingTags.map((tag) => (
                    <button
                      aria-label={`Add ${tag.public_label} tag`}
                      aria-selected="false"
                      className="admin-tag-result"
                      key={tag.id}
                      onClick={() => handleTagSelect(tag.id)}
                      role="option"
                      type="button"
                    >
                      <span className="admin-tag-result-label">
                        {tag.public_label}
                      </span>
                      <span className="admin-tag-result-slug">{tag.slug}</span>
                    </button>
                  ))
                ) : (
                  <p className="admin-tag-picker-empty">No matching tags.</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>
      <footer className="admin-form-footer">
        <button className="admin-primary-button" type="submit">
          {buttonLabel}
        </button>
      </footer>
    </form>
  );
}

async function buildFabricPayload({
  accessToken,
  dependencies,
  existingFabric,
  form,
  onUploadInfo,
  requireFiles,
  swatchCrop,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  existingFabric?: AdminCatalogFabric;
  form: HTMLFormElement;
  onUploadInfo(message: string): void;
  requireFiles: boolean;
  swatchCrop?: FabricSwatchCrop;
}): Promise<FabricMutationInput> {
  const formData = new FormData(form);
  const internalName = String(formData.get("internal_name") ?? "").trim();
  const publicName = String(formData.get("public_name") ?? "").trim();
  const swatchFile = readFileField(form, formData, "swatch_file");
  const aiReferenceFile = readFileField(form, formData, "ai_reference_file");

  if (requireFiles && (!swatchFile || !aiReferenceFile)) {
    throw new Error("Fabric images are required.");
  }

  const [swatchAsset, aiReferenceAsset] = await Promise.all([
    swatchFile
      ? uploadFabricAsset({
          accessToken,
          dependencies,
          file: swatchFile,
          onUploadInfo,
          purpose: "fabric_swatch",
          swatchCrop,
        })
      : Promise.resolve(existingFabric?.swatch_asset ?? null),
    aiReferenceFile
      ? uploadFabricAsset({
          accessToken,
          dependencies,
          file: aiReferenceFile,
          onUploadInfo,
          purpose: "fabric_ai_reference",
        })
      : Promise.resolve(existingFabric?.ai_reference_asset ?? null),
  ]);

  if (!swatchAsset || !aiReferenceAsset) {
    throw new Error("Fabric images are required.");
  }

  return {
    ai_reference_asset_id: aiReferenceAsset.id,
    internal_name: internalName,
    is_premium: formData.get("is_premium") === "on",
    public_name: publicName,
    swatch_asset_id: swatchAsset.id,
  };
}

async function uploadFabricAsset({
  accessToken,
  dependencies,
  file,
  onUploadInfo,
  purpose,
  swatchCrop,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  file: File;
  onUploadInfo(message: string): void;
  purpose: UploadCreateInput["purpose"];
  swatchCrop?: FabricSwatchCrop;
}) {
  const preparedUpload =
    purpose === "fabric_swatch" && swatchCrop
      ? await prepareAdminImageUploadFile({
          fabricSwatchCrop: swatchCrop,
          file,
          purpose,
        })
      : await prepareAdminImageUploadFile({
          file,
          purpose,
        });
  const uploadFile = preparedUpload.file;

  if (preparedUpload.message) {
    onUploadInfo(preparedUpload.message);
  }

  const upload = await dependencies.createUpload(accessToken, {
    byte_size: uploadFile.size,
    content_type: uploadFile.type,
    purpose,
  });
  await dependencies.uploadToSignedUrl(upload, uploadFile);

  return dependencies.completeUpload(accessToken, upload.upload_id);
}

function readFileField(
  form: HTMLFormElement,
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  if (!(value instanceof File) || value.size === 0) {
    const element = form.elements.namedItem(field);

    if (element instanceof HTMLInputElement) {
      return element.files?.[0] ?? null;
    }

    return null;
  }

  return value;
}

function nullableFormString(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();

  return value || null;
}

function buildSofaPayload(
  formData: FormData,
  selectedTagIds: string[],
): SofaMutationInput {
  const payload: SofaMutationInput = {
    tag_ids: selectedTagIds,
  };

  for (const field of [
    "internal_name",
    "public_name",
    "shopify_order_url",
    "public_description",
  ] as const) {
    const value = String(formData.get(field) ?? "").trim();

    if (value) {
      payload[field] = value;
    }
  }

  for (const field of ["length_cm", "depth_cm", "height_cm"] as const) {
    const value = String(formData.get(field) ?? "").trim();

    if (value) {
      payload[field] = Number(value);
    }
  }

  return payload;
}

async function requestAdminJson(
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) {
    if (!response.ok) {
      throw new Error("Request failed.");
    }

    return {};
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatAdminApiErrorMessage(body));
  }

  return body.data ?? {};
}

function readErrorMessage(error: unknown) {
  return formatAdminErrorMessage(error);
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
