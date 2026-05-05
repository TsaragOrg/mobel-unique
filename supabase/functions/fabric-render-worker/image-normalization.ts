export type OutputNormalizationCrop = {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
};

export type OutputNormalizationResult = {
  contentType: "image/png";
  outputBytes: Uint8Array;
  normalizedWidthPx: number;
  normalizedHeightPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
  cropApplied: boolean;
  resizeApplied: boolean;
  crop: OutputNormalizationCrop | null;
};

export class OutputNormalizationError extends Error {
  retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "OutputNormalizationError";
  }
}

type DecodedPng = {
  widthPx: number;
  heightPx: number;
  rgba: Uint8Array;
};

type JpegJsModule = {
  decode: (
    bytes: Uint8Array,
    options?: { colorTransform?: boolean; useTArray?: boolean },
  ) => {
    data: Uint8Array;
    width: number;
    height: number;
  };
};

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export async function normalizeGeneratedOutput(input: {
  outputBytes: Uint8Array;
  outputContentType: string;
  targetWidthPx: number;
  targetHeightPx: number;
}): Promise<OutputNormalizationResult> {
  assertPositiveDimensions(input.targetWidthPx, input.targetHeightPx);

  const isPngOutput = hasPngSignature(input.outputBytes);
  const isJpegOutput = hasJpegSignature(input.outputBytes);
  if (!isPngOutput && !isJpegOutput) {
    throw new OutputNormalizationError(
      `Unsupported image format: ${input.outputContentType}`,
    );
  }

  const source = isPngOutput
    ? await decodePng(input.outputBytes)
    : await decodeJpeg(input.outputBytes);

  if (
    isPngOutput &&
    source.widthPx === input.targetWidthPx &&
    source.heightPx === input.targetHeightPx
  ) {
    return {
      contentType: "image/png",
      crop: null,
      cropApplied: false,
      normalizedHeightPx: input.targetHeightPx,
      normalizedWidthPx: input.targetWidthPx,
      outputBytes: input.outputBytes,
      resizeApplied: false,
      sourceHeightPx: source.heightPx,
      sourceWidthPx: source.widthPx,
    };
  }

  const crop = calculateCenteredCrop({
    sourceHeightPx: source.heightPx,
    sourceWidthPx: source.widthPx,
    targetHeightPx: input.targetHeightPx,
    targetWidthPx: input.targetWidthPx,
  });
  const cropApplied =
    crop.xPx !== 0 ||
    crop.yPx !== 0 ||
    crop.widthPx !== source.widthPx ||
    crop.heightPx !== source.heightPx;
  const cropped = cropApplied ? cropRgba(source, crop) : source;
  const resizeApplied =
    cropped.widthPx !== input.targetWidthPx ||
    cropped.heightPx !== input.targetHeightPx;
  const normalized = resizeApplied
    ? resizeRgbaBilinear(cropped, input.targetWidthPx, input.targetHeightPx)
    : cropped;

  return {
    contentType: "image/png",
    crop: cropApplied ? crop : null,
    cropApplied,
    normalizedHeightPx: normalized.heightPx,
    normalizedWidthPx: normalized.widthPx,
    outputBytes: await encodePng(normalized),
    resizeApplied,
    sourceHeightPx: source.heightPx,
    sourceWidthPx: source.widthPx,
  };
}

function assertPositiveDimensions(widthPx: number, heightPx: number): void {
  if (
    !Number.isFinite(widthPx) ||
    !Number.isFinite(heightPx) ||
    widthPx <= 0 ||
    heightPx <= 0 ||
    !Number.isInteger(widthPx) ||
    !Number.isInteger(heightPx)
  ) {
    throw new OutputNormalizationError(
      "output normalization target dimensions must be positive integers",
    );
  }
}

function calculateCenteredCrop(input: {
  sourceWidthPx: number;
  sourceHeightPx: number;
  targetWidthPx: number;
  targetHeightPx: number;
}): OutputNormalizationCrop {
  const sourceRatio = input.sourceWidthPx / input.sourceHeightPx;
  const targetRatio = input.targetWidthPx / input.targetHeightPx;

  if (Math.abs(sourceRatio - targetRatio) <= 0.001) {
    return {
      heightPx: input.sourceHeightPx,
      widthPx: input.sourceWidthPx,
      xPx: 0,
      yPx: 0,
    };
  }

  if (sourceRatio > targetRatio) {
    const widthPx = Math.max(
      Math.min(
        Math.round(input.sourceHeightPx * targetRatio),
        input.sourceWidthPx,
      ),
      1,
    );
    const xPx = Math.max(Math.floor((input.sourceWidthPx - widthPx) / 2), 0);

    return {
      heightPx: input.sourceHeightPx,
      widthPx,
      xPx,
      yPx: 0,
    };
  }

  const heightPx = Math.max(
    Math.min(
      Math.round(input.sourceWidthPx / targetRatio),
      input.sourceHeightPx,
    ),
    1,
  );
  const yPx = Math.max(Math.floor((input.sourceHeightPx - heightPx) / 2), 0);

  return {
    heightPx,
    widthPx: input.sourceWidthPx,
    xPx: 0,
    yPx,
  };
}

function cropRgba(
  source: DecodedPng,
  crop: OutputNormalizationCrop,
): DecodedPng {
  const rgba = new Uint8Array(crop.widthPx * crop.heightPx * 4);

  for (let y = 0; y < crop.heightPx; y += 1) {
    const sourceStart = ((crop.yPx + y) * source.widthPx + crop.xPx) * 4;
    const sourceEnd = sourceStart + crop.widthPx * 4;
    rgba.set(
      source.rgba.subarray(sourceStart, sourceEnd),
      y * crop.widthPx * 4,
    );
  }

  return {
    heightPx: crop.heightPx,
    rgba,
    widthPx: crop.widthPx,
  };
}

function resizeRgbaBilinear(
  source: DecodedPng,
  targetWidthPx: number,
  targetHeightPx: number,
): DecodedPng {
  const rgba = new Uint8Array(targetWidthPx * targetHeightPx * 4);
  const xScale =
    targetWidthPx === 1 ? 0 : (source.widthPx - 1) / (targetWidthPx - 1);
  const yScale =
    targetHeightPx === 1 ? 0 : (source.heightPx - 1) / (targetHeightPx - 1);

  for (let y = 0; y < targetHeightPx; y += 1) {
    const sourceY =
      targetHeightPx === 1 ? (source.heightPx - 1) / 2 : y * yScale;
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(y0 + 1, source.heightPx - 1);
    const yWeight = sourceY - y0;

    for (let x = 0; x < targetWidthPx; x += 1) {
      const sourceX =
        targetWidthPx === 1 ? (source.widthPx - 1) / 2 : x * xScale;
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(x0 + 1, source.widthPx - 1);
      const xWeight = sourceX - x0;
      const targetOffset = (y * targetWidthPx + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        const topLeft = source.rgba[(y0 * source.widthPx + x0) * 4 + channel];
        const topRight = source.rgba[(y0 * source.widthPx + x1) * 4 + channel];
        const bottomLeft =
          source.rgba[(y1 * source.widthPx + x0) * 4 + channel];
        const bottomRight =
          source.rgba[(y1 * source.widthPx + x1) * 4 + channel];
        const top = topLeft + (topRight - topLeft) * xWeight;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight;

        rgba[targetOffset + channel] = Math.round(
          top + (bottom - top) * yWeight,
        );
      }
    }
  }

  return {
    heightPx: targetHeightPx,
    rgba,
    widthPx: targetWidthPx,
  };
}

async function decodeJpeg(bytes: Uint8Array): Promise<DecodedPng> {
  try {
    const jpegJs = await importJpegJs();
    const decoded = jpegJs.decode(bytes, {
      colorTransform: true,
      useTArray: true,
    });

    return {
      heightPx: decoded.height,
      rgba: new Uint8Array(decoded.data),
      widthPx: decoded.width,
    };
  } catch (error) {
    throw new OutputNormalizationError(
      `Invalid JPEG image data: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function importJpegJs(): Promise<JpegJsModule> {
  if ("Deno" in globalThis) {
    const module = (await import(
      /* @vite-ignore */ "./jpeg-js-deno.ts"
    )) as Partial<JpegJsModule>;

    if (!module.decode) {
      throw new OutputNormalizationError("JPEG decoder is not available");
    }

    return {
      decode: module.decode,
    };
  }

  const specifier = "jpeg-js";
  const module = (await import(
    /* @vite-ignore */ specifier
  )) as Partial<JpegJsModule> & {
    default?: Partial<JpegJsModule>;
  };
  const decode = module.decode ?? module.default?.decode;

  if (!decode) {
    throw new OutputNormalizationError("JPEG decoder is not available");
  }

  return {
    decode,
  };
}

async function decodePng(bytes: Uint8Array): Promise<DecodedPng> {
  let widthPx = 0;
  let heightPx = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compressionMethod = 0;
  let filterMethod = 0;
  let interlaceMethod = 0;
  const idatChunks: Uint8Array[] = [];
  let offset = PNG_SIGNATURE.length;

  while (offset + 8 <= bytes.length) {
    const length = readUInt32BE(bytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + length;
    const nextOffset = dataEnd + 4;

    if (dataEnd > bytes.length || nextOffset > bytes.length) {
      throw new OutputNormalizationError("Invalid PNG chunk length");
    }

    const type = readAscii(bytes, typeOffset, typeOffset + 4);
    const data = bytes.subarray(dataOffset, dataEnd);

    if (type === "IHDR") {
      widthPx = readUInt32BE(data, 0);
      heightPx = readUInt32BE(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      compressionMethod = data[10];
      filterMethod = data[11];
      interlaceMethod = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = nextOffset;
  }

  validatePngHeader({
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    heightPx,
    interlaceMethod,
    widthPx,
  });

  const inflated = await inflateZlib(concatUint8Arrays(idatChunks));
  return {
    heightPx,
    rgba: unfilterPngToRgba({
      colorType,
      heightPx,
      inflated,
      widthPx,
    }),
    widthPx,
  };
}

function validatePngHeader(input: {
  widthPx: number;
  heightPx: number;
  bitDepth: number;
  colorType: number;
  compressionMethod: number;
  filterMethod: number;
  interlaceMethod: number;
}): void {
  if (input.widthPx <= 0 || input.heightPx <= 0) {
    throw new OutputNormalizationError("Invalid PNG dimensions");
  }

  if (
    input.bitDepth !== 8 ||
    (input.colorType !== 6 && input.colorType !== 2)
  ) {
    throw new OutputNormalizationError(
      "Unsupported PNG format: expected 8-bit RGB or RGBA",
    );
  }

  if (
    input.compressionMethod !== 0 ||
    input.filterMethod !== 0 ||
    input.interlaceMethod !== 0
  ) {
    throw new OutputNormalizationError(
      "Unsupported PNG format: expected non-interlaced deflate PNG",
    );
  }
}

function unfilterPngToRgba(input: {
  inflated: Uint8Array;
  widthPx: number;
  heightPx: number;
  colorType: number;
}): Uint8Array {
  const channels = input.colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const rowLength = input.widthPx * channels;
  const expectedLength = (rowLength + 1) * input.heightPx;

  if (input.inflated.length < expectedLength) {
    throw new OutputNormalizationError("Invalid PNG pixel data length");
  }

  const rgba = new Uint8Array(input.widthPx * input.heightPx * 4);
  let sourceOffset = 0;
  let previousRow = new Uint8Array(rowLength);

  for (let y = 0; y < input.heightPx; y += 1) {
    const filterType = input.inflated[sourceOffset];
    sourceOffset += 1;
    const row = new Uint8Array(rowLength);

    for (let x = 0; x < rowLength; x += 1) {
      const raw = input.inflated[sourceOffset];
      sourceOffset += 1;
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previousRow[x] ?? 0;
      const upperLeft =
        x >= bytesPerPixel ? (previousRow[x - bytesPerPixel] ?? 0) : 0;

      row[x] = (raw + reversePngFilter(filterType, left, up, upperLeft)) & 0xff;
    }

    for (let x = 0; x < input.widthPx; x += 1) {
      const rowOffset = x * channels;
      const rgbaOffset = (y * input.widthPx + x) * 4;
      rgba[rgbaOffset] = row[rowOffset];
      rgba[rgbaOffset + 1] = row[rowOffset + 1];
      rgba[rgbaOffset + 2] = row[rowOffset + 2];
      rgba[rgbaOffset + 3] = channels === 4 ? row[rowOffset + 3] : 255;
    }

    previousRow = row;
  }

  return rgba;
}

function reversePngFilter(
  filterType: number,
  left: number,
  up: number,
  upperLeft: number,
): number {
  if (filterType === 0) {
    return 0;
  }

  if (filterType === 1) {
    return left;
  }

  if (filterType === 2) {
    return up;
  }

  if (filterType === 3) {
    return Math.floor((left + up) / 2);
  }

  if (filterType === 4) {
    return paethPredictor(left, up, upperLeft);
  }

  throw new OutputNormalizationError(`Unsupported PNG filter: ${filterType}`);
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  if (upDistance <= upperLeftDistance) {
    return up;
  }

  return upperLeft;
}

async function encodePng(image: DecodedPng): Promise<Uint8Array> {
  const raw = new Uint8Array((image.widthPx * 4 + 1) * image.heightPx);

  for (let y = 0; y < image.heightPx; y += 1) {
    const rowOffset = y * (image.widthPx * 4 + 1);
    raw[rowOffset] = 0;
    raw.set(
      image.rgba.subarray(y * image.widthPx * 4, (y + 1) * image.widthPx * 4),
      rowOffset + 1,
    );
  }

  const ihdr = new Uint8Array(13);
  writeUInt32BE(ihdr, 0, image.widthPx);
  writeUInt32BE(ihdr, 4, image.heightPx);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatUint8Arrays([
    PNG_SIGNATURE,
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", await deflateZlib(raw)),
    createPngChunk("IEND", new Uint8Array()),
  ]);
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = asciiBytes(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUInt32BE(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUInt32BE(
    chunk,
    8 + data.length,
    crc32(concatUint8Arrays([typeBytes, data])),
  );

  return chunk;
}

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  return await transformCompressionStream(bytes, "deflate", "decompress");
}

async function deflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  return await transformCompressionStream(bytes, "deflate", "compress");
}

async function transformCompressionStream(
  bytes: Uint8Array,
  format: CompressionFormat,
  mode: "compress" | "decompress",
): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream();
  const transformed =
    mode === "compress"
      ? stream.pipeThrough(new CompressionStream(format))
      : stream.pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(transformed).arrayBuffer());
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}

function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }

  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function writeUInt32BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function readAscii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }

  return bytes;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
