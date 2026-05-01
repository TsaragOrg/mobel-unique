import { describe, expect, it } from "vitest";

import {
  HEIC_BRAND_ALLOWLIST,
  detectHeicMagic,
  shouldConvertHeic
} from "../supabase/functions/in-home-simulation-worker/lib/heic.ts";

function buildFtypBox(brand) {
  // Minimal ISO base media file with an ftyp box at offset 0:
  //   bytes 0..3   box size (placeholder)
  //   bytes 4..7   "ftyp"
  //   bytes 8..11  major brand
  //   bytes 12..15 minor version
  //   bytes 16..19 compatible brand
  if (brand.length !== 4) {
    throw new Error("brand must be exactly four ASCII characters");
  }
  const buffer = new Uint8Array(20);
  // size = 20
  buffer[0] = 0x00;
  buffer[1] = 0x00;
  buffer[2] = 0x00;
  buffer[3] = 0x14;
  buffer[4] = "f".charCodeAt(0);
  buffer[5] = "t".charCodeAt(0);
  buffer[6] = "y".charCodeAt(0);
  buffer[7] = "p".charCodeAt(0);
  for (let i = 0; i < 4; i++) {
    buffer[8 + i] = brand.charCodeAt(i);
  }
  // minor version = 0
  for (let i = 0; i < 4; i++) {
    buffer[12 + i] = 0;
    buffer[16 + i] = brand.charCodeAt(i);
  }
  return buffer;
}

describe("HEIC_BRAND_ALLOWLIST", () => {
  it("includes the major HEIC and HEIF brands the worker must accept", () => {
    expect(HEIC_BRAND_ALLOWLIST).toEqual(
      expect.arrayContaining([
        "heic",
        "heix",
        "mif1",
        "msf1",
        "heim",
        "heis",
        "hevc",
        "hevx",
        "hevm",
        "hevs"
      ])
    );
  });
});

describe("detectHeicMagic", () => {
  it("returns true for an ftyp box with an HEIC major brand", () => {
    expect(detectHeicMagic(buildFtypBox("heic"))).toBe(true);
    expect(detectHeicMagic(buildFtypBox("heix"))).toBe(true);
  });

  it("returns true for an ftyp box with an HEIF major brand", () => {
    expect(detectHeicMagic(buildFtypBox("mif1"))).toBe(true);
    expect(detectHeicMagic(buildFtypBox("msf1"))).toBe(true);
  });

  it("returns true for HEVC sequence brands", () => {
    expect(detectHeicMagic(buildFtypBox("hevc"))).toBe(true);
    expect(detectHeicMagic(buildFtypBox("hevx"))).toBe(true);
    expect(detectHeicMagic(buildFtypBox("hevm"))).toBe(true);
    expect(detectHeicMagic(buildFtypBox("hevs"))).toBe(true);
  });

  it("returns false for an MP4 ftyp box", () => {
    expect(detectHeicMagic(buildFtypBox("mp42"))).toBe(false);
    expect(detectHeicMagic(buildFtypBox("isom"))).toBe(false);
  });

  it("returns false for a JPEG SOI marker", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(detectHeicMagic(jpeg)).toBe(false);
  });

  it("returns false for a PNG signature", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectHeicMagic(png)).toBe(false);
  });

  it("returns false when the buffer is too short", () => {
    expect(detectHeicMagic(new Uint8Array(0))).toBe(false);
    expect(detectHeicMagic(new Uint8Array(8))).toBe(false);
  });

  it("returns false for null or undefined input", () => {
    expect(detectHeicMagic(null)).toBe(false);
    expect(detectHeicMagic(undefined)).toBe(false);
  });
});

describe("shouldConvertHeic", () => {
  it("returns true when the bytes are HEIC even if the storage path looks like JPEG", () => {
    expect(
      shouldConvertHeic(buildFtypBox("heic"), "simulations/abc/inputs/room.jpg")
    ).toBe(true);
  });

  it("returns true when the storage path ends with .heic and bytes are not yet decodable", () => {
    expect(
      shouldConvertHeic(new Uint8Array([0x00]), "simulations/abc/inputs/room.heic")
    ).toBe(true);
    expect(
      shouldConvertHeic(new Uint8Array([0x00]), "simulations/abc/inputs/room.HEIF")
    ).toBe(true);
  });

  it("returns false for a JPEG byte stream with a JPEG path", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(shouldConvertHeic(jpeg, "simulations/abc/inputs/room.jpg")).toBe(false);
  });
});
