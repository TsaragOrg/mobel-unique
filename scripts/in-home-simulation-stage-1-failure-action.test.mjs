import { describe, expect, it } from "vitest";

import { decideStageFailureAction } from "../supabase/functions/in-home-simulation-worker/lib/retry.ts";

describe("decideStageFailureAction", () => {
  it("releases the claim when the error is retryable and attempts remain", () => {
    const action = decideStageFailureAction(
      new Error("provider returned HTTP 502 bad gateway"),
      { stage: "stage_1", attemptCount: 1, maxAttempts: 3 }
    );

    expect(action.kind).toBe("release");
    expect(action.stage).toBe("stage_1");
    expect(action.reason).toContain("http_502");
  });

  it("releases the claim for stage_2 timeouts when attempts remain", () => {
    const action = decideStageFailureAction(
      new Error("operation timed out"),
      { stage: "stage_2", attemptCount: 2, maxAttempts: 3 }
    );

    expect(action.kind).toBe("release");
    expect(action.stage).toBe("stage_2");
    expect(action.reason).toBe("timeout");
  });

  it("fails the job when the error is retryable but attempts are exhausted", () => {
    const action = decideStageFailureAction(
      new Error("fetch failed"),
      { stage: "stage_1", attemptCount: 3, maxAttempts: 3 }
    );

    expect(action.kind).toBe("fail");
    expect(action.reason).toContain("attempts_exhausted");
  });

  it("fails the job immediately when the error is non-retryable", () => {
    const action = decideStageFailureAction(
      new Error("decode_failed: bad jpeg header"),
      { stage: "stage_1", attemptCount: 1, maxAttempts: 3 }
    );

    expect(action.kind).toBe("fail");
    expect(action.reason).toContain("decode_failed");
  });

  it("treats unknown errors as non-retryable and fails the job", () => {
    const action = decideStageFailureAction(
      new Error("undocumented internal error"),
      { stage: "stage_1", attemptCount: 1, maxAttempts: 3 }
    );

    expect(action.kind).toBe("fail");
  });

  it("rejects an invalid stage", () => {
    expect(() =>
      decideStageFailureAction(new Error("x"), {
        stage: "stage_3",
        attemptCount: 1,
        maxAttempts: 3
      })
    ).toThrow(/stage/);
  });

  it("rejects a non-positive maxAttempts", () => {
    expect(() =>
      decideStageFailureAction(new Error("x"), {
        stage: "stage_1",
        attemptCount: 1,
        maxAttempts: 0
      })
    ).toThrow(/maxAttempts/);
  });
});
