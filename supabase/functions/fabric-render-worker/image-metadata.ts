export type ImageDimensions = {
  widthPx: number;
  heightPx: number;
};

export class ImageMetadataError extends Error {
  retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "ImageMetadataError";
  }
}

export function readImageDimensions(
  bytes: Uint8Array,
  contentType: string
): ImageDimensions {
  if (contentType === "image/png" || hasPngSignature(bytes)) {
    return readPngDimensions(bytes);
  }

  if (
    contentType === "image/jpeg" ||
    contentType === "image/jpg" ||
    hasJpegSignature(bytes)
  ) {
    return readJpegDimensions(bytes);
  }

  throw new ImageMetadataError(`Unsupported image format: ${contentType}`);
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions {
  if (bytes.length < 24 || !hasPngSignature(bytes)) {
    throw new ImageMetadataError("Invalid PNG image data");
  }

  return {
    heightPx: readUInt32BE(bytes, 20),
    widthPx: readUInt32BE(bytes, 16)
  };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions {
  if (!hasJpegSignature(bytes)) {
    throw new ImageMetadataError("Invalid JPEG image data");
  }

  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new ImageMetadataError("Invalid JPEG marker");
    }

    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = readUInt16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new ImageMetadataError("Invalid JPEG segment length");
    }

    if (isStartOfFrameMarker(marker)) {
      return {
        heightPx: readUInt16BE(bytes, offset + 3),
        widthPx: readUInt16BE(bytes, offset + 5)
      };
    }

    offset += segmentLength;
  }

  throw new ImageMetadataError("JPEG dimensions were not found");
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isStartOfFrameMarker(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) + bytes[offset + 1];
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}
