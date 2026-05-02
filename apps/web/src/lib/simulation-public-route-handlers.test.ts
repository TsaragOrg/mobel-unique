import { describe, expect, it, vi } from "vitest";

import {
  SIMULATION_ACCESS_TOKEN_COOKIE,
  deriveSimulationSessionTokenHash,
  issueSimulationAccessToken
} from "./simulation-access-token";
import {
  VERIFICATION_REQUEST_TTL_SECONDS,
  handleCreateEmailVerificationRequest,
  handleGetSimulationStatusRequest,
  handleVerifyEmailVerificationRequest,
  type SimulationJobReader,
  type SimulationJobView,
  type SimulationStorageSigner
} from "./simulation-public-route-handlers";
import type { SimulationStatusResponse } from "./simulation-public-api";

const SECRET = "test-secret";

function fixedNow(iso: string) {
  const date = new Date(iso);
  return () => date;
}

describe("handleCreateEmailVerificationRequest", () => {
  it("returns 200 with the generated verification_request_id", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z"),
        generateVerificationRequestId: () => "stub-deterministic-id"
      }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { verification_request_id: string; expires_at: string };
    };
    expect(body.data.verification_request_id).toBe("stub-deterministic-id");
  });

  it("returns expires_at one hour after now", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z"),
        generateVerificationRequestId: () => "stub-x"
      }
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
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z"),
        generateVerificationRequestId: () => "stub-x"
      }
    });
    expect(response.headers.get("set-cookie")).toBe(null);
  });

  it("rejects a missing email", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { consent_email_use: true },
      deps: { accessTokenSecret: SECRET, environment: "local" }
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
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });

  it("rejects consent_email_use=false", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: false },
      deps: { accessTokenSecret: SECRET, environment: "local" }
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
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });
});

describe("handleVerifyEmailVerificationRequest", () => {
  it("returns 200 with a valid simulation_access_token", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-deterministic-id",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { simulation_access_token: string; expires_at: string };
    };
    expect(body.data.simulation_access_token.startsWith("dev-token-")).toBe(
      true
    );
  });

  it("sets the simulation_access_token cookie", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-deterministic-id",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
    });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).not.toBe(null);
    expect(cookie).toContain(`${SIMULATION_ACCESS_TOKEN_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("adds Secure to the cookie when environment is dev", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-deterministic-id",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "dev",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
    });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("Secure");
  });

  it("rejects a verification_request_id without the stub- prefix", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "real-12345",
      body: { code: "123456" },
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a body without a code field", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-x",
      body: {},
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });

  it("rejects a non-object body", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-x",
      body: "not-json-object",
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });

  it("returns expires_at 24 hours after issuance", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-x",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
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
      now: NOW
    });
    return issued.token;
  }

  function makeJobView(
    overrides: Partial<SimulationJobView> = {}
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
      ...overrides
    };
  }

  function createDeps(
    job: SimulationJobView | null,
    options: {
      signedUrlMap?: Record<string, string>;
    } = {}
  ) {
    const signedUrlMap = options.signedUrlMap ?? {};
    const jobReader: SimulationJobReader = {
      findOwnedJob: vi.fn().mockResolvedValue(job)
    };
    const storageSigner: SimulationStorageSigner = {
      signObjectUrl: vi.fn().mockImplementation(async (input) => {
        return (
          signedUrlMap[input.storagePath] ??
          `https://signed.example/${input.storagePath}?ttl=${input.ttlSeconds}`
        );
      })
    };
    return {
      deps: {
        accessTokenSecret: SECRET,
        jobReader,
        storageSigner,
        now: NOW
      },
      jobReader,
      storageSigner
    };
  }

  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: null,
      deps
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
      deps
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
      deps
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
      deps
    });
    expect(response.status).toBe(404);
    expect(jobReader.findOwnedJob).toHaveBeenCalledWith({
      jobId: JOB_ID,
      accessTokenHash: deriveSimulationSessionTokenHash(VERIFICATION_REQUEST_ID)
    });
  });

  it("returns 200 with the canonical status payload for a queued job", async () => {
    const { deps } = createDeps(makeJobView({ status: "queued" }));
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
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
        dimensionGuideOverlayPath: `simulations/${JOB_ID}/room_dimensions.png`
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.required_dimensions).toEqual([
      "wall_width",
      "wall_height",
      "room_depth"
    ]);
    expect(body.data.dimension_guide_overlay_url).toContain(
      `simulations/${JOB_ID}/room_dimensions.png`
    );
    expect(storageSigner.signObjectUrl).toHaveBeenCalledWith({
      storagePath: `simulations/${JOB_ID}/room_dimensions.png`,
      ttlSeconds: 120
    });
  });

  it("returns the four-key required_dimensions for corner awaiting_dimensions", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "awaiting_dimensions",
        roomGeometryMode: "corner",
        dimensionGuideOverlayPath: `simulations/${JOB_ID}/room_dimensions.png`
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.required_dimensions).toEqual([
      "left_wall_width",
      "right_wall_width",
      "room_height",
      "room_depth"
    ]);
  });

  it("returns latest_output_url and regeneration_available=true for succeeded under the limit", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "succeeded",
        generatedOutputCount: 1,
        latestGeneratedOutputIndex: 0
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.status).toBe("succeeded");
    expect(body.data.regeneration_available).toBe(true);
    expect(body.data.latest_output_url).toContain(
      `simulations/${JOB_ID}/outputs/output-0.png`
    );
  });

  it("returns regeneration_available=false when the three-result cap is reached", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "succeeded",
        generatedOutputCount: 3,
        latestGeneratedOutputIndex: 2
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
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
        latestGeneratedOutputIndex: 0
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.latest_output_url).toContain("output-0.png");
    expect(body.data.regeneration_available).toBe(false);
  });

  it("includes the last_error on a failed job", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "failed",
        lastErrorMessage: "validation_rejected"
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
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
        lastRegenerationErrorMessage: "placement_failed"
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
    });
    const body = (await response.json()) as { data: SimulationStatusResponse };
    expect(body.data.last_error).toBe("placement_failed");
  });

  it("returns minimal payload for an expired job", async () => {
    const { deps } = createDeps(
      makeJobView({
        status: "expired",
        generatedOutputCount: 0,
        latestGeneratedOutputIndex: null
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
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
      deps
    });
    const expectedHash = deriveSimulationSessionTokenHash(
      VERIFICATION_REQUEST_ID
    );
    expect(jobReader.findOwnedJob).toHaveBeenCalledWith({
      jobId: JOB_ID,
      accessTokenHash: expectedHash
    });
  });

  it("respects the configured signed URL TTL", async () => {
    const { deps, storageSigner } = createDeps(
      makeJobView({
        status: "succeeded",
        generatedOutputCount: 1,
        latestGeneratedOutputIndex: 0
      })
    );
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps: { ...deps, signedUrlTtlSeconds: 30 }
    });
    expect(response.status).toBe(200);
    expect(storageSigner.signObjectUrl).toHaveBeenCalledWith({
      storagePath: `simulations/${JOB_ID}/outputs/output-0.png`,
      ttlSeconds: 30
    });
  });

  it("never sets a Set-Cookie header on the status response", async () => {
    const { deps } = createDeps(makeJobView());
    const response = await handleGetSimulationStatusRequest({
      jobId: JOB_ID,
      token: makeValidToken(),
      deps
    });
    expect(response.headers.get("set-cookie")).toBe(null);
  });
});
