// SPEC-0007 PLAN-0012 retry classifier.
//
// The Edge Function uses these helpers to decide, after a failure,
// whether to release the claim so the pgmq message can retry the same
// stage or to mark the job as `failed`. The categories follow
// `SPEC-0007 Retries`.

export type RetryClassification =
  | { kind: "retryable"; reason: string }
  | { kind: "non_retryable"; reason: string };

export const NON_RETRYABLE_ERROR_CODES = [
  "missing_input",
  "decode_failed",
  "cleaning_decode_failed",
  "cleaning_failed",
  "placement_decode_failed",
  "provider_no_image_data",
  "unsupported_format",
  "validation_rejected",
  "missing_env",
  "regeneration_cap_exceeded",
  "retention_deadline_passed",
  "geometry_detection_failed",
  "placement_failed"
] as const;

const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504, 522, 524]);

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function nameOf(error: unknown): string {
  if (error instanceof Error) return error.name;
  return "";
}

function detectHttpStatus(message: string): number | null {
  const match = message.match(/HTTP\s+(\d{3})/i);
  if (!match) return null;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
}

export function classifyWorkerError(error: unknown): RetryClassification {
  const message = messageOf(error).toLowerCase();
  const name = nameOf(error);

  if (!message && !name) {
    return { kind: "non_retryable", reason: "unknown error" };
  }

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return { kind: "retryable", reason: "timeout" };
  }

  if (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("network") ||
    message.includes("socket hang up")
  ) {
    return { kind: "retryable", reason: "network" };
  }

  const status = detectHttpStatus(message);
  if (status !== null) {
    if (RETRYABLE_HTTP_STATUSES.has(status)) {
      return { kind: "retryable", reason: `http_${status}` };
    }
    if (status >= 400 && status < 500) {
      return { kind: "non_retryable", reason: `http_${status}` };
    }
  }

  for (const code of NON_RETRYABLE_ERROR_CODES) {
    if (message.includes(code)) {
      return { kind: "non_retryable", reason: code };
    }
  }

  return { kind: "non_retryable", reason: "unknown" };
}

export function isRetryableError(error: unknown): boolean {
  return classifyWorkerError(error).kind === "retryable";
}

export type StageName = "stage_1" | "stage_2";

export type StageFailureAction =
  | { kind: "release"; stage: StageName; reason: string }
  | { kind: "fail"; reason: string };

export type StageFailureContext = {
  stage: StageName;
  attemptCount: number;
  maxAttempts: number;
};

export function decideStageFailureAction(
  error: unknown,
  context: StageFailureContext
): StageFailureAction {
  if (context.stage !== "stage_1" && context.stage !== "stage_2") {
    throw new Error(`unknown stage: ${context.stage}`);
  }
  if (
    !Number.isFinite(context.maxAttempts) ||
    context.maxAttempts <= 0
  ) {
    throw new Error("maxAttempts must be a positive integer");
  }

  const classification = classifyWorkerError(error);

  if (classification.kind === "non_retryable") {
    return { kind: "fail", reason: classification.reason };
  }

  if (context.attemptCount >= context.maxAttempts) {
    return {
      kind: "fail",
      reason: `attempts_exhausted (${classification.reason})`
    };
  }

  return {
    kind: "release",
    stage: context.stage,
    reason: classification.reason
  };
}
