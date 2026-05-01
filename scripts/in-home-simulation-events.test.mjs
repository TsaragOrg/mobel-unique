import { describe, expect, it } from "vitest";

import {
  IN_HOME_SIMULATION_JOB_TYPE,
  buildStageTransitionEvent,
  buildSubStepEvent
} from "../supabase/functions/in-home-simulation-worker/lib/events.ts";

describe("buildStageTransitionEvent", () => {
  it("emits the in-home simulation job type and event type stage_transition", () => {
    const event = buildStageTransitionEvent({
      jobId: "abc-123",
      fromStatus: "queued",
      toStatus: "room_prep_processing",
      message: "claimed by edge-1"
    });

    expect(event.job_type).toBe(IN_HOME_SIMULATION_JOB_TYPE);
    expect(event.in_home_simulation_job_id).toBe("abc-123");
    expect(event.fabric_render_job_id).toBeNull();
    expect(event.event_type).toBe("stage_transition");
    expect(event.from_status).toBe("queued");
    expect(event.to_status).toBe("room_prep_processing");
    expect(event.message).toBe("claimed by edge-1");
  });

  it("rejects an empty job id", () => {
    expect(() =>
      buildStageTransitionEvent({
        jobId: "",
        fromStatus: "queued",
        toStatus: "room_prep_processing"
      })
    ).toThrow(/job id/);
  });

  it("rejects an empty toStatus", () => {
    expect(() =>
      buildStageTransitionEvent({
        jobId: "abc",
        fromStatus: "queued",
        toStatus: ""
      })
    ).toThrow(/toStatus/);
  });
});

describe("buildSubStepEvent", () => {
  it("captures the sub-step name, provider, model, and prompt version in metadata", () => {
    const event = buildSubStepEvent({
      jobId: "abc-123",
      step: "geometry",
      providerName: "mock",
      providerModel: "mock-geometry-v001",
      promptVersion: "room_prep_v001",
      attempt: 2
    });

    expect(event.job_type).toBe(IN_HOME_SIMULATION_JOB_TYPE);
    expect(event.in_home_simulation_job_id).toBe("abc-123");
    expect(event.event_type).toBe("sub_step");
    expect(event.metadata).toEqual({
      step: "geometry",
      provider_name: "mock",
      provider_model: "mock-geometry-v001",
      prompt_version: "room_prep_v001",
      attempt: 2
    });
  });

  it("omits attempt from metadata when not provided", () => {
    const event = buildSubStepEvent({
      jobId: "abc-123",
      step: "validation",
      providerName: "mock",
      providerModel: "mock-validator-v001",
      promptVersion: "room_prep_v001"
    });

    expect(event.metadata.attempt).toBeUndefined();
  });

  it("rejects an empty job id, step, provider, or prompt version", () => {
    expect(() =>
      buildSubStepEvent({
        jobId: "",
        step: "x",
        providerName: "mock",
        providerModel: "y",
        promptVersion: "z"
      })
    ).toThrow(/job id/);
    expect(() =>
      buildSubStepEvent({
        jobId: "abc",
        step: "",
        providerName: "mock",
        providerModel: "y",
        promptVersion: "z"
      })
    ).toThrow(/step/);
  });
});
