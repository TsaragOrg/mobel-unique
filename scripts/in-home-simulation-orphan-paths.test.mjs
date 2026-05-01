import { describe, expect, it } from "vitest";

import {
  extractJobIdFromUploadPath,
  isLikelyUploadPath
} from "../supabase/functions/in-home-simulation-worker/lib/orphan-paths.ts";

const VALID_UUID = "00000000-0000-4000-8000-000000000abc";

describe("extractJobIdFromUploadPath", () => {
  it("extracts the job id from a Stage 1 input path", () => {
    expect(
      extractJobIdFromUploadPath(`simulations/${VALID_UUID}/inputs/room.jpg`)
    ).toBe(VALID_UUID);
  });

  it("extracts the job id from a nested input file", () => {
    expect(
      extractJobIdFromUploadPath(
        `simulations/${VALID_UUID}/inputs/subdir/room.png`
      )
    ).toBe(VALID_UUID);
  });

  it("returns null for non-input artifacts", () => {
    expect(
      extractJobIdFromUploadPath(
        `simulations/${VALID_UUID}/room_normalized.jpg`
      )
    ).toBeNull();
    expect(
      extractJobIdFromUploadPath(
        `simulations/${VALID_UUID}/outputs/output-0.png`
      )
    ).toBeNull();
  });

  it("returns null when the path is not under simulations/", () => {
    expect(
      extractJobIdFromUploadPath(`other-bucket/${VALID_UUID}/inputs/room.jpg`)
    ).toBeNull();
  });

  it("returns null when the second segment is not a UUID", () => {
    expect(
      extractJobIdFromUploadPath("simulations/not-a-uuid/inputs/room.jpg")
    ).toBeNull();
  });

  it("returns null defensively for non-string input", () => {
    expect(extractJobIdFromUploadPath(null)).toBeNull();
    expect(extractJobIdFromUploadPath(undefined)).toBeNull();
    expect(extractJobIdFromUploadPath("")).toBeNull();
  });
});

describe("isLikelyUploadPath", () => {
  it("returns true for input paths", () => {
    expect(
      isLikelyUploadPath(`simulations/${VALID_UUID}/inputs/room.jpg`)
    ).toBe(true);
  });

  it("returns false for outputs and intermediates", () => {
    expect(
      isLikelyUploadPath(`simulations/${VALID_UUID}/outputs/output-0.png`)
    ).toBe(false);
    expect(
      isLikelyUploadPath(`simulations/${VALID_UUID}/room_cleaned.png`)
    ).toBe(false);
  });
});
