# PLAN-0010 In-Home Simulation Stage 1 Room Preparation

Plan: PLAN-0010
Spec: SPEC-0007
Status: active
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker`
- `supabase/migrations`
- `supabase/seed.sql`
- `scripts`
- `package.json`
- `.env.example`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`

## Goal

Implement Stage 1 (room preparation) of the in-home simulation worker defined by
`SPEC-0007`, end to end and locally testable, so a developer can enqueue a real
room photo and receive the dimension-guide overlay artifact through local
Supabase.

This plan delivers:

- a new `in-home-simulation-worker` Edge Function on the Deno runtime that
  consumes `local_in_home_simulation_jobs` queue messages;
- atomic Stage 1 claim of `in_home_simulation_jobs` rows
  (`queued` -> `room_prep_processing`) with `claim_expires_at`;
- the Stage 1 logical sub-steps (normalize, validate, clean, geometry detection,
  dimension-guide overlay) producing the scratch artifacts named by the
  Generation Core File Contract;
- persistence of `room_normalized.jpg`, `room_compressed.jpg`,
  `room_cleaned.png`, `room_geometry.json`, and `room_guides.png` under the
  job's `simulations/{job_id}/` storage prefix in `simulation-private-artifacts`;
- transition to `awaiting_dimensions` with all storage paths recorded on the job
  row;
- mock provider implementations enabled by default plus opt-in real-provider
  paths via environment variables, so the smoke gate runs without any AI key
  but a developer can switch to live providers locally;
- a local CLI to seed a verified simulation session, upload a sample room
  photo, enqueue an in-home simulation job, and follow it to
  `awaiting_dimensions` while exposing the dimension-guide artifact through a
  signed URL.

This plan does not implement Stage 2 sofa placement, regeneration, retry
escalation beyond the per-stage attempt counter, claim-expiry recovery, the
24-hour purge job, or any production HTTP API surface. Those belong to
`PLAN-0011` and `PLAN-0012`.

## Tasks

- [x] Add or update local smoke and unit tests so they fail before any
      implementation work begins.
- [x] Create `supabase/functions/in-home-simulation-worker/` with a Deno entry
      point that reads queue messages from `local_in_home_simulation_jobs` and
      dispatches by current job status to the Stage 1 handler.
- [x] Implement the atomic Stage 1 claim, either as a Postgres function called
      from the Edge Function or as a single conditional update, that moves
      `queued` -> `room_prep_processing`, increments
      `room_prep_attempt_count`, sets `claim_expires_at`, and refuses claims
      when `retention_deadline` has passed or attempts are exhausted.
- [x] Add the scratch folder layout helpers (`room_original.*`,
      `room_normalized.jpg`, `room_compressed.jpg`, `room_cleaned.png`,
      `room_geometry.json`, `room_guides.png`, `error.txt`) backed by
      `IN_HOME_SIMULATION_TMP_DIR` with safe per-job subdirectories and
      idempotent cleanup before each attempt.
- [x] Materialize the customer room photo from
      `customer_room_original_path` into the scratch folder using a service-role
      Supabase client.
- [~] Implement worker-side normalization: EXIF orientation correction,
      HEIC and HEIF to JPEG conversion, and optional compression to a
      worker-defined maximum edge, without rejecting on minimum short edge or
      brightness. (EXIF orientation handled by imagescript decode; HEIC/HEIF
      conversion deferred to a follow-up commit and currently rejected as a
      non-retryable failure.)
- [~] Implement room validation through the configured vision provider with a
      mock that always returns a usable interior result and a real-provider
      adapter that returns a structured pass or readable failure code. (Mock
      adapter shipped; live adapter deferred.)
- [~] Implement furniture removal through the configured image-edit provider
      with a mock that copies the normalized room to `room_cleaned.png` and a
      real-provider adapter that produces a cleaned room while preserving
      geometry, openings, fixtures, and lighting. (Mock adapter shipped; live
      adapter deferred.)
- [~] Implement a single room-geometry detection call that returns
      `mode`, `points`, `confidence`, and `failure_reason`, including the
      ordered four-point `back_wall` shape and the six named `corner` points,
      with a mock that returns a deterministic set of points and a real-provider
      adapter. (Mock back_wall adapter shipped; corner mock and live adapter
      deferred.)
- [~] Add geometric sanity validation for the returned mode and points
      (in-image bounds, ordering for `back_wall`, named keys for `corner`)
      with a worker-defined retry limit before failing. (Both back_wall and
      corner sanity validators shipped; the worker currently routes only the
      back_wall path because the geometry mock is back_wall only.)
- [x] Implement deterministic dimension-guide rendering on
      `room_cleaned.png` that draws labelled arrows for the per-mode required
      measurements (back_wall: wall width and wall height; corner: left wall
      width, right wall width, room height) using language-tagged words rather
      than numeric measurements and without any worker watermark, producing
      `room_guides.png` at the cleaned room dimensions.
- [x] Persist Stage 1 artifacts under `simulations/{job_id}/` in the
      `simulation-private-artifacts` bucket and record their object paths on
      the job row (`room_normalized_path`, `room_compressed_path`,
      `room_cleaned_path`, `dimension_guide_overlay_path`) plus
      `room_geometry_mode`, `room_geometry_points`, and
      `room_geometry_confidence` when present.
- [x] Transition the job to `awaiting_dimensions`, set
      `awaiting_dimensions_at`, clear `claim_expires_at`, and clear any
      previous `last_error_message` on Stage 1 success.
- [~] On non-retryable Stage 1 failure, set `status = 'failed'`, write
      `last_error_code` and `last_error_message`, and persist a
      `worker_error.txt` artifact under the job prefix when the failure carries
      operator-readable detail. (Status and error message done; persisted
      `worker_error.txt` deferred.)
- [x] Add prompt asset files for `room_prep_v001` covering validation, cleaning,
      and geometry detection prompts, recording the rationale in plan notes.
- [x] Add a local CLI under `scripts/in-home-simulation/` and a
      `pnpm sim:stage1:enqueue` script that creates a verified
      `simulation_sessions` row, uploads a sample room photo to the private
      bucket, inserts an `in_home_simulation_jobs` row, sends a
      `local_in_home_simulation_jobs` queue message, and prints the resulting
      job id. (CLI script name is `sim:enqueue:stage1`.)
- [x] Add a `pnpm sim:status` script that prints the current status, attempt
      counters, and signed URLs for any persisted Stage 1 artifacts of a given
      job id.
- [ ] Update `.env.example` with the new variables required by the worker
      (`IN_HOME_SIMULATION_QUEUE_NAME`, `IN_HOME_SIMULATION_MAX_ATTEMPTS`,
      `IN_HOME_SIMULATION_MAX_CONCURRENT_JOBS`,
      `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS`, `IN_HOME_SIMULATION_TMP_DIR`,
      `SIMULATION_RETENTION_HOURS`, `IN_HOME_SIMULATION_PROVIDER_MODE`,
      `OPENAI_API_KEY`, `GEMINI_API_KEY`) and document that mocked providers
      remain the default.
- [ ] Update `pnpm test:workers:local` so the existing smoke gate runs the new
      Stage 1 smoke test alongside the existing worker-smoke check, skipping
      with a clear message when local Supabase is not running and failing
      clearly when Stage 1 sub-steps are missing or broken.
- [ ] Update the image worker and Supabase roadmaps to record this plan as
      active.
- [ ] Run the narrowest checks first
      (`pnpm --filter ./supabase/functions/... typecheck`,
      `pnpm test:workers:local`), then `pnpm spec:check`, and finally
      `pnpm check`.

## Tests

Add or update tests before implementation:

- a Stage 1 claim contract test verifying that a `queued` job moves to
  `room_prep_processing` exactly once under concurrent claim attempts,
  increments `room_prep_attempt_count`, sets `claim_expires_at` based on
  `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS`, and refuses a job whose
  `retention_deadline` has passed or whose `room_prep_attempt_count` already
  equals `max_attempts_per_stage`;
- normalization unit tests covering EXIF orientation correction, HEIC and HEIF
  to JPEG conversion, and compression behavior at the worker maximum edge,
  without short-edge or brightness rejection;
- a geometry validation unit test that rejects out-of-bounds points, an
  unordered `back_wall` quad, and a `corner` payload missing any of the six
  named keys;
- a deterministic dimension-guide rendering test that asserts the output
  dimensions equal the cleaned room dimensions, asserts language-tagged labels
  per mode, and asserts no numeric measurements appear in the rendered image
  metadata;
- a Stage 1 end-to-end smoke test against local Supabase using the mock
  providers that enqueues a sample room photo, runs the Edge Function once,
  and asserts the job reaches `awaiting_dimensions` with all five Stage 1
  artifacts present in `simulation-private-artifacts` under the job prefix;
- a provider-mode toggle test that confirms the worker refuses to call live
  providers when `IN_HOME_SIMULATION_PROVIDER_MODE` is `mock` and refuses to
  start with a missing key when the mode is `live`;
- a non-retryable failure test that confirms an unsupported image format
  transitions the job to `failed` without consuming the remaining attempt
  budget for transient retries.

The Stage 1 smoke gate may skip with a clear message when local Supabase is
not running, but it must fail clearly when local Supabase is running with
missing Stage 1 sub-step behavior, missing Stage 1 storage objects, missing
prompt assets, or an out-of-spec scratch folder layout.

## Roadmap

Update these roadmap files when implementation changes are made:

- `docs/roadmap/image-worker.md`;
- `docs/roadmap/supabase.md`;
- `docs/roadmap/workflow.md` if new shared local quality-gate commands are
  added;
- `docs/roadmap/api.md` if Edge Function naming, queue naming, or storage
  conventions change in a way that affects future API plans.

## Notes

The first pinned providers should follow the `SPEC-0007` rule that the model
stack is implementation-plan choice, not spec text. Stage 1 vision and image
edit calls target the providers already validated by the local Python bench
in `mebel/worker_test/`: an OpenAI image-edit model for cleaning, an
OpenAI vision model for room validation and geometry, and a Gemini fallback
left disabled by default. The exact model identifiers are recorded in the
prompt asset header for `room_prep_v001` and in the worker configuration
defaults so they can be moved to environment overrides without spec change.

Mocked providers must remain the default per `SPEC-0008`. Live provider calls
require explicit `IN_HOME_SIMULATION_PROVIDER_MODE=live` plus a non-empty
provider key, and the worker must fail to start in `live` mode when the
required key is missing rather than silently downgrading to mocks.

Stage 1 must persist `room_geometry_mode` even when `confidence` is null,
because the persistent record is the contract the API and Stage 2 read.
`room_geometry_failure_reason` may only be set when no successful geometry
result was produced for the current attempt.

The Edge Function entry point must reload the job row before running any image
sub-step and must skip work without provider calls when the job is missing,
expired, canceled, failed, or already past Stage 1.

Each Stage 1 sub-step must be skippable when its scratch artifact already
exists and is intact. Restarting Stage 1 on the same job must not regenerate
already-produced artifacts unless they are missing or corrupt, so a transient
Edge Function restart does not multiply provider cost.

This plan does not migrate any new database tables or buckets. Schema and
storage already match `SPEC-0007` requirements through migration
`20260427000200_spec_0009_data_model_and_storage.sql`. If implementation
discovers a missing index, helper function, or constraint, that gap must be
addressed through a new migration in this plan rather than by mutating the
accepted SPEC-0009 migration.

The CLI scripts must use only local Supabase URLs and the local service-role
key from the local environment. They must refuse to run when their resolved
Supabase URL points at DEV or PROD.
