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
const SERVER_HEIC_PREVIEW_URL = "/api/public/simulation/room-photo-preview";

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
  convertHeicToJpeg?: (blob: Blob, quality: number) => Promise<Blob>;
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
  const likelyHeic = isLikelyHeicPhoto(file);

  if (file.size < minBytes && !likelyHeic) {
    return originalPassthrough(file);
  }

  let bitmap: DecodedBitmap;
  let sourceBlob: Blob = file;
  try {
    bitmap = await deps.createImageBitmap(sourceBlob, {
      imageOrientation: "from-image"
    });
  } catch {
    if (!likelyHeic || !deps.convertHeicToJpeg) {
      return originalPassthrough(file);
    }
    let convertedBlob: Blob;
    try {
      convertedBlob = await deps.convertHeicToJpeg(file, jpegQuality);
      sourceBlob = convertedBlob;
      bitmap = await deps.createImageBitmap(sourceBlob, {
        imageOrientation: "from-image"
      });
    } catch {
      return originalPassthrough(file);
    }
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

function isLikelyHeicPhoto(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    type === "image/x-heic" ||
    type === "image/x-heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
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
    createImageBitmap: (blob, options) =>
      globalThis.createImageBitmap(blob, options),
    convertHeicToJpeg: convertHeicBlobToJpeg,
    drawToBlob: drawBitmapToBlob
  };
}

type Heic2Any = (options: {
  blob: Blob;
  toType?: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

let heic2anyPromise: Promise<Heic2Any> | null = null;

async function loadHeic2Any(): Promise<Heic2Any> {
  if (!heic2anyPromise) {
    heic2anyPromise = import("heic2any")
      .then((mod) => mod.default as Heic2Any)
      .catch((error) => {
        heic2anyPromise = null;
        throw error;
      });
  }
  return heic2anyPromise;
}

async function convertHeicBlobToJpeg(
  blob: Blob,
  quality: number
): Promise<Blob> {
  try {
    const heic2any = await loadHeic2Any();
    const converted = await heic2any({
      blob,
      toType: COMPRESSED_OUTPUT_MIME,
      quality
    });
    const output = Array.isArray(converted) ? converted[0] : converted;
    if (!(output instanceof Blob)) {
      throw new Error("HEIC conversion returned no JPEG blob");
    }
    return output;
  } catch (error) {
    return convertHeicBlobToJpegViaServer(blob, error);
  }
}

async function convertHeicBlobToJpegViaServer(
  blob: Blob,
  localError: unknown
): Promise<Blob> {
  const formData = new FormData();
  const filename =
    blob instanceof File && blob.name.trim().length > 0
      ? blob.name
      : "room.heic";
  formData.append("room_photo", blob, filename);

  const response = await fetch(SERVER_HEIC_PREVIEW_URL, {
    body: formData,
    credentials: "include",
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(
      `HEIC conversion failed locally (${formatHeicConversionError(
        localError
      )}) and server returned HTTP ${response.status}`
    );
  }

  const converted = await response.blob();
  const convertedType = converted.type.toLowerCase();
  if (convertedType !== "image/jpeg" && convertedType !== "image/jpg") {
    throw new Error(
      `HEIC server conversion returned ${converted.type || "<unknown>"}`
    );
  }
  return converted;
}

function formatHeicConversionError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
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
