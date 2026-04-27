# PLAN-0012 In-Home Simulation Resilience And Purge

Plan: PLAN-0012
Spec: SPEC-0007
Status: active
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker`
- `supabase/functions/in-home-simulation-purge`
- `supabase/migrations`
- `scripts`
- `package.json`
- `.env.example`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`

## Goal

Make the in-home simulation worker defined by `SPEC-0007` operationally safe
in local Supabase, by implementing the per-stage retry policy, expired-claim
recovery, the 24-hour retention purge, the orphaned room-upload cleanup, and
the operational observability surface required by the spec, building on the
Stage 1 and Stage 2 behavior delivered by `PLAN-0010` and `PLAN-0011`.

This plan delivers:

- the per-stage retry policy that distinguishes retryable provider, network,
  timeout, and rate-limit errors from non-retryable errors such as missing or
  unreadable inputs, unsupported image format, validation failure, missing
  required environment variables, regeneration cap, and expired retention;
- expired-claim recovery that moves `room_prep_processing` back to
  `queued` and `placement_processing` back to `placement_queued` only when
  attempts remain and the retention deadline has not passed, and otherwise
  marks the job `failed` with a claim-expired reason;
- a separate `in-home-simulation-purge` Edge Function that, on demand or on
  cron, deletes the full `simulations/{job_id}/` storage prefix, transitions
  the job to `expired`, sets `expired_at`, and preserves the operational
  metadata required by the SPEC-0003 lightweight overview;
- an orphaned-upload cleanup path that removes objects under
  `simulation-private-artifacts` whose owning job no longer exists or whose
  job creation never completed and whose age exceeds one hour;
- the observability surface required by `SPEC-0007 Observability`, including
  status-transition timestamps, attempt counters, provider and model used per
  sub-step, prompt version per family, input and output artifact references,
  and the failure message;
- local CLIs for triggering claim recovery, the purge job, and the orphan
  cleanup in development, plus an extension of `pnpm sim:status` that prints
  the operational view for a given job.

This plan does not change the Stage 1 or Stage 2 sub-step behavior delivered
by `PLAN-0010` and `PLAN-0011` and does not introduce a separate operational
events queue. The MVP operational view stays on database state per
`SPEC-0007 Observability`.

## Tasks

- [ ] Add or update resilience and purge tests so they fail before
      implementation begins.
- [ ] Implement the per-stage retry policy inside the
      `in-home-simulation-worker` Edge Function so transient provider,
      network, timeout, and rate-limit errors decrement attempts and re-queue
      the same stage when attempts remain, and so non-retryable failures move
      the job to `failed` immediately.
- [ ] Implement the expired-claim recovery path, either as a Postgres function
      or as a queue-driven Edge Function path, that scans
      `in_home_simulation_jobs` rows whose `claim_expires_at` is in the past,
      reloads the job before any image work, returns the job to `queued` or
      `placement_queued` while attempts remain and the retention deadline has
      not passed, and otherwise marks the job `failed` with a
      claim-expired reason in `last_error_message`.
- [ ] Add a recovery sweep CLI under `scripts/in-home-simulation/` exposed as
      `pnpm sim:recover-expired` that runs the recovery path once against
      local Supabase and prints a summary of recovered and failed jobs.
- [ ] Create `supabase/functions/in-home-simulation-purge/` with a Deno entry
      point that, given a target time horizon, lists `in_home_simulation_jobs`
      rows whose `retention_deadline` is in the past, deletes the full
      `simulations/{job_id}/` prefix from `simulation-private-artifacts`,
      sets the row to `status = 'expired'`, sets `expired_at`, clears
      `reserved_generation_index` and `claim_expires_at`, and updates each
      `simulation_generated_outputs` row's `purged_at` for the deleted
      objects.
- [ ] Make the purge function idempotent: a missing object under the job
      prefix counts as already deleted, and a repeated purge attempt for the
      same job must not fail because earlier files were already removed.
- [ ] Implement the orphan room-upload cleanup as part of the purge function
      or as a sibling helper, deleting objects under
      `simulation-private-artifacts` whose owning row does not exist in
      `in_home_simulation_jobs`, that are older than one hour, and that match
      the room-upload path shape.
- [ ] Add a `pnpm sim:purge` CLI that triggers the purge function once
      against local Supabase and prints a summary of purged jobs and orphan
      objects.
- [ ] Add the operational view payload assembly in `pnpm sim:status` so it
      prints the SPEC-0007 observability fields: status transitions with
      timestamps, attempt counters per stage, provider and model used per
      sub-step from the persisted artifacts and outputs, prompt versions per
      family, input artifact paths, output artifact paths, and the latest
      failure message when present.
- [ ] Refuse to start any stage on a job whose `retention_deadline` has
      already passed, with a clear non-retryable failure path that does not
      consume the per-stage attempt budget intended for transient retries.
- [ ] Update `.env.example` with any new resilience and purge variables (for
      example a recovery sweep batch size, a purge dry-run flag, and the
      orphan upload age threshold), keeping `SIMULATION_RETENTION_HOURS`
      capped at the SPEC-0003 maximum of 24.
- [ ] Extend `pnpm test:workers:local` so the existing smoke gate runs the
      resilience and purge smoke tests alongside the worker-smoke, Stage 1,
      and Stage 2 checks, skipping with a clear message when local Supabase
      is not running and failing clearly when claim recovery, purge, or the
      observability view do not match `SPEC-0007`.
- [ ] Update the image worker and Supabase roadmaps to record this plan as
      active.
- [ ] Run the narrowest checks first
      (`pnpm --filter ./supabase/functions/... typecheck`,
      `pnpm test:workers:local`), then `pnpm spec:check`, and finally
      `pnpm check`.

## Tests

Add or update tests before implementation:

- a retryable-error contract test that confirms a transient provider error in
  Stage 1 or Stage 2 increments the per-stage attempt counter, leaves
  retryable failure metadata on the job, and re-queues the same stage when
  attempts remain;
- a non-retryable-error contract test covering missing input artifact,
  unsupported image format, dimension validation rejection, missing required
  environment variable, regeneration cap exceeded, and retention deadline
  passed, asserting that each transitions the job to `failed` immediately
  without consuming the remaining transient retry budget;
- a claim-expiry recovery contract test that asserts a stuck
  `room_prep_processing` job whose `claim_expires_at` is in the past and
  whose `room_prep_attempt_count` is below `max_attempts_per_stage` returns
  to `queued`, and that the same scenario at the attempt cap moves the job
  to `failed` with a claim-expired `last_error_message`;
- the same recovery test for `placement_processing` -> `placement_queued`;
- a retention purge contract test that asserts a job past its
  `retention_deadline` is purged: every object under
  `simulations/{job_id}/` is deleted, the job row is set to
  `status = 'expired'` with `expired_at`, and every related
  `simulation_generated_outputs` row has `purged_at` set;
- a purge idempotency test that runs the purge twice against the same job
  and asserts the second run is a clean no-op rather than a failure;
- an orphan upload cleanup test that asserts an upload object with no
  matching `in_home_simulation_jobs` row, older than one hour, is deleted,
  while an upload younger than one hour is retained;
- an observability payload test that asserts the `pnpm sim:status` output
  for a `succeeded` job lists every SPEC-0007 observability field with the
  expected values from the persisted artifacts, output rows, and status
  transitions.

The resilience and purge smoke gate may skip with a clear message when
local Supabase is not running, but it must fail clearly when local Supabase
is running with missing recovery behavior, missing purge behavior, missing
orphan cleanup behavior, or an observability view that drifts from
`SPEC-0007`.

## Roadmap

Update these roadmap files when implementation changes are made:

- `docs/roadmap/image-worker.md`;
- `docs/roadmap/supabase.md`;
- `docs/roadmap/workflow.md` if new shared local quality-gate commands are
  added;
- `docs/roadmap/api.md` if Edge Function naming, recovery, or purge
  conventions change in a way that affects future API plans.

## Notes

The recovery and purge paths must reload the target row from the database
before doing any work, and must skip the row when it is missing, already
expired, canceled, failed, or in a status that does not match the recovery
or purge precondition. This protects against time-of-check to time-of-use
races between the worker, the API, and the recovery sweep.

The purge function must delete every generated output under the job prefix,
including all regeneration outputs, not only the latest result shown to the
visitor. The persistent output path shape is
`simulations/{job_id}/outputs/output-{index}.png` per `SPEC-0007 Storage`.

The MVP must not introduce a public `upload_pending` job status. Orphaned
uploads must be removed by deletion plus the one-hour age threshold rather
than by adding a status that is reachable from the visitor flow.

The operational view payload must not expose private image content beyond
what is strictly necessary for an operator to act on a failure. Signed URLs
in the operational payload must be short-lived and must not make the
underlying private bucket public.

The recovery and purge CLIs must use only local Supabase URLs and the local
service-role key from the local environment. They must refuse to run when
their resolved Supabase URL points at DEV or PROD.

This plan does not migrate any new database tables or buckets. Schema and
storage already match `SPEC-0007` requirements through migration
`20260427000200_spec_0009_data_model_and_storage.sql`. If implementation
discovers a missing index, helper function, or constraint required by
recovery, purge, or observability, that gap must be addressed through a new
migration in this plan rather than by mutating the accepted SPEC-0009
migration.
