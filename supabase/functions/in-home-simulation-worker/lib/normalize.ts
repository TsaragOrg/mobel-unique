// SPEC-0007 PLAN-0010 worker-side normalization helpers.
//
// These pure functions decide how the worker reshapes an input image
// during Stage 1 normalization and optional compression. Decoding,
// encoding, file I/O, and storage uploads stay in the Deno entry point;
// the calculation that says "the image must shrink to N pixels on the
// longest edge" lives here so it can be exercised by vitest.

export type ImageDimensions = {
  width: number;
  height: number;
};

export const DEFAULT_WORKER_MAX_EDGE_PX = 1536;
export const NORMALIZED_JPEG_QUALITY = 92;
export const COMPRESSED_JPEG_QUALITY = 82;

export function computeResizedDimensions(
  source: ImageDimensions,
  maxEdge: number
): ImageDimensions {
  if (!Number.isFinite(source.width) || source.width <= 0) {
    throw new Error("computeResizedDimensions requires a positive width");
  }
  if (!Number.isFinite(source.height) || source.height <= 0) {
    throw new Error("computeResizedDimensions requires a positive height");
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    throw new Error("computeResizedDimensions requires a positive maxEdge");
  }
  const longest = Math.max(source.width, source.height);
  if (longest <= maxEdge) {
    return { width: source.width, height: source.height };
  }
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(source.width * ratio)),
    height: Math.max(1, Math.round(source.height * ratio))
  };
}

export function shouldCompress(
  source: ImageDimensions,
  maxEdge: number
): boolean {
  return Math.max(source.width, source.height) > maxEdge;
}

export function parseMaxEdge(
  raw: string | null | undefined
): number {
  if (raw === null || raw === undefined || raw === "") {
    return DEFAULT_WORKER_MAX_EDGE_PX;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WORKER_MAX_EDGE_PX;
  }
  return parsed;
}
