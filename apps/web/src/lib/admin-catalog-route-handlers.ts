import { type createAdminAuth } from "./admin-auth";
import { formatAdminErrorCodeMessage } from "../app/admin/admin-copy";
import {
  AdminCatalogOperationError,
  shapeFabricRenderCandidateResponse,
  shapeFabricRenderJobResponse,
  shapeFabricResponse,
  shapeRenderCellResponse,
  shapeRenderCoverageResponse,
  shapeSofaResponse,
  shapeSofaFabricResponse,
  shapeSofaRenderExportResponse,
  shapeStorageAssetResponse,
  shapeTagResponse,
  shapeUploadResponse,
  shapeVisualMatrixColumnResponse,
  validateFabricCreatePayload,
  validateFabricPatchPayload,
  validateFabricRenderJobCreatePayload,
  validateFabricRenderResumePayload,
  validateManualRenderMutationPayload,
  validateSofaFabricMutationPayload,
  validateSofaCreatePayload,
  validateSofaPatchPayload,
  validateTagMutationPayload,
  validateUploadCreatePayload,
  validateVisualMatrixColumnCreatePayload,
  validateVisualMatrixColumnPatchPayload,
  type AdminCatalogOperationErrorData,
  type AdminCatalogStore,
  type AdminFabricRenderJobBatchRecord,
  type AdminFabricRenderResumeRecord,
} from "./admin-catalog";
import type { CatalogImageDeliveryVariant } from "./catalog-image-variants";

export type { AdminCatalogStore } from "./admin-catalog";

type AdminAuth = ReturnType<typeof createAdminAuth>;

interface BaseInput {
  adminAuth: AdminAuth;
  authorizationHeader: string | undefined;
  createStore: () => AdminCatalogStore;
  trustedDeviceSecret: string | undefined;
}

type RequestInput = BaseInput & {
  request: Request;
};

type SofaInput = BaseInput & {
  sofaId: string;
};

type StorageAssetInput = BaseInput & {
  assetId: string;
  variant?: string | null;
};

type RenderExportInput = BaseInput & {
  exportId: string;
};

type SofaRequestInput = RequestInput & {
  sofaId: string;
};

type FabricInput = BaseInput & {
  fabricId: string;
};

type FabricRequestInput = RequestInput & {
  fabricId: string;
};

type SofaFabricInput = BaseInput & {
  fabricId: string;
  sofaId: string;
};

type SofaFabricRequestInput = RequestInput & {
  fabricId: string;
  sofaId: string;
};

type UploadInput = BaseInput & {
  uploadId: string;
};

type VisualMatrixColumnInput = BaseInput & {
  columnId: string;
};

type VisualMatrixColumnRequestInput = RequestInput & {
  columnId: string;
};

type FabricRenderJobInput = BaseInput & {
  jobId: string;
};

type RenderCellInput = BaseInput & {
  renderCellId: string;
};

type RenderCellRequestInput = RequestInput & {
  renderCellId: string;
};

type RenderCandidateInput = BaseInput & {
  candidateId: string;
};

type TagInput = BaseInput & {
  tagId: string;
};

type TagRequestInput = RequestInput & {
  tagId: string;
};

export async function handleListSofasRequest(input: BaseInput) {
  return withAuthorizedStore(input, async (store) => {
    const sofas = await store.listSofas();

    return jsonResponse(
      {
        data: {
          sofas: sofas.map(shapeSofaResponse),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleCreateSofaRequest(input: RequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateSofaCreatePayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const sofa = await store.createSofa(validation.value);

    return jsonResponse(
      {
        data: {
          sofa: shapeSofaResponse(sofa),
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleGetSofaRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const sofa = await store.getSofa(input.sofaId);

    if (!sofa) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    return jsonResponse(
      {
        data: {
          sofa: shapeSofaResponse(sofa),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleUpdateSofaRequest(input: SofaRequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateSofaPatchPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const sofa = await store.updateSofa(input.sofaId, validation.value);

    if (!sofa) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    return jsonResponse(
      {
        data: {
          sofa: shapeSofaResponse(sofa),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleGetSofaPublicationReadinessRequest(
  input: SofaInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const readiness = await store.getSofaPublicationReadiness(input.sofaId);

    if (!readiness) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    return jsonResponse(
      {
        data: {
          readiness,
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handlePublishSofaRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.publishSofa(input.sofaId);

    if (!result) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          sofa: shapeSofaResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleArchiveSofaRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.archiveSofa(input.sofaId);

    if (!result) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          sofa: shapeSofaResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleUnarchiveSofaRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.unarchiveSofa(input.sofaId);

    if (!result) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          sofa: shapeSofaResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleUnpublishSofaRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.unpublishSofa(input.sofaId);

    if (!result) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          sofa: shapeSofaResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleCreateSofaRenderExportRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.createSofaRenderExport(input.sofaId);

    if (!result) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          render_export: shapeSofaRenderExportResponse(result),
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleGetSofaRenderExportRequest(
  input: RenderExportInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const renderExport = await store.getSofaRenderExport(input.exportId);

    if (!renderExport) {
      return notFoundResponse(
        "SOFA_RENDER_EXPORT_NOT_FOUND",
        "Sofa render export was not found.",
      );
    }

    return jsonResponse(
      {
        data: {
          render_export: shapeSofaRenderExportResponse(renderExport),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleGetStorageAssetPreviewRequest(
  input: StorageAssetInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const variant = parseStorageAssetPreviewVariant(input.variant);

    if (!variant.ok) {
      return validationResponse(variant);
    }

    const preview = await store.getStorageAssetPreview(
      input.assetId,
      variant.value,
    );

    if (!preview) {
      return notFoundResponse(
        "STORAGE_ASSET_NOT_FOUND",
        "Storage asset was not found.",
      );
    }

    return new Response(await preview.body.arrayBuffer(), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": preview.content_type,
      },
      status: 200,
    });
  });
}

export async function handleListVisualMatrixColumnsRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const columns = await store.listVisualMatrixColumns(input.sofaId);

    if (!columns) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    return jsonResponse(
      {
        data: {
          visual_matrix_columns: columns.map(shapeVisualMatrixColumnResponse),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleCreateVisualMatrixColumnRequest(
  input: SofaRequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateVisualMatrixColumnCreatePayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const result = await store.createVisualMatrixColumn(
      input.sofaId,
      validation.value,
    );

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          visual_matrix_column: shapeVisualMatrixColumnResponse(result),
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleUpdateVisualMatrixColumnRequest(
  input: VisualMatrixColumnRequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateVisualMatrixColumnPatchPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const result = await store.updateVisualMatrixColumn(
      input.columnId,
      validation.value,
    );

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          visual_matrix_column: shapeVisualMatrixColumnResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleDeleteVisualMatrixColumnRequest(
  input: VisualMatrixColumnInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const error = await store.deleteVisualMatrixColumn(input.columnId);

    if (error) {
      return catalogErrorResponse(error);
    }

    return new Response(null, {
      headers: {
        "Cache-Control": "no-store",
      },
      status: 204,
    });
  });
}

export async function handleGetRenderCoverageRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const coverage = await store.getRenderCoverage(input.sofaId);

    if (!coverage) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    return jsonResponse(
      {
        data: {
          render_coverage: shapeRenderCoverageResponse(coverage),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleCreateFabricRenderJobRequest(input: RequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateFabricRenderJobCreatePayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const result = await store.createFabricRenderJob(validation.value);

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    const fabricRenderJob = shapeFabricRenderJobResponse(result);

    return jsonResponse(
      {
        data: {
          fabric_render_job: fabricRenderJob,
          job_id: fabricRenderJob?.id,
          request_id: fabricRenderJob?.request_id,
          status: fabricRenderJob?.status,
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleGenerateAllFabricRenderJobsRequest(
  input: SofaInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.createFabricRenderJobsForSofa(input.sofaId);

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    const batch = result as AdminFabricRenderJobBatchRecord;
    const status = batch.status === "queued" ? 201 : 200;

    return jsonResponse(
      {
        data: {
          fabric_render_jobs: batch.fabric_render_jobs.map(
            shapeFabricRenderJobResponse,
          ),
          job_ids: batch.job_ids,
          request_id: batch.request_id,
          status: batch.status,
          total_jobs: batch.total_jobs,
        },
        meta: {},
      },
      status,
    );
  });
}

export async function handleResumeFabricRenderJobsRequest(input: RequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateFabricRenderResumePayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const result = await store.resumeFabricRenderJobs(validation.value);

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    const resume = result as AdminFabricRenderResumeRecord;

    return jsonResponse(
      {
        data: {
          ...(resume.preferred_job_id
            ? { preferred_job_id: resume.preferred_job_id }
            : {}),
          ...(resume.render_cell_id
            ? { render_cell_id: resume.render_cell_id }
            : {}),
          request_ids: resume.request_ids,
          status: resume.status,
          total_requests: resume.total_requests,
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleRetryFabricRenderJobRequest(
  input: FabricRenderJobInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.retryFabricRenderJob(input.jobId);

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    const fabricRenderJob = shapeFabricRenderJobResponse(result);

    return jsonResponse(
      {
        data: {
          fabric_render_job: fabricRenderJob,
          job_id: fabricRenderJob?.id,
          request_id: fabricRenderJob?.request_id,
          status: fabricRenderJob?.status,
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleGetFabricRenderJobRequest(
  input: FabricRenderJobInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const job = await store.getFabricRenderJob(input.jobId);

    if (!job) {
      return notFoundResponse(
        "FABRIC_RENDER_JOB_NOT_FOUND",
        "Fabric render job was not found.",
      );
    }

    return jsonResponse(
      {
        data: {
          fabric_render_job: shapeFabricRenderJobResponse(job),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleListRenderCellCandidatesRequest(
  input: RenderCellInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const candidates = await store.listRenderCellCandidates(input.renderCellId);

    if (!candidates) {
      return notFoundResponse(
        "RENDER_CELL_NOT_FOUND",
        "Render cell was not found.",
      );
    }

    return jsonResponse(
      {
        data: {
          render_candidates: candidates.map(shapeFabricRenderCandidateResponse),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleUseRenderCandidateRequest(
  input: RenderCandidateInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.useRenderCandidate(input.candidateId);

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          render_candidate: shapeFabricRenderCandidateResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleSetManualRenderRequest(
  input: RenderCellRequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateManualRenderMutationPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const result = await store.setManualRender(
      input.renderCellId,
      validation.value,
    );

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          render_cell: shapeRenderCellResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleCreateUploadRequest(input: RequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateUploadCreatePayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const upload = await store.createUpload(validation.value);

    return jsonResponse(
      {
        data: {
          upload: shapeUploadResponse(upload),
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleCompleteUploadRequest(input: UploadInput) {
  return withAuthorizedStore(input, async (store) => {
    const result = await store.completeUpload(input.uploadId);

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          asset: shapeStorageAssetResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleListFabricsRequest(input: BaseInput) {
  return withAuthorizedStore(input, async (store) => {
    const fabrics = await store.listFabrics();

    return jsonResponse(
      {
        data: {
          fabrics: fabrics.map(shapeFabricResponse),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleCreateFabricRequest(input: RequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateFabricCreatePayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const fabric = await store.createFabric(validation.value);

    return jsonResponse(
      {
        data: {
          fabric: shapeFabricResponse(fabric),
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleGetFabricRequest(input: FabricInput) {
  return withAuthorizedStore(input, async (store) => {
    const fabric = await store.getFabric(input.fabricId);

    if (!fabric) {
      return notFoundResponse("FABRIC_NOT_FOUND", "Fabric was not found.");
    }

    return jsonResponse(
      {
        data: {
          fabric: shapeFabricResponse(fabric),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleUpdateFabricRequest(input: FabricRequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateFabricPatchPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const fabric = await store.updateFabric(input.fabricId, validation.value);

    if (!fabric) {
      return notFoundResponse("FABRIC_NOT_FOUND", "Fabric was not found.");
    }

    return jsonResponse(
      {
        data: {
          fabric: shapeFabricResponse(fabric),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleArchiveFabricRequest(input: FabricInput) {
  return withAuthorizedStore(input, async (store) => {
    const fabric = await store.archiveFabric(input.fabricId);

    if (!fabric) {
      return notFoundResponse("FABRIC_NOT_FOUND", "Fabric was not found.");
    }

    return jsonResponse(
      {
        data: {
          fabric: shapeFabricResponse(fabric),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleListSofaFabricsRequest(input: SofaInput) {
  return withAuthorizedStore(input, async (store) => {
    const sofaFabrics = await store.listSofaFabrics(input.sofaId);

    if (!sofaFabrics) {
      return notFoundResponse("SOFA_NOT_FOUND", "Sofa was not found.");
    }

    return jsonResponse(
      {
        data: {
          sofa_fabrics: sofaFabrics.map(shapeSofaFabricResponse),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleAssignSofaFabricRequest(
  input: SofaFabricRequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateSofaFabricMutationPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const result = await store.assignSofaFabric(
      input.sofaId,
      input.fabricId,
      validation.value,
    );

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          sofa_fabric: shapeSofaFabricResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleUpdateSofaFabricRequest(
  input: SofaFabricRequestInput,
) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateSofaFabricMutationPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const result = await store.updateSofaFabric(
      input.sofaId,
      input.fabricId,
      validation.value,
    );

    if (isCatalogError(result)) {
      return catalogErrorResponse(result);
    }

    return jsonResponse(
      {
        data: {
          sofa_fabric: shapeSofaFabricResponse(result),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleRemoveSofaFabricRequest(input: SofaFabricInput) {
  return withAuthorizedStore(input, async (store) => {
    const error = await store.removeSofaFabric(input.sofaId, input.fabricId);

    if (error) {
      return catalogErrorResponse(error);
    }

    return new Response(null, {
      headers: {
        "Cache-Control": "no-store",
      },
      status: 204,
    });
  });
}

export async function handleListTagsRequest(input: BaseInput) {
  return withAuthorizedStore(input, async (store) => {
    const tags = await store.listTags();

    return jsonResponse(
      {
        data: {
          tags: tags.map(shapeTagResponse),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleCreateTagRequest(input: RequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateTagMutationPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const tag = await store.createTag(validation.value);

    return jsonResponse(
      {
        data: {
          tag: shapeTagResponse(tag),
        },
        meta: {},
      },
      201,
    );
  });
}

export async function handleUpdateTagRequest(input: TagRequestInput) {
  return withAuthorizedStore(input, async (store) => {
    const body = await readJsonObject(input.request);

    if (!body.ok) {
      return validationResponse(body);
    }

    const validation = validateTagMutationPayload(body.value);

    if (!validation.ok) {
      return validationResponse(validation);
    }

    const tag = await store.updateTag(input.tagId, validation.value);

    if (!tag) {
      return notFoundResponse("TAG_NOT_FOUND", "Tag was not found.");
    }

    return jsonResponse(
      {
        data: {
          tag: shapeTagResponse(tag),
        },
        meta: {},
      },
      200,
    );
  });
}

export async function handleDeleteTagRequest(input: TagInput) {
  return withAuthorizedStore(input, async (store) => {
    const error = await store.deleteTag(input.tagId);

    if (error) {
      return catalogErrorResponse(error);
    }

    return new Response(null, {
      headers: {
        "Cache-Control": "no-store",
      },
      status: 204,
    });
  });
}

async function withAuthorizedStore(
  input: BaseInput,
  callback: (store: AdminCatalogStore) => Promise<Response>,
) {
  try {
    const authorization = await input.adminAuth.authorizeRequest({
      authorizationHeader: input.authorizationHeader,
      trustedDeviceSecret: input.trustedDeviceSecret,
    });

    if (!authorization.ok) {
      return jsonResponse(
        {
          error: authorization.error,
        },
        authorization.status,
      );
    }

    return await callback(input.createStore());
  } catch (error) {
    if (error instanceof AdminCatalogOperationError) {
      return catalogErrorResponse(error);
    }

    return catalogErrorResponse({
      code: "CATALOG_UNAVAILABLE",
      message: "Catalog service is unavailable.",
      status: 500,
    });
  }
}

async function readJsonObject(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        details: {},
        message: "Request body must be JSON.",
      },
      ok: false as const,
      status: 415 as const,
    };
  }

  try {
    const value = await request.json();

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {
        error: {
          code: "INVALID_REQUEST",
          details: {},
          message: "Request body must be a JSON object.",
        },
        ok: false as const,
        status: 400 as const,
      };
    }

    return {
      ok: true as const,
      value,
    };
  } catch {
    return {
      error: {
        code: "INVALID_JSON",
        details: {},
        message: "Request body must be valid JSON.",
      },
      ok: false as const,
      status: 400 as const,
    };
  }
}

function validationResponse(input: {
  error: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
  };
  status: number;
}) {
  return jsonResponse(
    {
      error: {
        ...input.error,
        message: formatAdminErrorCodeMessage(input.error.code),
      },
    },
    input.status,
  );
}

function parseStorageAssetPreviewVariant(input: string | null | undefined):
  | {
      ok: true;
      value: CatalogImageDeliveryVariant;
    }
  | {
      error: {
        code: string;
        details: Record<string, unknown>;
        message: string;
      };
      ok: false;
      status: 400;
    } {
  if (!input) {
    return {
      ok: true,
      value: "original",
    };
  }

  if (input === "original" || input === "small" || input === "medium") {
    return {
      ok: true,
      value: input,
    };
  }

  return {
    error: {
      code: "INVALID_STORAGE_ASSET_VARIANT",
      details: {
        variant: input,
      },
      message: "Storage asset preview variant is not supported.",
    },
    ok: false,
    status: 400,
  };
}

function notFoundResponse(code: string, _message: string) {
  return jsonResponse(
    {
      error: {
        code,
        message: formatAdminErrorCodeMessage(code),
      },
    },
    404,
  );
}

function isCatalogError(
  value: unknown,
): value is AdminCatalogOperationErrorData {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    "status" in value
  );
}

function catalogErrorResponse(error: AdminCatalogOperationErrorData) {
  return jsonResponse(
    {
      error: {
        code: error.code,
        details: error.details ?? {},
        message: formatAdminErrorCodeMessage(error.code),
      },
    },
    error.status,
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
    status,
  });
}
