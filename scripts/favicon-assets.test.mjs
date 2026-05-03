import { describe, expect, it } from "vitest";
import { Image } from "imagescript";
import {
  FAVICON_BACKGROUND_COLOR,
  createFaviconImage,
  encodeIco,
  findVisibleBounds,
  resizeImageBilinear,
} from "./favicon-assets.mjs";

describe("favicon asset generation", () => {
  it("finds the visible logo bounds from alpha pixels", () => {
    const source = new Image(8, 5).fill(Image.rgbaToColor(0, 0, 0, 0));
    source.drawBox(3, 2, 4, 2, Image.rgbaToColor(0, 0, 0, 255));

    expect(findVisibleBounds(source)).toEqual({
      height: 2,
      width: 4,
      x: 2,
      y: 1,
    });
  });

  it("creates an opaque square icon on the warm light tile", () => {
    const source = new Image(8, 5).fill(Image.rgbaToColor(0, 0, 0, 0));
    source.drawBox(3, 2, 4, 2, Image.rgbaToColor(0, 0, 0, 255));

    const icon = createFaviconImage(source, 32, { fillRatio: 0.5 });

    expect(icon.width).toBe(32);
    expect(icon.height).toBe(32);
    expect(Array.from(icon.getRGBAAt(1, 1))).toEqual([255, 255, 255, 255]);
    expect(Array.from(icon.getRGBAAt(32, 32))).toEqual([255, 255, 255, 255]);
    expect(hasDarkPixel(icon)).toBe(true);
    expect(FAVICON_BACKGROUND_COLOR).toBe("#ffffff");
  });

  it("smooths scaled alpha edges instead of duplicating pixels", () => {
    const source = new Image(2, 1).fill(Image.rgbaToColor(0, 0, 0, 0));
    source.setPixelAt(2, 1, Image.rgbaToColor(0, 0, 0, 255));

    const resized = resizeImageBilinear(source, 6, 1);
    const alphaValues = Array.from(
      { length: resized.width },
      (_, index) => resized.getRGBAAt(index + 1, 1)[3],
    );

    expect(alphaValues.some((alpha) => alpha > 0 && alpha < 255)).toBe(true);
  });

  it("encodes a multi-size ICO with PNG image entries", async () => {
    const icon16 = new Image(16, 16).fill(
      Image.rgbaToColor(255, 255, 255, 255),
    );
    const icon32 = new Image(32, 32).fill(
      Image.rgbaToColor(255, 255, 255, 255),
    );
    const icon48 = new Image(48, 48).fill(
      Image.rgbaToColor(255, 255, 255, 255),
    );

    const ico = await encodeIco([icon16, icon32, icon48]);

    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect(
      [...ico.subarray(6, 6 + 16 * 3)].filter((_, index) => index % 16 === 0),
    ).toEqual([16, 32, 48]);

    const firstImageOffset = ico.readUInt32LE(18);
    expect(ico.subarray(firstImageOffset, firstImageOffset + 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });
});

function hasDarkPixel(image) {
  for (let y = 1; y <= image.height; y += 1) {
    for (let x = 1; x <= image.width; x += 1) {
      const [red, green, blue, alpha] = image.getRGBAAt(x, y);
      if (alpha > 200 && red < 16 && green < 16 && blue < 16) {
        return true;
      }
    }
  }

  return false;
}
