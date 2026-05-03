import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Image } from "imagescript";

export const FAVICON_BACKGROUND_COLOR = "#f4efe6";

const BACKGROUND_RGBA = [244, 239, 230, 255];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function findVisibleBounds(image, options = {}) {
  const alphaThreshold = options.alphaThreshold ?? 8;
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 1; y <= image.height; y += 1) {
    for (let x = 1; x <= image.width; x += 1) {
      const [, , , alpha] = image.getRGBAAt(x, y);

      if (alpha > alphaThreshold) {
        const zeroBasedX = x - 1;
        const zeroBasedY = y - 1;
        minX = Math.min(minX, zeroBasedX);
        minY = Math.min(minY, zeroBasedY);
        maxX = Math.max(maxX, zeroBasedX);
        maxY = Math.max(maxY, zeroBasedY);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("No visible pixels found in source logo.");
  }

  return {
    height: maxY - minY + 1,
    width: maxX - minX + 1,
    x: minX,
    y: minY
  };
}

export function createFaviconImage(sourceImage, size, options = {}) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Icon size must be a positive integer.");
  }

  const fillRatio = options.fillRatio ?? 0.78;
  const bounds = findVisibleBounds(sourceImage, options);
  const croppedLogo = sourceImage.clone().crop(bounds.x, bounds.y, bounds.width, bounds.height);
  const targetMax = Math.max(1, Math.round(size * fillRatio));
  const scale = Math.min(targetMax / croppedLogo.width, targetMax / croppedLogo.height);
  const logoWidth = Math.max(1, Math.round(croppedLogo.width * scale));
  const logoHeight = Math.max(1, Math.round(croppedLogo.height * scale));
  const logo = resizeImageBilinear(croppedLogo, logoWidth, logoHeight);

  const icon = new Image(size, size).fill(Image.rgbaToColor(...BACKGROUND_RGBA));
  icon.composite(logo, Math.floor((size - logo.width) / 2), Math.floor((size - logo.height) / 2));

  return icon;
}

export function resizeImageBilinear(sourceImage, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Resize dimensions must be positive integers.");
  }

  const resized = new Image(width, height).fill(Image.rgbaToColor(0, 0, 0, 0));
  const scaleX = width === 1 ? 0 : (sourceImage.width - 1) / (width - 1);
  const scaleY = height === 1 ? 0 : (sourceImage.height - 1) / (height - 1);

  for (let y = 0; y < height; y += 1) {
    const sourceY = height === 1 ? (sourceImage.height - 1) / 2 : y * scaleY;
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(sourceImage.height - 1, y0 + 1);
    const yWeight = sourceY - y0;

    for (let x = 0; x < width; x += 1) {
      const sourceX = width === 1 ? (sourceImage.width - 1) / 2 : x * scaleX;
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(sourceImage.width - 1, x0 + 1);
      const xWeight = sourceX - x0;
      const top = mixPremultipliedPixels(
        readPremultipliedPixel(sourceImage, x0, y0),
        readPremultipliedPixel(sourceImage, x1, y0),
        xWeight
      );
      const bottom = mixPremultipliedPixels(
        readPremultipliedPixel(sourceImage, x0, y1),
        readPremultipliedPixel(sourceImage, x1, y1),
        xWeight
      );
      const [red, green, blue, alpha] = unpremultiplyPixel(
        mixPremultipliedPixels(top, bottom, yWeight)
      );

      resized.setPixelAt(x + 1, y + 1, Image.rgbaToColor(red, green, blue, alpha));
    }
  }

  return resized;
}

export async function encodeIco(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("At least one icon image is required.");
  }

  const pngEntries = await Promise.all(
    images.map(async (image) => {
      const png = Buffer.from(await image.encode());

      if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new Error("ICO entries must be PNG encoded images.");
      }

      return { image, png };
    })
  );

  const directorySize = 6 + pngEntries.length * 16;
  const imageDataSize = pngEntries.reduce((total, entry) => total + entry.png.length, 0);
  const ico = Buffer.alloc(directorySize + imageDataSize);
  let imageOffset = directorySize;

  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(pngEntries.length, 4);

  for (let index = 0; index < pngEntries.length; index += 1) {
    const { image, png } = pngEntries[index];
    const entryOffset = 6 + index * 16;

    ico.writeUInt8(toIcoDimensionByte(image.width), entryOffset);
    ico.writeUInt8(toIcoDimensionByte(image.height), entryOffset + 1);
    ico.writeUInt8(0, entryOffset + 2);
    ico.writeUInt8(0, entryOffset + 3);
    ico.writeUInt16LE(1, entryOffset + 4);
    ico.writeUInt16LE(32, entryOffset + 6);
    ico.writeUInt32LE(png.length, entryOffset + 8);
    ico.writeUInt32LE(imageOffset, entryOffset + 12);
    png.copy(ico, imageOffset);
    imageOffset += png.length;
  }

  return ico;
}

export async function generateFaviconAssets(options) {
  const sourcePath = options.sourcePath;
  const outDir = options.outDir ?? path.join("apps", "web", "src", "app");

  if (!sourcePath) {
    throw new Error("A source PNG path is required.");
  }

  const source = await Image.decode(await fs.readFile(sourcePath));
  const icon = createFaviconImage(source, 512, { fillRatio: 0.76 });
  const appleIcon = createFaviconImage(source, 180, { fillRatio: 0.74 });
  const faviconImages = [16, 32, 48].map((size) =>
    createFaviconImage(source, size, { fillRatio: 0.9 })
  );

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "icon.png"), Buffer.from(await icon.encode()));
  await fs.writeFile(path.join(outDir, "apple-icon.png"), Buffer.from(await appleIcon.encode()));
  await fs.writeFile(path.join(outDir, "favicon.ico"), await encodeIco(faviconImages));

  return {
    appleIconPath: path.join(outDir, "apple-icon.png"),
    faviconPath: path.join(outDir, "favicon.ico"),
    iconPath: path.join(outDir, "icon.png")
  };
}

function readPremultipliedPixel(image, x, y) {
  const [red, green, blue, alpha] = image.getRGBAAt(x + 1, y + 1);

  return [red * alpha, green * alpha, blue * alpha, alpha];
}

function mixPremultipliedPixels(first, second, weight) {
  const inverse = 1 - weight;

  return [
    first[0] * inverse + second[0] * weight,
    first[1] * inverse + second[1] * weight,
    first[2] * inverse + second[2] * weight,
    first[3] * inverse + second[3] * weight
  ];
}

function unpremultiplyPixel(pixel) {
  const alpha = clampColorChannel(pixel[3]);

  if (alpha === 0) {
    return [0, 0, 0, 0];
  }

  return [
    clampColorChannel(pixel[0] / alpha),
    clampColorChannel(pixel[1] / alpha),
    clampColorChannel(pixel[2] / alpha),
    alpha
  ];
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toIcoDimensionByte(size) {
  if (!Number.isInteger(size) || size <= 0 || size > 256) {
    throw new Error("ICO image dimensions must be between 1 and 256 px.");
  }

  return size === 256 ? 0 : size;
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === "--source") {
      options.sourcePath = value;
      index += 1;
    } else if (flag === "--out-dir") {
      options.outDir = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return options;
}

async function main() {
  const output = await generateFaviconAssets(parseArgs(process.argv.slice(2)));

  for (const filePath of Object.values(output)) {
    console.log(filePath);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
