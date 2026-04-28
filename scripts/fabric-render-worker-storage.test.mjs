import { describe, expect, it } from "vitest";

import {
  buildStorageObjectUrl,
  downloadStorageObject,
  uploadStorageObject,
  base64ToUint8Array,
  uint8ArrayToBase64
} from "../supabase/functions/fabric-render-worker/storage.ts";
import {
  buildFabricRenderCandidateOutputPath,
  validateFabricRenderJobInputs
} from "../supabase/functions/fabric-render-worker/job.ts";
import {
  prepareFabricRenderScratch,
  recordFabricRenderScratchFailure,
  recordFabricRenderScratchSuccess
} from "../supabase/functions/fabric-render-worker/scratch.ts";
import { readImageDimensions } from "../supabase/functions/fabric-render-worker/image-metadata.ts";

function createFetchResponse(body, options = {}) {
  return {
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: async () => options.text ?? ""
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
      }
    },
    removes,
    writes
  };
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
        supabaseUrl: "http://127.0.0.1:54321/"
      })
    ).toBe(
      "http://127.0.0.1:54321/storage/v1/object/catalog-private-assets/sofas/source.jpg"
    );

    const bytes = await downloadStorageObject({
      bucketId: "catalog-private-assets",
      fetchImpl,
      objectPath: "sofas/source.jpg",
      serviceRoleKey: "service-key",
      supabaseUrl: "http://127.0.0.1:54321"
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
      supabaseUrl: "http://127.0.0.1:54321"
    });

    expect(calls[0].url).toContain(
      "/storage/v1/object/catalog-private-assets/renders/output.png"
    );
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.Authorization).toBe("Bearer service-key");
    expect(calls[0].init.headers.apikey).toBe("service-key");
    expect(calls[0].init.headers["Content-Type"]).toBe("image/png");
    expect(calls[0].init.headers["x-upsert"]).toBe("true");
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
        visualMatrixColumnId: "column-id"
      })
    ).toBe("renders/sofa-id/fabric-id/column-id/candidates/job-id/output.png");
  });

  it("rejects invalid source metadata as non-retryable job metadata", () => {
    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: null },
        generationMode: "initial",
        targetSofa: { heightPx: 768, widthPx: 1024 }
      })
    ).toThrow("fabric reference width and height are required");

    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: 512 },
        generationMode: "initial",
        targetSofa: { heightPx: 1000, widthPx: 2049 }
      })
    ).toThrow("target sofa exceeds 2048 px");
  });

  it("enforces initial and refine source rules", () => {
    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: 512 },
        generationMode: "refine",
        targetSofa: { heightPx: 768, widthPx: 1024 }
      })
    ).toThrow("refinement source is required for refine mode");

    expect(() =>
      validateFabricRenderJobInputs({
        fabricReference: { heightPx: 512, widthPx: 512 },
        generationMode: "initial",
        refinementSource: { heightPx: 768, widthPx: 1024 },
        targetSofa: { heightPx: 768, widthPx: 1024 }
      })
    ).toThrow("refinement source is not allowed for initial mode");
  });

  it("materializes the SPEC-0006 initial scratch contract", async () => {
    const memory = createMemoryScratchFileSystem();

    await prepareFabricRenderScratch({
      fabricReferenceBytes: new Uint8Array([1]),
      fs: memory.fs,
      generationMode: "initial",
      scratchDir: "/tmp/job",
      targetSofaBytes: new Uint8Array([2])
    });

    expect(memory.removes).toEqual(["/tmp/job/output.png", "/tmp/job/error.txt"]);
    expect(memory.writes.map((write) => write.path)).toEqual([
      "/tmp/job/fabric_ref.jpg",
      "/tmp/job/target_sofa.jpg"
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
      targetSofaBytes: new Uint8Array([2])
    });

    expect(memory.writes.map((write) => write.path)).toContain(
      "/tmp/job/refine_source.png"
    );
  });

  it("records successful output and failed error artifacts without stale files", async () => {
    const successMemory = createMemoryScratchFileSystem();
    await recordFabricRenderScratchSuccess({
      fs: successMemory.fs,
      outputBytes: new Uint8Array([9]),
      scratchDir: "/tmp/job"
    });

    expect(successMemory.removes).toEqual(["/tmp/job/error.txt"]);
    expect(successMemory.writes.map((write) => write.path)).toEqual([
      "/tmp/job/output.png"
    ]);

    const failureMemory = createMemoryScratchFileSystem();
    await recordFabricRenderScratchFailure({
      errorMessage: "provider failed",
      fs: failureMemory.fs,
      scratchDir: "/tmp/job"
    });

    expect(failureMemory.removes).toEqual(["/tmp/job/output.png"]);
    expect(failureMemory.writes).toEqual([
      { data: "provider failed", path: "/tmp/job/error.txt" }
    ]);
  });

  it("reads PNG and JPEG dimensions without transforming image bytes", () => {
    const png1x1 = base64ToUint8Array(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    );
    const jpeg320x240 = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
      0x08, 0x00, 0xf0, 0x01, 0x40, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00,
      0x03, 0x11, 0x00, 0xff, 0xd9
    ]);

    expect(readImageDimensions(png1x1, "image/png")).toEqual({
      heightPx: 1,
      widthPx: 1
    });
    expect(readImageDimensions(jpeg320x240, "image/jpeg")).toEqual({
      heightPx: 240,
      widthPx: 320
    });
  });

  it("fails readably for unsupported output image bytes", () => {
    expect(() => readImageDimensions(new Uint8Array([1, 2, 3]), "image/webp"))
      .toThrow("Unsupported image format");
  });
});
