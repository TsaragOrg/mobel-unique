import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_FABRIC_SWATCH_OUTPUT_PX,
  getDefaultFabricSwatchCrop,
  prepareAdminImageUploadFile,
} from "./admin-image-upload";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("admin image upload preparation", () => {
  it("returns the largest centered square crop for wide source images", () => {
    expect(getDefaultFabricSwatchCrop({ width: 1600, height: 900 })).toEqual({
      sourceSize: 900,
      sourceX: 350,
      sourceY: 0,
    });
  });

  it("returns the largest centered square crop for tall source images", () => {
    expect(getDefaultFabricSwatchCrop({ width: 900, height: 1600 })).toEqual({
      sourceSize: 900,
      sourceX: 0,
      sourceY: 350,
    });
  });

  it("returns non-render input uploads unchanged", async () => {
    const createImageBitmapMock = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    const file = new File(["swatch"], "swatch.png", {
      type: "image/png",
    });

    const result = await prepareAdminImageUploadFile({
      file,
      purpose: "fabric_swatch",
    });

    expect(result).toEqual({
      file,
      message: null,
      resized: false,
    });
    expect(createImageBitmapMock).not.toHaveBeenCalled();
  });

  it("returns render input uploads unchanged when the longest edge is within 2048 px", async () => {
    const close = vi.fn();
    const createImageBitmapMock = vi.fn(async () => ({
      close,
      height: 1200,
      width: 1600,
    }));
    const createElementSpy = vi.spyOn(document, "createElement");
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    const file = new File(["reference"], "reference.jpg", {
      type: "image/jpeg",
    });

    const result = await prepareAdminImageUploadFile({
      file,
      purpose: "fabric_ai_reference",
    });

    expect(result).toEqual({
      file,
      message: null,
      resized: false,
    });
    expect(createImageBitmapMock).toHaveBeenCalledWith(file);
    expect(createElementSpy).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns webp render input uploads unchanged when the longest edge is within 2048 px", async () => {
    const close = vi.fn();
    const createImageBitmapMock = vi.fn(async () => ({
      close,
      height: 1200,
      width: 1600,
    }));
    const createElementSpy = vi.spyOn(document, "createElement");
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    const file = new File(["webp-reference"], "reference.webp", {
      type: "image/webp",
    });

    const result = await prepareAdminImageUploadFile({
      file,
      purpose: "fabric_ai_reference",
    });

    expect(result).toEqual({
      file,
      message: null,
      resized: false,
    });
    expect(createImageBitmapMock).toHaveBeenCalledWith(file);
    expect(createElementSpy).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("resizes oversized render input uploads before signed upload creation", async () => {
    const close = vi.fn();
    const bitmap = {
      close,
      height: 3000,
      width: 4000,
    };
    const createImageBitmapMock = vi.fn(async () => bitmap);
    const drawImage = vi.fn();
    const toBlob = vi.fn(
      (
        callback: BlobCallback,
        type?: string,
        quality?: number,
      ) => {
        expect(type).toBe("image/jpeg");
        expect(quality).toBe(0.9);
        callback(new Blob(["resized"], { type }));
      },
    );
    const canvas = {
      getContext: vi.fn(() => ({
        drawImage,
      })),
      height: 0,
      toBlob,
      width: 0,
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    vi.spyOn(document, "createElement").mockReturnValue(canvas);
    const file = new File(["original-large"], "source.jpg", {
      lastModified: 42,
      type: "image/jpeg",
    });

    const result = await prepareAdminImageUploadFile({
      file,
      purpose: "sofa_source_photo",
    });

    expect(result.file).not.toBe(file);
    expect(result.file.name).toBe("source.jpg");
    expect(result.file.type).toBe("image/jpeg");
    expect(result.file.size).toBe(7);
    expect(result.resized).toBe(true);
    expect(result.message).toBe(
      "Image resized from 4000x3000 to 2048x1536 before upload.",
    );
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1536);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2048, 1536);
    expect(close).toHaveBeenCalledOnce();
  });

  it("creates a generated square swatch file from a normalized crop", async () => {
    const close = vi.fn();
    const bitmap = {
      close,
      height: 900,
      width: 1200,
    };
    const createImageBitmapMock = vi.fn(async () => bitmap);
    const drawImage = vi.fn();
    const toBlob = vi.fn(
      (
        callback: BlobCallback,
        type?: string,
        quality?: number,
      ) => {
        expect(type).toBe("image/png");
        expect(quality).toBe(0.9);
        callback(new Blob(["cropped"], { type }));
      },
    );
    const canvas = {
      getContext: vi.fn(() => ({
        drawImage,
      })),
      height: 0,
      toBlob,
      width: 0,
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    vi.spyOn(document, "createElement").mockReturnValue(canvas);
    const file = new File(["raw-swatch"], "swatch.png", {
      lastModified: 84,
      type: "image/png",
    });

    const result = await prepareAdminImageUploadFile({
      fabricSwatchCrop: {
        sourceSize: 1000,
        sourceX: -50,
        sourceY: 200,
      },
      file,
      purpose: "fabric_swatch",
    });

    expect(result.file).not.toBe(file);
    expect(result.file.name).toBe("swatch.png");
    expect(result.file.type).toBe("image/png");
    expect(result.file.size).toBe(7);
    expect(result.resized).toBe(true);
    expect(result.message).toBe("Swatch cropped to a 512x512 square before upload.");
    expect(canvas.width).toBe(ADMIN_FABRIC_SWATCH_OUTPUT_PX);
    expect(canvas.height).toBe(ADMIN_FABRIC_SWATCH_OUTPUT_PX);
    expect(drawImage).toHaveBeenCalledWith(
      bitmap,
      0,
      0,
      900,
      900,
      0,
      0,
      ADMIN_FABRIC_SWATCH_OUTPUT_PX,
      ADMIN_FABRIC_SWATCH_OUTPUT_PX,
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
