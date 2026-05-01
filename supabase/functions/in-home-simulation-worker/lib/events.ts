// SPEC-0007 PLAN-0012 in-home simulation worker observability events.
//
// SPEC-0007 Observability requires the worker to record status
// transitions, attempt counters, providers and prompt versions per
// sub-step, and failure messages. Per-spec the MVP overview stays on
// database state. The worker writes those events into the
// `worker_job_events` table from SPEC-0009 so an operator can
// reconstruct a job timeline through SQL.

export const IN_HOME_SIMULATION_JOB_TYPE = "in_home_simulation";

export type WorkerJobEventRow = {
  job_type: typeof IN_HOME_SIMULATION_JOB_TYPE;
  in_home_simulation_job_id: string;
  fabric_render_job_id: null;
  from_status: string | null;
  to_status: string | null;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown>;
};

export type StageTransitionInput = {
  jobId: string;
  fromStatus: string | null;
  toStatus: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value;
}

export function buildStageTransitionEvent(
  input: StageTransitionInput
): WorkerJobEventRow {
  requireNonEmpty(input.jobId, "job id");
  requireNonEmpty(input.toStatus, "toStatus");

  return {
    job_type: IN_HOME_SIMULATION_JOB_TYPE,
    in_home_simulation_job_id: input.jobId,
    fabric_render_job_id: null,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus,
    event_type: "stage_transition",
    message: input.message ?? null,
    metadata: input.metadata ?? {}
  };
}

export type SubStepInput = {
  jobId: string;
  step: string;
  providerName: string;
  providerModel: string;
  promptVersion: string;
  attempt?: number;
  message?: string;
  extra?: Record<string, unknown>;
};

export function buildSubStepEvent(input: SubStepInput): WorkerJobEventRow {
  requireNonEmpty(input.jobId, "job id");
  requireNonEmpty(input.step, "step");
  requireNonEmpty(input.providerName, "providerName");
  requireNonEmpty(input.providerModel, "providerModel");
  requireNonEmpty(input.promptVersion, "promptVersion");

  const metadata: Record<string, unknown> = {
    step: input.step,
    provider_name: input.providerName,
    provider_model: input.providerModel,
    prompt_version: input.promptVersion
  };
  if (typeof input.attempt === "number" && Number.isFinite(input.attempt)) {
    metadata.attempt = input.attempt;
  }
  if (input.extra) {
    Object.assign(metadata, input.extra);
  }

  return {
    job_type: IN_HOME_SIMULATION_JOB_TYPE,
    in_home_simulation_job_id: input.jobId,
    fabric_render_job_id: null,
    from_status: null,
    to_status: null,
    event_type: "sub_step",
    message: input.message ?? null,
    metadata
  };
}
