export type FabricRenderGenerationMode = "initial" | "refine";

export type ImageMetadata = {
  widthPx: number | null | undefined;
  heightPx: number | null | undefined;
};

export type FabricRenderJobInputMetadata = {
  generationMode: FabricRenderGenerationMode;
  targetSofa: ImageMetadata;
  fabricReference: ImageMetadata;
  refinementSource?: ImageMetadata | null;
};

export type FabricRenderCandidateOutputPathInput = {
  sofaId: string;
  fabricId: string;
  visualMatrixColumnId: string;
  jobId: string;
};

export class FabricRenderJobValidationError extends Error {
  retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "FabricRenderJobValidationError";
  }
}

export function buildFabricRenderCandidateOutputPath(
  input: FabricRenderCandidateOutputPathInput
): string {
  return [
    "renders",
    input.sofaId,
    input.fabricId,
    input.visualMatrixColumnId,
    "candidates",
    input.jobId,
    "output.png"
  ].join("/");
}

export function validateFabricRenderJobInputs(
  input: FabricRenderJobInputMetadata
): void {
  validateImageMetadata("target sofa", input.targetSofa);
  validateImageMetadata("fabric reference", input.fabricReference);

  if (input.generationMode === "initial" && input.refinementSource) {
    throw new FabricRenderJobValidationError(
      "refinement source is not allowed for initial mode"
    );
  }

  if (input.generationMode === "refine" && !input.refinementSource) {
    throw new FabricRenderJobValidationError(
      "refinement source is required for refine mode"
    );
  }

  if (input.generationMode === "refine" && input.refinementSource) {
    validateImageMetadata("refinement source", input.refinementSource);
  }
}

function validateImageMetadata(label: string, metadata: ImageMetadata): void {
  const width = metadata.widthPx;
  const height = metadata.heightPx;

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new FabricRenderJobValidationError(
      `${label} width and height are required`
    );
  }

  if ((width as number) <= 0 || (height as number) <= 0) {
    throw new FabricRenderJobValidationError(
      `${label} width and height must be positive`
    );
  }

  if (Math.max(width as number, height as number) > 2048) {
    throw new FabricRenderJobValidationError(`${label} exceeds 2048 px`);
  }
}
