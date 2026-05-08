# PLAN-0053 In-Home Simulation Worker Stage 1 Checkpoint Refactor

Plan: PLAN-0053
Spec: SPEC-0015
Status: done
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker/index.ts`
- `scripts/in-home-simulation-stage-1-checkpoint.test.mjs` (new)
- `docs/roadmap/supabase.md`

## Goal

Make Stage 1 (room preparation) survive the Supabase Edge Functions
150-second wall-clock limit on the Free tier without changing any DB
schema, RPCs, or frontend code.

End-to-end testing on dev exposed the limit: `validate (~5s) +
cleaning (~30-50s) + corners (up to 3 retries × 30-50s)` exceeds 150s
on harder photos, so the function dies with `IDLE_TIMEOUT 504` and
the job stays stuck in `room_prep_processing` forever (no cron-driven
recovery exists).

This plan splits Stage 1 into two checkpoints inside the worker. Each
checkpoint runs in its own invocation, well under 150s. The job's
on-storage artifacts are the source of truth for which checkpoint
already ran. Status remains `room_prep_processing` across both, so
the public API and wizard see the same in-progress state until the
second checkpoint transitions to `awaiting_dimensions` exactly once.

## Scope

This plan covers:

- `processClaimedJob` reads the full job row after claim, decides
  whether to run the cleaning checkpoint or the corners checkpoint,
  and exits without writing anything beyond the artifacts and the
  re-enqueue when only the cleaning side ran.
- A new `fetchInHomeSimulationJobRow` helper that reads the
  artifact-path columns from the job table via PostgREST so the
  worker does not need a new RPC.
- Persisting `room_normalized_path`, `room_compressed_path`, and
  `room_cleaned_path` via a direct PATCH to
  `/rest/v1/in_home_simulation_jobs?id=eq.<id>` after the cleaning
  step succeeds.
- Releasing the claim and re-enqueueing the same job into the same
  pgmq queue so the next cron tick picks it up to run the corners
  checkpoint.
- A focused vitest spec covering the checkpoint dispatch logic
  (which step runs based on the claim row state) without standing
  up the OpenAI providers.

This plan does **not** include:

- DB schema changes, new RPCs, or migrations.
- Frontend or API changes.
- Stage 2 (placement) refactoring; placement has its own potential
  150s budget concern handled separately if observed (PLAN-0054).
- Provider behaviour changes (cleaning prompt, corners retry count,
  validate prompt all stay identical).

## Tasks

- [ ] Add `fetchInHomeSimulationJobRow(supabaseUrl, serviceRoleKey,
      jobId)` helper that does `GET
      /rest/v1/in_home_simulation_jobs?id=eq.<id>&select=room_cleaned_path,
      room_normalized_path,room_compressed_path,room_geometry_points,
      room_geometry_mode,storage_prefix,customer_room_original_path`
      and returns the typed row.
- [ ] Add `persistCleaningCheckpoint(supabaseUrl, serviceRoleKey,
      jobId, paths)` helper that does a PATCH to the same endpoint
      writing `room_normalized_path`, `room_compressed_path`, and
      `room_cleaned_path`. Mirrors the existing `failJobNonRetryable`
      direct-PATCH style.
- [ ] Refactor `processClaimedJob`:
  - read full row;
  - if `room_cleaned_path` is null: run `validate -> compress ->
    clean`, upload three storage artifacts, persist paths via
    PATCH, call `release_in_home_simulation_room_prep_claim`, call
    `enqueue_in_home_simulation_room_prep_message` to push a fresh
    queue message, write a `worker_job_event` of type
    `stage_1_cleaning_checkpoint_completed`, and return so the
    outer `Deno.serve` deletes the original pgmq message;
  - if `room_cleaned_path` exists and `room_geometry_points` is
    null: run `corners -> dot detect -> classify -> draw lines`,
    upload `room_corners.png` and `room_dimensions.png`, call the
    existing `complete_in_home_simulation_room_prep_stage` RPC
    (which is responsible for the `awaiting_dimensions`
    transition); the outer flow records the existing
    `stage_1_completed` transition event.
- [ ] Threading: pass `queueName` from `Deno.serve` through to
      `processClaimedJob` so the cleaning checkpoint can call the
      enqueue RPC with the correct queue.
- [ ] Add `scripts/in-home-simulation-stage-1-checkpoint.test.mjs`
      with three vitest specs:
  - "runs cleaning when no room_cleaned_path is persisted" — calls
    cleaning-stage providers and not corners providers, returns
    without touching the complete-stage RPC, releases + re-enqueues;
  - "runs corners when room_cleaned_path is set" — skips cleaning,
    calls corners + lines code, calls complete-stage RPC;
  - "fails fast when room_cleaned_path is set but the cleaned
    artifact is missing in storage" — no infinite loop, fails the
    job non-retryably with `cleaning_artifact_missing`.
- [ ] Update `docs/roadmap/supabase.md` with one PLAN-0053 row.
- [ ] Run `pnpm typecheck`, the focused vitest, and `pnpm spec:check`
      locally before pushing.

## Tests

- The new vitest above is the primary automated check. The existing
  Stage 1 unit tests
  (`in-home-simulation-stage-1-smoke.test.mjs`,
  `in-home-simulation-stage-1-providers.test.mjs`,
  `in-home-simulation-corners.test.mjs`) keep passing because the
  per-step provider logic is unchanged.
- End-to-end verification on dev: Ahmed runs the wizard against a
  real iPhone room photo. Job transitions:
  `queued -> room_prep_processing` (claim),
  cleaning checkpoint completes (~40-60s),
  release + re-enqueue,
  `room_prep_processing` (re-claim),
  corners checkpoint completes (~40-90s),
  `awaiting_dimensions`.
  Total wall-clock: ~2-3 minutes split across 2 invocations, neither
  of which exceeds 150s.

## Roadmap

- `docs/roadmap/supabase.md`

## Notes

- The cleaning checkpoint consumes 1 of 3
  `max_attempts_per_stage`. The corners checkpoint consumes the
  second attempt. Net steady-state: a clean run uses 2 of 3
  attempts. One attempt remains as headroom for a single transient
  provider failure on either side. If real-world flakiness exhausts
  that headroom we can bump the column default in a small follow-up.
- `pgmq` visibility timeout for the in-home queue is 600 seconds
  (`dequeue_in_home_simulation_room_prep_messages` default). If the
  cleaning checkpoint dies between PATCH and re-enqueue, the
  original message becomes visible again after 600s and the
  recovery path runs naturally.
- The new helpers do **not** introduce a new RPC dependency; both
  are direct PostgREST calls that already work with the
  service-role key the worker holds. This keeps the change
  reversible by reverting one TypeScript file.
- The "production worker input parity" memory rule is preserved
  because the per-provider inputs (validate, clean, corners,
  placement measurement) are identical to today's pipeline. Only
  the orchestration around them changed.
- After this plan lands and Ahmed verifies end-to-end on dev,
  PLAN-0042 manual launch testing can finally execute the
  back-wall happy path. Stage 2 (placement) parity verification is
  the next remaining gate; if placement also exceeds 150s, a
  parallel PLAN-0054 splits it on the same checkpointing pattern.

## Plan Hygiene Closure

Closed from active during the 2026-05-08 plan hygiene pass. Implementation evidence exists in worker checkpoint dispatch and regression tests. Later durable checkpoint dispatch continues under PLAN-0068.
