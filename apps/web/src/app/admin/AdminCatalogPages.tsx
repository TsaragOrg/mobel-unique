"use client";

/*
RU: Этот файл нужен для страниц админского каталога.
RU: На экране админ видит диваны, ткани, формы, загрузку фото и подготовку картинок.
RU: Здесь можно менять данные, запускать генерацию и выбирать готовую картинку.
FR: Ce fichier sert aux pages du catalogue admin.
FR: A l'ecran, l'admin voit les canapes, tissus, formulaires, envois de photos et preparation d'images.
FR: Ici, on peut modifier les donnees, lancer la generation et choisir l'image finale.
*/

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { prepareAdminImageUploadFile } from "../../lib/admin-image-upload";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";

type AdminPageState = "checking" | "forbidden" | "ready";

// RU: Эти числа задают частоту проверки результата после запуска генерации.
// FR: Ces nombres reglent la frequence de verification apres le lancement.
const FABRIC_RENDER_JOB_POLL_INTERVAL_MS = 3000;
const FABRIC_RENDER_JOB_POLL_ATTEMPTS = 100;

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
  sofa_id: string;
  updated_at: string;
  visual_matrix_column_id: string;
}

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

type SofaTestChecklistItem = {
  completeText: string;
  id: string;
  isComplete: boolean;
  label: string;
  missingText: string;
};

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
  Partial<VisualMatrixColumnMutationInput>;

export interface FabricRenderJobCreateInput {
  fabric_id: string;
  generation_mode: "initial";
  idempotency_key?: string;
  prompt_note: string | null;
  sofa_id: string;
  visual_matrix_column_id: string;
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
  createTag(
    accessToken: string,
    input: TagMutationInput,
  ): Promise<AdminCatalogTag>;
  createUpload(
    accessToken: string,
    input: UploadCreateInput,
  ): Promise<AdminCatalogUpload>;
  createFabricRenderJob(
    accessToken: string,
    input: FabricRenderJobCreateInput,
  ): Promise<AdminCatalogFabricRenderJob>;
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
      <main className="admin-workspace" aria-live="polite">
        <p role="status">Checking admin session.</p>
      </main>
    );
  }

  if (pageState === "forbidden") {
    return (
      <main className="admin-workspace">
        <section aria-labelledby="admin-denied-title">
          <p className="eyebrow">Mobel Unique</p>
          <h1 id="admin-denied-title">Admin access unavailable</h1>
          <p>This account is not authorized for the admin area.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-workspace">
      <AdminNavigation />
      {accessToken ? render(accessToken, activeDependencies) : null}
    </main>
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
    <section aria-labelledby="sofas-title" className="admin-section">
      <div className="admin-heading-row">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="sofas-title">Sofas</h1>
        </div>
        <Link className="button-link" href="/admin/sofas/new">
          New sofa
        </Link>
      </div>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLoading ? <p role="status">Loading sofas.</p> : null}
      {!isLoading && sofas.length === 0 ? <p>No sofas.</p> : null}
      {sofas.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>State</th>
                <th>Slug</th>
                <th>Shopify</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sofas.map((sofa) => (
                <tr key={sofa.id}>
                  <td>{sofa.internal_name || sofa.public_name}</td>
                  <td>{sofa.lifecycle_state}</td>
                  <td>{sofa.public_slug ?? "None"}</td>
                  <td>{sofa.shopify_order_url ? "Set" : "Missing"}</td>
                  <td>{formatTimestamp(sofa.updated_at)}</td>
                  <td>
                    <Link href={`/admin/sofas/${sofa.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <section aria-labelledby="fabrics-title" className="admin-section">
      <div className="admin-heading-row">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="fabrics-title">Fabrics</h1>
        </div>
        <Link className="button-link" href="/admin/fabrics/new">
          New fabric
        </Link>
      </div>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLoading ? <p role="status">Loading fabrics.</p> : null}
      {!isLoading && fabrics.length === 0 ? <p>No fabrics.</p> : null}
      {fabrics.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Internal name</th>
                <th>Public name</th>
                <th>State</th>
                <th>Premium</th>
                <th>Swatch</th>
                <th>AI reference</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fabrics.map((fabric) => (
                <tr key={fabric.id}>
                  <td>{fabric.internal_name}</td>
                  <td>{fabric.public_name}</td>
                  <td>{fabric.lifecycle_state}</td>
                  <td>{fabric.is_premium ? "Premium" : "Standard"}</td>
                  <td>{fabric.swatch_asset ? "Ready" : "Missing"}</td>
                  <td>{fabric.ai_reference_asset ? "Ready" : "Missing"}</td>
                  <td>{formatTimestamp(fabric.updated_at)}</td>
                  <td>
                    <Link href={`/admin/fabrics/${fabric.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

  // RU: Это действие сохраняет новую ткань и может подготовить фото перед отправкой.
  // FR: Cette action enregistre un tissu et peut preparer une image avant l'envoi.
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
      });
      const fabric = await dependencies.createFabric(accessToken, payload);
      dependencies.navigate(`/admin/fabrics/${fabric.id}`);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="create-fabric-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="create-fabric-title">Create fabric</h1>
      <FabricForm
        buttonLabel={isSubmitting ? "Creating" : "Create fabric"}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
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

  // RU: Это действие сохраняет ткань и может подготовить новое фото перед отправкой.
  // FR: Cette action enregistre le tissu et peut preparer une nouvelle image avant l'envoi.
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
    <section aria-labelledby="edit-fabric-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="edit-fabric-title">{fabric?.internal_name ?? "Fabric"}</h1>
      {fabric ? (
        <div className="admin-grid">
          <FabricForm
            buttonLabel={isSubmitting ? "Saving" : "Save fabric"}
            errorMessage={errorMessage}
            fabric={fabric}
            onSubmit={handleSubmit}
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
    <section aria-labelledby="create-sofa-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="create-sofa-title">Create sofa</h1>
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
  const sofaTestChecklist = useMemo(
    () =>
      buildSofaTestChecklist({
        readiness,
        renderCoverage,
        sofaFabrics,
        visualMatrixColumns,
      }),
    [readiness, renderCoverage, sofaFabrics, visualMatrixColumns],
  );

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

  async function refreshRenderPreparation() {
    const [nextColumns, nextCoverage] = await Promise.all([
      dependencies.listVisualMatrixColumns(accessToken, sofaId),
      dependencies.getRenderCoverage(accessToken, sofaId),
    ]);

    setVisualMatrixColumns(nextColumns);
    setRenderCoverage(nextCoverage);
  }

  if (!sofa && !errorMessage) {
    return (
      <section className="admin-section" aria-live="polite">
        <p role="status">Loading sofa.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="edit-sofa-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="edit-sofa-title">{sofa?.internal_name ?? "Sofa"}</h1>
      {sofa ? (
        <>
          <SofaTestNavigation />
          <SofaTestChecklist items={sofaTestChecklist} />
          <div className="admin-section-stack admin-test-workflow">
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
            <VisualMatrixSection
              accessToken={accessToken}
              columns={visualMatrixColumns}
              dependencies={dependencies}
              onRefresh={refreshRenderPreparation}
              sofaFabrics={sofaFabrics}
              sofaId={sofaId}
            />
            <RenderCoverageSection
              accessToken={accessToken}
              coverage={renderCoverage}
              dependencies={dependencies}
              onRefresh={refreshRenderPreparation}
              sofaFabrics={sofaFabrics}
              visualMatrixColumns={visualMatrixColumns}
            />
            <PublicationReadinessSection readiness={readiness} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function SofaTestNavigation() {
  const links = [
    { href: "#sofa-basics", label: "Sofa basics", number: "1" },
    { href: "#fabric-assignments", label: "Fabric assignments", number: "2" },
    { href: "#visual-matrix", label: "Visual matrix", number: "3" },
    { href: "#render-coverage", label: "Render coverage", number: "4" },
    {
      href: "#publication-readiness",
      label: "Publication readiness",
      number: "5",
    },
  ];

  return (
    <nav aria-label="Sofa test sections" className="admin-test-nav">
      {links.map((link) => (
        <a aria-label={link.label} href={link.href} key={link.href}>
          <span aria-hidden="true">{link.number}</span>
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function SofaTestChecklist({ items }: { items: SofaTestChecklistItem[] }) {
  return (
    <section
      aria-labelledby="sofa-test-checklist-title"
      className="admin-test-checklist"
    >
      <h2 id="sofa-test-checklist-title">Manual test checklist</h2>
      <ul aria-label="Manual sofa test checklist">
        {items.map((item) => (
          <li
            aria-label={`${item.label}: ${item.isComplete ? "Done" : "Missing"}`}
            className="admin-checklist-item"
            key={item.id}
          >
            <span className="admin-checklist-label">{item.label}</span>
            <span
              className={
                item.isComplete
                  ? "admin-checklist-state admin-checklist-state-ready"
                  : "admin-checklist-state"
              }
            >
              {item.isComplete ? item.completeText : item.missingText}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PublicationReadinessSection({
  readiness,
}: {
  readiness: AdminCatalogReadiness | null;
}) {
  return (
    <section
      aria-labelledby="readiness-title"
      className="admin-subsection"
      id="publication-readiness"
    >
      <SectionStepHeading
        headingId="readiness-title"
        number="5"
        title="Publication readiness"
      />
      {readiness?.ready ? <p>Ready</p> : <p>Blocked</p>}
      {readiness?.errors.length ? (
        <ul className="admin-list">
          {readiness.errors.map((error) => (
            <li key={error.code}>
              <strong>{error.code}</strong>
              <span>{error.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SectionStepHeading({
  headingId,
  number,
  title,
}: {
  headingId: string;
  number: string;
  title: string;
}) {
  return (
    <div className="admin-step-heading">
      <span aria-hidden="true" className="admin-step-number">
        {number}
      </span>
      <h2 id={headingId}>{title}</h2>
    </div>
  );
}

function buildSofaTestChecklist({
  readiness,
  renderCoverage,
  sofaFabrics,
  visualMatrixColumns,
}: {
  readiness: AdminCatalogReadiness | null;
  renderCoverage: AdminCatalogRenderCoverage | null;
  sofaFabrics: AdminCatalogSofaFabric[];
  visualMatrixColumns: AdminCatalogVisualMatrixColumn[];
}): SofaTestChecklistItem[] {
  const renderCells = renderCoverage?.render_cells ?? [];
  const hasSourcePhoto = visualMatrixColumns.some((column) =>
    Boolean(column.current_source_photo_id),
  );

  return [
    {
      completeText: `${sofaFabrics.length} assigned`,
      id: "fabric-assignment",
      isComplete: sofaFabrics.length > 0,
      label: "Fabric assigned",
      missingText: "Missing",
    },
    {
      completeText: `${visualMatrixColumns.length} columns`,
      id: "visual-matrix-column",
      isComplete: visualMatrixColumns.length > 0,
      label: "Visual column",
      missingText: "Missing",
    },
    {
      completeText: "Ready",
      id: "source-photo",
      isComplete: hasSourcePhoto,
      label: "Source photo",
      missingText: "Missing",
    },
    {
      completeText: `${renderCells.reduce((total, cell) => total + cell.candidate_count, 0)} candidates`,
      id: "generated-candidate",
      isComplete: renderCells.some((cell) => cell.candidate_count > 0),
      label: "Generated candidate",
      missingText: "Missing",
    },
    {
      completeText: "Selected",
      id: "private-render",
      isComplete: renderCells.some((cell) => cell.has_private_render),
      label: "Private render",
      missingText: "Missing",
    },
    {
      completeText: "Ready",
      id: "publication-readiness",
      isComplete: Boolean(readiness?.ready),
      label: "Publication readiness",
      missingText: "Blocked",
    },
  ];
}

function TagManagerContent({
  accessToken,
  dependencies,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<string | null>(
    null,
  );
  const [tags, setTags] = useState<AdminCatalogTag[]>([]);

  async function loadTags() {
    const nextTags = await dependencies.listTags(accessToken);
    setTags(nextTags);
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
    const formData = new FormData(form);
    const publicLabel = String(formData.get(`tag-${tag.id}`) ?? "").trim();

    try {
      await dependencies.updateTag(accessToken, tag.id, {
        public_label: publicLabel,
      });
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  async function handleDelete(tag: AdminCatalogTag) {
    setErrorMessage(null);

    try {
      await dependencies.deleteTag(accessToken, tag.id);
      setPendingDeleteTagId(null);
      await loadTags();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  return (
    <section aria-labelledby="tags-title" className="admin-section">
      <p className="eyebrow">Catalog</p>
      <h1 id="tags-title">Tags</h1>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <form className="admin-inline-form" onSubmit={handleCreate}>
        <label className="field">
          <span>Public label</span>
          <input name="public_label" required />
        </label>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating" : "Create tag"}
        </button>
      </form>
      {tags.length === 0 ? <p>No tags.</p> : null}
      <div className="admin-list">
        {tags.map((tag) => (
          <form
            className="admin-list-row"
            key={tag.id}
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpdate(tag, event.currentTarget);
            }}
          >
            <label className="field">
              <span>Edit {tag.public_label}</span>
              <input
                aria-label={`Edit ${tag.public_label}`}
                defaultValue={tag.public_label}
                name={`tag-${tag.id}`}
                required
              />
            </label>
            <span className="admin-muted">{tag.slug}</span>
            <button type="submit">Save {tag.public_label}</button>
            {pendingDeleteTagId === tag.id ? (
              <button onClick={() => void handleDelete(tag)} type="button">
                Confirm delete {tag.public_label}
              </button>
            ) : (
              <button
                onClick={() => setPendingDeleteTagId(tag.id)}
                type="button"
              >
                Delete {tag.public_label}
              </button>
            )}
          </form>
        ))}
      </div>
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
  const assignedFabricIds = new Set(
    sofaFabrics.map((assignment) => assignment.fabric_id),
  );
  const assignableFabrics = fabrics.filter(
    (fabric) =>
      fabric.lifecycle_state === "active" && !assignedFabricIds.has(fabric.id),
  );

  async function refreshAssignmentsAndReadiness() {
    const [nextAssignments, nextReadiness] = await Promise.all([
      dependencies.listSofaFabrics(accessToken, sofaId),
      dependencies.getSofaReadiness(accessToken, sofaId),
    ]);
    onSofaFabricsChange(nextAssignments);
    onReadinessChange(nextReadiness);
    await onRenderPreparationRefresh();
  }

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

  async function handleUpdate(
    assignment: AdminCatalogSofaFabric,
    value: string,
  ) {
    setErrorMessage(null);

    try {
      await dependencies.updateSofaFabric(
        accessToken,
        sofaId,
        assignment.fabric_id,
        {
          public_order: value.trim() ? Number(value) : null,
        },
      );
      await refreshAssignmentsAndReadiness();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

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
        number="2"
        title="Fabric assignments"
      />
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <form
        className="admin-inline-form admin-inline-form-wide"
        onSubmit={handleAssign}
      >
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
        <label className="field">
          <span>Public order</span>
          <input min="0" name="public_order" type="number" />
        </label>
        <button disabled={isSubmitting} type="submit">
          Assign fabric
        </button>
      </form>
      {sofaFabrics.length === 0 ? <p>No assigned fabrics.</p> : null}
      {sofaFabrics.length > 0 ? (
        <div className="admin-list">
          {sofaFabrics.map((assignment) => (
            <div className="admin-list-row" key={assignment.fabric_id}>
              <span>
                {assignment.fabric?.internal_name ?? assignment.fabric_id}
              </span>
              <label className="field">
                <span>Public order for {assignment.fabric?.internal_name}</span>
                <input
                  aria-label={`Public order for ${assignment.fabric?.internal_name ?? assignment.fabric_id}`}
                  defaultValue={assignment.public_order ?? ""}
                  min="0"
                  onBlur={(event) =>
                    void handleUpdate(assignment, event.currentTarget.value)
                  }
                  type="number"
                />
              </label>
              <button
                onClick={() => void handleRemove(assignment)}
                type="button"
              >
                Unassign {assignment.fabric?.internal_name ?? "fabric"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
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
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(
    column: AdminCatalogVisualMatrixColumn,
    form: HTMLFormElement,
  ) {
    setErrorMessage(null);
    const formData = new FormData(form);

    try {
      await dependencies.updateVisualMatrixColumn(accessToken, column.id, {
        admin_label: nullableFormString(formData, `admin_label_${column.id}`),
        public_label: nullableFormString(formData, `public_label_${column.id}`),
        sequence: Number(formData.get(`sequence_${column.id}`)),
      });
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  async function handleDelete(column: AdminCatalogVisualMatrixColumn) {
    setErrorMessage(null);

    try {
      await dependencies.deleteVisualMatrixColumn(accessToken, column.id);
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  // RU: Это действие отправляет исходное фото и может подготовить его перед отправкой.
  // FR: Cette action envoie la photo source et peut la preparer avant l'envoi.
  async function handleSourcePhotoUpload(
    column: AdminCatalogVisualMatrixColumn,
    form: HTMLFormElement,
  ) {
    setErrorMessage(null);
    setUploadInfoMessage(null);
    const formData = new FormData(form);
    const originalFabricId = String(formData.get(`source_fabric_${column.id}`));
    const file = readFileField(form, formData, `source_photo_${column.id}`);

    if (!file) {
      setErrorMessage("SOURCE_PHOTO_REQUIRED");
      return;
    }

    try {
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
      form.reset();
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  return (
    <section
      aria-labelledby="visual-matrix-title"
      className="admin-subsection"
      id="visual-matrix"
    >
      <SectionStepHeading
        headingId="visual-matrix-title"
        number="3"
        title="Visual matrix"
      />
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
      <form
        className="admin-inline-form admin-inline-form-wide"
        onSubmit={handleCreate}
      >
        <label className="field">
          <span>Sequence</span>
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
        <button disabled={isSubmitting} type="submit">
          Add column
        </button>
      </form>
      {columns.length === 0 ? <p>No visual columns.</p> : null}
      {columns.length > 0 ? (
        <div className="admin-list">
          {columns.map((column) => (
            <div className="admin-list-row" key={column.id}>
              <form
                className="admin-inline-form admin-inline-form-wide"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleUpdate(column, event.currentTarget);
                }}
              >
                <label className="field">
                  <span>Sequence {column.sequence}</span>
                  <input
                    defaultValue={column.sequence}
                    min="1"
                    name={`sequence_${column.id}`}
                    type="number"
                  />
                </label>
                <label className="field">
                  <span>Admin label {column.sequence}</span>
                  <input
                    defaultValue={column.admin_label ?? ""}
                    name={`admin_label_${column.id}`}
                  />
                </label>
                <label className="field">
                  <span>Public label {column.sequence}</span>
                  <input
                    defaultValue={column.public_label ?? ""}
                    name={`public_label_${column.id}`}
                  />
                </label>
                <button type="submit">Save column {column.sequence}</button>
                <button onClick={() => void handleDelete(column)} type="button">
                  Delete column {column.sequence}
                </button>
              </form>
              <form
                className="admin-inline-form admin-inline-form-wide"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSourcePhotoUpload(column, event.currentTarget);
                }}
              >
                <label className="field">
                  <span>Original fabric {column.sequence}</span>
                  <select name={`source_fabric_${column.id}`} required>
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
                <label className="field">
                  <span>Source photo {column.sequence}</span>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    name={`source_photo_${column.id}`}
                    type="file"
                  />
                </label>
                <span className="admin-muted">
                  {column.current_source_photo ? "Source ready" : "No source"}
                </span>
                <button type="submit">Upload source {column.sequence}</button>
              </form>
            </div>
          ))}
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

function isSourcePhotoCompleteCell(cell: AdminCatalogRenderCell) {
  return (
    cell.source_type === "source_photo" &&
    cell.has_private_render &&
    Boolean(cell.source_photo_id)
  );
}

async function pollFabricRenderJobResult({
  accessToken,
  dependencies,
  isActive,
  jobId,
  onRefresh,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  isActive(): boolean;
  jobId: string;
  onRefresh(): Promise<void>;
}) {
  for (
    let attempt = 0;
    attempt < FABRIC_RENDER_JOB_POLL_ATTEMPTS;
    attempt += 1
  ) {
    if (!isActive()) {
      return null;
    }

    const job = await dependencies.getFabricRenderJob(accessToken, jobId);

    if (isTerminalFabricRenderJobStatus(job.status)) {
      if (isActive()) {
        await onRefresh();
      }

      return job;
    }

    await waitForFabricRenderJobPollDelay();
  }

  return null;
}

function isTerminalFabricRenderJobStatus(status: string) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function waitForFabricRenderJobPollDelay() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, FABRIC_RENDER_JOB_POLL_INTERVAL_MS);
  });
}

function RenderCoverageSection({
  accessToken,
  coverage,
  dependencies,
  onRefresh,
  sofaFabrics,
  visualMatrixColumns,
}: {
  accessToken: string;
  coverage: AdminCatalogRenderCoverage | null;
  dependencies: AdminCatalogPageDependencies;
  onRefresh(): Promise<void>;
  sofaFabrics: AdminCatalogSofaFabric[];
  visualMatrixColumns: AdminCatalogVisualMatrixColumn[];
}) {
  // RU: Эти значения хранят сообщение, выбранную ячейку и список картинок для проверки.
  // FR: Ces valeurs gardent le message, la case choisie et la liste d'images a verifier.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [reviewCellId, setReviewCellId] = useState<string | null>(null);
  const [reviewCandidates, setReviewCandidates] = useState<
    AdminCatalogRenderCandidate[]
  >([]);

  // RU: Этот флажок нужен, чтобы остановить проверку, если админ ушел со страницы.
  // FR: Ce repere sert a stopper la verification si l'admin quitte la page.
  const isAliveRef = useRef(true);

  // RU: Этот автоматический блок включает флажок при открытии секции и выключает при уходе.
  // FR: Ce bloc automatique active le repere a l'ouverture et le desactive au depart.
  useEffect(() => {
    isAliveRef.current = true;

    return () => {
      isAliveRef.current = false;
    };
  }, []);

  // RU: Это действие ставит задачу в очередь и потом само проверяет готовность.
  // FR: Cette action place la tache en file puis verifie seule quand elle est prete.
  async function handleGenerate(cell: AdminCatalogRenderCell) {
    setErrorMessage(null);
    setActiveCellId(cell.id);

    try {
      const job = await dependencies.createFabricRenderJob(accessToken, {
        fabric_id: cell.fabric_id,
        generation_mode: "initial",
        prompt_note: null,
        sofa_id: cell.sofa_id,
        visual_matrix_column_id: cell.visual_matrix_column_id,
      });
      await onRefresh();
      void pollFabricRenderJobResult({
        accessToken,
        dependencies,
        isActive: () => isAliveRef.current,
        jobId: job.id,
        onRefresh,
      })
        .then((finishedJob) => {
          if (!isAliveRef.current || !finishedJob) {
            return;
          }

          if (finishedJob.status === "failed") {
            setErrorMessage(
              finishedJob.last_error_message ?? "FABRIC_RENDER_JOB_FAILED",
            );
          }
        })
        .catch((error) => {
          if (isAliveRef.current) {
            setErrorMessage(readErrorMessage(error));
          }
        });
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
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
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  // RU: Это действие выбирает одну готовую картинку как текущую.
  // FR: Cette action choisit une image prete comme image actuelle.
  async function handleUseCandidate(candidate: AdminCatalogRenderCandidate) {
    setErrorMessage(null);
    setActiveCellId(candidate.render_cell_id);

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
      setErrorMessage("MANUAL_RENDER_REQUIRED");
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
      await dependencies.setManualRender(accessToken, cell.id, {
        asset_id: asset.id,
      });
      form.reset();
      await onRefresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setActiveCellId(null);
    }
  }

  function findCell(fabricId: string, columnId: string) {
    return coverage?.render_cells.find(
      (cell) =>
        cell.fabric_id === fabricId &&
        cell.visual_matrix_column_id === columnId,
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
        number="4"
        title="Render coverage"
      />
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
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fabric</th>
                {visualMatrixColumns.map((column) => (
                  <th key={column.id}>
                    {column.public_label ??
                      column.admin_label ??
                      `Column ${column.sequence}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sofaFabrics.map((assignment) => (
                <tr key={assignment.fabric_id}>
                  <td>
                    {assignment.fabric?.internal_name ?? assignment.fabric_id}
                  </td>
                  {visualMatrixColumns.map((column) => {
                    const cell = findCell(assignment.fabric_id, column.id);

                    return (
                      <td className="admin-render-cell" key={column.id}>
                        {cell ? (
                          <div className="admin-cell-stack">
                            <div className="admin-cell-summary">
                              <strong>Render status</strong>
                              <span>
                                {cell.has_public_render
                                  ? "Public ready"
                                  : cell.has_private_render
                                    ? "Private ready"
                                    : "Incomplete"}
                              </span>
                            </div>
                            <dl className="admin-cell-details">
                              <div>
                                <dt>Source</dt>
                                <dd>
                                  {renderSourceTypeLabel(cell.source_type)}
                                </dd>
                              </div>
                              <div>
                                <dt>Job</dt>
                                <dd>{cell.latest_job?.status ?? "No job"}</dd>
                              </div>
                              <div>
                                <dt>Candidates</dt>
                                <dd>{cell.candidate_count}</dd>
                              </div>
                            </dl>
                            {cell.blockers.length > 0 ? (
                              <div className="admin-cell-blockers">
                                <strong>Blockers</strong>
                                <span>{cell.blockers.join(", ")}</span>
                              </div>
                            ) : null}
                            <div className="admin-cell-actions">
                              {isSourcePhotoCompleteCell(cell) ? (
                                <span className="admin-muted">
                                  Source photo is current
                                </span>
                              ) : (
                                <button
                                  disabled={
                                    !cell.can_generate_initial ||
                                    activeCellId === cell.id
                                  }
                                  onClick={() => void handleGenerate(cell)}
                                  type="button"
                                >
                                  {activeCellId === cell.id
                                    ? "Queueing"
                                    : "Generate"}
                                </button>
                              )}
                              <button
                                disabled={
                                  cell.candidate_count === 0 ||
                                  activeCellId === cell.id
                                }
                                onClick={() =>
                                  void handleReviewCandidates(cell)
                                }
                                type="button"
                              >
                                Review candidates
                              </button>
                            </div>
                            <form
                              className="admin-cell-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void handleManualRenderUpload(
                                  cell,
                                  event.currentTarget,
                                );
                              }}
                            >
                              <label className="field">
                                <span>Manual render</span>
                                <input
                                  accept="image/png,image/jpeg,image/webp"
                                  name={`manual_render_${cell.id}`}
                                  type="file"
                                />
                              </label>
                              <button
                                disabled={activeCellId === cell.id}
                                type="submit"
                              >
                                Upload manual render
                              </button>
                            </form>
                            {reviewCellId === cell.id ? (
                              <div className="admin-candidate-list">
                                {reviewCandidates.length === 0 ? (
                                  <span className="admin-muted">
                                    No candidates
                                  </span>
                                ) : null}
                                {reviewCandidates.map((candidate) => (
                                  <div
                                    className="admin-candidate-row"
                                    key={candidate.id}
                                  >
                                    {candidate.preview_url ? (
                                      <img
                                        alt={`Candidate preview ${candidate.id}`}
                                        className="admin-preview-image"
                                        src={candidate.preview_url}
                                      />
                                    ) : null}
                                    <span>
                                      {candidate.generation_mode} -{" "}
                                      {candidate.prompt_version}
                                    </span>
                                    <span className="admin-muted">
                                      {candidate.is_current
                                        ? "Current"
                                        : "Candidate"}
                                    </span>
                                    <button
                                      disabled={
                                        candidate.is_current ||
                                        activeCellId === cell.id
                                      }
                                      onClick={() =>
                                        void handleUseCandidate(candidate)
                                      }
                                      type="button"
                                    >
                                      Use candidate
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          "Missing"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function FabricForm({
  buttonLabel,
  errorMessage,
  fabric,
  onSubmit,
  uploadInfoMessage,
}: {
  buttonLabel: string;
  errorMessage: string | null;
  fabric?: AdminCatalogFabric;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  uploadInfoMessage: string | null;
}) {
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
          type="file"
        />
      </label>
      <label className="field">
        <span>AI reference image</span>
        <input
          accept="image/png,image/jpeg,image/webp"
          name="ai_reference_file"
          type="file"
        />
      </label>
      <button type="submit">{buttonLabel}</button>
    </form>
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
  function handleTagToggle(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      onSelectedTagIdsChange(selectedTagIds.filter((id) => id !== tagId));
      return;
    }

    onSelectedTagIdsChange([...selectedTagIds, tagId]);
  }

  return (
    <form className="admin-form admin-form-wide" onSubmit={onSubmit}>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
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
      <div className="admin-form-grid">
        <label className="field">
          <span>Length cm</span>
          <input
            defaultValue={sofa?.length_cm ?? ""}
            min="1"
            name="length_cm"
            type="number"
          />
        </label>
        <label className="field">
          <span>Depth cm</span>
          <input
            defaultValue={sofa?.depth_cm ?? ""}
            min="1"
            name="depth_cm"
            type="number"
          />
        </label>
        <label className="field">
          <span>Height cm</span>
          <input
            defaultValue={sofa?.height_cm ?? ""}
            min="1"
            name="height_cm"
            type="number"
          />
        </label>
      </div>
      <fieldset className="admin-fieldset">
        <legend>Tags</legend>
        {tags.length === 0 ? <p>No tags.</p> : null}
        <div className="admin-checkboxes">
          {tags.map((tag) => (
            <label key={tag.id}>
              <input
                checked={selectedTagIds.includes(tag.id)}
                onChange={() => handleTagToggle(tag.id)}
                type="checkbox"
              />
              <span>{tag.public_label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit">{buttonLabel}</button>
    </form>
  );
}

function AdminNavigation() {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link href="/admin">Dashboard</Link>
      <Link href="/admin/sofas">Sofas</Link>
      <Link href="/admin/fabrics">Fabrics</Link>
      <Link href="/admin/tags">Tags</Link>
    </nav>
  );
}

async function buildFabricPayload({
  accessToken,
  dependencies,
  existingFabric,
  form,
  onUploadInfo,
  requireFiles,
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  existingFabric?: AdminCatalogFabric;
  form: HTMLFormElement;
  onUploadInfo(message: string): void;
  requireFiles: boolean;
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
}: {
  accessToken: string;
  dependencies: AdminCatalogPageDependencies;
  file: File;
  onUploadInfo(message: string): void;
  purpose: UploadCreateInput["purpose"];
}) {
  const preparedUpload = await prepareAdminImageUploadFile({
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
    throw new Error(
      body.error?.code ?? body.error?.message ?? "Request failed.",
    );
  }

  return body.data ?? {};
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
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
