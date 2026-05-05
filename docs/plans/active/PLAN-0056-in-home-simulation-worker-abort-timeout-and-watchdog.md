# PLAN-0056 In-Home Simulation Worker Abort Timeout, Start Events, And Watchdog Cron

Plan: PLAN-0056
Spec: SPEC-0015
Status: active
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker/lib/providers/openai-fetch.ts` (new)
- `supabase/functions/in-home-simulation-worker/lib/providers/openai-cleaning.ts`
- `supabase/functions/in-home-simulation-worker/lib/providers/openai-corners.ts`
- `supabase/functions/in-home-simulation-worker/lib/providers/openai-placement.ts`
- `supabase/functions/in-home-simulation-worker/lib/providers/openai-vision.ts`
- `supabase/functions/in-home-simulation-worker/lib/providers/openai-placement-measurement.ts`
- `supabase/functions/in-home-simulation-worker/index.ts`
- `supabase/functions/in-home-simulation-worker/lib/providers/__tests__/openai-fetch.test.ts` (new)
- `supabase/migrations/20260503001000_in_home_simulation_recovery_cron.sql` (new)
- `scripts/in-home-simulation-recovery-cron.test.mjs` (new)
- `apps/api/.env.example`
- `docs/specs/manifest.json`
- `docs/roadmap/supabase.md`

## Goal

Stop the in-home simulation worker from leaving jobs in
`room_prep_processing` (or `placement_processing`) forever when an
OpenAI image-edit call exceeds the Supabase Edge Functions 150-second
wall-clock limit. Today the providers issue raw `fetch(...)` against
`https://api.openai.com/v1/images/edits` with no `AbortController` and
no timeout, so when the isolate is killed mid-fetch every subsequent
line — `failJobNonRetryable`, the release-claim RPC, and
`recordWorkerEvent` — never runs. The job row stays in a processing
state, no `worker_job_events` row is written, and the wizard sits on
the "Préparation de votre simulation" screen indefinitely.

This plan ships three layered defenses without changing any prompts,
queue contracts, or upstream/downstream flows:

1. A shared `openaiImagesEditsFetch` / `openaiChatCompletionsFetch`
   helper that wraps every provider call with a configurable
   `AbortController` timeout (default 130 s, well under the 150 s
   wall-clock). When it fires, the existing catch paths in the
   worker mark the job `failed` with a deterministic
   `*_failed`/`*_timeout` code, call the release-claim RPC, and emit a
   `worker_job_events` row.
2. Worker-emitted `stage_*_started` events
   (`stage_1_cleaning_checkpoint_started`,
   `stage_1_corners_checkpoint_started`,
   `stage_2_placement_started`) written immediately after the claim
   succeeds and before the long fetch. This closes the observability
   gap so an operator looking at `worker_job_events` always sees
   something between "claim acquired" and "step finished/failed".
3. A `pg_cron` entry that calls the existing
   `recover_expired_in_home_simulation_claims()` RPC every minute. The
   function was added by PLAN-0012 but no scheduler ever invoked it.
   This is the safety net for the case where the isolate dies before
   `AbortController` can fire (out-of-memory, network reset, host
   reboot). With the default `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS=600`
   plus a 1-minute cron tick the worst-case recovery window is ~11
   minutes, after which the job either re-queues or transitions to
   `failed` with `claim_expired`.

## Out of scope

- No changes to prompts, prompt versions, or the v003 placement loop.
- No changes to the `simulation_generated_outputs` shape, the pgmq
  queue payloads, or the public API contracts.
- No move to OpenAI background-mode polling. That is a future
  consideration if 130 s + retry is not enough headroom.
- No change to the wizard UI or French copy.
- No new env variables on the web side.

## Tasks

### Provider fetch helper

- [ ] Add `lib/providers/openai-fetch.ts` exporting
      `openaiFetchWithTimeout(input, init, opts?)`. Reads
      `OPENAI_FETCH_TIMEOUT_MS` (default 130000) from `Deno.env`.
      Wraps `fetch` with `AbortController`. On abort throws a stable
      `OpenAIFetchTimeoutError` whose `message` includes the URL and
      the elapsed milliseconds.
- [ ] Add Vitest unit tests for the helper covering: success path
      passes through the `Response`; timeout fires the abort; an
      explicit `init.signal` is composed with the internal abort so
      either trigger cancels the fetch.

### Wire the helper into all five providers

- [ ] Replace the raw `fetch` call in `openai-cleaning.ts:173` with
      the helper. On `OpenAIFetchTimeoutError` re-throw a
      `cleaning_timeout` error so the existing catch in
      `runCleaningCheckpoint` records a deterministic event code.
- [ ] Same for `openai-corners.ts:323` (`corners_timeout`).
- [ ] Same for `openai-placement.ts:643` (`placement_timeout`).
- [ ] Same for `openai-vision.ts:183` (`validation_timeout`).
- [ ] Same for `openai-placement-measurement.ts:266`
      (`measurement_timeout`).
- [ ] Update each provider's existing fake-fetch test (where present)
      to keep passing with the new wrapper.

### Worker start-event emissions

- [ ] In `runCleaningCheckpoint` (`index.ts:588`) emit
      `recordWorkerEvent({ event_type: 'stage_1_cleaning_checkpoint_started', ... })`
      directly after the scratch-dir is created and before the OpenAI
      cleaning fetch. Include `worker_identifier`, `attempt`, and
      `room_geometry_mode` in metadata.
- [ ] In `runCornersCheckpoint` (`index.ts:854`) emit
      `stage_1_corners_checkpoint_started` before the corners-edit
      fetch.
- [ ] In the placement entry path (existing
      `processPlacementJob` / Stage 2 dispatcher) emit
      `stage_2_placement_started` before the placement fetch and a
      matching `stage_2_placement_attempt_started` per retry.
- [ ] Add a Vitest assertion that grep'ing `index.ts` finds at least
      one occurrence of each event type.

### Watchdog cron

- [ ] Add migration
      `20260503001000_in_home_simulation_recovery_cron.sql`. Schedule
      a `pg_cron` job named
      `in-home-simulation-recovery-runner` running every minute that
      executes
      `select public.recover_expired_in_home_simulation_claims(100)`.
      Drop and recreate the schedule idempotently like the existing
      `in-home-simulation-worker-runner` migration.
- [ ] Add `scripts/in-home-simulation-recovery-cron.test.mjs`
      Vitest assertion that the migration file contains the cron
      schedule, the recovery RPC name, and the idempotent unschedule
      block.

### Env example + roadmap

- [ ] Add `OPENAI_FETCH_TIMEOUT_MS=130000` to
      `apps/api/.env.example` (the worker shares the env-template
      with the API package per PLAN-0008 conventions).
- [ ] Add a one-line PLAN-0056 row to `docs/roadmap/supabase.md`.

### Manifest + checkbox cleanup (the documentation gigieine pass)

- [ ] Add `"PLAN-0050"` and `"PLAN-0056"` to the
      `SPEC-0015.implementationPlans` array in
      `docs/specs/manifest.json` (PLAN-0050 was missing from the
      list at merge time).
- [ ] Tick the merged `[ ]` checkboxes in PLAN-0041, PLAN-0050, and
      PLAN-0051 to reflect ground truth on `dev`. Do not touch
      PLAN-0042 (still ungated) or PLAN-0053 (just-merged, manual
      smoke pending).

### Quality gates

- [ ] `pnpm typecheck` (root).
- [ ] `pnpm test` (root) including the new Vitest cases.
- [ ] `pnpm spec:check`.

### Deployment

- [ ] Manual: Ahmed deploys the migration (`supabase db push`) and
      redeploys the in-home simulation worker Edge Function on DEV
      after the PR merges.
- [ ] Manual: Ahmed re-runs the wizard end-to-end on DEV to confirm
      a slow gpt-image-2 call now produces a `cleaning_timeout`
      event and the wizard surfaces the error screen instead of
      hanging forever. This is the smoke gate before merging to
      main.

## Tests

- Unit tests for the fetch helper (timeout, success, signal
  composition).
- Provider fake-fetch tests continue to pass after the wrapper is
  inserted.
- Vitest grep-style assertion that all three start events are emitted
  in `index.ts`.
- Vitest assertion on the new recovery-cron migration shape.

## Roadmap

- `docs/roadmap/supabase.md`

## Notes

- 130 s was chosen empirically: gpt-image-2 at `size=auto` on a 720
  px input typically returns within 60–110 s; 130 s leaves
  headroom for OpenAI tail latency while staying under the 150 s
  Edge Function wall-clock by 20 s — enough for catch + release-claim
  + event-write to land before the isolate is killed.
- The watchdog cron is a defense in depth for the case where the
  isolate is killed before `AbortController` fires (out of memory,
  worker shutdown, network reset). It does not replace the
  in-process abort; it complements it.
- Because the existing `recover_expired_in_home_simulation_claims`
  function already handles attempt-count + retention-deadline
  decisions, no new state-transition logic is added in this plan.
- The default `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS` is left at 600.
  Operators who want faster recovery can lower it via env without
  touching code.
