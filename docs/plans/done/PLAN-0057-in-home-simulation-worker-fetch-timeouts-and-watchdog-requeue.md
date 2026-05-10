# PLAN-0057 In-Home Simulation Worker Fetch Timeouts And Watchdog Requeue

Plan: PLAN-0057
Spec: SPEC-0015
Status: done
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker/lib/supabase-fetch.ts` (new)
- `supabase/functions/in-home-simulation-worker/lib/providers/openai-fetch.ts`
- `supabase/functions/in-home-simulation-worker/index.ts`
- `supabase/migrations/20260503002000_in_home_simulation_requeue_recovered_jobs.sql` (new)
- `scripts/in-home-simulation-supabase-fetch.test.mjs` (new)
- `scripts/in-home-simulation-openai-fetch.test.mjs`
- `scripts/in-home-simulation-requeue-recovered-jobs-migration.test.mjs` (new)
- `scripts/in-home-simulation-worker-internal-fetch-timeouts.test.mjs` (new)
- `supabase/.env.example`
- `workers/image/.env.example`
- `package.json` (test:root:parallel wiring)
- `docs/specs/manifest.json`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Bring the in-home simulation worker to a state where every external call has a finite timeout, every recoverable failure surfaces as a `worker_job_events` row plus a `failed`/`queued` status transition within 3 minutes, and no job can ever sit in `queued` state without a corresponding pgmq message.

PLAN-0056 added `AbortController` to the OpenAI fetches and scheduled `recover_expired_in_home_simulation_claims` on a one-minute cron. End-to-end DEV testing exposed two follow-on gaps that this plan closes:

1. On Supabase Edge Functions, `AbortController.abort()` does not reliably interrupt a Deno `fetch` whose response body is being slow-read by the platform's HTTP client. A slow `gpt-image-2` cleaning call can therefore exceed the 150-second wall-clock and have the isolate killed before any catch path runs. Promise-race timeouts give the same effective behavior with a guarantee that the timer wins regardless of platform-level fetch behavior.
2. `recover_expired_in_home_simulation_claims` only flips the row back to `queued`/`placement_queued`. The original pgmq message has long been deleted by an earlier worker tick that observed the row in `*_processing` state and dropped its claim. Recovery therefore produces orphan `queued` jobs that no worker ever picks up.

In addition, every internal Supabase REST/RPC/storage call in the worker is currently a naked `fetch(...)` with no timeout. Any one of them stuck on the network can hold the isolate to wall-clock, defeating the AbortController fix on the OpenAI fetch.

## Out of scope

- No prompt changes (v003 LOCKED).
- No Stage 2 placement loop logic changes.
- No move to OpenAI background mode (deferred to a separate plan if needed).
- No frontend, public API, or pgmq queue contract changes.
- No DB schema changes — only two new functions + one new cron migration.

## Tasks

### Fix A: Promise-race timeout for OpenAI fetches

- [ ] Update `lib/providers/openai-fetch.ts`: keep the `AbortController` but race the resulting fetch promise against a `setTimeout` that rejects with `OpenAIFetchTimeoutError`. Whichever finishes first wins. The timer provides a hard guarantee that the helper rejects at `timeoutMs` even if the platform fetch implementation does not honor abort during a slow body read.
- [ ] Update `scripts/in-home-simulation-openai-fetch.test.mjs` to cover the new race semantics: a `fetch` that never resolves still rejects at `timeoutMs` with `OpenAIFetchTimeoutError`.

### Fix B: Internal-fetch timeout helper

- [ ] Add `lib/supabase-fetch.ts` exporting `supabaseFetchWithTimeout(input, init, opts?)`. Reads `IN_HOME_SIMULATION_INTERNAL_FETCH_TIMEOUT_MS` (default 30000) from `Deno.env`. Same race-style behavior as the OpenAI helper. Throws `SupabaseFetchTimeoutError` on timeout.
- [ ] Add `scripts/in-home-simulation-supabase-fetch.test.mjs` with the same coverage shape as the OpenAI helper test.

### Fix C: Wire all internal worker fetches through the helper

- [ ] Replace raw `fetch(...)` in `index.ts:185` (`callRpc`) with `supabaseFetchWithTimeout`.
- [ ] Replace raw `fetch(...)` in `index.ts:284` (`downloadStorageObject`).
- [ ] Replace raw `fetch(...)` in `index.ts:310` (`uploadStorageObject`).
- [ ] Replace raw `fetch(...)` in `index.ts:370` (`recordWorkerEvent`).
- [ ] Replace raw `fetch(...)` in `index.ts:417` (`failJobNonRetryable` PATCH).
- [ ] Replace raw `fetch(...)` in `index.ts:456` (`fetchInHomeSimulationJobRow`).
- [ ] Replace raw `fetch(...)` in `index.ts:498` (`persistCleaningCheckpoint`).
- [ ] Add `scripts/in-home-simulation-worker-internal-fetch-timeouts.test.mjs` source-grep that asserts every `await fetch(` in `index.ts` was replaced and that each call site imports the helper.

### Fix D: Reduce default claim TTL

- [ ] Change `DEFAULT_CLAIM_TTL_SECONDS = 600` to `DEFAULT_CLAIM_TTL_SECONDS = 180` in `index.ts:103`. The internal fetch budget plus the OpenAI timeout fits well under 150 seconds; 180 seconds gives a 30-second margin before the watchdog notices.
- [ ] Update `supabase/.env.example` and `workers/image/.env.example` `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS` to `180` with a comment explaining the relationship to the Edge Functions wall-clock.

### Fix E: SQL helper for placement message enqueue

- [ ] In the new migration, add `public.enqueue_in_home_simulation_placement_message(job_id uuid, queue_name text)` mirroring the existing `enqueue_in_home_simulation_room_prep_message` shape. Service-role grant. Inserts the standard `{job_id, type: "in_home_simulation_placement"}` envelope.

### Fix F: Watchdog requeue wrapper

- [ ] In the new migration, add `public.requeue_recovered_in_home_simulation_jobs(batch_size integer default 100, queue_name text default 'local_in_home_simulation_jobs')` that:
    - Calls `public.recover_expired_in_home_simulation_claims(batch_size)` and iterates the returned rows.
    - For each row whose `new_status` is `queued`, calls `public.enqueue_in_home_simulation_room_prep_message(row.job_id, queue_name)`.
    - For each row whose `new_status` is `placement_queued`, calls `public.enqueue_in_home_simulation_placement_message(row.job_id, queue_name)`.
    - Returns the same shape as `recover_expired_in_home_simulation_claims` so existing callers that just want the rows can swap in the wrapper without changes.
- [ ] In the same migration, drop and re-schedule the `in-home-simulation-recovery-runner` cron to call the new wrapper instead of the bare RPC.

### Quality gates

- [ ] `pnpm typecheck`.
- [ ] `pnpm test`.
- [ ] `pnpm spec:check`.
- [ ] `pnpm build`.

### Manifest + roadmap

- [ ] Add `"PLAN-0057"` to `SPEC-0015.implementationPlans` in `docs/specs/manifest.json`.
- [ ] Add a row in `docs/roadmap/supabase.md` summarizing the plan.
- [ ] Add a row in `docs/roadmap/workflow.md` for the new tests.

### Manual deployment (Ahmed)

- [ ] After merge, `supabase db push` applies the new migration.
- [ ] Redeploy `in-home-simulation-worker` Edge Function on DEV (CI handles this on push to dev).
- [ ] Manually re-enqueue any in-flight jobs that were stranded before this PR:
    ```sql
    do $$
    declare j record;
    begin
      for j in select id, status from public.in_home_simulation_jobs
               where status in ('queued', 'placement_queued')
                 and claim_expires_at is null
      loop
        if j.status = 'queued' then
          perform public.enqueue_in_home_simulation_room_prep_message(j.id, 'local_in_home_simulation_jobs');
        else
          perform public.enqueue_in_home_simulation_placement_message(j.id, 'local_in_home_simulation_jobs');
        end if;
      end loop;
    end $$;
    ```
- [ ] Smoke test: run wizard end-to-end. Expectation — Stage 1 either completes within ~2 minutes or surfaces an error screen within ~3 minutes. Never an indefinite hang.

## Tests

- Unit tests for the new `supabaseFetchWithTimeout` helper.
- Updated unit tests for the existing `openaiFetchWithTimeout` helper covering Promise-race semantics.
- Source-grep tests asserting that every internal fetch in `index.ts` is wrapped.
- Migration source-grep test for the new `requeue_recovered_in_home_simulation_jobs` function and the cron re-schedule.

## Roadmap

- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Notes

- The 130 s OpenAI fetch timeout plus 30 s per internal fetch covers the pessimistic path: validation (≈30 s) + cleaning (≈130 s) + corners (≈100 s, but this only runs in the second checkpoint after PLAN-0053). Each invocation stays under the 150 s wall-clock by design.
- The 180 s claim TTL means the worst-case stuck-job recovery window is roughly `180 s + 60 s cron tick = 4 minutes`. Combined with the rejection of orphan-queued state by Fix F, this caps the user-visible delay before the wizard either shows the result or shows the error screen.
- Promise-race is intentionally additive: the `AbortController` is preserved so a fetch that does honor abort frees its socket immediately. The race timer only matters when abort fails to propagate.
- The `recover_expired_in_home_simulation_claims` function from PLAN-0012 is left unchanged. The wrapper composes with it instead of editing it, so any downstream caller that depends on the original signature still works.

## Plan Hygiene Closure

Closed from active during the 2026-05-08 plan hygiene pass. Implementation evidence exists in Supabase fetch timeouts, claim TTL changes, recovery requeue migration, tests, and roadmaps. Recovery/dispatch refinements continue under PLAN-0068.
