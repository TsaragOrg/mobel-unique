import { describe, expect, it } from "vitest";

import {
  WORKER_ERROR_ARTIFACT_FILENAME,
  errorArtifactObjectPath,
  formatErrorArtifactBody
} from "../supabase/functions/in-home-simulation-worker/lib/error-artifact.ts";

describe("errorArtifactObjectPath", () => {
  it("returns the worker_error.txt path under the job storage prefix", () => {
    expect(
      errorArtifactObjectPath("simulations/abc-123")
    ).toBe(`simulations/abc-123/${WORKER_ERROR_ARTIFACT_FILENAME}`);
  });

  it("strips a trailing slash from the storage prefix", () => {
    expect(
      errorArtifactObjectPath("simulations/abc-123/")
    ).toBe(`simulations/abc-123/${WORKER_ERROR_ARTIFACT_FILENAME}`);
  });

  it("rejects an empty storage prefix", () => {
    expect(() => errorArtifactObjectPath("")).toThrow(/storage prefix/);
    expect(() => errorArtifactObjectPath(" ")).toThrow(/storage prefix/);
  });
});

describe("formatErrorArtifactBody", () => {
  it("includes job id, stage, error code, message, and timestamp", () => {
    const body = formatErrorArtifactBody({
      jobId: "abc-123",
      stage: "stage_1",
      errorCode: "decode_failed",
      errorMessage: "bad jpeg header",
      timestamp: new Date("2026-04-28T01:23:45.000Z")
    });

    expect(body).toContain("Job: abc-123");
    expect(body).toContain("Stage: stage_1");
    expect(body).toContain("Error code: decode_failed");
    expect(body).toContain("Error message: bad jpeg header");
    expect(body).toContain("Timestamp: 2026-04-28T01:23:45.000Z");
  });

  it("uses the current time when timestamp is omitted", () => {
    const before = Date.now();
    const body = formatErrorArtifactBody({
      jobId: "abc",
      stage: "stage_2",
      errorCode: "x",
      errorMessage: "y"
    });
    const after = Date.now();

    const match = body.match(/Timestamp: (.+)$/m);
    expect(match).not.toBeNull();
    const parsed = Date.parse(match[1]);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it("falls back when stage or codes are not provided", () => {
    const body = formatErrorArtifactBody({
      jobId: "abc",
      errorMessage: "unknown failure"
    });
    expect(body).toContain("Job: abc");
    expect(body).toContain("Stage: -");
    expect(body).toContain("Error code: -");
    expect(body).toContain("Error message: unknown failure");
  });

  it("rejects an empty job id or empty error message", () => {
    expect(() =>
      formatErrorArtifactBody({ jobId: "", errorMessage: "x" })
    ).toThrow(/job id/);
    expect(() =>
      formatErrorArtifactBody({ jobId: "abc", errorMessage: "" })
    ).toThrow(/error message/);
  });
});
