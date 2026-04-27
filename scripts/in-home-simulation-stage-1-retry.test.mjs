import { describe, expect, it } from "vitest";

import {
  NON_RETRYABLE_ERROR_CODES,
  classifyWorkerError,
  isRetryableError
} from "../supabase/functions/in-home-simulation-worker/lib/retry.ts";

describe("classifyWorkerError", () => {
  it("classifies network and timeout errors as retryable", () => {
    expect(
      classifyWorkerError(new Error("fetch failed: ECONNRESET"))
    ).toEqual({ kind: "retryable", reason: "network" });

    expect(
      classifyWorkerError(new Error("request timed out after 30000ms"))
    ).toEqual({ kind: "retryable", reason: "timeout" });

    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    expect(classifyWorkerError(abort).kind).toBe("retryable");
  });

  it("classifies HTTP 429 and 5xx errors as retryable", () => {
    expect(
      classifyWorkerError(new Error("provider returned HTTP 429 rate limit"))
        .kind
    ).toBe("retryable");

    expect(
      classifyWorkerError(new Error("provider returned HTTP 502 bad gateway"))
        .kind
    ).toBe("retryable");

    expect(
      classifyWorkerError(
        new Error("provider returned HTTP 503 service unavailable")
      ).kind
    ).toBe("retryable");
  });

  it("classifies HTTP 4xx (except 429) as non-retryable", () => {
    expect(
      classifyWorkerError(new Error("provider returned HTTP 400 bad request"))
        .kind
    ).toBe("non_retryable");

    expect(
      classifyWorkerError(new Error("provider returned HTTP 401 unauthorized"))
        .kind
    ).toBe("non_retryable");

    expect(
      classifyWorkerError(new Error("provider returned HTTP 403 forbidden"))
        .kind
    ).toBe("non_retryable");
  });

  it("classifies the documented non-retryable error codes as non-retryable", () => {
    for (const code of NON_RETRYABLE_ERROR_CODES) {
      const error = new Error(`worker reported ${code}`);
      const result = classifyWorkerError(error);
      expect(result.kind).toBe("non_retryable");
    }
  });

  it("treats unknown errors as non-retryable by default", () => {
    expect(
      classifyWorkerError(new Error("totally unexpected error message")).kind
    ).toBe("non_retryable");
  });

  it("accepts a non-Error value defensively", () => {
    expect(classifyWorkerError("string error").kind).toBe("non_retryable");
    expect(classifyWorkerError(undefined).kind).toBe("non_retryable");
    expect(classifyWorkerError(null).kind).toBe("non_retryable");
  });
});

describe("isRetryableError shortcut", () => {
  it("returns true for retryable errors", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError(new Error("decode_failed"))).toBe(false);
  });
});
