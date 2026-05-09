export type SofaEditTabKey =
  | "basics"
  | "fabrics"
  | "visual_matrix"
  | "renders"
  | "publish";

export type SofaEditReadinessKind = "ready" | "missing" | "partial" | "blocked";

export type RenderCellDisplayStatus =
  | "ready"
  | "missing"
  | "candidate"
  | "blocked"
  | "queued"
  | "processing"
  | "failed";

export type RenderCellPrimaryAction = {
  label: string;
  targetTab?: SofaEditTabKey;
};

type RenderCellStatusInput = {
  blockers: string[];
  candidate_count: number;
  has_private_render: boolean;
  has_public_render: boolean;
  latest_job: { status?: string | null } | null;
};

export function getRenderCellDisplayStatus(
  cell: RenderCellStatusInput,
): RenderCellDisplayStatus {
  if (cell.latest_job?.status === "queued") {
    return "queued";
  }

  if (cell.latest_job?.status === "processing") {
    return "processing";
  }

  if (cell.has_public_render || cell.has_private_render) {
    return "ready";
  }

  const displayBlockers = getRenderCellDisplayBlockers(cell.blockers);

  if (displayBlockers.length > 0) {
    return "blocked";
  }

  if (cell.candidate_count > 0) {
    return "candidate";
  }

  if (cell.latest_job?.status === "failed") {
    return "failed";
  }

  return "missing";
}

export function getRenderCellDisplayBlockers(blockers: string[]) {
  return blockers.filter(
    (blocker) =>
      blocker !== "ACTIVE_RENDER_JOB_EXISTS" &&
      blocker !== "SOURCE_PHOTO_RENDER_COMPLETE",
  );
}

export function getRenderCellPrimaryAction(
  status: RenderCellDisplayStatus,
): RenderCellPrimaryAction | null {
  switch (status) {
    case "blocked":
      return {
        label: "Go to View columns",
        targetTab: "visual_matrix",
      };
    case "candidate":
      return {
        label: "Review candidates",
      };
    case "failed":
      return {
        label: "Retry generation",
      };
    case "queued":
      return {
        label: "Resume generation",
      };
    case "processing":
      return null;
    case "ready":
      return {
        label: "View current render",
      };
    case "missing":
      return {
        label: "Generate",
      };
  }
}

export function buildSofaEditTabReadiness(input: {
  publicationReadiness: { ready: boolean } | null;
  renderCells: RenderCellStatusInput[] | null;
  sofa: { internal_name: string | null };
  sofaFabrics: Array<{
    fabric: { ai_reference_asset: unknown } | null;
  }>;
  visualMatrixColumns: Array<{
    current_source_photo_id: string | null;
  }>;
}): Record<SofaEditTabKey, SofaEditReadinessKind> {
  const basics = input.sofa.internal_name?.trim() ? "ready" : "missing";
  const fabrics =
    input.sofaFabrics.length === 0
      ? "missing"
      : input.sofaFabrics.some(
            (sofaFabric) => !sofaFabric.fabric?.ai_reference_asset,
          )
        ? "blocked"
        : "ready";
  const visualMatrix =
    input.visualMatrixColumns.length === 0
      ? "missing"
      : input.visualMatrixColumns.some(
            (column) => !column.current_source_photo_id,
          )
        ? "partial"
        : "ready";
  const renderStatuses = input.renderCells?.map(getRenderCellDisplayStatus);
  const renders =
    !renderStatuses || renderStatuses.length === 0
      ? "missing"
      : renderStatuses.some((status) => status === "blocked")
        ? "blocked"
        : renderStatuses.some((status) => status !== "ready")
          ? "partial"
          : "ready";
  const publish = input.publicationReadiness?.ready ? "ready" : "blocked";

  return {
    basics,
    fabrics,
    publish,
    renders,
    visual_matrix: visualMatrix,
  };
}

export function getPublicationBlockerTarget(code: string): SofaEditTabKey {
  if (
    code.includes("FABRIC") ||
    code.includes("SWATCH") ||
    code.includes("AI_REFERENCE")
  ) {
    return "fabrics";
  }

  if (code.includes("SOURCE_PHOTO") || code.includes("VISUAL_MATRIX")) {
    return "visual_matrix";
  }

  if (code.includes("RENDER")) {
    return "renders";
  }

  return "basics";
}
