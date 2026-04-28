// SPEC-0007 PLAN-0010 worker_error.txt artifact helpers.
//
// SPEC-0007 Stage 1 and Stage 2 specify that the worker should persist
// a `worker_error.txt` artifact under the job storage prefix when the
// failure carries operator-readable detail. These pure helpers compute
// the object path and format the body so the Edge Function can upload
// the artifact in one consistent shape.

export const WORKER_ERROR_ARTIFACT_FILENAME = "worker_error.txt";

export function errorArtifactObjectPath(storagePrefix: string): string {
  if (
    storagePrefix === undefined ||
    storagePrefix === null ||
    typeof storagePrefix !== "string" ||
    storagePrefix.trim().length === 0
  ) {
    throw new Error("storage prefix is required");
  }
  const normalized = storagePrefix.replace(/\/+$/, "");
  return `${normalized}/${WORKER_ERROR_ARTIFACT_FILENAME}`;
}

export type ErrorArtifactInput = {
  jobId: string;
  stage?: string;
  errorCode?: string;
  errorMessage: string;
  timestamp?: Date;
};

export function formatErrorArtifactBody(input: ErrorArtifactInput): string {
  if (!input.jobId || input.jobId.trim().length === 0) {
    throw new Error("job id is required");
  }
  if (!input.errorMessage || input.errorMessage.trim().length === 0) {
    throw new Error("error message is required");
  }
  const at = input.timestamp ?? new Date();
  return [
    `Job: ${input.jobId}`,
    `Stage: ${input.stage ?? "-"}`,
    `Error code: ${input.errorCode ?? "-"}`,
    `Error message: ${input.errorMessage}`,
    `Timestamp: ${at.toISOString()}`
  ].join("\n");
}
