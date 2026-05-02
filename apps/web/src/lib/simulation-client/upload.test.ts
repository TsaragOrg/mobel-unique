import { describe, expect, it } from "vitest";

import {
  UPLOAD_DEFAULT_BACKOFFS_MS,
  UPLOAD_DEFAULT_MAX_ATTEMPTS,
  uploadRoomPhotoWithDeps,
  type UploadDeps,
  type UploadInput
} from "./upload";

interface CapturedHeader {
  name: string;
  value: string;
}

interface FakeXhr {
  open: (method: string, url: string) => void;
  setRequestHeader: (name: string, value: string) => void;
  send: (body: FormData | string | null) => void;
  abort: () => void;
  withCredentials: boolean;
  upload: { onprogress: ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  status: number;
  responseText: string;
  capturedMethod: string;
  capturedUrl: string;
  capturedHeaders: CapturedHeader[];
  capturedBody: FormData | null;
}

function makeFakeXhr(): FakeXhr {
  const xhr: FakeXhr = {
    capturedHeaders: [],
    capturedMethod: "",
    capturedUrl: "",
    capturedBody: null,
    status: 0,
    responseText: "",
    withCredentials: false,
    upload: { onprogress: null },
    onload: null,
    onerror: null,
    ontimeout: null,
    open(method, url) {
      this.capturedMethod = method;
      this.capturedUrl = url;
    },
    setRequestHeader(name, value) {
      this.capturedHeaders.push({ name, value });
    },
    send(body) {
      this.capturedBody = body instanceof FormData ? body : null;
    },
    abort() {
      // no-op for tests
    }
  };
  return xhr;
}

function inputForTest(overrides: Partial<UploadInput> = {}): UploadInput {
  return {
    endpoint: "/api/public/simulations",
    sofaSlug: "canape-rivoli",
    fabricId: "fabric-boucle",
    visualPositionId: "front",
    photoBlob: new Blob([new ArrayBuffer(256)], { type: "image/jpeg" }),
    photoFilename: "room.jpg",
    idempotencyKey: "11111111-2222-3333-4444-555555555555",
    accessToken: "dev-token-abc",
    ...overrides
  };
}

function depsForTest(
  xhrs: FakeXhr[],
  scheduledDelays: number[]
): UploadDeps {
  let nextXhr = 0;
  return {
    createXhr: () => {
      const x = xhrs[nextXhr++];
      if (!x) {
        throw new Error("test ran out of fake XHRs");
      }
      return x as unknown as XMLHttpRequest;
    },
    setTimeout: (callback: () => void, delayMs: number): number => {
      scheduledDelays.push(delayMs);
      callback();
      return 0;
    }
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

function makeProgressEvent(loaded: number, total: number): ProgressEvent {
  return new ProgressEvent("progress", {
    lengthComputable: true,
    loaded,
    total
  });
}

describe("uploadRoomPhotoWithDeps", () => {
  it("posts a multipart form with the four required fields and the photo", async () => {
    const xhr = makeFakeXhr();
    const deps = depsForTest([xhr], []);

    const promise = uploadRoomPhotoWithDeps(inputForTest(), deps);
    xhr.status = 200;
    xhr.responseText = JSON.stringify({
      simulation_job_id: "sim-1",
      status: "queued",
      created_at: "2026-05-02T10:00:00.000Z",
      retention_deadline: "2026-05-03T10:00:00.000Z"
    });
    xhr.onload?.();

    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobId).toBe("sim-1");
    expect(result.status).toBe("queued");

    expect(xhr.capturedMethod).toBe("POST");
    expect(xhr.capturedUrl).toBe("/api/public/simulations");
    expect(xhr.withCredentials).toBe(true);

    const body = xhr.capturedBody!;
    expect(body.get("sofa_slug")).toBe("canape-rivoli");
    expect(body.get("fabric_id")).toBe("fabric-boucle");
    expect(body.get("visual_position_id")).toBe("front");
    expect(body.get("room_photo")).toBeInstanceOf(File);
  });

  it("sets Idempotency-Key and Authorization headers on every attempt", async () => {
    const xhrs = [makeFakeXhr(), makeFakeXhr(), makeFakeXhr()];
    const deps = depsForTest(xhrs, []);

    const promise = uploadRoomPhotoWithDeps(inputForTest(), deps);
    await flush();
    xhrs[0].onerror?.();
    await flush();
    xhrs[1].onerror?.();
    await flush();
    xhrs[2].status = 200;
    xhrs[2].responseText = JSON.stringify({
      simulation_job_id: "sim-2",
      status: "queued",
      created_at: "x",
      retention_deadline: "y"
    });
    xhrs[2].onload?.();
    await promise;

    for (const xhr of xhrs) {
      const idemHeader = xhr.capturedHeaders.find(
        (h) => h.name.toLowerCase() === "idempotency-key"
      );
      const authHeader = xhr.capturedHeaders.find(
        (h) => h.name.toLowerCase() === "authorization"
      );
      expect(idemHeader?.value).toBe("11111111-2222-3333-4444-555555555555");
      expect(authHeader?.value).toBe("Bearer dev-token-abc");
    }
  });

  it("forwards upload progress events as a 0-100 integer percentage", async () => {
    const xhr = makeFakeXhr();
    const deps = depsForTest([xhr], []);
    const progressSamples: number[] = [];

    const promise = uploadRoomPhotoWithDeps(
      inputForTest({ onProgress: (p) => progressSamples.push(p) }),
      deps
    );

    await flush();
    xhr.upload.onprogress?.(makeProgressEvent(50, 200));
    xhr.upload.onprogress?.(makeProgressEvent(200, 200));
    xhr.status = 200;
    xhr.responseText = JSON.stringify({
      simulation_job_id: "sim-3",
      status: "queued",
      created_at: "x",
      retention_deadline: "y"
    });
    xhr.onload?.();
    await promise;

    expect(progressSamples).toEqual([25, 100]);
  });

  it("retries with the configured 1s and 3s backoffs after network failures", async () => {
    const xhrs = [makeFakeXhr(), makeFakeXhr(), makeFakeXhr()];
    const delays: number[] = [];
    const deps = depsForTest(xhrs, delays);

    const promise = uploadRoomPhotoWithDeps(inputForTest(), deps);
    await flush();
    xhrs[0].onerror?.();
    await flush();
    xhrs[1].onerror?.();
    await flush();
    xhrs[2].status = 200;
    xhrs[2].responseText = JSON.stringify({
      simulation_job_id: "sim-4",
      status: "queued",
      created_at: "x",
      retention_deadline: "y"
    });
    xhrs[2].onload?.();
    await promise;

    expect(delays).toEqual([
      UPLOAD_DEFAULT_BACKOFFS_MS[0],
      UPLOAD_DEFAULT_BACKOFFS_MS[1]
    ]);
  });

  it("returns a stable NETWORK error code after the retry budget is exhausted", async () => {
    const xhrs = [makeFakeXhr(), makeFakeXhr(), makeFakeXhr()];
    const deps = depsForTest(xhrs, []);

    const promise = uploadRoomPhotoWithDeps(inputForTest(), deps);
    for (const xhr of xhrs) {
      await flush();
      xhr.onerror?.();
    }
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NETWORK");
    expect(result.attempts).toBe(UPLOAD_DEFAULT_MAX_ATTEMPTS);
  });

  it("does not retry on a server-side validation error and surfaces the server code", async () => {
    const xhrs = [makeFakeXhr()];
    const deps = depsForTest(xhrs, []);

    const promise = uploadRoomPhotoWithDeps(inputForTest(), deps);
    xhrs[0].status = 400;
    xhrs[0].responseText = JSON.stringify({
      error: { code: "VALIDATION_FAILED", message: "sofa_slug missing" }
    });
    xhrs[0].onload?.();
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(result.attempts).toBe(1);
  });

  it("retries on 5xx responses up to the budget", async () => {
    const xhrs = [makeFakeXhr(), makeFakeXhr(), makeFakeXhr()];
    const delays: number[] = [];
    const deps = depsForTest(xhrs, delays);

    const promise = uploadRoomPhotoWithDeps(inputForTest(), deps);
    await flush();
    xhrs[0].status = 503;
    xhrs[0].responseText = "{}";
    xhrs[0].onload?.();
    await flush();
    xhrs[1].status = 502;
    xhrs[1].responseText = "{}";
    xhrs[1].onload?.();
    await flush();
    xhrs[2].status = 200;
    xhrs[2].responseText = JSON.stringify({
      simulation_job_id: "sim-5",
      status: "queued",
      created_at: "x",
      retention_deadline: "y"
    });
    xhrs[2].onload?.();
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(delays).toEqual([
      UPLOAD_DEFAULT_BACKOFFS_MS[0],
      UPLOAD_DEFAULT_BACKOFFS_MS[1]
    ]);
  });
});
