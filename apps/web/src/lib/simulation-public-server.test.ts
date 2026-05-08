import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseSimulationCreateJobStore,
  createSupabaseSimulationDimensionsStore,
  createSupabaseSimulationRegenerationStore
} from "./simulation-public-server";

describe("public simulation Supabase stores", () => {
  it("submits dimensions through the dispatch-outbox RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: "00000000-0000-4000-8000-000000000111",
        error: null
      })
    };
    const store = createSupabaseSimulationDimensionsStore(client as never);

    await expect(
      store.submit({
        jobId: "00000000-0000-4000-8000-000000000001",
        suppliedDimensions: {
          wall_width: 4.2,
          wall_height: 2.7,
          room_depth: 5
        }
      })
    ).resolves.toEqual({
      checkpointId: "00000000-0000-4000-8000-000000000111"
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "submit_in_home_simulation_dimensions_dispatch_outbox",
      {
        p_job_id: "00000000-0000-4000-8000-000000000001",
        p_supplied_dimensions: {
          wall_width: 4.2,
          wall_height: 2.7,
          room_depth: 5
        }
      }
    );
  });

  it("requests regeneration through the dispatch-outbox RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: "00000000-0000-4000-8000-000000000222",
        error: null
      })
    };
    const store = createSupabaseSimulationRegenerationStore(client as never);

    await expect(
      store.request({
        jobId: "00000000-0000-4000-8000-000000000002"
      })
    ).resolves.toEqual({
      checkpointId: "00000000-0000-4000-8000-000000000222"
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "request_in_home_simulation_regeneration_dispatch_outbox",
      {
        p_job_id: "00000000-0000-4000-8000-000000000002",
        p_supplied_dimensions: null
      }
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
              "simulations/00000000-0000-4000-8000-000000000003"
          }
        ],
        error: null
      })
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
        retentionHours: 24
      })
    ).resolves.toMatchObject({
      ok: true,
      jobId: "00000000-0000-4000-8000-000000000003",
      status: "queued",
      storagePrefix: "simulations/00000000-0000-4000-8000-000000000003"
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_in_home_simulation_job_for_visitor_dispatch_outbox",
      expect.objectContaining({
        p_verification_request_id: "verify-1",
        p_sofa_slug: "sofa-1",
        p_job_id_override: "00000000-0000-4000-8000-000000000003"
      })
    );
  });
});
