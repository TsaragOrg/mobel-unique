# PLAN-0011 In-Home Simulation Stage 2 Sofa Placement

Plan: PLAN-0011
Spec: SPEC-0007
Status: active
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker`
- `supabase/migrations`
- `scripts`
- `package.json`
- `.env.example`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`

## Goal

Implement Stage 2 (sofa placement) and the regeneration flow of the in-home
simulation worker defined by `SPEC-0007`, building on the Stage 1 foundation
delivered by `PLAN-0010`, so a developer can submit wall dimensions to a
locally enqueued job and receive a final composed sofa-in-room result, then
request up to two regenerations and observe the regeneration-indexed outputs.

This plan delivers:

- atomic Stage 2 claim of `in_home_simulation_jobs` rows
  (`placement_queued` -> `placement_processing`) with `claim_expires_at`;
- the Stage 2 logical sub-steps (dimension validation, prepared sofa
  materialization, composition) producing the scratch `output.png`;
- persistence of `output-{index}.png` under
  `simulations/{job_id}/outputs/` in `simulation-private-artifacts`, with
  matching `simulation_generated_outputs` rows recording provider, model, and
  prompt version;
- the success path (`placement_processing` -> `succeeded`) updating
  `latest_generated_output_index`, incrementing `generated_output_count`,
  and clearing `reserved_generation_index`;
- the regeneration state cycle (`succeeded` -> `placement_queued` ->
  `placement_processing` -> `succeeded`) including the API-side reservation of
  the next index, the worker-side index commit, and the failure paths that keep
  a previously persisted result available;
- a CLI to submit dimensions for a job in `awaiting_dimensions`, watch it
  reach `succeeded`, and request up to two regenerations within the
  three-result MVP cap;
- prompt assets for `sofa_placement_v001`.

This plan does not implement Stage 2 retry escalation beyond the per-stage
attempt counter, claim-expiry recovery, or the 24-hour purge job. Those belong
to `PLAN-0012`.

## Tasks

- [ ] Add or update Stage 2 unit, contract, and smoke tests so they fail
      before implementation begins.
- [ ] Extend the `in-home-simulation-worker` Edge Function to dispatch
      `placement_queued` queue messages to the Stage 2 handler and to ignore
      Stage 1 messages it has already completed.
- [ ] Implement the atomic Stage 2 claim, either as a Postgres function called
      from the Edge Function or as a single conditional update, that moves
      `placement_queued` -> `placement_processing`, increments
      `placement_attempt_count`, sets `claim_expires_at`, refuses to claim a
      job whose `retention_deadline` has passed, and refuses to claim a job
      whose `placement_attempt_count` already equals
      `max_attempts_per_stage`.
- [ ] Implement dimension validation against the job's `room_geometry_mode`
      and `supplied_dimensions`, rejecting cases such as a sofa wider than the
      supplied wall width for `back_wall`, a corner sofa wider than either
      supplied wall width for `corner`, and a sofa taller than the supplied
      wall or room height, with worker accept ranges separate from per-job
      validation.
- [ ] Materialize the prepared sofa asset referenced by
      `prepared_sofa_asset_id` and `prepared_render_cell_id` into
      `sofa_prepared.png` in the scratch folder, refusing the stage when the
      catalog row does not resolve to a public-usable render.
- [ ] Implement the composition sub-step that calls the configured image-edit
      provider with `room_cleaned.png`, `room_geometry.json`, the supplied
      dimensions, and `sofa_prepared.png`, and produces `output.png`, with a
      mock that pastes the prepared sofa onto the cleaned room at a
      deterministic position scaled from the supplied dimensions and a
      real-provider adapter that follows the placement prompt rules.
- [ ] Add output normalization that resizes `output.png` to the cleaned
      room dimensions when the provider returns a different size or aspect
      ratio.
- [ ] Persist the result to
      `simulations/{job_id}/outputs/output-{index}.png` where `{index}` is
      the `reserved_generation_index` for regenerations or `0` for the
      initial result, and create the matching `simulation_generated_outputs`
      row with `source_type = 'ai_generated_in_home_simulation'`,
      `provider_name`, `provider_model`, `prompt_version`,
      `generation_index`, `width_px`, `height_px`, and `content_type`.
- [ ] Transition the job to `succeeded`, set `completed_at`, set
      `latest_generated_output_index` to the just-persisted index, increment
      `generated_output_count`, clear `reserved_generation_index`, clear
      `claim_expires_at`, and clear any prior `last_regeneration_error_message`
      after a clean success.
- [ ] Implement the regeneration support that the API drives: when the
      worker observes a `placement_queued` job whose
      `reserved_generation_index` is non-null and whose
      `generated_output_count` is greater than zero, treat it as a
      regeneration, reuse `room_cleaned.png`, `room_geometry.json`, and
      `sofa_prepared.png`, clear `output.png` and `error.txt` before the new
      attempt, and respect the wall-dimension override when
      `supplied_dimensions` differ from the prior attempt.
- [ ] Refuse any Stage 2 attempt that would push `generated_output_count`
      above three with a non-retryable error, since the SPEC-0004 MVP cap is
      three results per simulation attempt.
- [ ] Implement the regeneration failure paths: when no previous output
      exists, transition the job to `failed`; when at least one previous
      output exists, clear `reserved_generation_index`, record
      `last_regeneration_error_message`, return the job to `succeeded`, and
      keep `latest_generated_output_index` pointing at the prior result.
- [ ] On non-retryable Stage 2 failure with no previous output, set
      `status = 'failed'`, write `last_error_code` and `last_error_message`,
      and persist a `worker_error.txt` artifact under the job prefix when the
      failure carries operator-readable detail.
- [ ] Add prompt asset files for `sofa_placement_v001` covering the
      placement prompt rules listed in `SPEC-0007 Prompting`.
- [ ] Add a `pnpm sim:dimensions:submit` CLI that attaches
      `supplied_dimensions` to a job in `awaiting_dimensions`, sets
      `dimensions_submitted_at`, transitions the job to
      `placement_queued`, and enqueues a Stage 2 message.
- [ ] Add a `pnpm sim:regenerate` CLI that, for a job in `succeeded`,
      verifies the three-result cap, atomically reserves the next
      `reserved_generation_index`, optionally accepts overridden
      `supplied_dimensions`, transitions the job to `placement_queued`,
      and enqueues a Stage 2 message.
- [ ] Extend `pnpm sim:status` to also print
      `latest_generated_output_index`, `generated_output_count`,
      `reserved_generation_index`, `last_regeneration_error_message`, and
      signed URLs for every persisted output under the job prefix.
- [ ] Update `.env.example` with any new placement-specific variables and
      record the pinned Stage 2 model identifiers in the prompt asset header
      for `sofa_placement_v001`.
- [ ] Extend `pnpm test:workers:local` so the existing smoke gate runs the
      Stage 2 smoke test alongside the Stage 1 and worker-smoke checks,
      skipping with a clear message when local Supabase is not running and
      failing clearly when Stage 2 sub-steps, output rows, output paths, or
      regeneration transitions are missing or broken.
- [ ] Update the image worker and Supabase roadmaps to record this plan as
      active.
- [ ] Run the narrowest checks first
      (`pnpm --filter ./supabase/functions/... typecheck`,
      `pnpm test:workers:local`), then `pnpm spec:check`, and finally
      `pnpm check`.

## Tests

Add or update tests before implementation:

- a Stage 2 claim contract test verifying that a `placement_queued` job
  moves to `placement_processing` exactly once under concurrent claim
  attempts, increments only `placement_attempt_count`, sets
  `claim_expires_at` based on `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS`, and
  refuses claims when `retention_deadline` has passed or
  `placement_attempt_count` already equals `max_attempts_per_stage`;
- a dimension validation unit test covering valid and invalid combinations
  per geometry mode, including sofa-wider-than-wall, sofa-wider-than-corner,
  sofa-taller-than-room, and missing dimension keys;
- a Stage 2 success contract test asserting that on a clean run the job
  ends in `succeeded`, the persistent path is exactly
  `simulations/{job_id}/outputs/output-{index}.png`, the
  `simulation_generated_outputs` row carries the expected `source_type`,
  `provider_name`, `provider_model`, `prompt_version`, and
  `generation_index`, and `latest_generated_output_index` matches the row;
- a regeneration cycle contract test that drives a job through
  `succeeded` -> `placement_queued` -> `placement_processing` -> `succeeded`
  twice, asserting that `generated_output_count` reaches three, the third
  reservation request is refused, and `regeneration_count` ends at two with
  the database constraint
  `regeneration_count = greatest(generated_output_count - 1, 0)` still
  satisfied;
- a regeneration failure-with-prior-output test that asserts the job
  returns to `succeeded`, `latest_generated_output_index` still points at
  the prior result, `reserved_generation_index` is cleared, and
  `last_regeneration_error_message` is set;
- a regeneration failure-without-prior-output test that asserts the job
  becomes `failed` and `last_error_message` is set;
- an output normalization unit test confirming that a provider response with
  a different size or aspect ratio is resized to the cleaned room dimensions
  before persistence;
- a Stage 2 end-to-end smoke test against local Supabase using mock providers
  that completes the Stage 1 -> dimensions -> Stage 2 -> regeneration -> cap
  flow for a single job and asserts every persisted artifact, every
  `simulation_generated_outputs` row, and every status transition.

The Stage 2 smoke gate may skip with a clear message when local Supabase is
not running, but it must fail clearly when local Supabase is running with
missing Stage 2 sub-step behavior, missing output rows, an out-of-spec output
path, or a broken regeneration transition.

## Roadmap

Update these roadmap files when implementation changes are made:

- `docs/roadmap/image-worker.md`;
- `docs/roadmap/supabase.md`;
- `docs/roadmap/workflow.md` if new shared local quality-gate commands are
  added;
- `docs/roadmap/api.md` if Edge Function naming, queue naming, or output
  storage conventions change in a way that affects future API plans.

## Notes

The Stage 2 placement prompt and provider must follow the `SPEC-0007 Prompting`
rules: preserve cleaned-room geometry, openings, fixtures, perspective, and
lighting; preserve the prepared sofa identity, including silhouette, cushion
arrangement, armrest profile, base style, and fabric appearance; place the
sofa against the detected geometry at the supplied dimensions; and never
reproduce reference scale guides, numeric labels, or annotation marks in the
final output.

Stage 2 must use `room_cleaned.png` as the room input, not `room_guides.png`,
and must materialize the prepared sofa from the catalog rather than from any
visitor upload, since the visitor never uploads a sofa per `SPEC-0007 Users
And Permissions`.

The worker must enforce the per-job three-result MVP cap as a hard refusal,
even when the API has reserved an index, because the worker is the
last-line guard against violating `SPEC-0004 Simulation Launch`. Cross-job
visitor-session anti-abuse remains an API responsibility.

The success path must increment `generated_output_count` and the regeneration
constraint
`regeneration_count = greatest(generated_output_count - 1, 0)` must hold at
every commit point. The implementation must be careful to update the
counters in a single statement or transaction so the constraint is not
transiently violated.

Persistent output paths must use the regeneration-indexed paths defined by
`SPEC-0007 Regeneration`. The scratch `output.png` file must not be promoted
to a persistent object path. A failed placement must not leave a stale
`output.png` in the scratch folder, and a successful placement must not
leave an `error.txt`.

This plan does not migrate any new database tables or buckets. Schema and
storage already match `SPEC-0007` requirements through migration
`20260427000200_spec_0009_data_model_and_storage.sql`. If implementation
discovers a missing index, helper function, or constraint, that gap must be
addressed through a new migration in this plan rather than by mutating the
accepted SPEC-0009 migration.
