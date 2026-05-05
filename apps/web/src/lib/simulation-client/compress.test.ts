import { describe, expect, it, vi } from "vitest";

import {
  COMPRESS_DEFAULT_JPEG_QUALITY,
  COMPRESS_DEFAULT_MAX_EDGE_PX,
  COMPRESS_DEFAULT_MIN_BYTES,
  compressRoomPhotoWithDeps,
  type CompressDeps
} from "./compress";

interface FakeBitmap {
  width: number;
  height: number;
  close: () => void;
}

function fakeFile(name: string, type: string, bytes: number): File {
  const buffer = new ArrayBuffer(bytes);
  return new File([buffer], name, { type });
}

function makeDeps(overrides: Partial<CompressDeps> = {}): {
  deps: CompressDeps;
  drawCalls: Array<{
    width: number;
    height: number;
    mimeType: string;
    quality: number;
  }>;
} {
  const drawCalls: Array<{
    width: number;
    height: number;
    mimeType: string;
    quality: number;
  }> = [];
  const defaultDeps: CompressDeps = {
    createImageBitmap: vi.fn(
      async (_blob: Blob, _opts?: ImageBitmapOptions): Promise<FakeBitmap> => ({
        width: 3200,
        height: 2400,
        close: () => undefined
      })
    ),
    drawToBlob: vi.fn(
      async (
        _bitmap: FakeBitmap,
        width: number,
        height: number,
        mimeType: string,
        quality: number
      ): Promise<Blob> => {
        drawCalls.push({ width, height, mimeType, quality });
        return new Blob([new ArrayBuffer(width * height)], { type: mimeType });
      }
    )
  };
  return {
    drawCalls,
    deps: { ...defaultDeps, ...overrides }
  };
}

describe("compressRoomPhotoWithDeps", () => {
  it("downscales a 3200x2400 image to a 1600 max edge at JPEG 0.85", async () => {
    const file = fakeFile("room.jpg", "image/jpeg", 4_000_000);
    const { deps, drawCalls } = makeDeps();

    const result = await compressRoomPhotoWithDeps(file, {}, deps);

    expect(drawCalls).toHaveLength(1);
    expect(drawCalls[0].width).toBe(COMPRESS_DEFAULT_MAX_EDGE_PX);
    expect(drawCalls[0].height).toBe(1200);
    expect(drawCalls[0].mimeType).toBe("image/jpeg");
    expect(drawCalls[0].quality).toBe(COMPRESS_DEFAULT_JPEG_QUALITY);
    expect(result.sourceUsed).toBe("compressed");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.width).toBe(COMPRESS_DEFAULT_MAX_EDGE_PX);
    expect(result.height).toBe(1200);
  });

  it("downscales a portrait 1200x2400 image so the long edge is 1600", async () => {
    const file = fakeFile("portrait.jpg", "image/jpeg", 4_000_000);
    const { deps, drawCalls } = makeDeps({
      createImageBitmap: vi.fn(async () => ({
        width: 1200,
        height: 2400,
        close: () => undefined
      }))
    });

    await compressRoomPhotoWithDeps(file, {}, deps);

    expect(drawCalls[0].width).toBe(800);
    expect(drawCalls[0].height).toBe(COMPRESS_DEFAULT_MAX_EDGE_PX);
  });

  it("does not upscale an image whose largest edge is below the maximum", async () => {
    const file = fakeFile("small.jpg", "image/jpeg", 1_000_000);
    const { deps, drawCalls } = makeDeps({
      createImageBitmap: vi.fn(async () => ({
        width: 800,
        height: 600,
        close: () => undefined
      }))
    });

    await compressRoomPhotoWithDeps(file, {}, deps);

    expect(drawCalls[0].width).toBe(800);
    expect(drawCalls[0].height).toBe(600);
  });

  it("requests EXIF orientation be baked into pixels via createImageBitmap", async () => {
    const file = fakeFile("rotated.jpg", "image/jpeg", 1_000_000);
    const createImageBitmap = vi.fn(async () => ({
      width: 1000,
      height: 1500,
      close: () => undefined
    }));
    const { deps } = makeDeps({ createImageBitmap });

    await compressRoomPhotoWithDeps(file, {}, deps);

    expect(createImageBitmap).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ imageOrientation: "from-image" })
    );
  });

  it("returns the original file untouched when the file is smaller than the threshold", async () => {
    const file = fakeFile("tiny.jpg", "image/jpeg", COMPRESS_DEFAULT_MIN_BYTES - 1);
    const { deps, drawCalls } = makeDeps();

    const result = await compressRoomPhotoWithDeps(file, {}, deps);

    expect(drawCalls).toHaveLength(0);
    expect(result.sourceUsed).toBe("original");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob).toBe(file);
  });

  it("falls back to original bytes when the browser cannot decode HEIC", async () => {
    const file = fakeFile("snap.heic", "image/heic", 4_000_000);
    const createImageBitmap = vi.fn(async () => {
      throw new Error("InvalidStateError: heic not supported");
    });
    const { deps, drawCalls } = makeDeps({ createImageBitmap });

    const result = await compressRoomPhotoWithDeps(file, {}, deps);

    expect(drawCalls).toHaveLength(0);
    expect(result.sourceUsed).toBe("original");
    expect(result.mimeType).toBe("image/heic");
    expect(result.blob).toBe(file);
  });

  it("rounds the scaled dimension to an integer", async () => {
    const file = fakeFile("odd.jpg", "image/jpeg", 4_000_000);
    const { deps, drawCalls } = makeDeps({
      createImageBitmap: vi.fn(async () => ({
        width: 4001,
        height: 3001,
        close: () => undefined
      }))
    });

    await compressRoomPhotoWithDeps(file, {}, deps);

    expect(Number.isInteger(drawCalls[0].width)).toBe(true);
    expect(Number.isInteger(drawCalls[0].height)).toBe(true);
    expect(drawCalls[0].width).toBe(COMPRESS_DEFAULT_MAX_EDGE_PX);
  });
});
