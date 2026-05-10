import { describe, expect, it, vi } from "vitest";

import {
  SIMULATION_ACCESS_TOKEN_COOKIE,
  deriveSimulationSessionTokenHash,
  issueSimulationAccessToken,
} from "./simulation-access-token";
import {
  SIMULATION_CREATE_MAX_PHOTO_BYTES,
  VERIFICATION_REQUEST_TTL_SECONDS,
  handleConvertSimulationRoomPhotoPreviewRequest,
  handleCreateEmailVerificationRequest,
  handleCreateSimulationRequest,
  handleGetSimulationStatusRequest,
  handleGetSimulationRealtimeTokenRequest,
  handleRequestRegenerationRequest,
  handleSubmitDimensionsRequest,
  handleVerifyEmailVerificationRequest,
  type SimulationCatalogStore,
  type SimulationCreateJobStore,
  type SimulationDimensionsStore,
  type SimulationDispatchTrigger,
  type SimulationEmailOtpProvider,
  type SimulationEmailVerificationStore,
  type SimulationJobReader,
  type SimulationJobView,
  type SimulationProgressAccessReader,
  type SimulationRealtimeTokenIssuer,
  type SimulationRegenerationStore,
  type SimulationRoomPhotoNormalizer,
  type SimulationSessionAccessReader,
  type SimulationStorageSigner,
  type SimulationStorageUploader,
} from "./simulation-public-route-handlers";
import type { SimulationIdempotencyStore } from "./simulation-idempotency";
import type { SimulationRateLimitStore } from "./simulation-rate-limit";
import type { SimulationStatusResponse } from "./simulation-public-api";

const SECRET = "test-secret";

function makeDispatchTrigger(): SimulationDispatchTrigger {
  return {
    trigger: vi.fn().mockResolvedValue(undefined),
  };
}

function fixedNow(iso: string) {
  const date = new Date(iso);
  return () => date;
}

const HEIC_BYTES = new Uint8Array([
  0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0,
]);
const HEIF_BYTES = new Uint8Array([
  0, 0, 0, 24, 102, 116, 121, 112, 109, 105, 102, 49, 0, 0, 0, 0,
]);
const HEIC_COMPATIBLE_BRAND_BYTES = new Uint8Array([
  0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
  111, 56, 104, 101, 105, 99,
]);
const NORMALIZED_JPEG_BYTES = new Uint8Array([255, 216, 255, 217]);

function makeRoomPhotoOnlyFormData(
  options: {
    bytes?: Uint8Array;
    contentType?: string;
    filename?: string;
  } = {},
): FormData {
  const formData = new FormData();
  const bytes = options.bytes ?? HEIC_BYTES;
  const photoArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(photoArrayBuffer).set(bytes);
  const blob = new Blob([photoArrayBuffer], {
    type: options.contentType ?? "application/octet-stream",
  });
  formData.append("room_photo", blob, options.filename ?? "room.heic");
  return formData;
}

describe("handleCreateEmailVerificationRequest", () => {
  function createEmailDeps(
    options: {
      sendOk?: boolean;
      verifyOk?: boolean;
      requestRecord?: {
        verificationRequestId: string;
        email: string;
        emailNormalizedHash: string;
        expiresAt: Date;
      } | null;
    } = {},
  ) {
    const requestRecord =
      options.requestRecord === undefined
        ? {
            verificationRequestId: "00000000-0000-4000-8000-000000000111",
            email: "visitor@example.com",
            emailNormalizedHash: "email-hash-1",
            expiresAt: new Date("2026-05-02T11:00:00Z"),
          }
        : options.requestRecord;
    const emailVerificationStore: SimulationEmailVerificationStore = {
      createRequest: vi.fn().mockResolvedValue({
        verificationRequestId: "00000000-0000-4000-8000-000000000111",
        expiresAt: new Date("2026-05-02T11:00:00Z"),
      }),
      findRequestForVerification: vi.fn().mockResolvedValue(requestRecord),
      markSendFailed: vi.fn().mockResolvedValue(undefined),
      markVerifiedAndCreateSession: vi.fn().mockResolvedValue({
        simulationSessionId: "00000000-0000-4000-8000-000000000222",
      }),
    };
    const otpProvider: SimulationEmailOtpProvider = {
      sendOtp: vi.fn().mockResolvedValue({
        ok: options.sendOk ?? true,
      }),
      verifyOtp: vi.fn().mockResolvedValue(
        options.verifyOk === false
          ? { ok: false, reason: "invalid" as const }
          : {
              ok: true,
              authUserId: "00000000-0000-4000-8000-000000000333",
            },
      ),
    };
    return {
      deps: {
        accessTokenSecret: SECRET,
        environment: "local" as const,
        now: fixedNow("2026-05-02T10:00:00Z"),
        emailVerificationStore,
        otpProvider,
      },
      emailVerificationStore,
      otpProvider,
    };
  }

  it("persists a verification request and asks Supabase Auth to send the OTP", async () => {
    const ctx = createEmailDeps();
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: ctx.deps,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { verification_request_id: string; expires_at: string };
    };
    expect(body.data.verification_request_id).toBe(
      "00000000-0000-4000-8000-000000000111",
    );
    expect(ctx.emailVerificationStore.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "visitor@example.com",
        consentEmailUse: true,
        consentMarketing: false,
      }),
    );
    expect(ctx.otpProvider.sendOtp).toHaveBeenCalledWith({
      email: "visitor@example.com",
    });
  });

  it("returns expires_at one hour after now", async () => {
    const ctx = createEmailDeps();
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: ctx.deps,
    });
    const body = (await response.json()) as {
      data: { expires_at: string };
    };
    const expectedMs =
      new Date("2026-05-02T10:00:00Z").getTime() +
      VERIFICATION_REQUEST_TTL_SECONDS * 1000;
    expect(new Date(body.data.expires_at).getTime()).toBe(expectedMs);
  });

  it("does not set a Set-Cookie header on create", async () => {
    const ctx = createEmailDeps();
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: ctx.deps,
    });
    expect(response.headers.get("set-cookie")).toBe(null);
  });

  it("marks the request send_failed when Supabase Auth cannot send the OTP", async () => {
    const ctx = createEmailDeps({ sendOk: false });
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: ctx.deps,
    });
    expect(response.status).toBe(500);
    expect(ctx.emailVerificationStore.markSendFailed).toHaveBeenCalledWith({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
    });
  });

  it("rejects a missing email", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { consent_email_use: true },
      deps: { accessTokenSecret: SECRET, environment: "local" },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an invalid email format", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "not-an-email", consent_email_use: true },
      deps: { accessTokenSecret: SECRET, environment: "local" },
    });
    expect(response.status).toBe(400);
  });

  it("rejects consent_email_use=false", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: false },
      deps: { accessTokenSecret: SECRET, environment: "local" },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.message).toContain("consent_email_use");
  });

  it("rejects a non-object body", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: null,
      deps: { accessTokenSecret: SECRET, environment: "local" },
    });
    expect(response.status).toBe(400);
  });
});

describe("handleConvertSimulationRoomPhotoPreviewRequest", () => {
  it("returns a JPEG response after normalizing a HEIC room photo", async () => {
    const roomPhotoNormalizer: SimulationRoomPhotoNormalizer = {
      normalize: vi.fn(async (photo) => {
        expect(photo.fileContentType).toBe("image/heic");
        expect(photo.fileExtension).toBe("heic");
        return {
          fileBytes: NORMALIZED_JPEG_BYTES,
          fileContentType: "image/jpeg",
          fileExtension: "jpg",
        };
      }),
    };

    const response = await handleConvertSimulationRoomPhotoPreviewRequest({
      formData: makeRoomPhotoOnlyFormData(),
      deps: { roomPhotoNormalizer },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      NORMALIZED_JPEG_BYTES,
    );
  });

  it("returns 400 when preview normalization cannot produce JPEG", async () => {
    const roomPhotoNormalizer: SimulationRoomPhotoNormalizer = {
      normalize: vi.fn(async (photo) => photo),
    };

    const response = await handleConvertSimulationRoomPhotoPreviewRequest({
      formData: makeRoomPhotoOnlyFormData(),
      deps: { roomPhotoNormalizer },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("handleVerifyEmailVerificationRequest", () => {
  function createVerifyDeps(
    options: {
      verifyOk?: boolean;
      requestRecord?: {
        verificationRequestId: string;
        email: string;
        emailNormalizedHash: string;
        expiresAt: Date;
      } | null;
    } = {},
  ) {
    const requestRecord =
      options.requestRecord === undefined
        ? {
            verificationRequestId: "00000000-0000-4000-8000-000000000111",
            email: "visitor@example.com",
            emailNormalizedHash: "email-hash-1",
            expiresAt: new Date("2026-05-02T11:00:00Z"),
          }
        : options.requestRecord;
    const emailVerificationStore: SimulationEmailVerificationStore = {
      createRequest: vi.fn(),
      findRequestForVerification: vi.fn().mockResolvedValue(requestRecord),
      markSendFailed: vi.fn(),
      markVerifiedAndCreateSession: vi.fn().mockResolvedValue({
        simulationSessionId: "00000000-0000-4000-8000-000000000222",
      }),
    };
    const otpProvider: SimulationEmailOtpProvider = {
      sendOtp: vi.fn(),
      verifyOtp: vi.fn().mockResolvedValue(
        options.verifyOk === false
          ? { ok: false, reason: "invalid" as const }
          : {
              ok: true,
              authUserId: "00000000-0000-4000-8000-000000000333",
            },
      ),
    };
    return {
      deps: {
        accessTokenSecret: SECRET,
        environment: "local" as const,
        now: fixedNow("2026-05-02T10:00:00Z"),
        emailVerificationStore,
        otpProvider,
      },
      emailVerificationStore,
      otpProvider,
    };
  }

  it("returns 200 with a valid simulation_access_token", async () => {
    const ctx = createVerifyDeps();
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: { code: "123456" },
      deps: ctx.deps,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { simulation_access_token: string; expires_at: string };
    };
    expect(body.data.simulation_access_token.startsWith("dev-token-")).toBe(
      true,
    );
    expect(ctx.otpProvider.verifyOtp).toHaveBeenCalledWith({
      email: "visitor@example.com",
      code: "123456",
    });
    expect(
      ctx.emailVerificationStore.markVerifiedAndCreateSession,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationRequestId: "00000000-0000-4000-8000-000000000111",
        authUserId: "00000000-0000-4000-8000-000000000333",
        emailNormalizedHash: "email-hash-1",
        accessTokenHash: deriveSimulationSessionTokenHash(
          "00000000-0000-4000-8000-000000000111",
        ),
      }),
    );
  });

  it("sets the simulation_access_token cookie", async () => {
    const ctx = createVerifyDeps();
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: { code: "123456" },
      deps: ctx.deps,
    });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).not.toBe(null);
    expect(cookie).toContain(`${SIMULATION_ACCESS_TOKEN_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("adds Secure to the cookie when environment is dev", async () => {
    const ctx = createVerifyDeps();
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: { code: "123456" },
      deps: {
        ...ctx.deps,
        environment: "dev",
      },
    });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("Secure");
  });

  it("returns 400 when the verification request does not exist", async () => {
    const ctx = createVerifyDeps({ requestRecord: null });
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: { code: "123456" },
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a body without a code field", async () => {
    const ctx = createVerifyDeps();
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: {},
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
  });

  it("rejects a non-object body", async () => {
    const ctx = createVerifyDeps();
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: "not-json-object",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
  });

  it("returns 401 when Supabase Auth rejects the OTP", async () => {
    const ctx = createVerifyDeps({ verifyOk: false });
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: { code: "123456" },
      deps: ctx.deps,
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AUTH_INVALID");
  });

  it("returns expires_at 24 hours after issuance", async () => {
    const ctx = createVerifyDeps();
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "00000000-0000-4000-8000-000000000111",
      body: { code: "123456" },
      deps: ctx.deps,
    });
    const body = (await response.json()) as {
      data: { expires_at: string };
    };
    const expectedMs =
      Math.floor(new Date("2026-05-02T10:00:00Z").getTime() / 1000) * 1000 +
      24 * 60 * 60 * 1000;
    expect(new Date(body.data.expires_at).getTime()).toBe(expectedMs);
  });
});

describe("handleGetSimulationStatusRequest", () => {
  const VERIFICATION_REQUEST_ID = "stub-00000000-0000-4000-8000-000000000099";
  const JOB_ID = "00000000-0000-4000-8000-0000000000a1";
  const NOW = fixedNow("2026-05-02T10:00:00Z");

  function makeValidToken() {
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: NOW,
    });
    return issued.token;
  }

  function makeJobView(
    overrides: Partial<SimulationJobView> = {},
  ): SimulationJobView {
    return {
      jobId: JOB_ID,
      status: "queued",
      roomGeometryMode: "back_wall",
      createdAt: new Date("2026-05-02T10:00:00Z"),
      retentionDeadline: new Date("2026-05-03T10:00:00Z"),
      storagePrefix: `simulations/${JOB_ID}`,
      dimensionGuideOverlayPath: null,
      generatedOutputCount: 0,
      latestGeneratedOutputIndex: null,
      lastErrorMessage: null,
      lastRegenerationErrorMessage: null,
      ...overrides,
    };
  }

  function createDeps(
    job: SimulationJobView | null,
    options: {
      signedUrlMap?: Record<string, string>;
    } = {},
  ) {
    const signedUrlMap = options.signedUrlMap ?? {};
    const jobReader: SimulationJobReader = {
      findOwnedJob: vi.fn().mockResolvedValue(job),
    };
    const storageSigner: SimulationStorageSigner = {
      signObjectUrl: vi.fn().mockImplementation(async (input) => {
        return (
          signedUrlMap[input.storagePath] ??
          `https://signed.example/${input.storagePath}?ttl=${input.ttlSeconds}`
        );
      }),
    };
    return {
      deps: {
        accessTokenSecret: SECRET,
        jobReader,
        storageSigner,
        now: NOW,
      },
      jobReader,
      storageSigner,
    };
  }

  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: null,
      deps,
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 AUTH_INVALID when the token is malformed", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: "not-a-token",
      deps,
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AUTH_INVALID");
  });

  it("returns 404 JOB_NOT_FOUND when the job id is not a uuid", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleGetSimulationStatusRequest({
      jobId: "not-a-uuid",
      token: makeValidToken(),
      deps,
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("JOB_NOT_FOUND");
  });

  it("returns 404 JOB_NOT_FOUND when the job belongs to another visitor", async () => {
    const { deps, jobReader } = createDeps(null);
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    expect(response.status).toBe(404);
    expect(jobReader.findOwnedJob).toHaveBeenCalledWith({
      jobId: JOB_ID,
      accessTokenHash: deriveSimulationSessionTokenHash(
        VERIFICATION_REQUEST_ID,
      ),
    });
  });

  it("returns 200 with the canonical status payload for a queued job", async () => {
    const { deps } = createDeps(makeJobView({ status: "queued" }));
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.simulation_job_id).toBe(JOB_ID);
    expect(body.data.status).toBe("queued");
    expect(body.data.room_geometry_mode).toBe("back_wall");
    expect(body.data.generated_output_count).toBe(0);
    expect(body.data.regeneration_available).toBe(false);
    expect(body.data.required_dimensions).toBeUndefined();
    expect(body.data.dimension_guide_overlay_url).toBeUndefined();
    expect(body.data.latest_output_url).toBeUndefined();
  });

  it("returns required_dimensions and a signed overlay URL for back_wall awaiting_dimensions", async () => {
    const { deps, storageSigner } = createDeps(
      makeJobView({
        status: "awaiting_dimensions",
        roomGeometryMode: "back_wall",
        dimensionGuideOverlayPath: `simulations/${JOB_ID}/room_dimensions.png`,
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.required_dimensions).toEqual([
      "wall_width",
      "wall_height",
      "room_depth",
    ]);
    expect(body.data.dimension_guide_overlay_url).toContain(
      `simulations/${JOB_ID}/room_dimensions.png`,
    );
    expect(storageSigner.signObjectUrl).toHaveBeenCalledWith({
      storagePath: `simulations/${JOB_ID}/room_dimensions.png`,
      ttlSeconds: 120,
    });
  });

  it("returns the four-key required_dimensions for corner awaiting_dimensions", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "awaiting_dimensions",
        roomGeometryMode: "corner",
        dimensionGuideOverlayPath: `simulations/${JOB_ID}/room_dimensions.png`,
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.required_dimensions).toEqual([
      "left_wall_width",
      "right_wall_width",
      "room_height",
      "room_depth",
    ]);
  });

  it("returns latest_output_url and regeneration_available=true for succeeded under the limit", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "succeeded",
        generatedOutputCount: 1,
        latestGeneratedOutputIndex: 0,
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.status).toBe("succeeded");
    expect(body.data.regeneration_available).toBe(true);
    expect(body.data.latest_output_url).toContain(
      `simulations/${JOB_ID}/outputs/output-0.png`,
    );
  });

  it("returns regeneration_available=false when the three-result cap is reached", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "succeeded",
        generatedOutputCount: 3,
        latestGeneratedOutputIndex: 2,
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.regeneration_available).toBe(false);
    expect(body.data.latest_output_url).toContain("output-2.png");
  });

  it("keeps the previous output visible while a regeneration is processing", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "placement_processing",
        generatedOutputCount: 1,
        latestGeneratedOutputIndex: 0,
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.latest_output_url).toContain("output-0.png");
    expect(body.data.regeneration_available).toBe(false);
  });

  it("includes the last_error on a failed job", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "failed",
        lastErrorMessage: "validation_rejected",
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.status).toBe("failed");
    expect(body.data.last_error).toBe("validation_rejected");
    expect(body.data.latest_output_url).toBeUndefined();
  });

  it("surfaces the last regeneration error on a succeeded job that just retried", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "succeeded",
        generatedOutputCount: 1,
        latestGeneratedOutputIndex: 0,
        lastRegenerationErrorMessage: "placement_failed",
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.last_error).toBe("placement_failed");
  });

  it("returns minimal payload for an expired job", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "expired",
        generatedOutputCount: 0,
        latestGeneratedOutputIndex: null,
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.status).toBe("expired");
    expect(body.data.regeneration_available).toBe(false);
    expect(body.data.dimension_guide_overlay_url).toBeUndefined();
    expect(body.data.latest_output_url).toBeUndefined();
  });

  it("computes the access_token_hash from the token's verification_request_id", async () => {
    const { deps, jobReader } = createDeps(makeJobView());
    await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    const expectedHash = deriveSimulationSessionTokenHash(
      VERIFICATION_REQUEST_ID,
    );
    expect(jobReader.findOwnedJob).toHaveBeenCalledWith({
      jobId: JOB_ID,
      accessTokenHash: expectedHash,
    });
  });

  it("respects the configured signed URL TTL", async () => {
    const { deps, storageSigner } = createDeps(
      makeJobView({
        status: "succeeded",
        generatedOutputCount: 1,
        latestGeneratedOutputIndex: 0,
      }),
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps: { ...deps, signedUrlTtlSeconds: 30 },
    });
    expect(response.status).toBe(200);
    expect(storageSigner.signObjectUrl).toHaveBeenCalledWith({
      storagePath: `simulations/${JOB_ID}/outputs/output-0.png`,
      ttlSeconds: 30,
    });
  });

  it("never sets a Set-Cookie header on the status response", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    expect(response.headers.get("set-cookie")).toBe(null);
  });
});

describe("handleGetSimulationRealtimeTokenRequest", () => {
  const VERIFICATION_REQUEST_ID = "stub-00000000-0000-4000-8000-000000000099";
  const JOB_ID = "00000000-0000-4000-8000-0000000000a1";
  const SESSION_ID = "00000000-0000-4000-8000-0000000000b2";
  const NOW = fixedNow("2026-05-02T10:00:00Z");

  function makeValidToken() {
    return issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: NOW,
    }).token;
  }

  function createDeps(
    access: {
      jobId: string;
      simulationSessionId: string;
      retentionDeadline: Date;
    } | null,
  ) {
    const progressAccessReader: SimulationProgressAccessReader = {
      findOwnedProgressAccess: vi.fn().mockResolvedValue(access),
    };
    const realtimeTokenIssuer: SimulationRealtimeTokenIssuer = {
      issueProgressToken: vi.fn().mockResolvedValue({
        token: "progress.jwt",
        expiresAt: new Date("2026-05-02T10:05:00Z"),
      }),
    };
    return {
      deps: {
        accessTokenSecret: SECRET,
        progressAccessReader,
        realtimeTokenIssuer,
        now: NOW,
      },
      progressAccessReader,
      realtimeTokenIssuer,
    };
  }

  it("returns a scoped Realtime token for an owned simulation job", async () => {
    const ctx = createDeps({
      jobId: JOB_ID,
      simulationSessionId: SESSION_ID,
      retentionDeadline: new Date("2026-05-03T10:00:00Z"),
    });
    const response = await handleGetSimulationRealtimeTokenRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps: ctx.deps,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { realtime_token: string; expires_at: string };
    };
    expect(body.data.realtime_token).toBe("progress.jwt");
    expect(body.data.expires_at).toBe("2026-05-02T10:05:00.000Z");
    expect(
      ctx.progressAccessReader.findOwnedProgressAccess,
    ).toHaveBeenCalledWith({
      jobId: JOB_ID,
      accessTokenHash: deriveSimulationSessionTokenHash(
        VERIFICATION_REQUEST_ID,
      ),
    });
    expect(ctx.realtimeTokenIssuer.issueProgressToken).toHaveBeenCalledWith({
      jobId: JOB_ID,
      simulationSessionId: SESSION_ID,
      retentionDeadline: new Date("2026-05-03T10:00:00Z"),
    });
  });

  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    const ctx = createDeps({
      jobId: JOB_ID,
      simulationSessionId: SESSION_ID,
      retentionDeadline: new Date("2026-05-03T10:00:00Z"),
    });
    const response = await handleGetSimulationRealtimeTokenRequest({
      jobId: JOB_ID,
      token: null,
      deps: ctx.deps,
    });
    expect(response.status).toBe(401);
    expect(ctx.realtimeTokenIssuer.issueProgressToken).not.toHaveBeenCalled();
  });

  it("returns 404 when the job is not owned by the visitor", async () => {
    const ctx = createDeps(null);
    const response = await handleGetSimulationRealtimeTokenRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps: ctx.deps,
    });
    expect(response.status).toBe(404);
    expect(ctx.realtimeTokenIssuer.issueProgressToken).not.toHaveBeenCalled();
  });
});

describe("handleSubmitDimensionsRequest", () => {
  const VERIFICATION_REQUEST_ID = "stub-00000000-0000-4000-8000-000000000099";
  const JOB_ID = "00000000-0000-4000-8000-0000000000a1";
  const NOW = fixedNow("2026-05-02T10:00:00Z");

  function makeValidToken() {
    return issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: NOW,
    }).token;
  }

  function makeJobView(
    overrides: Partial<SimulationJobView> = {},
  ): SimulationJobView {
    return {
      jobId: JOB_ID,
      status: "awaiting_dimensions",
      roomGeometryMode: "back_wall",
      createdAt: new Date("2026-05-02T10:00:00Z"),
      retentionDeadline: new Date("2026-05-03T10:00:00Z"),
      storagePrefix: `simulations/${JOB_ID}`,
      dimensionGuideOverlayPath: `simulations/${JOB_ID}/room_dimensions.png`,
      generatedOutputCount: 0,
      latestGeneratedOutputIndex: null,
      lastErrorMessage: null,
      lastRegenerationErrorMessage: null,
      ...overrides,
    };
  }

  function createDeps(job: SimulationJobView | null) {
    const jobReader: SimulationJobReader = {
      findOwnedJob: vi.fn().mockResolvedValue(job),
    };
    const dimensionsStore: SimulationDimensionsStore = {
      submit: vi.fn().mockResolvedValue({
        checkpointId: "00000000-0000-4000-8000-000000000042",
      }),
    };
    const dispatchTrigger = makeDispatchTrigger();
    return {
      deps: {
        accessTokenSecret: SECRET,
        dispatchTrigger,
        jobReader,
        dimensionsStore,
        now: NOW,
      },
      jobReader,
      dimensionsStore,
      dispatchTrigger,
    };
  }

  it("returns 200 + placement_queued on a valid back_wall payload", async () => {
    const ctx = createDeps(makeJobView());
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: { wall_width: 4.2, wall_height: 2.7, room_depth: 5 },
      deps: ctx.deps,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { simulation_job_id: string; status: string };
    };
    expect(body.data.simulation_job_id).toBe(JOB_ID);
    expect(body.data.status).toBe("placement_queued");
    expect(ctx.dimensionsStore.submit).toHaveBeenCalledWith({
      jobId: JOB_ID,
      suppliedDimensions: {
        wall_width: 4.2,
        wall_height: 2.7,
        room_depth: 5,
      },
    });
    expect(ctx.dispatchTrigger.trigger).toHaveBeenCalledWith({
      checkpointId: "00000000-0000-4000-8000-000000000042",
      jobId: JOB_ID,
      reason: "dimensions",
    });
  });

  it("returns 200 + placement_queued on a valid corner payload", async () => {
    const ctx = createDeps(makeJobView({ roomGeometryMode: "corner" }));
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: {
        left_wall_width: 3.4,
        right_wall_width: 4.0,
        room_height: 2.7,
        room_depth: 5,
      },
      deps: ctx.deps,
    });
    expect(response.status).toBe(200);
    expect(ctx.dimensionsStore.submit).toHaveBeenCalledWith({
      jobId: JOB_ID,
      suppliedDimensions: {
        left_wall_width: 3.4,
        right_wall_width: 4.0,
        room_height: 2.7,
        room_depth: 5,
      },
    });
  });

  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: null,
      body: { wall_width: 4, wall_height: 2.5, room_depth: 5 },
      deps,
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 JOB_NOT_FOUND for a malformed jobId", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleSubmitDimensionsRequest({
      jobId: "not-a-uuid",
      token: makeValidToken(),
      body: { wall_width: 4, wall_height: 2.5, room_depth: 5 },
      deps,
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 JOB_NOT_FOUND when the job is not owned", async () => {
    const { deps, dimensionsStore } = createDeps(null);
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: { wall_width: 4, wall_height: 2.5, room_depth: 5 },
      deps,
    });
    expect(response.status).toBe(404);
    expect(dimensionsStore.submit).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_FAILED when room_depth is missing", async () => {
    const { deps, dimensionsStore } = createDeps(makeJobView());
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: { wall_width: 4, wall_height: 2.5 },
      deps,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(dimensionsStore.submit).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_FAILED when a dimension is non-numeric", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: { wall_width: "x", wall_height: 2.5, room_depth: 5 },
      deps,
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 VALIDATION_FAILED when a corner request lacks left_wall_width", async () => {
    const { deps } = createDeps(makeJobView({ roomGeometryMode: "corner" }));
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: { right_wall_width: 4, room_height: 2.7, room_depth: 5 },
      deps,
    });
    expect(response.status).toBe(400);
  });

  it("returns 409 JOB_STATE_CONFLICT when status is not awaiting_dimensions", async () => {
    const { deps, dimensionsStore } = createDeps(
      makeJobView({ status: "queued" }),
    );
    const response = await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: { wall_width: 4, wall_height: 2.5, room_depth: 5 },
      deps,
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("JOB_STATE_CONFLICT");
    expect(dimensionsStore.submit).not.toHaveBeenCalled();
  });

  it("does not invoke the store when the body is invalid", async () => {
    const { deps, dimensionsStore } = createDeps(makeJobView());
    await handleSubmitDimensionsRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      body: { wall_width: -1, wall_height: 2.5, room_depth: 5 },
      deps,
    });
    expect(dimensionsStore.submit).not.toHaveBeenCalled();
  });
});

describe("handleRequestRegenerationRequest", () => {
  const VERIFICATION_REQUEST_ID = "stub-00000000-0000-4000-8000-000000000099";
  const JOB_ID = "00000000-0000-4000-8000-0000000000a1";
  const NOW = fixedNow("2026-05-02T10:00:00Z");

  function makeValidToken() {
    return issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: NOW,
    }).token;
  }

  function makeJobView(
    overrides: Partial<SimulationJobView> = {},
  ): SimulationJobView {
    return {
      jobId: JOB_ID,
      status: "succeeded",
      roomGeometryMode: "back_wall",
      createdAt: new Date("2026-05-02T10:00:00Z"),
      retentionDeadline: new Date("2026-05-03T10:00:00Z"),
      storagePrefix: `simulations/${JOB_ID}`,
      dimensionGuideOverlayPath: `simulations/${JOB_ID}/room_dimensions.png`,
      generatedOutputCount: 1,
      latestGeneratedOutputIndex: 0,
      lastErrorMessage: null,
      lastRegenerationErrorMessage: null,
      ...overrides,
    };
  }

  function createDeps(job: SimulationJobView | null) {
    const jobReader: SimulationJobReader = {
      findOwnedJob: vi.fn().mockResolvedValue(job),
    };
    const regenerationStore: SimulationRegenerationStore = {
      request: vi.fn().mockResolvedValue({
        checkpointId: "00000000-0000-4000-8000-000000000099",
      }),
    };
    const dispatchTrigger = makeDispatchTrigger();
    return {
      deps: {
        accessTokenSecret: SECRET,
        dispatchTrigger,
        jobReader,
        regenerationStore,
        now: NOW,
      },
      jobReader,
      regenerationStore,
      dispatchTrigger,
    };
  }

  it("returns 200 + placement_queued for a succeeded job under the cap", async () => {
    const ctx = createDeps(makeJobView({ generatedOutputCount: 1 }));
    const response = await handleRequestRegenerationRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps: ctx.deps,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { simulation_job_id: string; status: string };
    };
    expect(body.data.simulation_job_id).toBe(JOB_ID);
    expect(body.data.status).toBe("placement_queued");
    expect(ctx.regenerationStore.request).toHaveBeenCalledWith({
      jobId: JOB_ID,
    });
    expect(ctx.dispatchTrigger.trigger).toHaveBeenCalledWith({
      checkpointId: "00000000-0000-4000-8000-000000000099",
      jobId: JOB_ID,
      reason: "regeneration",
    });
  });

  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleRequestRegenerationRequest({
      jobId: JOB_ID,
      token: null,
      deps,
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 JOB_NOT_FOUND when the job is not owned", async () => {
    const { deps, regenerationStore } = createDeps(null);
    const response = await handleRequestRegenerationRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    expect(response.status).toBe(404);
    expect(regenerationStore.request).not.toHaveBeenCalled();
  });

  it("returns 409 JOB_STATE_CONFLICT when status is not succeeded", async () => {
    const { deps, regenerationStore } = createDeps(
      makeJobView({ status: "awaiting_dimensions" }),
    );
    const response = await handleRequestRegenerationRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("JOB_STATE_CONFLICT");
    expect(regenerationStore.request).not.toHaveBeenCalled();
  });

  it("returns 409 REGENERATION_LIMIT_REACHED at the three-result cap", async () => {
    const { deps, regenerationStore } = createDeps(
      makeJobView({ generatedOutputCount: 3, latestGeneratedOutputIndex: 2 }),
    );
    const response = await handleRequestRegenerationRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps,
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("REGENERATION_LIMIT_REACHED");
    expect(regenerationStore.request).not.toHaveBeenCalled();
  });

  it("returns 404 JOB_NOT_FOUND for a malformed jobId", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleRequestRegenerationRequest({
      jobId: "not-a-uuid",
      token: makeValidToken(),
      deps,
    });
    expect(response.status).toBe(404);
  });
});

describe("handleCreateSimulationRequest", () => {
  const VERIFICATION_REQUEST_ID = "stub-00000000-0000-4000-8000-000000000099";
  const FABRIC_ID = "00000000-0000-4000-8000-000000000fab";
  const VISUAL_POSITION_ID = "00000000-0000-4000-8000-000000000bcd";
  const SOFA_SLUG = "test-sofa";
  const CORNER_TAG_SLUG = "corner";
  const NEW_JOB_ID = "00000000-0000-4000-8000-000000000a01";
  const NOW = fixedNow("2026-05-02T10:00:00Z");
  const RATE_LIMIT_SALT = "salt";
  const EMAIL_NORMALIZED_HASH = "verified-email-hash-1";

  function makeValidToken() {
    return issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: NOW,
    }).token;
  }

  function makeHeaders(
    options: {
      cookie?: string | null;
      idempotencyKey?: string | null;
    } = {},
  ) {
    const headers = new Headers();
    if (options.cookie === undefined) {
      headers.set("cookie", `simulation_access_token=${makeValidToken()}`);
    } else if (options.cookie !== null) {
      headers.set("cookie", options.cookie);
    }
    if (options.idempotencyKey === undefined) {
      headers.set("idempotency-key", "test-key-1");
    } else if (options.idempotencyKey !== null) {
      headers.set("idempotency-key", options.idempotencyKey);
    }
    return headers;
  }

  function makeFormData(
    overrides: {
      sofaSlug?: string | null;
      fabricId?: string | null;
      visualPositionId?: string | null;
      photoBytes?: Uint8Array | null;
      photoContentType?: string;
      photoFilename?: string;
    } = {},
  ) {
    const formData = new FormData();
    if (overrides.sofaSlug !== null) {
      formData.append("sofa_slug", overrides.sofaSlug ?? SOFA_SLUG);
    }
    if (overrides.fabricId !== null) {
      formData.append("fabric_id", overrides.fabricId ?? FABRIC_ID);
    }
    if (overrides.visualPositionId !== null) {
      formData.append(
        "visual_position_id",
        overrides.visualPositionId ?? VISUAL_POSITION_ID,
      );
    }
    if (overrides.photoBytes !== null) {
      const photoBytes =
        overrides.photoBytes ?? new Uint8Array([1, 2, 3, 4, 5]);
      const photoArrayBuffer = new ArrayBuffer(photoBytes.byteLength);
      new Uint8Array(photoArrayBuffer).set(photoBytes);
      const blob = new Blob([photoArrayBuffer], {
        type: overrides.photoContentType ?? "image/jpeg",
      });
      formData.append(
        "room_photo",
        blob,
        overrides.photoFilename ?? "room.jpg",
      );
    }
    return formData;
  }

  function createDeps(
    options: {
      rateAllowed?: boolean;
      rateTripped?: "ip" | "email";
      idempotencyAcquired?: boolean;
      idempotencyExistingJobId?: string | null;
      catalogMode?: "back_wall" | "corner" | null;
      createOk?: boolean;
      createThrows?: boolean;
      uploadThrows?: boolean;
      finalizeThrows?: boolean;
      existingJob?: SimulationJobView | null;
      roomPhotoNormalizer?: SimulationRoomPhotoNormalizer;
      verifiedSession?: { emailNormalizedHash: string } | null;
    } = {},
  ) {
    const rateLimitStore: SimulationRateLimitStore = {
      increment: vi.fn().mockResolvedValue({
        count: 1,
        allowed: options.rateAllowed ?? true,
      }),
    };
    if (options.rateTripped === "ip") {
      rateLimitStore.increment = vi.fn().mockResolvedValue({
        count: 4,
        allowed: false,
      });
    } else if (options.rateTripped === "email") {
      const incFn = vi.fn();
      incFn.mockResolvedValueOnce({ count: 1, allowed: true });
      incFn.mockResolvedValueOnce({ count: 3, allowed: false });
      rateLimitStore.increment = incFn;
    }

    const idempotencyStore: SimulationIdempotencyStore = {
      acquire: vi.fn().mockResolvedValue({
        acquired: options.idempotencyAcquired ?? true,
        simulationJobId: options.idempotencyExistingJobId ?? null,
      }),
      finalize: options.finalizeThrows
        ? vi.fn().mockRejectedValue(new Error("finalize boom"))
        : vi.fn().mockResolvedValue(undefined),
    };

    const catalogStore: SimulationCatalogStore = {
      resolveRoomGeometryMode: vi
        .fn()
        .mockResolvedValue(
          options.catalogMode === undefined ? "back_wall" : options.catalogMode,
        ),
    };

    const storageUploader: SimulationStorageUploader = {
      uploadRoomPhoto: options.uploadThrows
        ? vi.fn().mockRejectedValue(new Error("upload boom"))
        : vi.fn().mockResolvedValue(undefined),
      deleteUploadedRoomPhoto: vi.fn().mockResolvedValue(undefined),
    };
    const roomPhotoNormalizer: SimulationRoomPhotoNormalizer =
      options.roomPhotoNormalizer ?? {
        normalize: vi.fn(async (photo) => photo),
      };

    const createJobStore: SimulationCreateJobStore = {
      create: options.createThrows
        ? vi.fn().mockRejectedValue(new Error("create boom"))
        : vi.fn().mockResolvedValue(
            options.createOk === false
              ? { ok: false, reason: "triple_not_publishable" as const }
              : {
                  ok: true,
                  jobId: NEW_JOB_ID,
                  status: "queued" as const,
                  createdAt: new Date("2026-05-02T10:00:00Z"),
                  retentionDeadline: new Date("2026-05-03T10:00:00Z"),
                  storagePrefix: `simulations/${NEW_JOB_ID}`,
                },
          ),
    };

    const jobReader: SimulationJobReader = {
      findOwnedJob: vi.fn().mockResolvedValue(options.existingJob ?? null),
    };
    const sessionAccessReader: SimulationSessionAccessReader = {
      findVerifiedSession: vi
        .fn()
        .mockResolvedValue(
          options.verifiedSession === undefined
            ? { emailNormalizedHash: EMAIL_NORMALIZED_HASH }
            : options.verifiedSession,
        ),
    };
    const dispatchTrigger = makeDispatchTrigger();

    return {
      deps: {
        accessTokenSecret: SECRET,
        dispatchTrigger,
        rateLimitSalt: RATE_LIMIT_SALT,
        rateLimitIpPerDay: 3,
        rateLimitEmailPerDay: 2,
        cornerTagSlug: CORNER_TAG_SLUG,
        retentionHours: 24,
        rateLimitStore,
        idempotencyStore,
        catalogStore,
        storageUploader,
        roomPhotoNormalizer,
        createJobStore,
        jobReader,
        sessionAccessReader,
        generateJobId: () => NEW_JOB_ID,
        now: NOW,
      },
      rateLimitStore,
      idempotencyStore,
      catalogStore,
      storageUploader,
      roomPhotoNormalizer,
      createJobStore,
      jobReader,
      sessionAccessReader,
      dispatchTrigger,
    };
  }

  it("returns 201 with the new job metadata on a back_wall happy path", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: {
        simulation_job_id: string;
        status: string;
        created_at: string;
        retention_deadline: string;
      };
    };
    expect(body.data.simulation_job_id).toBe(NEW_JOB_ID);
    expect(body.data.status).toBe("queued");
    expect(ctx.storageUploader.uploadRoomPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: `simulations/${NEW_JOB_ID}/inputs/room.jpg`,
        contentType: "image/jpeg",
      }),
    );
    expect(ctx.createJobStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationRequestId: VERIFICATION_REQUEST_ID,
        sofaSlug: SOFA_SLUG,
        fabricId: FABRIC_ID,
        visualPositionId: VISUAL_POSITION_ID,
        customerRoomOriginalPath: `simulations/${NEW_JOB_ID}/inputs/room.jpg`,
        roomGeometryMode: "back_wall",
        jobIdOverride: NEW_JOB_ID,
        retentionHours: 24,
      }),
    );
    expect(ctx.dispatchTrigger.trigger).toHaveBeenCalledWith({
      jobId: NEW_JOB_ID,
      reason: "create",
    });
    expect(ctx.idempotencyStore.finalize).toHaveBeenCalledWith(
      expect.any(String),
      NEW_JOB_ID,
    );
    expect(ctx.sessionAccessReader.findVerifiedSession).toHaveBeenCalledWith({
      accessTokenHash: deriveSimulationSessionTokenHash(
        VERIFICATION_REQUEST_ID,
      ),
    });
  });

  it("uses the verified session email hash for the per-email rate limit", async () => {
    const ctx = createDeps();
    await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });

    expect(ctx.rateLimitStore.increment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        subjectKind: "email",
        subjectValueHash: expect.any(String),
      }),
    );
    const rateLimitCalls = vi.mocked(ctx.rateLimitStore.increment).mock.calls;
    expect(JSON.stringify(rateLimitCalls)).not.toContain(
      VERIFICATION_REQUEST_ID,
    );
  });

  it("derives roomGeometryMode='corner' for a corner-tagged sofa", async () => {
    const ctx = createDeps({ catalogMode: "corner" });
    await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(ctx.createJobStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ roomGeometryMode: "corner" }),
    );
  });

  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders({ cookie: null }),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(401);
  });

  it("returns 400 VALIDATION_FAILED when Idempotency-Key header is missing", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders({ idempotencyKey: null }),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
    expect(ctx.rateLimitStore.increment).not.toHaveBeenCalled();
  });

  it("returns 401 when the token does not resolve to a verified simulation session", async () => {
    const ctx = createDeps({ verifiedSession: null });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(401);
    expect(ctx.rateLimitStore.increment).not.toHaveBeenCalled();
    expect(ctx.storageUploader.uploadRoomPhoto).not.toHaveBeenCalled();
  });

  it("returns 400 when sofa_slug is missing", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({ sofaSlug: null }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
    expect(ctx.storageUploader.uploadRoomPhoto).not.toHaveBeenCalled();
  });

  it("returns 400 when fabric_id is not a UUID", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({ fabricId: "not-a-uuid" }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 when room_photo content-type is not allowed", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoContentType: "application/pdf",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
  });

  it("accepts HEIC when the browser sends a generic content-type", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoBytes: HEIC_BYTES,
        photoContentType: "application/octet-stream",
        photoFilename: "room.HEIC",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
    expect(ctx.storageUploader.uploadRoomPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: `simulations/${NEW_JOB_ID}/inputs/room.heic`,
        contentType: "image/heic",
      }),
    );
    expect(ctx.createJobStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerRoomOriginalPath: `simulations/${NEW_JOB_ID}/inputs/room.heic`,
      }),
    );
  });

  it("normalizes HEIC uploads to JPEG before storing and creating the job when configured", async () => {
    const roomPhotoNormalizer: SimulationRoomPhotoNormalizer = {
      normalize: vi.fn(async (photo) => {
        expect(photo.fileContentType).toBe("image/heic");
        expect(photo.fileExtension).toBe("heic");
        return {
          fileBytes: NORMALIZED_JPEG_BYTES,
          fileContentType: "image/jpeg",
          fileExtension: "jpg",
        };
      }),
    };
    const ctx = createDeps({ roomPhotoNormalizer });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoBytes: HEIC_BYTES,
        photoContentType: "application/octet-stream",
        photoFilename: "room.HEIC",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });

    expect(response.status).toBe(201);
    expect(roomPhotoNormalizer.normalize).toHaveBeenCalledOnce();
    expect(ctx.storageUploader.uploadRoomPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: `simulations/${NEW_JOB_ID}/inputs/room.jpg`,
        bytes: NORMALIZED_JPEG_BYTES,
        contentType: "image/jpeg",
      }),
    );
    expect(ctx.createJobStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerRoomOriginalPath: `simulations/${NEW_JOB_ID}/inputs/room.jpg`,
      }),
    );
  });

  it("returns a validation error when configured HEIC normalization fails", async () => {
    const roomPhotoNormalizer: SimulationRoomPhotoNormalizer = {
      normalize: vi.fn().mockRejectedValue(new Error("heic decode failed")),
    };
    const ctx = createDeps({ roomPhotoNormalizer });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoBytes: HEIC_BYTES,
        photoContentType: "application/octet-stream",
        photoFilename: "room.HEIC",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(ctx.storageUploader.uploadRoomPhoto).not.toHaveBeenCalled();
    expect(ctx.createJobStore.create).not.toHaveBeenCalled();
  });

  it("accepts HEIF when the browser sends an empty content-type", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoBytes: HEIF_BYTES,
        photoContentType: "",
        photoFilename: "room.heif",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
    expect(ctx.storageUploader.uploadRoomPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: `simulations/${NEW_JOB_ID}/inputs/room.heif`,
        contentType: "image/heif",
      }),
    );
  });

  it("accepts HEIC by file signature when the filename has no image extension", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoBytes: HEIC_BYTES,
        photoContentType: "application/octet-stream",
        photoFilename: "room.bin",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
    expect(ctx.storageUploader.uploadRoomPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: `simulations/${NEW_JOB_ID}/inputs/room.heic`,
        contentType: "image/heic",
      }),
    );
  });

  it("accepts HEIC when the ftyp compatible brands identify the image", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoBytes: HEIC_COMPATIBLE_BRAND_BYTES,
        photoContentType: "application/octet-stream",
        photoFilename: "room.bin",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
    expect(ctx.storageUploader.uploadRoomPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: `simulations/${NEW_JOB_ID}/inputs/room.heic`,
        contentType: "image/heic",
      }),
    );
  });

  it("rejects generic uploads without a HEIC or HEIF file signature", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({
        photoBytes: new Uint8Array([1, 2, 3, 4]),
        photoContentType: "application/octet-stream",
        photoFilename: "room.heic",
      }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
    expect(ctx.storageUploader.uploadRoomPhoto).not.toHaveBeenCalled();
  });

  it("returns 400 when room_photo is empty", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({ photoBytes: new Uint8Array() }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 when room_photo exceeds the size cap", async () => {
    const ctx = createDeps();
    const oversize = new Uint8Array(SIMULATION_CREATE_MAX_PHOTO_BYTES + 1);
    const response = await handleCreateSimulationRequest({
      formData: makeFormData({ photoBytes: oversize }),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
  });

  it("returns 429 RATE_LIMITED when the per-IP cap is reached", async () => {
    const ctx = createDeps({ rateTripped: "ip" });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(429);
    expect(ctx.idempotencyStore.acquire).not.toHaveBeenCalled();
  });

  it("returns 429 RATE_LIMITED when the per-email cap is reached", async () => {
    const ctx = createDeps({ rateTripped: "email" });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(429);
  });

  it("returns the existing job for a duplicate Idempotency-Key", async () => {
    const existingJob: SimulationJobView = {
      jobId: "00000000-0000-4000-8000-000000000abc",
      status: "queued",
      roomGeometryMode: "back_wall",
      createdAt: new Date("2026-05-02T09:00:00Z"),
      retentionDeadline: new Date("2026-05-03T09:00:00Z"),
      storagePrefix: "simulations/00000000-0000-4000-8000-000000000abc",
      dimensionGuideOverlayPath: null,
      generatedOutputCount: 0,
      latestGeneratedOutputIndex: null,
      lastErrorMessage: null,
      lastRegenerationErrorMessage: null,
    };
    const ctx = createDeps({
      idempotencyAcquired: false,
      idempotencyExistingJobId: existingJob.jobId,
      existingJob,
    });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { simulation_job_id: string };
    };
    expect(body.data.simulation_job_id).toBe(existingJob.jobId);
    expect(ctx.storageUploader.uploadRoomPhoto).not.toHaveBeenCalled();
    expect(ctx.createJobStore.create).not.toHaveBeenCalled();
  });

  it("returns 409 IDEMPOTENCY_IN_PROGRESS when the original is in flight", async () => {
    const ctx = createDeps({
      idempotencyAcquired: false,
      idempotencyExistingJobId: null,
    });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(409);
  });

  it("returns 409 IDEMPOTENCY_IN_PROGRESS when the existing job belongs to another visitor", async () => {
    const ctx = createDeps({
      idempotencyAcquired: false,
      idempotencyExistingJobId: "00000000-0000-4000-8000-000000000abc",
      existingJob: null,
    });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(409);
  });

  it("returns 400 when the catalog cannot resolve the sofa", async () => {
    const ctx = createDeps({ catalogMode: null });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
    expect(ctx.storageUploader.uploadRoomPhoto).not.toHaveBeenCalled();
  });

  it("rolls back the upload when create-job returns triple_not_publishable", async () => {
    const ctx = createDeps({ createOk: false });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(400);
    expect(ctx.storageUploader.deleteUploadedRoomPhoto).toHaveBeenCalledWith({
      storagePath: `simulations/${NEW_JOB_ID}/inputs/room.jpg`,
    });
  });

  it("rolls back the upload when create-job throws", async () => {
    const ctx = createDeps({ createThrows: true });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(500);
    expect(ctx.storageUploader.deleteUploadedRoomPhoto).toHaveBeenCalled();
  });

  it("returns 500 without rolling back when only the upload fails", async () => {
    const ctx = createDeps({ uploadThrows: true });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(500);
    expect(ctx.createJobStore.create).not.toHaveBeenCalled();
    expect(ctx.storageUploader.deleteUploadedRoomPhoto).not.toHaveBeenCalled();
  });

  it("creates the durable job without a legacy pgmq dependency", async () => {
    const ctx = createDeps();
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
    expect(ctx.storageUploader.deleteUploadedRoomPhoto).not.toHaveBeenCalled();
  });

  it("logs the underlying error when uploadRoomPhoto throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = createDeps({ uploadThrows: true });
    await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[simulations] uploadRoomPhoto failed:",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("logs the underlying error when createJobStore.create throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = createDeps({ createThrows: true });
    await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[simulations] createJobStore.create failed:",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("still returns 201 even if the idempotency finalize step throws", async () => {
    const ctx = createDeps({ finalizeThrows: true });
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
  });

  it("reads the Idempotency-Key header case-insensitively", async () => {
    const ctx = createDeps();
    const headers = new Headers();
    headers.set("cookie", `simulation_access_token=${makeValidToken()}`);
    headers.set("Idempotency-Key", "case-test");
    const response = await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers,
      clientIp: "203.0.113.7",
      deps: ctx.deps,
    });
    expect(response.status).toBe(201);
  });

  it("uses the configured corner-tag slug when calling the catalog", async () => {
    const ctx = createDeps();
    await handleCreateSimulationRequest({
      formData: makeFormData(),
      headers: makeHeaders(),
      clientIp: "203.0.113.7",
      deps: { ...ctx.deps, cornerTagSlug: "l-shape" },
    });
    expect(ctx.catalogStore.resolveRoomGeometryMode).toHaveBeenCalledWith({
      sofaSlug: SOFA_SLUG,
      cornerTagSlug: "l-shape",
    });
  });
});
