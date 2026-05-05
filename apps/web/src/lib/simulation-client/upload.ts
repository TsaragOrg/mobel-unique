// SPEC-0015 PLAN-0041 client-side uploader for the public simulation
// wizard's POST /api/public/simulations call. Uses XMLHttpRequest to
// surface real upload-progress events, retries network/5xx failures
// with the documented 1s/3s backoffs, and reuses the same
// Idempotency-Key UUID across every attempt — so a manual "Try again"
// after the retry budget is exhausted reuses the same key, letting
// the server deduplicate.
//
// The implementation accepts injected `createXhr` and `setTimeout` so
// unit tests can drive deterministic XHR lifecycles without touching
// the real network or the real timer wheel.

import type {
  CreateSimulationResponse,
  SimulationJobStatus,
  SimulationPublicErrorCode
} from "../simulation-public-api";

export const UPLOAD_DEFAULT_MAX_ATTEMPTS = 3;
export const UPLOAD_DEFAULT_BACKOFFS_MS: readonly number[] = [1000, 3000];

export interface UploadInput {
  endpoint: string;
  sofaSlug: string;
  fabricId: string;
  visualPositionId: string;
  photoBlob: Blob;
  photoFilename: string;
  idempotencyKey: string;
  accessToken?: string;
  onProgress?: (percent: number) => void;
}

export interface UploadDeps {
  createXhr: () => XMLHttpRequest;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
}

export type UploadAttemptOutcome =
  | { ok: true; payload: CreateSimulationResponse }
  | { ok: false; retryable: true; reason: "NETWORK" | "TIMEOUT" | "HTTP_5XX" }
  | {
      ok: false;
      retryable: false;
      code: SimulationPublicErrorCode | "UNKNOWN";
      httpStatus: number;
    };

export type UploadResult =
  | {
      ok: true;
      jobId: string;
      status: SimulationJobStatus;
      createdAt: string;
      retentionDeadline: string;
      attempts: number;
    }
  | {
      ok: false;
      code: SimulationPublicErrorCode | "NETWORK" | "TIMEOUT" | "UNKNOWN";
      attempts: number;
      httpStatus?: number;
      message?: string;
    };

export async function uploadRoomPhotoWithDeps(
  input: UploadInput,
  deps: UploadDeps,
  options: { maxAttempts?: number; backoffsMs?: readonly number[] } = {}
): Promise<UploadResult> {
  const maxAttempts = options.maxAttempts ?? UPLOAD_DEFAULT_MAX_ATTEMPTS;
  const backoffsMs = options.backoffsMs ?? UPLOAD_DEFAULT_BACKOFFS_MS;

  let lastRetryReason: "NETWORK" | "TIMEOUT" | "HTTP_5XX" = "NETWORK";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outcome = await runOneAttempt(input, deps);
    if (outcome.ok) {
      return {
        ok: true,
        jobId: outcome.payload.simulation_job_id,
        status: outcome.payload.status,
        createdAt: outcome.payload.created_at,
        retentionDeadline: outcome.payload.retention_deadline,
        attempts: attempt
      };
    }
    if (!outcome.retryable) {
      return {
        ok: false,
        code: outcome.code,
        attempts: attempt,
        httpStatus: outcome.httpStatus
      };
    }
    lastRetryReason = outcome.reason;
    if (attempt === maxAttempts) {
      break;
    }
    const backoffIndex = Math.min(attempt - 1, backoffsMs.length - 1);
    await new Promise<void>((resolve) => {
      deps.setTimeout(() => resolve(), backoffsMs[backoffIndex]);
    });
  }

  return {
    ok: false,
    code: lastRetryReason === "TIMEOUT" ? "TIMEOUT" : "NETWORK",
    attempts: maxAttempts
  };
}

export async function uploadRoomPhoto(input: UploadInput): Promise<UploadResult> {
  return uploadRoomPhotoWithDeps(input, defaultDeps());
}

function defaultDeps(): UploadDeps {
  return {
    createXhr: () => new XMLHttpRequest(),
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs)
  };
}

function runOneAttempt(
  input: UploadInput,
  deps: UploadDeps
): Promise<UploadAttemptOutcome> {
  return new Promise<UploadAttemptOutcome>((resolve) => {
    const xhr = deps.createXhr();
    xhr.open("POST", input.endpoint);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Idempotency-Key", input.idempotencyKey);
    if (input.accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${input.accessToken}`);
    }

    if (xhr.upload && input.onProgress) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (!event.lengthComputable || event.total === 0) {
          return;
        }
        const percent = Math.round((event.loaded / event.total) * 100);
        input.onProgress?.(clamp(percent, 0, 100));
      };
    }

    xhr.onload = () => {
      const status = xhr.status;
      const text = xhr.responseText;
      if (status >= 200 && status < 300) {
        const parsed = safeParseSuccess(text);
        if (parsed) {
          resolve({ ok: true, payload: parsed });
          return;
        }
        resolve({
          ok: false,
          retryable: false,
          code: "INTERNAL_ERROR",
          httpStatus: status
        });
        return;
      }
      if (status >= 500 && status < 600) {
        resolve({ ok: false, retryable: true, reason: "HTTP_5XX" });
        return;
      }
      resolve({
        ok: false,
        retryable: false,
        code: extractServerErrorCode(text),
        httpStatus: status
      });
    };

    xhr.onerror = () => {
      resolve({ ok: false, retryable: true, reason: "NETWORK" });
    };

    xhr.ontimeout = () => {
      resolve({ ok: false, retryable: true, reason: "TIMEOUT" });
    };

    const form = buildFormData(input);
    xhr.send(form);
  });
}

function buildFormData(input: UploadInput): FormData {
  const form = new FormData();
  form.append("sofa_slug", input.sofaSlug);
  form.append("fabric_id", input.fabricId);
  form.append("visual_position_id", input.visualPositionId);
  const file =
    input.photoBlob instanceof File
      ? input.photoBlob
      : new File([input.photoBlob], input.photoFilename, {
          type: input.photoBlob.type || "application/octet-stream"
        });
  form.append("room_photo", file, input.photoFilename);
  return form;
}

function safeParseSuccess(text: string): CreateSimulationResponse | null {
  try {
    const parsed = JSON.parse(text) as
      | Partial<CreateSimulationResponse>
      | { data?: Partial<CreateSimulationResponse> };
    const inner: Partial<CreateSimulationResponse> =
      "data" in parsed && parsed.data && typeof parsed.data === "object"
        ? parsed.data
        : (parsed as Partial<CreateSimulationResponse>);
    if (
      typeof inner.simulation_job_id === "string" &&
      typeof inner.status === "string" &&
      typeof inner.created_at === "string" &&
      typeof inner.retention_deadline === "string"
    ) {
      return inner as CreateSimulationResponse;
    }
    return null;
  } catch {
    return null;
  }
}

function extractServerErrorCode(
  text: string
): SimulationPublicErrorCode | "UNKNOWN" {
  try {
    const parsed = JSON.parse(text) as {
      error?: { code?: SimulationPublicErrorCode };
    };
    if (parsed.error?.code) {
      return parsed.error.code;
    }
  } catch {
    // fall through
  }
  return "UNKNOWN";
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
