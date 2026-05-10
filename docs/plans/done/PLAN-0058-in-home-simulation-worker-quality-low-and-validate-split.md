# PLAN-0058 In-Home Simulation Worker Quality=Low And Validate Split

Plan: PLAN-0058
Spec: SPEC-0015
Status: done
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker/lib/providers/openai-cleaning.ts`
- `supabase/functions/in-home-simulation-worker/lib/providers/openai-corners.ts`
- `supabase/functions/in-home-simulation-worker/index.ts`
- `scripts/in-home-simulation-openai-cleaning.test.mjs`
- `scripts/in-home-simulation-corners.test.mjs`
- `scripts/in-home-simulation-stage-1-checkpoint.test.mjs`
- `scripts/in-home-simulation-worker-start-events.test.mjs`
- `docs/specs/manifest.json`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Bring Stage 1 wall-clock under control on the Supabase Edge Functions
150-second cap so a real customer photo reliably either succeeds or
surfaces an error screen within ~3 minutes — not the current
~10-12 minutes after PLAN-0056/0057 closed the silent-hang gap.

End-to-end DEV testing on 2026-05-04 showed the wizard now reaches
the SPEC-0015 Screen 6 error after the watchdog cron does its work,
but the wall-clock budget is exhausted by:

1. **gpt-image-2 cleaning generates at the model's default quality**,
   which on the verified-tier OpenAI org consistently runs 100-130s
   per call. The terminal harness on 2026-04-29 ran the same step in
   ~60-90s; either the org's processing tier dropped or OpenAI's
   image-edit pipeline got slower across the board. The model
   accepts a `quality` parameter (low/medium/high/auto). Cleaning is
   an internal artifact — we never show it to the user — so `low`
   is the correct trade-off, and corner-dot placement is also a
   utility step that does not need high quality.
2. **The cleaning checkpoint runs validation (gpt-5 vision, ~20-30s)
   inline before cleaning**, eating wall-clock budget that the
   cleaning fetch then runs out of. PLAN-0053 split Stage 1 into two
   checkpoints (cleaning + corners). This plan splits the cleaning
   checkpoint further so the validate step lives in its own
   checkpoint and cleaning gets the full ~150s budget for a single
   gpt-image-2 fetch.

After this plan ships, Stage 1 has three checkpoints — `validate`,
`cleaning`, `corners` — each well under the wall-clock with margin
for the catch path. Combined with `quality=low` on cleaning and
corners, the realistic per-checkpoint wall-clock is ~30s, ~70s,
~70s. Total Stage 1 wall-clock spans ~3-4 minutes across three cron
ticks.

## Out of scope

- No prompt v003 changes (LOCKED).
- No placement provider quality change — placement is the final
  user-visible image and stays at the model default.
- No move to OpenAI background mode — deferred to a future plan if
  needed.
- No new database columns. The split uses the existing
  `room_normalized_path`, `room_compressed_path`, and
  `room_cleaned_path` columns to dispatch checkpoints.
- No frontend, public API, queue contract, or Stage 2 changes.

## Tasks

### Fix 1: quality=low on gpt-image-2 cleaning + corners

- [ ] Add `OPENAI_CLEANING_DEFAULT_QUALITY = "low"` constant in
      `openai-cleaning.ts`. Extend `CleaningFormDataInput` to accept
      `quality`. `buildCleaningFormData` writes
      `form.set("quality", input.quality)`. Constructor option
      `quality?: string`. Default to the new constant.
- [ ] Same shape in `openai-corners.ts`:
      `OPENAI_CORNERS_DEFAULT_QUALITY = "low"`,
      `buildCornersFormData` adds the field, constructor accepts
      `quality?: string`.
- [ ] Update `scripts/in-home-simulation-openai-cleaning.test.mjs`:
      buildCleaningFormData test asserts the form contains
      `quality=low` by default.
- [ ] Update `scripts/in-home-simulation-corners.test.mjs`: same.
- [ ] No change to placement — final image quality stays at model
      default.

### Fix 2: Split cleaning checkpoint into validate + cleaning

- [ ] Add new function `runValidateCheckpoint(supabaseUrl, key,
      workerId, claim, queueName)` in `index.ts`. Body:
      1. emit `stage_1_validate_checkpoint_started` event
      2. download original photo
      3. HEIC → JPEG conversion if needed
      4. decode + encodeJPEG normalized
      5. validation provider call (gpt-5 vision)
      6. compress to `IN_HOME_SIMULATION_MAX_EDGE_PX`
      7. encodeJPEG compressed
      8. upload normalized + compressed
      9. PATCH `room_normalized_path` and `room_compressed_path` on
         the row (new helper `persistValidateCheckpoint`)
      10. release_in_home_simulation_room_prep_claim
      11. enqueue_in_home_simulation_room_prep_message (re-queue
          for the next cron tick, mirrors PLAN-0053 cleaning →
          corners hand-off)
      12. emit `stage_1_validate_checkpoint_completed` event
- [ ] Refactor `runCleaningCheckpoint` to skip the validate +
      compress steps. Body becomes:
      1. emit `stage_1_cleaning_checkpoint_started` event
         (existing)
      2. download `room_compressed_path` from storage
      3. cleanRoom
      4. decode + encode cleaned
      5. upload `room_cleaned.png`
      6. PATCH `room_cleaned_path` (existing
         `persistCleaningCheckpoint`, but now with only one path
         to set)
      7. release_in_home_simulation_room_prep_claim
      8. enqueue_in_home_simulation_room_prep_message
      9. emit `stage_1_cleaning_checkpoint_completed` event
         (existing)
- [ ] Update `processClaimedJob` dispatch:
      ```
      const checkpoint = await fetchInHomeSimulationJobRow(...);
      if (!checkpoint.room_normalized_path) {
        await runValidateCheckpoint(...);
        return "stage_1_validate_checkpoint_advanced";
      }
      if (!checkpoint.room_cleaned_path) {
        await runCleaningCheckpoint(...);
        return "stage_1_cleaning_checkpoint_advanced";
      }
      await runCornersCheckpoint(...);
      return "stage_1_completed";
      ```
- [ ] Extend `Stage1CheckpointOutcome` with the new
      `stage_1_validate_checkpoint_advanced` value. Outer dispatch
      returns `job_status: "queued"` for both advanced cases (same
      shape as today).
- [ ] Add `persistValidateCheckpoint(supabaseUrl, key, jobId,
      paths)` helper that PATCHes only `room_normalized_path` and
      `room_compressed_path`.
- [ ] Update `persistCleaningCheckpoint` to accept just
      `roomCleanedPath` (the validate paths are already on the
      row). Update its signature and call site.
- [ ] Adjust the corners checkpoint precondition check in
      `runCornersCheckpoint` to use the new contract: it expects
      both `room_normalized_path`, `room_compressed_path`, AND
      `room_cleaned_path` set, same as today.

### Tests

- [ ] Update `scripts/in-home-simulation-stage-1-checkpoint.test.mjs`
      to cover the new three-checkpoint dispatch:
      - `processClaimedJob` checks `room_normalized_path` first
      - validate-checkpoint releases claim and re-enqueues
      - cleaning-checkpoint downloads `room_compressed_path` (not
        original) and persists only `room_cleaned_path`
- [ ] Update
      `scripts/in-home-simulation-worker-start-events.test.mjs` to
      assert `stage_1_validate_checkpoint_started` precedes the
      validation provider call.
- [ ] Update existing OpenAI-cleaning and corners pure-helper
      tests to assert the `quality` field appears in the form data
      with default `low`.

### Quality gates

- [ ] `pnpm typecheck`.
- [ ] `pnpm test`.
- [ ] `pnpm spec:check`.
- [ ] `pnpm build`.

### Manifest + roadmap

- [ ] Add `"PLAN-0058"` to `SPEC-0015.implementationPlans` in
      `docs/specs/manifest.json`.
- [ ] One row in `docs/roadmap/supabase.md`.
- [ ] One row in `docs/roadmap/workflow.md` for the new tests.

### Manual deployment (Ahmed)

- [ ] After merge, CI deploys Edge Function on push to dev.
- [ ] Smoke: upload an empty-room photo through the wizard.
      Expectation — Stage 1 reaches the dimension-entry screen
      within ~3-4 minutes (validate ~30s + cleaning ~70s + corners
      ~70s, plus ~60s of cron-tick scheduling between
      checkpoints), not the previous ~10 minutes.

## Tests

- Pure-helper tests for `quality=low` in cleaning and corners form
  data.
- Source-grep checkpoint dispatch test for the new three-checkpoint
  flow.
- Source-grep start-events test for the new
  `stage_1_validate_checkpoint_started` event.

## Roadmap

- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Notes

- `quality` is part of the OpenAI Images API for both `/generations`
  and `/edits` since gpt-image-1. Values: `low`, `medium`, `high`,
  `auto`. We pin `low` for cleaning + corners because the output is
  an internal artifact (cleaning) or a utility-grade dot map
  (corners). Generation time on `low` is empirically 30-50% of
  `high`, which is the headroom we need.
- The validate split intentionally PATCHes both
  `room_normalized_path` and `room_compressed_path` in the validate
  checkpoint, so the cleaning checkpoint reads the compressed bytes
  from storage instead of re-running compression. This keeps each
  checkpoint single-purpose and minimizes re-work on retry.
- Three cron ticks per Stage 1 means total wall-clock spans ~3-4
  minutes (one minute per tick + per-tick processing). The user
  sees this as "Préparation de votre simulation" for the duration
  before "Mesurez votre pièce" appears, exactly matching the
  SPEC-0015 Screen 2/3 transition.

## Plan Hygiene Closure

Closed from active during the 2026-05-08 plan hygiene pass. Implementation evidence exists in quality-low provider defaults, validate checkpoint split, tests, and roadmaps. Durable checkpoint orchestration continues under PLAN-0068.
