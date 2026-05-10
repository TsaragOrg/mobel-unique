import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

import {
  buildStorageObjectUrl,
  downloadStorageObject,
  removeStorageObjects,
  uploadStorageObject,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../supabase/functions/fabric-render-worker/storage.ts";
import {
  buildFabricRenderCandidateOutputPath,
  validateFabricRenderJobInputs,
} from "../supabase/functions/fabric-render-worker/job.ts";
import {
  prepareFabricRenderScratch,
  recordFabricRenderScratchFailure,
  recordFabricRenderScratchSuccess,
} from "../supabase/functions/fabric-render-worker/scratch.ts";
import { readImageDimensions } from "../supabase/functions/fabric-render-worker/image-metadata.ts";
import { normalizeGeneratedOutput } from "../supabase/functions/fabric-render-worker/image-normalization.ts";
import {
  buildFabricRenderCandidateVariantObjectPath,
  generateFabricRenderCandidateImageVariants,
} from "../supabase/functions/fabric-render-worker/image-variants.ts";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const FABRIC_RENDER_IMAGE_VARIANTS_PATH =
  "supabase/functions/fabric-render-worker/image-variants.ts";
const FABRIC_RENDER_DENO_JSON_PATH =
  "supabase/functions/fabric-render-worker/deno.json";

function createFetchResponse(body, options = {}) {
  return {
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: async () => options.text ?? "",
  };
}

function createMemoryScratchFileSystem() {
  const writes = [];
  const removes = [];

  return {
    fs: {
      mkdir: async () => undefined,
      remove: async (path) => {
        removes.push(path);
      },
      writeFile: async (path, data) => {
        writes.push({ data, path });
      },
      writeTextFile: async (path, text) => {
        writes.push({ data: text, path });
      },
    },
    removes,
    writes,
  };
}

function createRgbaPng(width, height, pixelForPosition) {
  const bytesPerPixel = 4;
  const raw = Buffer.alloc((width * bytesPerPixel + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * bytesPerPixel + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = pixelForPosition(x, y);
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      raw[pixelOffset] = pixel[0];
      raw[pixelOffset + 1] = pixel[1];
      raw[pixelOffset + 2] = pixel[2];
      raw[pixelOffset + 3] = pixel[3] ?? 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return new Uint8Array(
    Buffer.concat([
      PNG_SIGNATURE,
      createPngChunk("IHDR", ihdr),
      createPngChunk("IDAT", deflateSync(raw)),
      createPngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function createSolidRgbaPng(width, height, pixel) {
  return createRgbaPng(width, height, () => pixel);
}

function createPngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);

  return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

describe("fabric render storage and scratch helpers", () => {
  it("builds private storage object URLs and downloads with service-role headers", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ init, url });
      return createFetchResponse(new Uint8Array([1, 2, 3]));
    };

    expect(
      buildStorageObjectUrl({
        bucketId: "catalog-private-assets",
        objectPath: "sofas/source.jpg",
        supabaseUrl: "http://127.0.0.1:54321/",
      }),
    ).toBe(
      "http://127.0.0.1:54321/storage/v1/object/catalog-private-assets/sofas/source.jpg",
    );

    const bytes = await downloadStorageObject({
      bucketId: "catalog-private-assets",
      fetchImpl,
      objectPath: "sofas/source.jpg",
      serviceRoleKey: "service-key",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect([...bytes]).toEqual([1, 2, 3]);
    expect(calls[0].init.headers.Authorization).toBe("Bearer service-key");
    expect(calls[0].init.headers.apikey).toBe("service-key");
  });

  it("uploads generated output with private service-role headers", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ init, url });
      return createFetchResponse(new Uint8Array([]));
    };

    await uploadStorageObject({
      body: new Uint8Array([4, 5, 6]),
      bucketId: "catalog-private-assets",
      contentType: "image/png",
      fetchImpl,
      objectPath: "renders/output.png",
      serviceRoleKey: "service-key",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(calls[0].url).toContain(
      "/storage/v1/object/catalog-private-assets/renders/output.png",
    );
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.Authorization).toBe("Bearer service-key");
    expect(calls[0].init.headers.apikey).toBe("service-key");
    expect(calls[0].init.headers["Content-Type"]).toBe("image/png");
    expect(calls[0].init.headers["x-upsert"]).toBe("true");
  });

  it("removes generated output objects with private service-role headers", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ init, url });
      return createFetchResponse(new Uint8Array([]));
    };

    await removeStorageObjects({
      bucketId: "catalog-private-assets",
      fetchImpl,
      objectPaths: [
        "renders/sofa/fabric/column/candidates/job/output.png",
        "renders/sofa/fabric/column/candidates/job/variants/small/asset.jpg",
      ],
      serviceRoleKey: "service-key",
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(calls.map((call) => call.init.method)).toEqual([
      "DELETE",
      "DELETE",
    ]);
    expect(calls[0].url).toContain(
      "/storage/v1/object/catalog-private-assets/renders/sofa/fabric/column/candidates/job/output.png",
    );
    expect(calls[0].init.headers.Authorization).toBe("Bearer service-key");
  });

  it("converts bytes to and from base64", () => {
    const base64 = uint8ArrayToBase64(new Uint8Array([1, 2, 3, 254]));

    expect(base64ToUint8Array(base64)).toEqual(new Uint8Array([1, 2, 3, 254]));
  });

  it("builds the SPEC-0009 private candidate output path", () => {
    expect(
      buildFabricRenderCandidateOutputPath({
        fabricId: "fabric-id",
        jobId: "job-id",
        sofaId: "sofa-id",
        visualMatrixColumnId: "column-id",
      }),
    ).toBe("renders/sofa-id/fabric-id/column-id/candidates/job-id/output.png");
  });

  it("builds private candidate variant paths with immutable variant asset ids", () => {
    expect(
      buildFabricRenderCandidateVariantObjectPath({
        contentType: "image/jpeg",
        outputPath:
          "renders/sofa-id/fabric-id/column-id/candidates/job-id/output.png",
        variantAssetId: "small-asset-id",
        variantKind: "small",
      }),
    ).toBe(
      "renders/sofa-id/fabric-id/column-id/candidates/job-id/variants/small/small-asset-id.jpg",
    );
  });

  it("uses the Deno imagescript import for Edge-compatible variant generation", async () => {
    const [source, denoJsonText] = await Promise.all([
      readFile(FABRIC_RENDER_IMAGE_VARIANTS_PATH, "utf8"),
      readFile(FABRIC_RENDER_DENO_JSON_PATH, "utf8"),
    ]);
    const denoJson = JSON.parse(denoJsonText);

    expect(source).toContain(
      'from "https://deno.land/x/imagescript@1.2.17/mod.ts"',
    );
    expect(source).not.toContain('from "imagescript"');
    expect(denoJson.imports?.imagescript).toBeUndefined();
    expect(denoJsonText).not.toContain("npm:imagescript");
  });

  it("generates small and medium private candidate variant metadata without cropping", async () => {
    const outputBytes = createSolidRgbaPng(640, 320, [20, 40, 60, 255]);
    const variants = await generateFabricRenderCandidateImageVariants({
      createVariantAssetId: (variantKind) => `${variantKind}-asset-id`,
      outputBytes,
      outputContentType: "image/png",
      outputPath:
        "renders/sofa-id/fabric-id/column-id/candidates/job-id/output.png",
    });

    expect(variants.map((variant) => variant.variant_kind)).toEqual([
      "small",
      "medium",
    ]);
    expect(variants.map((variant) => variant.variant_asset_id)).toEqual([
      "small-asset-id",
      "medium-asset-id",
    ]);
    expect(variants[0]).toMatchObject({
      content_type: "image/jpeg",
      height_px: 160,
      object_path:
        "renders/sofa-id/fabric-id/column-id/candidates/job-id/variants/small/small-asset-id.jpg",
      variant_kind: "small",
      width_px: 320,
    });
    expect(variants[1]).toMatchObject({
      content_type: "image/jpeg",
      height_px: 320,
      object_path:
        "renders/sofa-id/fabric-id/column-id/candidates/job-id/variants/medium/medium-asset-id.jpg",
      variant_kind: "medium",
      width_px: 640,
    });
    expect(
      variants.map((variant) =>
        readImageDimensions(variant.bytes, variant.content_type),
      ),
    ).toEqual([
      { heightPx: 160, widthPx: 320 },
      { heightPx: 320, widthPx: 640 },
    ]);
  });

  it("rejects invalid source metadata as non-retryable job metadata", () => {
    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: null },
        generationMode: "initial",
        targetSofa: { heightPx: 768, widthPx: 1024 },
      }),
    ).toThrow("fabric reference width and height are required");

    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: 512 },
        generationMode: "initial",
        targetSofa: { heightPx: 1000, widthPx: 2049 },
      }),
    ).toThrow("target sofa exceeds 2048 px");
  });

  it("enforces initial and refine source rules", () => {
    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: 512 },
        generationMode: "refine",
        targetSofa: { heightPx: 768, widthPx: 1024 },
      }),
    ).toThrow("refinement source is required for refine mode");

    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: 512 },
        generationMode: "initial",
        refinementSource: { heightPx: 768, widthPx: 1024 },
        targetSofa: { heightPx: 768, widthPx: 1024 },
      }),
    ).toThrow("refinement source is not allowed for initial mode");
  });

  it("materializes the SPEC-0006 initial scratch contract", async () => {
    const memory = createMemoryScratchFileSystem();

    await prepareFabricRenderScratch({
      fabricReferenceBytes: new Uint8Array([1]),
      fs: memory.fs,
      generationMode: "initial",
      scratchDir: "/tmp/job",
      targetSofaBytes: new Uint8Array([2]),
    });

    expect(memory.removes).toEqual([
      "/tmp/job/output.png",
      "/tmp/job/error.txt",
    ]);
    expect(memory.writes.map((write) => write.path)).toEqual([
      "/tmp/job/fabric_ref.jpg",
      "/tmp/job/target_sofa.jpg",
    ]);
  });

  it("materializes refine source only for refine scratch attempts", async () => {
    const memory = createMemoryScratchFileSystem();

    await prepareFabricRenderScratch({
      fabricReferenceBytes: new Uint8Array([1]),
      fs: memory.fs,
      generationMode: "refine",
      refineSourceBytes: new Uint8Array([3]),
      scratchDir: "/tmp/job",
      targetSofaBytes: new Uint8Array([2]),
    });

    expect(memory.writes.map((write) => write.path)).toContain(
      "/tmp/job/refine_source.png",
    );
  });

  it("records successful output and failed error artifacts without stale files", async () => {
    const successMemory = createMemoryScratchFileSystem();
    await recordFabricRenderScratchSuccess({
      fs: successMemory.fs,
      outputBytes: new Uint8Array([9]),
      scratchDir: "/tmp/job",
    });

    expect(successMemory.removes).toEqual(["/tmp/job/error.txt"]);
    expect(successMemory.writes.map((write) => write.path)).toEqual([
      "/tmp/job/output.png",
    ]);

    const failureMemory = createMemoryScratchFileSystem();
    await recordFabricRenderScratchFailure({
      errorMessage: "provider failed",
      fs: failureMemory.fs,
      scratchDir: "/tmp/job",
    });

    expect(failureMemory.removes).toEqual(["/tmp/job/output.png"]);
    expect(failureMemory.writes).toEqual([
      { data: "provider failed", path: "/tmp/job/error.txt" },
    ]);
  });

  it("creates the scratch folder before recording an early failure", async () => {
    const calls = [];
    const fs = {
      mkdir: async (path, options) => {
        calls.push({ options, path, type: "mkdir" });
      },
      remove: async (path) => {
        calls.push({ path, type: "remove" });
      },
      writeFile: async (path, data) => {
        calls.push({ data, path, type: "writeFile" });
      },
      writeTextFile: async (path, text) => {
        calls.push({ path, text, type: "writeTextFile" });
      },
    };

    await recordFabricRenderScratchFailure({
      errorMessage: "input download failed",
      fs,
      scratchDir: "/tmp/job",
    });

    expect(calls).toEqual([
      { options: { recursive: true }, path: "/tmp/job", type: "mkdir" },
      { path: "/tmp/job/output.png", type: "remove" },
      {
        path: "/tmp/job/error.txt",
        text: "input download failed",
        type: "writeTextFile",
      },
    ]);
  });

  it("reads PNG and JPEG dimensions without transforming image bytes", () => {
    const png1x1 = base64ToUint8Array(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    );
    const jpeg320x240 = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
      0x08, 0x00, 0xf0, 0x01, 0x40, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00,
      0x03, 0x11, 0x00, 0xff, 0xd9,
    ]);

    expect(readImageDimensions(png1x1, "image/png")).toEqual({
      heightPx: 1,
      widthPx: 1,
    });
    expect(readImageDimensions(jpeg320x240, "image/jpeg")).toEqual({
      heightPx: 240,
      widthPx: 320,
    });
  });

  it("fails readably for unsupported output image bytes", () => {
    expect(() =>
      readImageDimensions(new Uint8Array([1, 2, 3]), "image/webp"),
    ).toThrow("Unsupported image format");
  });

  it("leaves already matching PNG output dimensions unchanged", async () => {
    const sourceBytes = createSolidRgbaPng(2, 3, [20, 40, 60, 255]);

    const result = await normalizeGeneratedOutput({
      outputBytes: sourceBytes,
      outputContentType: "image/png",
      targetHeightPx: 3,
      targetWidthPx: 2,
    });

    expect(result.contentType).toBe("image/png");
    expect(readImageDimensions(result.outputBytes, result.contentType)).toEqual(
      {
        heightPx: 3,
        widthPx: 2,
      },
    );
    expect(result.sourceHeightPx).toBe(3);
    expect(result.sourceWidthPx).toBe(2);
    expect(result.cropApplied).toBe(false);
    expect(result.resizeApplied).toBe(false);
    expect(result.crop).toBeNull();
  });

  it("normalizes JPEG provider output into PNG even when dimensions already match", async () => {
    const jpeg1x1 = base64ToUint8Array(
      "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==",
    );

    const result = await normalizeGeneratedOutput({
      outputBytes: jpeg1x1,
      outputContentType: "image/jpeg",
      targetHeightPx: 1,
      targetWidthPx: 1,
    });

    expect(result.contentType).toBe("image/png");
    expect(readImageDimensions(result.outputBytes, result.contentType)).toEqual(
      {
        heightPx: 1,
        widthPx: 1,
      },
    );
    expect(result.sourceHeightPx).toBe(1);
    expect(result.sourceWidthPx).toBe(1);
    expect(result.cropApplied).toBe(false);
    expect(result.resizeApplied).toBe(false);
  });

  it("center-crops wide provider PNG output before resizing to target dimensions", async () => {
    const sourceBytes = createRgbaPng(6, 2, (x) => [x * 30, 0, 0, 255]);

    const result = await normalizeGeneratedOutput({
      outputBytes: sourceBytes,
      outputContentType: "image/png",
      targetHeightPx: 4,
      targetWidthPx: 4,
    });

    expect(readImageDimensions(result.outputBytes, result.contentType)).toEqual(
      {
        heightPx: 4,
        widthPx: 4,
      },
    );
    expect(result.cropApplied).toBe(true);
    expect(result.resizeApplied).toBe(true);
    expect(result.crop).toEqual({
      heightPx: 2,
      widthPx: 2,
      xPx: 2,
      yPx: 0,
    });
  });

  it("center-crops tall provider PNG output before resizing to target dimensions", async () => {
    const sourceBytes = createRgbaPng(2, 6, (_x, y) => [0, y * 30, 0, 255]);

    const result = await normalizeGeneratedOutput({
      outputBytes: sourceBytes,
      outputContentType: "image/png",
      targetHeightPx: 4,
      targetWidthPx: 4,
    });

    expect(readImageDimensions(result.outputBytes, result.contentType)).toEqual(
      {
        heightPx: 4,
        widthPx: 4,
      },
    );
    expect(result.cropApplied).toBe(true);
    expect(result.resizeApplied).toBe(true);
    expect(result.crop).toEqual({
      heightPx: 2,
      widthPx: 2,
      xPx: 0,
      yPx: 2,
    });
  });

  it("fails readably before upload when provider output cannot be normalized", async () => {
    await expect(
      normalizeGeneratedOutput({
        outputBytes: new Uint8Array([1, 2, 3]),
        outputContentType: "image/webp",
        targetHeightPx: 4,
        targetWidthPx: 4,
      }),
    ).rejects.toThrow("Unsupported image format");
  });
});
