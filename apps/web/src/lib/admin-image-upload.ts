export const ADMIN_RENDER_INPUT_MAX_EDGE_PX = 2048;

export type AdminImageUploadPurpose =
  | "fabric_swatch"
  | "fabric_ai_reference"
  | "sofa_source_photo"
  | "manual_render";

export interface PreparedAdminImageUpload {
  file: File;
  message: string | null;
  resized: boolean;
}

const RESIZABLE_RENDER_INPUT_PURPOSES = new Set<AdminImageUploadPurpose>([
  "fabric_ai_reference",
  "sofa_source_photo",
]);

const SUPPORTED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CANVAS_OUTPUT_QUALITY = 0.9;

interface LoadedImage {
  close(): void;
  height: number;
  source: CanvasImageSource;
  width: number;
}

export async function prepareAdminImageUploadFile(input: {
  file: File;
  purpose: AdminImageUploadPurpose;
}): Promise<PreparedAdminImageUpload> {
  if (
    !RESIZABLE_RENDER_INPUT_PURPOSES.has(input.purpose) ||
    !SUPPORTED_IMAGE_CONTENT_TYPES.has(input.file.type)
  ) {
    return unchanged(input.file);
  }

  const image = await loadImage(input.file);

  try {
    const longestEdge = Math.max(image.width, image.height);

    if (longestEdge <= ADMIN_RENDER_INPUT_MAX_EDGE_PX) {
      return unchanged(input.file);
    }

    const scale = ADMIN_RENDER_INPUT_MAX_EDGE_PX / longestEdge;
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));
    const preparedFile = await resizeImageFile({
      file: input.file,
      image,
      targetHeight,
      targetWidth,
    });

    return {
      file: preparedFile,
      message: `Image resized from ${image.width}x${image.height} to ${targetWidth}x${targetHeight} before upload.`,
      resized: true,
    };
  } finally {
    image.close();
  }
}

function unchanged(file: File): PreparedAdminImageUpload {
  return {
    file,
    message: null,
    resized: false,
  };
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof globalThis.createImageBitmap === "function") {
    const bitmap = await globalThis.createImageBitmap(file);

    return {
      close() {
        bitmap.close();
      },
      height: bitmap.height,
      source: bitmap,
      width: bitmap.width,
    };
  }

  return loadHtmlImage(file);
}

async function loadHtmlImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!globalThis.URL?.createObjectURL) {
      reject(new Error("IMAGE_PREPARATION_UNAVAILABLE"));
      return;
    }

    const objectUrl = globalThis.URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        close() {
          globalThis.URL.revokeObjectURL(objectUrl);
        },
        height: image.naturalHeight || image.height,
        source: image,
        width: image.naturalWidth || image.width,
      });
    };
    image.onerror = () => {
      globalThis.URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    image.src = objectUrl;
  });
}

async function resizeImageFile(input: {
  file: File;
  image: LoadedImage;
  targetHeight: number;
  targetWidth: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = input.targetWidth;
  canvas.height = input.targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("IMAGE_PREPARATION_UNAVAILABLE");
  }

  context.drawImage(
    input.image.source,
    0,
    0,
    input.targetWidth,
    input.targetHeight,
  );

  const outputType = SUPPORTED_IMAGE_CONTENT_TYPES.has(input.file.type)
    ? input.file.type
    : "image/jpeg";
  const blob = await createCanvasBlob(canvas, outputType);

  return new File([blob], input.file.name, {
    lastModified: input.file.lastModified,
    type: outputType,
  });
}

async function createCanvasBlob(canvas: HTMLCanvasElement, outputType: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("IMAGE_PREPARATION_UNAVAILABLE"));
          return;
        }

        resolve(blob);
      },
      outputType,
      CANVAS_OUTPUT_QUALITY,
    );
  });
}
