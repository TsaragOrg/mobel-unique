// SPEC-0015 PLAN-0041 client-side image compression for the public
// simulation wizard. The browser shrinks the visitor's room photo to
// keep upload time predictable while leaving the worker's downstream
// 720 px internal compression with a still-clean source. EXIF rotation
// is baked into pixels via createImageBitmap's `imageOrientation`
// option so the worker never has to interpret EXIF metadata.
//
// The implementation is shaped as `compressRoomPhotoWithDeps` so unit
// tests can inject deterministic stand-ins for `createImageBitmap` and
// the canvas draw step (jsdom does not implement either).

export const COMPRESS_DEFAULT_MAX_EDGE_PX = 1600;
export const COMPRESS_DEFAULT_JPEG_QUALITY = 0.85;
export const COMPRESS_DEFAULT_MIN_BYTES = 200_000;
const COMPRESSED_OUTPUT_MIME = "image/jpeg";

export interface CompressRoomPhotoOptions {
  maxEdgePx?: number;
  jpegQuality?: number;
  minBytesForCompression?: number;
}

export interface CompressedPhoto {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  sourceUsed: "compressed" | "original";
}

export interface DecodedBitmap {
  width: number;
  height: number;
  close: () => void;
}

export interface CompressDeps {
  createImageBitmap: (
    blob: Blob,
    options?: ImageBitmapOptions
  ) => Promise<DecodedBitmap>;
  drawToBlob: (
    bitmap: DecodedBitmap,
    width: number,
    height: number,
    mimeType: string,
    quality: number
  ) => Promise<Blob>;
}

export async function compressRoomPhotoWithDeps(
  file: File,
  options: CompressRoomPhotoOptions,
  deps: CompressDeps
): Promise<CompressedPhoto> {
  const maxEdgePx = options.maxEdgePx ?? COMPRESS_DEFAULT_MAX_EDGE_PX;
  const jpegQuality = options.jpegQuality ?? COMPRESS_DEFAULT_JPEG_QUALITY;
  const minBytes = options.minBytesForCompression ?? COMPRESS_DEFAULT_MIN_BYTES;

  if (file.size < minBytes) {
    return originalPassthrough(file);
  }

  let bitmap: DecodedBitmap;
  try {
    bitmap = await deps.createImageBitmap(file, {
      imageOrientation: "from-image"
    });
  } catch {
    return originalPassthrough(file);
  }

  try {
    const target = scaleToFit(bitmap.width, bitmap.height, maxEdgePx);
    const blob = await deps.drawToBlob(
      bitmap,
      target.width,
      target.height,
      COMPRESSED_OUTPUT_MIME,
      jpegQuality
    );
    return {
      blob,
      mimeType: COMPRESSED_OUTPUT_MIME,
      width: target.width,
      height: target.height,
      sourceUsed: "compressed"
    };
  } finally {
    bitmap.close();
  }
}

export async function compressRoomPhoto(
  file: File,
  options: CompressRoomPhotoOptions = {}
): Promise<CompressedPhoto> {
  return compressRoomPhotoWithDeps(file, options, defaultDeps());
}

function originalPassthrough(file: File): CompressedPhoto {
  return {
    blob: file,
    mimeType: file.type || "application/octet-stream",
    width: 0,
    height: 0,
    sourceUsed: "original"
  };
}

function scaleToFit(
  sourceWidth: number,
  sourceHeight: number,
  maxEdgePx: number
): { width: number; height: number } {
  const longestEdge = Math.max(sourceWidth, sourceHeight);
  if (longestEdge <= maxEdgePx) {
    return { width: sourceWidth, height: sourceHeight };
  }
  const ratio = maxEdgePx / longestEdge;
  return {
    width: Math.round(sourceWidth * ratio),
    height: Math.round(sourceHeight * ratio)
  };
}

function defaultDeps(): CompressDeps {
  return {
    createImageBitmap: (blob, options) => globalThis.createImageBitmap(blob, options),
    drawToBlob: drawBitmapToBlob
  };
}

async function drawBitmapToBlob(
  bitmap: DecodedBitmap,
  width: number,
  height: number,
  mimeType: string,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("compressRoomPhoto: 2d canvas context unavailable");
  }
  context.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("compressRoomPhoto: canvas toBlob returned null"));
          return;
        }
        resolve(result);
      },
      mimeType,
      quality
    );
  });
}
