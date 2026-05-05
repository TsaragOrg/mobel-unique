import { Blob as NodeBlob } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminAuth, type AdminAuthUser } from "./admin-auth";
import {
  handleArchiveFabricRequest,
  handleArchiveSofaRequest,
  handleAssignSofaFabricRequest,
  handleCompleteUploadRequest,
  handleCreateFabricRequest,
  handleCreateFabricRenderJobRequest,
  handleCreateSofaRequest,
  handleCreateSofaRenderExportRequest,
  handleCreateTagRequest,
  handleCreateUploadRequest,
  handleCreateVisualMatrixColumnRequest,
  handleDeleteTagRequest,
  handleDeleteVisualMatrixColumnRequest,
  handleGetFabricRenderJobRequest,
  handleGenerateAllFabricRenderJobsRequest,
  handleResumeFabricRenderJobsRequest,
  handleGetFabricRequest,
  handleGetRenderCoverageRequest,
  handleGetSofaPublicationReadinessRequest,
  handleGetSofaRenderExportRequest,
  handleGetSofaRequest,
  handleGetStorageAssetPreviewRequest,
  handleListFabricsRequest,
  handleListRenderCellCandidatesRequest,
  handleListSofaFabricsRequest,
  handleListSofasRequest,
  handleListTagsRequest,
  handleListVisualMatrixColumnsRequest,
  handlePublishSofaRequest,
  handleRemoveSofaFabricRequest,
  handleRetryFabricRenderJobRequest,
  handleUpdateFabricRequest,
  handleUpdateSofaRequest,
  handleUpdateSofaFabricRequest,
  handleUpdateTagRequest,
  handleUpdateVisualMatrixColumnRequest,
  handleSetManualRenderRequest,
  handleUnarchiveSofaRequest,
  handleUnpublishSofaRequest,
  handleUseRenderCandidateRequest,
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

afterEach(() => {
  vi.unstubAllEnvs();
});

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
  const renderCells = new Map<string, Record<string, unknown>>();
  const renderCandidates = new Map<string, Record<string, unknown>>();
  const renderExports = new Map<string, Record<string, unknown>>();
  const renderJobs = new Map<string, Record<string, unknown>>();
  const sofaFabrics = new Map<string, Record<string, unknown>>();
  const sourcePhotos = new Map<string, Record<string, unknown>>();
  const uploadDescriptors = new Map<
    string,
    Parameters<AdminCatalogStore["createUpload"]>[0]
  >();
  const visualMatrixColumns = new Map<string, Record<string, unknown>>();
  let tagCounter = 0;
  let sofaCounter = 0;
  let fabricCounter = 0;
  let renderCellCounter = 0;
  let renderCandidateCounter = 0;
  let renderJobCounter = 0;
  let sourcePhotoCounter = 0;
  let visualColumnCounter = 0;
  const swatchAsset = {
    asset_kind: "fabric_swatch_public",
    bucket_id: "catalog-public-assets",
    byte_size: 1200,
    content_type: "image/png",
    height_px: 256,
    id: "00000000-0000-4000-8000-000000000901",
    lifecycle_state: "active",
    object_path: "fabrics/fabric-id/swatches/swatch.png",
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

  function createFakeRenderCell({
    fabricId,
    sofaId,
    visualMatrixColumnId,
  }: {
    fabricId: string;
    sofaId: string;
    visualMatrixColumnId: string;
  }) {
    renderCellCounter += 1;

    return {
      current_private_asset_id: null,
      current_public_asset_id: null,
      fabric_id: fabricId,
      id: `00000000-0000-4000-8000-${String(960 + renderCellCounter).padStart(
        12,
        "0",
      )}`,
      sofa_id: sofaId,
      source_photo_id: null,
      source_type: "ai_generated",
      updated_at: "2026-04-28T10:25:00.000Z",
      visual_matrix_column_id: visualMatrixColumnId,
    };
  }

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
    async archiveSofa(sofaId) {
      const existing = sofas.get(sofaId);

      if (!existing) {
        return null;
      }

      const next = {
        ...existing,
        archived_at: "2026-04-28T10:55:00.000Z",
        lifecycle_state: "archived",
        published_at: null,
        updated_at: "2026-04-28T10:55:00.000Z",
      };
      sofas.set(sofaId, next);

      return next;
    },
    async unarchiveSofa(sofaId) {
      const existing = sofas.get(sofaId);

      if (!existing) {
        return null;
      }

      const next = {
        ...existing,
        archived_at: null,
        lifecycle_state: "draft",
        updated_at: "2026-04-28T11:05:00.000Z",
      };
      sofas.set(sofaId, next);

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

      if (uploadId === "sofa-source-photo-upload") {
        const descriptor = uploadDescriptors.get(uploadId);
        const sourcePhotoAsset = {
          asset_kind: "sofa_source_photo",
          byte_size: 1800,
          content_type: "image/png",
          height_px: 1200,
          id: "00000000-0000-4000-8000-000000000904",
          lifecycle_state: "active",
          visibility: "private",
          width_px: 1600,
        };
        const column = descriptor?.visual_matrix_column_id
          ? visualMatrixColumns.get(
              descriptor.visual_matrix_column_id as string,
            )
          : [...visualMatrixColumns.values()][0];
        const assignment = descriptor?.original_fabric_id
          ? sofaFabrics.get(
              `${descriptor.sofa_id}:${descriptor.original_fabric_id}`,
            )
          : [...sofaFabrics.values()][0];

        if (column && assignment) {
          sourcePhotoCounter += 1;
          const sourcePhoto = {
            asset: sourcePhotoAsset,
            asset_id: sourcePhotoAsset.id,
            created_at: "2026-04-28T10:25:00.000Z",
            id: `00000000-0000-4000-8000-${String(
              950 + sourcePhotoCounter,
            ).padStart(12, "0")}`,
            original_fabric_id: assignment.fabric_id,
            sofa_id: descriptor?.sofa_id ?? column.sofa_id,
            updated_at: "2026-04-28T10:25:00.000Z",
            visual_matrix_column_id: column.id,
          };
          sourcePhotos.set(sourcePhoto.id, sourcePhoto);
          visualMatrixColumns.set(column.id as string, {
            ...column,
            current_source_photo: sourcePhoto,
            current_source_photo_id: sourcePhoto.id,
          });
          const existingCell = [...renderCells.values()].find(
            (renderCell) =>
              renderCell.sofa_id === sourcePhoto.sofa_id &&
              renderCell.fabric_id === sourcePhoto.original_fabric_id &&
              renderCell.visual_matrix_column_id ===
                sourcePhoto.visual_matrix_column_id,
          );
          const cell =
            existingCell ??
            createFakeRenderCell({
              fabricId: sourcePhoto.original_fabric_id as string,
              sofaId: sourcePhoto.sofa_id as string,
              visualMatrixColumnId:
                sourcePhoto.visual_matrix_column_id as string,
            });

          renderCells.set(cell.id as string, {
            ...cell,
            accepted_fabric_render_candidate_id: null,
            current_private_asset_id: sourcePhoto.asset_id,
            source_photo_id: sourcePhoto.id,
            source_type: "source_photo",
            updated_at: "2026-04-28T10:25:00.000Z",
          });
        }

        assets.set(sourcePhotoAsset.id, sourcePhotoAsset);

        return sourcePhotoAsset;
      }

      if (uploadId === "manual-render-upload") {
        const manualRenderAsset = {
          asset_kind: "manual_render",
          byte_size: 1900,
          content_type: "image/png",
          height_px: 1200,
          id: "00000000-0000-4000-8000-000000000909",
          lifecycle_state: "active",
          visibility: "private",
          width_px: 1600,
        };
        assets.set(manualRenderAsset.id, manualRenderAsset);

        return manualRenderAsset;
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
    async createSofaRenderExport(sofaId) {
      if (!sofas.has(sofaId)) {
        return null;
      }

      const renderExport = {
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
      };
      renderExports.set(String(renderExport.id), renderExport);

      return renderExport;
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
      const uploadId =
        input.purpose === "fabric_swatch"
          ? "fabric-swatch-upload"
          : input.purpose === "sofa_source_photo"
            ? "sofa-source-photo-upload"
            : input.purpose === "manual_render"
              ? "manual-render-upload"
              : "fabric-ai-reference-upload";
      uploadDescriptors.set(uploadId, input);

      return {
        expires_at: "2026-04-28T12:00:00.000Z",
        method: "signed_upload",
        signed_upload_url: `https://storage.example/${input.purpose}`,
        upload_id: uploadId,
      };
    },
    async createFabricRenderJob(input) {
      const column = visualMatrixColumns.get(input.visual_matrix_column_id);
      const sourcePhoto =
        typeof column?.current_source_photo_id === "string"
          ? sourcePhotos.get(column.current_source_photo_id)
          : undefined;
      const sourcePhotoSatisfiedCell = [...renderCells.values()].find(
        (renderCell) =>
          sourcePhoto &&
          renderCell.sofa_id === input.sofa_id &&
          renderCell.fabric_id === input.fabric_id &&
          renderCell.visual_matrix_column_id ===
            input.visual_matrix_column_id &&
          renderCell.current_private_asset_id === sourcePhoto["asset_id"] &&
          renderCell.source_photo_id === sourcePhoto["id"] &&
          renderCell.source_type === "source_photo",
      );

      if (
        sourcePhoto?.["original_fabric_id"] === input.fabric_id &&
        sourcePhotoSatisfiedCell
      ) {
        return {
          code: "FABRIC_RENDER_JOB_CONFLICT",
          message:
            "The source photo already satisfies the original fabric render cell.",
          status: 422,
        };
      }

      const inputPromptNote =
        input.generation_mode === "initial" ? input.prompt_note : null;
      const inputRefinementSourceAssetId =
        input.generation_mode === "refine"
          ? input.refinement_source_asset_id
          : null;
      const inputRefinePrompt =
        input.generation_mode === "refine" ? input.refine_prompt : null;
      const activeDuplicate = [...renderJobs.values()].find(
        (job) =>
          job.sofa_id === input.sofa_id &&
          job.fabric_id === input.fabric_id &&
          job.visual_matrix_column_id === input.visual_matrix_column_id &&
          job.generation_mode === input.generation_mode &&
          job.prompt_note === inputPromptNote &&
          job.refinement_source_asset_id === inputRefinementSourceAssetId &&
          job.refine_prompt === inputRefinePrompt &&
          (job.status === "queued" || job.status === "processing"),
      );

      if (activeDuplicate) {
        return {
          code: "FABRIC_RENDER_JOB_CONFLICT",
          message: "An equivalent active fabric render job already exists.",
          status: 409,
        };
      }

      const cell =
        [...renderCells.values()].find(
          (renderCell) =>
            renderCell.sofa_id === input.sofa_id &&
            renderCell.fabric_id === input.fabric_id &&
            renderCell.visual_matrix_column_id ===
              input.visual_matrix_column_id,
        ) ??
        createFakeRenderCell({
          fabricId: input.fabric_id,
          sofaId: input.sofa_id,
          visualMatrixColumnId: input.visual_matrix_column_id,
        });
      renderCells.set(cell.id as string, cell);
      renderJobCounter += 1;
      const job = {
        attempt_count: 0,
        completed_at: null,
        created_at: "2026-04-28T10:30:00.000Z",
        fabric_ai_reference_asset_id: aiReferenceAsset.id,
        fabric_id: input.fabric_id,
        generation_mode: input.generation_mode,
        id: `00000000-0000-4000-8000-${String(970 + renderJobCounter).padStart(
          12,
          "0",
        )}`,
        last_error_message: null,
        max_attempts: 3,
        prompt_note: inputPromptNote,
        prompt_version: "v007",
        queued_at: "2026-04-28T10:30:00.000Z",
        request_id: `00000000-0000-4000-8000-${String(
          1970 + renderJobCounter,
        ).padStart(12, "0")}`,
        refinement_source_asset_id: inputRefinementSourceAssetId,
        refine_prompt: inputRefinePrompt,
        render_cell_id: cell.id,
        sofa_id: input.sofa_id,
        status: "queued",
        target_sofa_asset_id:
          (sourcePhoto?.["asset_id"] as string | undefined) ??
          "00000000-0000-4000-8000-000000000904",
        updated_at: "2026-04-28T10:30:00.000Z",
        visual_matrix_column_id: input.visual_matrix_column_id,
      };
      renderJobs.set(job.id, job);

      renderCandidateCounter += 1;
      const candidateAsset = {
        asset_kind: "fabric_render_candidate",
        byte_size: 2400,
        content_type: "image/png",
        height_px: 1200,
        id: `00000000-0000-4000-8000-${String(
          980 + renderCandidateCounter,
        ).padStart(12, "0")}`,
        lifecycle_state: "active",
        visibility: "private",
        width_px: 1600,
      };
      assets.set(candidateAsset.id, candidateAsset);
      const candidate = {
        accepted_at: null,
        asset: candidateAsset,
        asset_id: candidateAsset.id,
        created_at: "2026-04-28T10:35:00.000Z",
        fabric_id: input.fabric_id,
        generation_mode: input.generation_mode,
        id: `00000000-0000-4000-8000-${String(
          990 + renderCandidateCounter,
        ).padStart(12, "0")}`,
        is_current: false,
        job_id: job.id,
        preview_url:
          "https://storage.example/signed/private-candidate-preview?token=short",
        prompt_version: "v007",
        provider_model: "mock-fabric-render-v1",
        provider_name: "mock",
        render_cell_id: cell.id,
        sofa_id: input.sofa_id,
        visual_matrix_column_id: input.visual_matrix_column_id,
      };
      renderCandidates.set(candidate.id, candidate);

      return job;
    },
    async createFabricRenderJobsForSofa(sofaId) {
      if (!sofas.has(sofaId)) {
        return {
          code: "SOFA_NOT_FOUND",
          message: "Sofa was not found.",
          status: 404,
        };
      }

      const activeJobCellIds = new Set(
        [...renderJobs.values()]
          .filter(
            (job) => job.status === "queued" || job.status === "processing",
          )
          .map((job) => job.render_cell_id),
      );
      const eligibleCells = [...renderCells.values()].filter(
        (cell) =>
          cell.sofa_id === sofaId &&
          !cell.current_private_asset_id &&
          !activeJobCellIds.has(cell.id),
      );

      if (eligibleCells.length === 0) {
        return {
          fabric_render_jobs: [],
          job_ids: [],
          request_id: null,
          status: "noop",
          total_jobs: 0,
        };
      }

      const requestId = `00000000-0000-4000-8000-${String(
        2970 + renderJobCounter,
      ).padStart(12, "0")}`;
      const jobs = eligibleCells.map((cell) => {
        renderJobCounter += 1;

        const job = {
          attempt_count: 0,
          completed_at: null,
          created_at: "2026-04-28T10:30:00.000Z",
          fabric_ai_reference_asset_id: aiReferenceAsset.id,
          fabric_id: cell.fabric_id,
          generation_mode: "initial",
          id: `00000000-0000-4000-8000-${String(
            970 + renderJobCounter,
          ).padStart(12, "0")}`,
          last_error_message: null,
          max_attempts: 3,
          prompt_note: null,
          prompt_version: "v007",
          queued_at: "2026-04-28T10:30:00.000Z",
          request_id: requestId,
          refinement_source_asset_id: null,
          refine_prompt: null,
          render_cell_id: cell.id,
          sofa_id: sofaId,
          status: "queued",
          target_sofa_asset_id: "00000000-0000-4000-8000-000000000904",
          updated_at: "2026-04-28T10:30:00.000Z",
          visual_matrix_column_id: cell.visual_matrix_column_id,
        };

        renderJobs.set(job.id, job);

        return job;
      });

      return {
        fabric_render_jobs: jobs,
        job_ids: jobs.map((job) => job.id),
        request_id: requestId,
        status: "queued",
        total_jobs: jobs.length,
      };
    },
    async resumeFabricRenderJobs(input) {
      const requestIds = [
        ...new Set(
          [...renderJobs.values()]
            .filter(
              (job) =>
                job.status === "queued" &&
                (input.request_id
                  ? job.request_id === input.request_id
                  : job.sofa_id === input.sofa_id),
            )
            .map((job) => job.request_id as string),
        ),
      ];

      return {
        request_ids: requestIds,
        status: requestIds.length > 0 ? "started" : "noop",
        total_requests: requestIds.length,
      };
    },
    async retryFabricRenderJob(jobId) {
      const existingJob = renderJobs.get(jobId);

      if (!existingJob) {
        return {
          code: "FABRIC_RENDER_JOB_NOT_FOUND",
          message: "Fabric render job was not found.",
          status: 404,
        };
      }

      if (existingJob.status !== "failed") {
        return {
          code: "FABRIC_RENDER_JOB_CONFLICT",
          message: "Only failed fabric render jobs can be retried.",
          status: 409,
        };
      }

      renderJobCounter += 1;

      const retryJob = {
        ...existingJob,
        attempt_count: 0,
        completed_at: null,
        created_at: "2026-04-28T10:45:00.000Z",
        id: `00000000-0000-4000-8000-${String(3970 + renderJobCounter).padStart(
          12,
          "0",
        )}`,
        last_error_message: null,
        queued_at: "2026-04-28T10:45:00.000Z",
        request_id: `00000000-0000-4000-8000-${String(
          4970 + renderJobCounter,
        ).padStart(12, "0")}`,
        status: "queued",
        updated_at: "2026-04-28T10:45:00.000Z",
      };

      renderJobs.set(retryJob.id, retryJob);

      return retryJob;
    },
    async createVisualMatrixColumn(sofaId, input) {
      if (!sofas.has(sofaId)) {
        return {
          code: "SOFA_NOT_FOUND",
          message: "Sofa was not found.",
          status: 404,
        };
      }

      const sequenceConflict = [...visualMatrixColumns.values()].some(
        (column) =>
          column.sofa_id === sofaId &&
          column.sequence === input.sequence &&
          column.deleted_at === null,
      );

      if (sequenceConflict) {
        return {
          code: "VISUAL_MATRIX_COLUMN_CONFLICT",
          message:
            "Another active visual matrix column already uses this sequence.",
          status: 409,
        };
      }

      visualColumnCounter += 1;
      const column = {
        created_at: "2026-04-28T10:20:00.000Z",
        current_source_photo: null,
        current_source_photo_id: null,
        deleted_at: null,
        id: `00000000-0000-4000-8000-${String(
          930 + visualColumnCounter,
        ).padStart(12, "0")}`,
        sofa_id: sofaId,
        updated_at: "2026-04-28T10:20:00.000Z",
        ...input,
      };
      visualMatrixColumns.set(column.id, column);

      return column;
    },
    async deleteVisualMatrixColumn(columnId) {
      const existing = visualMatrixColumns.get(columnId);

      if (!existing || existing.deleted_at) {
        return {
          code: "VISUAL_MATRIX_COLUMN_NOT_FOUND",
          message: "Visual matrix column was not found.",
          status: 404,
        };
      }

      visualMatrixColumns.set(columnId, {
        ...existing,
        deleted_at: "2026-04-28T10:35:00.000Z",
      });

      return null;
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
    async getFabricRenderJob(jobId) {
      return renderJobs.get(jobId) ?? null;
    },
    async getRenderCoverage(sofaId) {
      if (!sofas.has(sofaId)) {
        return null;
      }

      const columns = [...visualMatrixColumns.values()].filter(
        (column) => column.sofa_id === sofaId && column.deleted_at === null,
      );
      const assignments = [...sofaFabrics.values()].filter(
        (assignment) => assignment.sofa_id === sofaId,
      );

      for (const assignment of assignments) {
        for (const column of columns) {
          const existing = [...renderCells.values()].find(
            (cell) =>
              cell.sofa_id === sofaId &&
              cell.fabric_id === assignment.fabric_id &&
              cell.visual_matrix_column_id === column.id,
          );

          if (!existing) {
            const cell = createFakeRenderCell({
              fabricId: assignment.fabric_id as string,
              sofaId,
              visualMatrixColumnId: column.id as string,
            });
            renderCells.set(cell.id, cell);
          }
        }
      }

      return {
        render_cells: [...renderCells.values()].map((cell) => {
          const latestJob =
            [...renderJobs.values()].find(
              (job) => job.render_cell_id === cell.id,
            ) ?? null;
          const column = visualMatrixColumns.get(
            cell.visual_matrix_column_id as string,
          );
          const sourcePhoto =
            typeof column?.current_source_photo_id === "string"
              ? sourcePhotos.get(column.current_source_photo_id)
              : undefined;
          const sourcePhotoSatisfied =
            sourcePhoto &&
            sourcePhoto["original_fabric_id"] === cell.fabric_id &&
            sourcePhoto["asset_id"] === cell.current_private_asset_id &&
            sourcePhoto["id"] === cell.source_photo_id &&
            cell.source_type === "source_photo";
          const blockers = [
            ...(sourcePhotoSatisfied ? ["SOURCE_PHOTO_RENDER_COMPLETE"] : []),
            ...(column?.current_source_photo_id
              ? []
              : ["MISSING_SOURCE_PHOTO"]),
            ...(latestJob?.status === "queued"
              ? ["ACTIVE_RENDER_JOB_EXISTS"]
              : []),
          ];

          return {
            ...cell,
            blockers,
            can_generate_initial: blockers.length === 0,
            candidate_count: [...renderCandidates.values()].filter(
              (candidate) => candidate.render_cell_id === cell.id,
            ).length,
            has_private_render: Boolean(cell.current_private_asset_id),
            has_public_render: Boolean(cell.current_public_asset_id),
            latest_job: latestJob,
          };
        }),
        sofa_fabrics: assignments,
        sofa_id: sofaId,
        visual_matrix_columns: columns,
      };
    },
    async getSofa(sofaId) {
      return sofas.get(sofaId) ?? null;
    },
    async getStorageAssetPreview(assetId) {
      const asset = assets.get(assetId);

      if (
        !asset ||
        asset.visibility !== "private" ||
        typeof asset.content_type !== "string" ||
        !asset.content_type.startsWith("image/")
      ) {
        return null;
      }

      return {
        body: new NodeBlob([`preview:${assetId}`], {
          type: asset.content_type,
        }) as unknown as Blob,
        content_type: asset.content_type,
      };
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
    async getSofaRenderExport(exportId) {
      const renderExport = renderExports.get(exportId);

      return renderExport
        ? {
            ...renderExport,
            download_url: "https://storage.example/signed/render-export.zip",
          }
        : null;
    },
    async publishSofa(sofaId) {
      const existing = sofas.get(sofaId);

      if (!existing) {
        return null;
      }

      const publicName =
        typeof existing.public_name === "string"
          ? existing.public_name
          : typeof existing.internal_name === "string"
            ? existing.internal_name
            : "sofa";
      const next = {
        ...existing,
        lifecycle_state: "published",
        public_slug:
          typeof existing.public_slug === "string"
            ? existing.public_slug
            : publicName
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, ""),
        updated_at: "2026-04-28T10:45:00.000Z",
      };
      sofas.set(sofaId, next);

      return next;
    },
    async unpublishSofa(sofaId) {
      const existing = sofas.get(sofaId);

      if (!existing) {
        return null;
      }

      const next = {
        ...existing,
        lifecycle_state: "draft",
        updated_at: "2026-04-28T10:50:00.000Z",
      };
      sofas.set(sofaId, next);

      return next;
    },
    async listFabrics() {
      return [...fabrics.values()];
    },
    async listRenderCellCandidates(renderCellId) {
      if (!renderCells.has(renderCellId)) {
        return null;
      }

      return [...renderCandidates.values()].filter(
        (candidate) => candidate.render_cell_id === renderCellId,
      );
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
    async listVisualMatrixColumns(sofaId) {
      if (!sofas.has(sofaId)) {
        return null;
      }

      return [...visualMatrixColumns.values()].filter(
        (column) => column.sofa_id === sofaId && column.deleted_at === null,
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
    async setManualRender(renderCellId, input) {
      const existing = renderCells.get(renderCellId);
      const asset = assets.get(input.asset_id);

      if (!existing) {
        return {
          code: "RENDER_CELL_NOT_FOUND",
          message: "Render cell was not found.",
          status: 404,
        };
      }

      if (!asset || asset.asset_kind !== "manual_render") {
        return {
          code: "MANUAL_RENDER_NOT_FOUND",
          message: "Manual render asset was not found.",
          status: 422,
        };
      }

      const next = {
        ...existing,
        accepted_fabric_render_candidate_id: null,
        current_private_asset_id: input.asset_id,
        current_public_asset_id: null,
        source_photo_id: null,
        source_type: "manual_upload",
        updated_at: "2026-04-28T10:40:00.000Z",
      };
      renderCells.set(renderCellId, next);

      return next;
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
    async updateVisualMatrixColumn(columnId, input) {
      const existing = visualMatrixColumns.get(columnId);

      if (!existing || existing.deleted_at) {
        return {
          code: "VISUAL_MATRIX_COLUMN_NOT_FOUND",
          message: "Visual matrix column was not found.",
          status: 404,
        };
      }

      const next = {
        ...existing,
        ...input,
        updated_at: "2026-04-28T10:25:00.000Z",
      };
      visualMatrixColumns.set(columnId, next);

      return next;
    },
    async useRenderCandidate(candidateId) {
      const candidate = renderCandidates.get(candidateId);

      if (!candidate) {
        return {
          code: "FABRIC_RENDER_CANDIDATE_NOT_FOUND",
          message: "Fabric render candidate was not found.",
          status: 404,
        };
      }

      const cell = renderCells.get(candidate.render_cell_id as string);

      if (!cell) {
        return {
          code: "RENDER_CELL_NOT_FOUND",
          message: "Render cell was not found.",
          status: 404,
        };
      }

      for (const [id, existingCandidate] of renderCandidates.entries()) {
        if (existingCandidate.render_cell_id === candidate.render_cell_id) {
          renderCandidates.set(id, {
            ...existingCandidate,
            accepted_at: null,
            is_current: false,
          });
        }
      }

      const acceptedCandidate = {
        ...candidate,
        accepted_at: "2026-04-28T10:40:00.000Z",
        is_current: true,
      };
      renderCandidates.set(candidateId, acceptedCandidate);
      renderCells.set(candidate.render_cell_id as string, {
        ...cell,
        accepted_fabric_render_candidate_id: candidateId,
        current_private_asset_id: candidate.asset_id,
        current_public_asset_id: null,
        source_type: "ai_generated",
        updated_at: "2026-04-28T10:40:00.000Z",
      });

      return acceptedCandidate;
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

  it("returns private image previews through the admin facade", async () => {
    const store = createFakeStore();
    const input = createInput(store);

    const response = await handleGetStorageAssetPreviewRequest({
      ...input,
      assetId: "00000000-0000-4000-8000-000000000902",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    await expect(response.text()).resolves.toBe(
      "preview:00000000-0000-4000-8000-000000000902",
    );
  });

  it("does not serve public or unsupported assets through the private preview endpoint", async () => {
    const store = createFakeStore();
    const input = createInput(store);

    const response = await handleGetStorageAssetPreviewRequest({
      ...input,
      assetId: "00000000-0000-4000-8000-000000000901",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "STORAGE_ASSET_NOT_FOUND",
      },
    });
  });

  it("protects render preparation endpoints with the admin boundary", async () => {
    const store = createFakeStore();
    const createStore = vi.fn(() => store);
    const anonymousResponse = await handleGetRenderCoverageRequest({
      adminAuth: createRouteAuth({}),
      authorizationHeader: undefined,
      createStore,
      sofaId: "00000000-0000-4000-8000-000000000701",
      trustedDeviceSecret: undefined,
    });
    expect(anonymousResponse.status).toBe(401);
    expect(createStore).not.toHaveBeenCalled();

    const nonAdminResponse = await handleCreateFabricRenderJobRequest({
      ...createInput(store, nonAdminUser),
      request: jsonRequest({
        fabric_id: "00000000-0000-4000-8000-000000000903",
        generation_mode: "initial",
        prompt_note: null,
        sofa_id: "00000000-0000-4000-8000-000000000701",
        visual_matrix_column_id: "00000000-0000-4000-8000-000000000904",
      }),
    });
    expect(nonAdminResponse.status).toBe(403);
  });

  it("returns request-scoped generate-all fabric render job batches", async () => {
    const requestId = "00000000-0000-4000-8000-000000003001";
    const jobId = "00000000-0000-4000-8000-000000003002";
    const store = {
      async createFabricRenderJobsForSofa(sofaId: string) {
        return {
          fabric_render_jobs: [
            {
              attempt_count: 0,
              completed_at: null,
              created_at: "2026-04-28T10:30:00.000Z",
              fabric_id: "00000000-0000-4000-8000-000000003003",
              generation_mode: "initial",
              id: jobId,
              last_error_message: null,
              max_attempts: 3,
              prompt_note: null,
              queued_at: "2026-04-28T10:30:00.000Z",
              request_id: requestId,
              refinement_source_asset_id: null,
              refine_prompt: null,
              render_cell_id: "00000000-0000-4000-8000-000000003004",
              sofa_id: sofaId,
              status: "queued",
              updated_at: "2026-04-28T10:30:00.000Z",
              visual_matrix_column_id: "00000000-0000-4000-8000-000000003005",
            },
          ],
          job_ids: [jobId],
          request_id: requestId,
          status: "queued",
          total_jobs: 1,
        };
      },
    } as unknown as AdminCatalogStore;

    const response = await handleGenerateAllFabricRenderJobsRequest({
      ...createInput(store),
      sofaId: "00000000-0000-4000-8000-000000003006",
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        fabric_render_jobs: [
          {
            id: jobId,
            request_id: requestId,
          },
        ],
        job_ids: [jobId],
        request_id: requestId,
        status: "queued",
        total_jobs: 1,
      },
    });
  });

  it("resumes queued fabric render requests through an explicit admin action", async () => {
    const requestId = "00000000-0000-4000-8000-000000003011";
    const store = {
      async resumeFabricRenderJobs(input: { request_id?: string | null }) {
        return {
          request_ids: input.request_id ? [input.request_id] : [],
          status: input.request_id ? "started" : "noop",
          total_requests: input.request_id ? 1 : 0,
        };
      },
    } as unknown as AdminCatalogStore;

    const response = await handleResumeFabricRenderJobsRequest({
      ...createInput(store),
      request: jsonRequest({
        request_id: requestId,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        request_ids: [requestId],
        status: "started",
        total_requests: 1,
      },
    });
  });

  it("returns a new request-scoped job for manual fabric render retry", async () => {
    const requestId = "00000000-0000-4000-8000-000000003021";
    const jobId = "00000000-0000-4000-8000-000000003022";
    const store = {
      async retryFabricRenderJob() {
        return {
          attempt_count: 0,
          completed_at: null,
          created_at: "2026-04-28T10:45:00.000Z",
          fabric_id: "00000000-0000-4000-8000-000000003023",
          generation_mode: "initial",
          id: jobId,
          last_error_message: null,
          max_attempts: 3,
          prompt_note: null,
          queued_at: "2026-04-28T10:45:00.000Z",
          request_id: requestId,
          refinement_source_asset_id: null,
          refine_prompt: null,
          render_cell_id: "00000000-0000-4000-8000-000000003024",
          sofa_id: "00000000-0000-4000-8000-000000003025",
          status: "queued",
          updated_at: "2026-04-28T10:45:00.000Z",
          visual_matrix_column_id: "00000000-0000-4000-8000-000000003026",
        };
      },
    } as unknown as AdminCatalogStore;

    const response = await handleRetryFabricRenderJobRequest({
      ...createInput(store),
      jobId: "00000000-0000-4000-8000-000000003027",
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        fabric_render_job: {
          id: jobId,
          request_id: requestId,
          status: "queued",
        },
        job_id: jobId,
        request_id: requestId,
        status: "queued",
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

  it("publishes and unpublishes a sofa through the admin boundary", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createSofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Internal sofa",
          public_name: "Public sofa",
          shopify_order_url: "https://shopify.example/products/public-sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const sofaId = createSofaBody.data.sofa.id as string;

    const publishResponse = await handlePublishSofaRequest({
      ...input,
      sofaId,
    });

    expect(publishResponse.status).toBe(200);
    await expect(publishResponse.json()).resolves.toMatchObject({
      data: {
        sofa: {
          id: sofaId,
          lifecycle_state: "published",
          public_slug: "public-sofa",
        },
      },
      meta: {},
    });

    const unpublishResponse = await handleUnpublishSofaRequest({
      ...input,
      sofaId,
    });

    expect(unpublishResponse.status).toBe(200);
    await expect(unpublishResponse.json()).resolves.toMatchObject({
      data: {
        sofa: {
          id: sofaId,
          lifecycle_state: "draft",
          public_slug: "public-sofa",
        },
      },
      meta: {},
    });
  });

  it("archives a published sofa through the admin boundary", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createSofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Internal sofa",
          public_name: "Public sofa",
          shopify_order_url: "https://shopify.example/products/public-sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const sofaId = createSofaBody.data.sofa.id as string;

    await handlePublishSofaRequest({
      ...input,
      sofaId,
    });

    const archiveResponse = await handleArchiveSofaRequest({
      ...input,
      sofaId,
    });

    expect(archiveResponse.status).toBe(200);
    await expect(archiveResponse.json()).resolves.toMatchObject({
      data: {
        sofa: {
          archived_at: "2026-04-28T10:55:00.000Z",
          id: sofaId,
          lifecycle_state: "archived",
          public_slug: "public-sofa",
        },
      },
      meta: {},
    });
  });

  it("returns not found when archiving an unknown sofa", async () => {
    const response = await handleArchiveSofaRequest({
      ...createInput(createFakeStore()),
      sofaId: "00000000-0000-4000-8000-000000009999",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "SOFA_NOT_FOUND",
      },
    });
  });

  it("unarchives an archived sofa through the admin boundary", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createSofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Internal sofa",
          public_name: "Public sofa",
          shopify_order_url: "https://shopify.example/products/public-sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const sofaId = createSofaBody.data.sofa.id as string;

    await handlePublishSofaRequest({
      ...input,
      sofaId,
    });

    await handleArchiveSofaRequest({
      ...input,
      sofaId,
    });

    const unarchiveResponse = await handleUnarchiveSofaRequest({
      ...input,
      sofaId,
    });

    expect(unarchiveResponse.status).toBe(200);
    await expect(unarchiveResponse.json()).resolves.toMatchObject({
      data: {
        sofa: {
          archived_at: null,
          id: sofaId,
          lifecycle_state: "draft",
          public_slug: "public-sofa",
        },
      },
      meta: {},
    });
  });

  it("returns not found when unarchiving an unknown sofa", async () => {
    const response = await handleUnarchiveSofaRequest({
      ...createInput(createFakeStore()),
      sofaId: "00000000-0000-4000-8000-000000009999",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "SOFA_NOT_FOUND",
      },
    });
  });

  it("creates and reads a sofa render ZIP export through the admin boundary", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createSofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Internal sofa",
          public_name: "Public sofa",
          shopify_order_url: "https://shopify.example/products/public-sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const sofaId = createSofaBody.data.sofa.id as string;

    const createExportResponse = await handleCreateSofaRenderExportRequest({
      ...input,
      sofaId,
    });

    expect(createExportResponse.status).toBe(201);
    const createExportBody = await createExportResponse.json();
    expect(createExportBody).toMatchObject({
      data: {
        render_export: {
          download_url: null,
          included_render_count: 2,
          sofa_id: sofaId,
          status: "succeeded",
        },
      },
      meta: {},
    });

    const exportId = createExportBody.data.render_export.id as string;
    const getExportResponse = await handleGetSofaRenderExportRequest({
      ...input,
      exportId,
    });

    expect(getExportResponse.status).toBe(200);
    await expect(getExportResponse.json()).resolves.toMatchObject({
      data: {
        render_export: {
          download_url: "https://storage.example/signed/render-export.zip",
          id: exportId,
          included_render_count: 2,
          status: "succeeded",
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
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example");

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
    const listFabricsBody = await listFabricsResponse.json();
    expect(listFabricsBody).toMatchObject({
      data: {
        fabrics: [
          {
            id: fabricId,
            swatch_preview_url:
              "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
            swatch_asset: {
              visibility: "public",
            },
          },
        ],
      },
    });
    expect(JSON.stringify(listFabricsBody)).not.toContain("object_path");

    const getFabricResponse = await handleGetFabricRequest({
      ...input,
      fabricId,
    });
    expect(getFabricResponse.status).toBe(200);
    const getFabricBody = await getFabricResponse.json();
    expect(getFabricBody.data.fabric).toMatchObject({
      id: fabricId,
      swatch_preview_url:
        "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
    });
    expect(JSON.stringify(getFabricBody)).not.toContain("object_path");

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
            swatch_preview_url:
              "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
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

  it("runs the visual matrix, source photo, coverage, and render job flow", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createSofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Render prep sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const sofaId = createSofaBody.data.sofa.id as string;
    const createSourceFabricBody = await (
      await handleCreateFabricRequest({
        ...input,
        request: jsonRequest({
          ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
          internal_name: "Render prep source fabric",
          is_premium: false,
          public_name: "Render prep source fabric",
          swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        }),
      })
    ).json();
    const sourceFabricId = createSourceFabricBody.data.fabric.id as string;
    const createTargetFabricBody = await (
      await handleCreateFabricRequest({
        ...input,
        request: jsonRequest({
          ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
          internal_name: "Render prep target fabric",
          is_premium: false,
          public_name: "Render prep target fabric",
          swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        }),
      })
    ).json();
    const targetFabricId = createTargetFabricBody.data.fabric.id as string;

    await handleAssignSofaFabricRequest({
      ...input,
      fabricId: sourceFabricId,
      request: jsonRequest({
        public_order: 1,
      }),
      sofaId,
    });
    await handleAssignSofaFabricRequest({
      ...input,
      fabricId: targetFabricId,
      request: jsonRequest({
        public_order: 2,
      }),
      sofaId,
    });

    const createColumnResponse = await handleCreateVisualMatrixColumnRequest({
      ...input,
      request: jsonRequest({
        admin_label: "Front internal",
        public_label: "Front",
        sequence: 1,
      }),
      sofaId,
    });
    expect(createColumnResponse.status).toBe(201);
    const createColumnBody = await createColumnResponse.json();
    const columnId = createColumnBody.data.visual_matrix_column.id as string;
    expect(createColumnBody.data.visual_matrix_column).toMatchObject({
      admin_label: "Front internal",
      public_label: "Front",
      sequence: 1,
      sofa_id: sofaId,
    });

    const listColumnsResponse = await handleListVisualMatrixColumnsRequest({
      ...input,
      sofaId,
    });
    expect(listColumnsResponse.status).toBe(200);
    await expect(listColumnsResponse.json()).resolves.toMatchObject({
      data: {
        visual_matrix_columns: [
          {
            id: columnId,
          },
        ],
      },
    });

    const updateColumnResponse = await handleUpdateVisualMatrixColumnRequest({
      ...input,
      columnId,
      request: jsonRequest({
        public_label: "Front view",
      }),
    });
    expect(updateColumnResponse.status).toBe(200);
    await expect(updateColumnResponse.json()).resolves.toMatchObject({
      data: {
        visual_matrix_column: {
          id: columnId,
          public_label: "Front view",
        },
      },
    });

    const initialCoverageResponse = await handleGetRenderCoverageRequest({
      ...input,
      sofaId,
    });
    expect(initialCoverageResponse.status).toBe(200);
    const initialCoverageBody = await initialCoverageResponse.json();
    const initialSourceCell =
      initialCoverageBody.data.render_coverage.render_cells.find(
        (cell: Record<string, unknown>) => cell.fabric_id === sourceFabricId,
      );
    expect(initialSourceCell).toMatchObject({
      has_private_render: false,
      source_type: "ai_generated",
    });

    await handleCreateUploadRequest({
      ...input,
      request: jsonRequest({
        byte_size: 1900,
        content_type: "image/png",
        purpose: "manual_render",
        render_cell_id: initialSourceCell.id,
      }),
    });
    const manualAssetBody = await (
      await handleCompleteUploadRequest({
        ...input,
        uploadId: "manual-render-upload",
      })
    ).json();
    const manualSourceCellResponse = await handleSetManualRenderRequest({
      ...input,
      renderCellId: initialSourceCell.id as string,
      request: jsonRequest({
        asset_id: manualAssetBody.data.asset.id,
      }),
    });
    expect(manualSourceCellResponse.status).toBe(200);

    const sourceUploadResponse = await handleCreateUploadRequest({
      ...input,
      request: jsonRequest({
        byte_size: 1800,
        content_type: "image/png",
        original_fabric_id: sourceFabricId,
        purpose: "sofa_source_photo",
        sofa_id: sofaId,
        visual_matrix_column_id: columnId,
      }),
    });
    expect(sourceUploadResponse.status).toBe(201);
    await expect(sourceUploadResponse.json()).resolves.toMatchObject({
      data: {
        upload: {
          upload_id: "sofa-source-photo-upload",
        },
      },
    });

    const sourceCompleteResponse = await handleCompleteUploadRequest({
      ...input,
      uploadId: "sofa-source-photo-upload",
    });
    expect(sourceCompleteResponse.status).toBe(200);
    await expect(sourceCompleteResponse.json()).resolves.toMatchObject({
      data: {
        asset: {
          asset_kind: "sofa_source_photo",
          visibility: "private",
        },
      },
    });

    const coverageResponse = await handleGetRenderCoverageRequest({
      ...input,
      sofaId,
    });
    expect(coverageResponse.status).toBe(200);
    const coverageBody = await coverageResponse.json();
    const sourceCell = coverageBody.data.render_coverage.render_cells.find(
      (cell: Record<string, unknown>) => cell.fabric_id === sourceFabricId,
    );
    const targetCell = coverageBody.data.render_coverage.render_cells.find(
      (cell: Record<string, unknown>) => cell.fabric_id === targetFabricId,
    );
    expect(coverageBody.data.render_coverage.sofa_id).toBe(sofaId);
    expect(sourceCell).toMatchObject({
      can_generate_initial: false,
      fabric_id: sourceFabricId,
      has_private_render: true,
      source_type: "source_photo",
      visual_matrix_column_id: columnId,
    });
    expect(targetCell).toMatchObject({
      can_generate_initial: true,
      fabric_id: targetFabricId,
      has_private_render: false,
      source_type: "ai_generated",
      visual_matrix_column_id: columnId,
    });

    const sourceJobResponse = await handleCreateFabricRenderJobRequest({
      ...input,
      request: jsonRequest({
        fabric_id: sourceFabricId,
        generation_mode: "initial",
        prompt_note: null,
        sofa_id: sofaId,
        visual_matrix_column_id: columnId,
      }),
    });
    expect(sourceJobResponse.status).toBe(422);
    await expect(sourceJobResponse.json()).resolves.toMatchObject({
      error: {
        code: "FABRIC_RENDER_JOB_CONFLICT",
      },
    });

    const jobResponse = await handleCreateFabricRenderJobRequest({
      ...input,
      request: jsonRequest({
        fabric_id: targetFabricId,
        generation_mode: "initial",
        prompt_note: null,
        sofa_id: sofaId,
        visual_matrix_column_id: columnId,
      }),
    });
    expect(jobResponse.status).toBe(201);
    const jobBody = await jobResponse.json();
    const jobId = jobBody.data.job_id as string;
    expect(jobBody.data).toMatchObject({
      fabric_render_job: {
        request_id: jobBody.data.request_id,
      },
      request_id: expect.any(String),
      status: "queued",
    });

    const duplicateJobResponse = await handleCreateFabricRenderJobRequest({
      ...input,
      request: jsonRequest({
        fabric_id: targetFabricId,
        generation_mode: "initial",
        prompt_note: null,
        sofa_id: sofaId,
        visual_matrix_column_id: columnId,
      }),
    });
    expect(duplicateJobResponse.status).toBe(409);

    const getJobResponse = await handleGetFabricRenderJobRequest({
      ...input,
      jobId,
    });
    expect(getJobResponse.status).toBe(200);
    await expect(getJobResponse.json()).resolves.toMatchObject({
      data: {
        fabric_render_job: {
          id: jobId,
          status: "queued",
        },
      },
    });

    const deleteColumnResponse = await handleDeleteVisualMatrixColumnRequest({
      ...input,
      columnId,
    });
    expect(deleteColumnResponse.status).toBe(204);
  });

  it("runs candidate review, current selection, and manual render attachment", async () => {
    const store = createFakeStore();
    const input = createInput(store);
    const createSofaBody = await (
      await handleCreateSofaRequest({
        ...input,
        request: jsonRequest({
          internal_name: "Candidate sofa",
          tag_ids: [],
        }),
      })
    ).json();
    const sofaId = createSofaBody.data.sofa.id as string;
    const createSourceFabricBody = await (
      await handleCreateFabricRequest({
        ...input,
        request: jsonRequest({
          ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
          internal_name: "Candidate source fabric",
          is_premium: false,
          public_name: "Candidate source fabric",
          swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        }),
      })
    ).json();
    const sourceFabricId = createSourceFabricBody.data.fabric.id as string;
    const createTargetFabricBody = await (
      await handleCreateFabricRequest({
        ...input,
        request: jsonRequest({
          ai_reference_asset_id: "00000000-0000-4000-8000-000000000902",
          internal_name: "Candidate target fabric",
          is_premium: false,
          public_name: "Candidate target fabric",
          swatch_asset_id: "00000000-0000-4000-8000-000000000901",
        }),
      })
    ).json();
    const targetFabricId = createTargetFabricBody.data.fabric.id as string;

    await handleAssignSofaFabricRequest({
      ...input,
      fabricId: sourceFabricId,
      request: jsonRequest({
        public_order: 1,
      }),
      sofaId,
    });
    await handleAssignSofaFabricRequest({
      ...input,
      fabricId: targetFabricId,
      request: jsonRequest({
        public_order: 2,
      }),
      sofaId,
    });

    const createColumnBody = await (
      await handleCreateVisualMatrixColumnRequest({
        ...input,
        request: jsonRequest({
          admin_label: "Front internal",
          public_label: "Front",
          sequence: 1,
        }),
        sofaId,
      })
    ).json();
    const columnId = createColumnBody.data.visual_matrix_column.id as string;
    await handleCreateUploadRequest({
      ...input,
      request: jsonRequest({
        byte_size: 1800,
        content_type: "image/png",
        original_fabric_id: sourceFabricId,
        purpose: "sofa_source_photo",
        sofa_id: sofaId,
        visual_matrix_column_id: columnId,
      }),
    });
    await handleCompleteUploadRequest({
      ...input,
      uploadId: "sofa-source-photo-upload",
    });

    const jobBody = await (
      await handleCreateFabricRenderJobRequest({
        ...input,
        request: jsonRequest({
          fabric_id: targetFabricId,
          generation_mode: "initial",
          prompt_note: null,
          sofa_id: sofaId,
          visual_matrix_column_id: columnId,
        }),
      })
    ).json();
    const renderCellId = jobBody.data.fabric_render_job
      .render_cell_id as string;

    const candidatesResponse = await handleListRenderCellCandidatesRequest({
      ...input,
      renderCellId,
    });
    expect(candidatesResponse.status).toBe(200);
    const candidatesBody = await candidatesResponse.json();
    const candidate = candidatesBody.data.render_candidates[0];
    expect(candidate).toMatchObject({
      is_current: false,
      preview_url: null,
      render_cell_id: renderCellId,
    });
    expect(JSON.stringify(candidate)).not.toContain("object_path");

    const refineJobResponse = await handleCreateFabricRenderJobRequest({
      ...input,
      request: jsonRequest({
        fabric_id: targetFabricId,
        generation_mode: "refine",
        prompt_note: null,
        refine_prompt: "reduce wrinkles on the left arm",
        refinement_source_asset_id: candidate.asset_id,
        sofa_id: sofaId,
        visual_matrix_column_id: columnId,
      }),
    });
    expect(refineJobResponse.status).toBe(201);
    await expect(refineJobResponse.json()).resolves.toMatchObject({
      data: {
        fabric_render_job: {
          generation_mode: "refine",
          refine_prompt: "reduce wrinkles on the left arm",
          refinement_source_asset_id: candidate.asset_id,
          status: "queued",
        },
      },
    });

    const useCandidateResponse = await handleUseRenderCandidateRequest({
      ...input,
      candidateId: candidate.id,
    });
    expect(useCandidateResponse.status).toBe(200);
    await expect(useCandidateResponse.json()).resolves.toMatchObject({
      data: {
        render_candidate: {
          id: candidate.id,
          is_current: true,
        },
      },
    });

    const manualUploadResponse = await handleCreateUploadRequest({
      ...input,
      request: jsonRequest({
        byte_size: 1900,
        content_type: "image/png",
        purpose: "manual_render",
        render_cell_id: renderCellId,
      }),
    });
    expect(manualUploadResponse.status).toBe(201);
    await expect(manualUploadResponse.json()).resolves.toMatchObject({
      data: {
        upload: {
          upload_id: "manual-render-upload",
        },
      },
    });

    const manualAssetBody = await (
      await handleCompleteUploadRequest({
        ...input,
        uploadId: "manual-render-upload",
      })
    ).json();
    const manualRenderResponse = await handleSetManualRenderRequest({
      ...input,
      renderCellId,
      request: jsonRequest({
        asset_id: manualAssetBody.data.asset.id,
      }),
    });
    expect(manualRenderResponse.status).toBe(200);
    await expect(manualRenderResponse.json()).resolves.toMatchObject({
      data: {
        render_cell: {
          current_private_asset_id: manualAssetBody.data.asset.id,
          current_public_asset_id: null,
          source_type: "manual_upload",
        },
      },
    });
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
