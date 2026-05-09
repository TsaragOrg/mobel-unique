import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSupabaseSimulationDispatchTrigger,
  createSupabaseSimulationEmailOtpProvider,
  createSupabaseSimulationEmailVerificationStore,
  createSupabaseSimulationCreateJobStore,
  createSupabaseSimulationDimensionsStore,
  createSupabaseSimulationRegenerationStore,
  createSupabaseSimulationSessionAccessReader,
} from "./simulation-public-server";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public simulation Supabase stores", () => {
  it("triggers the in-home worker dispatch endpoint after durable writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          function_name: "in-home-simulation-worker",
          mode: "dispatch",
          processed: 1,
          status: "claimed",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const trigger = createSupabaseSimulationDispatchTrigger({
      functionUrl:
        "http://127.0.0.1:54321/functions/v1/in-home-simulation-worker",
      invokeSecret: "worker-secret",
      timeoutMs: 1000,
    });

    await trigger.trigger({
      checkpointId: "00000000-0000-4000-8000-000000000111",
      jobId: "00000000-0000-4000-8000-000000000001",
      reason: "dimensions",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/in-home-simulation-worker",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-in-home-simulation-worker-secret": "worker-secret",
        }),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody).toEqual({
      checkpoint_id: "00000000-0000-4000-8000-000000000111",
      job_id: "00000000-0000-4000-8000-000000000001",
      mode: "dispatch",
      reason: "dimensions",
      source: "public-api",
    });
  });

  it("creates email verification requests through the PLAN-0074 RPC without plaintext email", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            out_verification_request_id: "00000000-0000-4000-8000-000000000101",
            out_expires_at: "2026-05-08T01:00:00.000Z",
          },
        ],
        error: null,
      }),
    };
    const store = createSupabaseSimulationEmailVerificationStore(
      client as never,
      {
        emailEncryptionSecret: "email-encryption-secret",
        emailHashSecret: "email-hash-secret",
      },
    );

    await expect(
      store.createRequest({
        email: "Visitor@Example.com",
        consentEmailUse: true,
        consentMarketing: false,
        expiresAt: new Date("2026-05-08T01:00:00.000Z"),
      }),
    ).resolves.toEqual({
      verificationRequestId: "00000000-0000-4000-8000-000000000101",
      expiresAt: new Date("2026-05-08T01:00:00.000Z"),
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_public_simulation_email_verification_request",
      expect.objectContaining({
        p_email_address_encrypted: expect.not.stringContaining(
          "Visitor@Example.com",
        ),
        p_email_normalized_hash: expect.any(String),
        p_optional_commercial_decision: "rejected",
        p_expires_at: "2026-05-08T01:00:00.000Z",
      }),
    );
  });

  it("delegates OTP send and verification to Supabase Auth without returning sessions", async () => {
    const client = {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
        verifyOtp: vi.fn().mockResolvedValue({
          data: {
            user: { id: "00000000-0000-4000-8000-000000000202" },
            session: {
              access_token: "supabase-access-token",
              refresh_token: "supabase-refresh-token",
            },
          },
          error: null,
        }),
      },
    };
    const provider = createSupabaseSimulationEmailOtpProvider(client as never);

    await expect(
      provider.sendOtp({ email: "visitor@example.com" }),
    ).resolves.toEqual({ ok: true });
    await expect(
      provider.verifyOtp({ email: "visitor@example.com", code: "123456" }),
    ).resolves.toEqual({
      ok: true,
      authUserId: "00000000-0000-4000-8000-000000000202",
    });

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "visitor@example.com",
      options: {
        shouldCreateUser: true,
        data: {
          public_simulation_transient: true,
          public_simulation_purpose: "in_home_simulation_email_otp",
        },
      },
    });
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      email: "visitor@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("reads only active non-expired verified simulation sessions", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                email_normalized_hash: "email-hash-1",
                status: "active",
                expires_at: "2999-01-01T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    const reader = createSupabaseSimulationSessionAccessReader(client as never);

    await expect(
      reader.findVerifiedSession({ accessTokenHash: "token-hash-1" }),
    ).resolves.toEqual({ emailNormalizedHash: "email-hash-1" });
  });

  it("submits dimensions through the dispatch-outbox RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: "00000000-0000-4000-8000-000000000111",
        error: null,
      }),
    };
    const store = createSupabaseSimulationDimensionsStore(client as never);

    await expect(
      store.submit({
        jobId: "00000000-0000-4000-8000-000000000001",
        suppliedDimensions: {
          wall_width: 4.2,
          wall_height: 2.7,
          room_depth: 5,
        },
      }),
    ).resolves.toEqual({
      checkpointId: "00000000-0000-4000-8000-000000000111",
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "submit_in_home_simulation_dimensions_dispatch_outbox",
      {
        p_job_id: "00000000-0000-4000-8000-000000000001",
        p_supplied_dimensions: {
          wall_width: 4.2,
          wall_height: 2.7,
          room_depth: 5,
        },
      },
    );
  });

  it("requests regeneration through the dispatch-outbox RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: "00000000-0000-4000-8000-000000000222",
        error: null,
      }),
    };
    const store = createSupabaseSimulationRegenerationStore(client as never);

    await expect(
      store.request({
        jobId: "00000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual({
      checkpointId: "00000000-0000-4000-8000-000000000222",
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "request_in_home_simulation_regeneration_dispatch_outbox",
      {
        p_job_id: "00000000-0000-4000-8000-000000000002",
        p_supplied_dimensions: null,
      },
    );
  });

  it("creates jobs through the dispatch-outbox RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            out_job_id: "00000000-0000-4000-8000-000000000003",
            out_status: "queued",
            out_created_at: "2026-05-08T00:00:00.000Z",
            out_retention_deadline: "2026-05-09T00:00:00.000Z",
            out_room_geometry_mode: "back_wall",
            out_storage_prefix:
              "simulations/00000000-0000-4000-8000-000000000003",
          },
        ],
        error: null,
      }),
    };
    const store = createSupabaseSimulationCreateJobStore(client as never);

    await expect(
      store.create({
        verificationRequestId: "verify-1",
        sofaSlug: "sofa-1",
        fabricId: "00000000-0000-4000-8000-000000000004",
        visualPositionId: "00000000-0000-4000-8000-000000000005",
        customerRoomOriginalPath:
          "simulations/00000000-0000-4000-8000-000000000003/inputs/room.jpg",
        roomGeometryMode: "back_wall",
        jobIdOverride: "00000000-0000-4000-8000-000000000003",
        retentionHours: 24,
      }),
    ).resolves.toMatchObject({
      ok: true,
      jobId: "00000000-0000-4000-8000-000000000003",
      status: "queued",
      storagePrefix: "simulations/00000000-0000-4000-8000-000000000003",
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_in_home_simulation_job_for_visitor_dispatch_outbox",
      expect.objectContaining({
        p_verification_request_id: "verify-1",
        p_sofa_slug: "sofa-1",
        p_job_id_override: "00000000-0000-4000-8000-000000000003",
      }),
    );
  });
});
