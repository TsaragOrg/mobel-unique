// SPEC-0007 PLAN-0010 in-home simulation HEIC/HEIF normalization helpers.
//
// iPhone cameras default to HEIC/HEIF, so any real visitor uploads will
// hit this path. The worker converts HEIC bytes to JPEG inside Stage 1
// normalization before the imagescript decoder runs, since imagescript
// does not understand HEIC natively.
//
// Detection uses the ISO base media file format `ftyp` box at offset 4
// rather than the storage path extension, because uploaded files often
// have mismatched extensions. The conversion uses the libheif-js WASM bundle
// from jsDelivr because esm.sh does not expose the required libheif-js version
// reliably in the local Supabase Edge runtime.

export const HEIC_BRAND_ALLOWLIST = [
  "heic",
  "heix",
  "heim",
  "heis",
  "mif1",
  "msf1",
  "hevc",
  "hevx",
  "hevm",
  "hevs"
] as const;

const FTYP_OFFSET = 4;
const BRAND_OFFSET = 8;

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  if (bytes.length < offset + 4) return 0;
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

export function detectHeicMagic(
  bytes: Uint8Array | null | undefined
): boolean {
  if (!bytes || bytes.length < BRAND_OFFSET + 4) return false;
  const ftyp = readAscii(bytes, FTYP_OFFSET, 4);
  if (ftyp !== "ftyp") return false;
  const boxSize = readUint32(bytes, 0);
  const scanEnd =
    boxSize >= 16 && boxSize <= bytes.length
      ? boxSize
      : Math.min(bytes.length, 64);
  for (let offset = BRAND_OFFSET; offset + 4 <= scanEnd; offset += 4) {
    if (offset === 12) continue;
    const brand = readAscii(bytes, offset, 4).toLowerCase();
    if ((HEIC_BRAND_ALLOWLIST as readonly string[]).includes(brand)) {
      return true;
    }
  }
  return false;
}

function endsWithHeicExtension(path: string | null | undefined): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

export function shouldConvertHeic(
  bytes: Uint8Array | null | undefined,
  storagePath: string | null | undefined
): boolean {
  if (detectHeicMagic(bytes)) return true;
  return endsWithHeicExtension(storagePath);
}

type LibheifImage = {
  get_width(): number;
  get_height(): number;
  display(
    image_data: { data: Uint8ClampedArray; width: number; height: number },
    callback: (display: {
      data: Uint8ClampedArray;
      width: number;
      height: number;
    } | null) => void
  ): void;
};

type LibheifDecoder = {
  decode(buffer: ArrayBuffer | Uint8Array): LibheifImage[];
};

type LibheifModule = {
  HeifDecoder: new () => LibheifDecoder;
};

type LibheifModuleFactory = () => Promise<LibheifModule>;

let libheifPromise: Promise<LibheifModule> | null = null;

async function loadLibheif(): Promise<LibheifModule> {
  if (!libheifPromise) {
    libheifPromise = import(
      "https://cdn.jsdelivr.net/npm/libheif-js@1.19.8/libheif-wasm/libheif-bundle.mjs"
    )
      .then((mod) => (mod.default as LibheifModuleFactory)())
      .catch((error) => {
        libheifPromise = null;
        throw error;
      });
  }
  return libheifPromise;
}

export type HeicConversionDependencies = {
  loadLibheif?: () => Promise<LibheifModule>;
  encodeJpeg: (
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    quality: number
  ) => Promise<Uint8Array>;
};

export type HeicConversionResult = {
  jpegBytes: Uint8Array;
  width: number;
  height: number;
};

export async function convertHeicBytesToJpeg(
  bytes: Uint8Array,
  jpegQuality: number,
  deps: HeicConversionDependencies
): Promise<HeicConversionResult> {
  if (!detectHeicMagic(bytes)) {
    // Defensive: callers should gate with shouldConvertHeic, but if a
    // non-HEIC slipped through we surface a readable error rather than
    // letting libheif fail with an internal message.
    throw new Error("convertHeicBytesToJpeg requires HEIC/HEIF input bytes");
  }
  const loader = deps.loadLibheif ?? loadLibheif;
  let libheif: LibheifModule;
  try {
    libheif = await loader();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`libheif could not load: ${message}`);
  }

  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(bytes);
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("HEIC decode produced no images");
  }
  const primary = images[0];
  const width = primary.get_width();
  const height = primary.get_height();
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `HEIC decode returned invalid dimensions: ${width}x${height}`
    );
  }

  const rgbaCanvas: {
    data: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
  } = {
    data: new Uint8ClampedArray(new ArrayBuffer(width * height * 4)),
    width,
    height
  };

  const display = await new Promise<typeof rgbaCanvas | null>((resolve) => {
    primary.display(rgbaCanvas, (result) =>
      resolve(result as typeof rgbaCanvas | null)
    );
  });

  if (!display || display.data.length !== width * height * 4) {
    throw new Error("HEIC decode returned no displayable pixel data");
  }

  const jpegBytes = await deps.encodeJpeg(
    display.data,
    width,
    height,
    jpegQuality
  );
  return { jpegBytes, width, height };
}
