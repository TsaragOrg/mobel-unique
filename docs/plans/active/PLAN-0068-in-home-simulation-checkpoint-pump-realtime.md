# PLAN-0068 In-Home Simulation Checkpoint Pump And Realtime

Plan: PLAN-0068
Spec: SPEC-0007
Related specs: SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0015
Related change request: CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015-in-home-checkpoint-pump-realtime
Status: active
Owner area: supabase
Affected packages:

- `apps/web`
- `supabase/functions/in-home-simulation-worker`
- `supabase/migrations`
- `scripts`
- `docs/roadmap`

## Goal

Replace the current cron-first in-home simulation execution path with a
visitor-action-driven checkpoint pump that is resilient to Edge Function
timeouts, queue gaps, browser disconnects, and provider latency.

The target architecture is:

- public API actions create or update durable job state;
- public API actions invoke the worker pump immediately as best effort;
- pump mode starts only bounded one-checkpoint worker invocations;
- checkpoint mode performs one durable checkpoint for one job;
- Realtime is the primary visitor progress channel;
- HTTP status polling remains the fallback and the signed-URL refresh path;
- cron remains only a recovery and backlog backstop.

## Current Problems To Address

- New jobs can wait for the next cron tick before processing starts.
- A job can be created but fail to enqueue, leaving a queued row without a
  queue message.
- Some AI loops can perform several expensive provider calls inside one Edge
  invocation.
- Public progress is currently based on fixed polling and coarse statuses.
- Realtime cannot be safely exposed by publishing private simulation job rows
  directly to public visitors.
- Worker recovery exists, but it is built around expired claims rather than a
  complete checkpoint state machine.

## Architecture Decisions

- Keep the existing public job statuses unless an implementation test proves a
  new status is required.
- Add checkpoint state separately from public status. Use either a dedicated
  checkpoint table or explicit checkpoint columns on `in_home_simulation_jobs`,
  but keep the durable database state authoritative.
- Prefer database-claimable checkpoints over queue-message-only processing.
  Queue messages may wake the worker, but losing a message must not orphan a
  job.
- Prefer a public-safe Realtime table, such as `simulation_public_progress`,
  over direct Realtime access to `in_home_simulation_jobs`.
- Signed URLs stay API-only. Realtime carries only state and progress metadata.
- Public visitors need a short-lived Realtime capability scoped to one job and
  one verified simulation session.
- Each checkpoint invocation should make at most one expensive OpenAI call.
  Additional attempts must be persisted and resumed through later checkpoint
  invocations.
- Global provider capacity must be enforced in database claim RPCs, not in the
  browser.

## Tasks

- [x] Accept or revise the related change request before editing accepted specs.
- [x] Update `SPEC-0007`, `SPEC-0009`, `SPEC-0010`, `SPEC-0012`, and
      `SPEC-0015` according to the accepted change request.
- [x] Add migration tests for checkpoint state, claim indexes, capacity
      locking, public progress state, Realtime publication, and RLS boundaries.
- [ ] Add worker source tests for pump mode, one-checkpoint job mode, claim
      capacity, retryable checkpoint failure, non-retryable checkpoint failure,
      and pump chaining.
- [ ] Add worker timeout tests proving multi-attempt provider loops are split
      across persisted checkpoint attempts.
- [ ] Add API tests proving create, dimensions, and regeneration invoke the
      worker pump as best effort after durable state is persisted.
- [ ] Add API tests proving pump invocation failure leaves recoverable queued
      work rather than an invisible broken visitor flow.
- [ ] Add Realtime access tests proving one visitor cannot subscribe to another
      visitor's progress.
- [ ] Add frontend tests for Realtime progress rendering, fallback polling,
      foreground refresh, offline handling, and signed-URL refresh through the
      status endpoint.
- [x] Implement database checkpoint state and public progress surface.
- [ ] Implement worker pump mode.
- [x] Implement checkpoint claim RPCs.
- [ ] Refactor room validation, room cleaning, corners, dimension-guide,
      placement generation, placement measurement, and placement finalization
      into bounded checkpoints.
- [ ] Implement public API pump invocation and Realtime access contract.
- [ ] Implement frontend Realtime subscription and fallback polling.
- [ ] Update recovery cron to recover checkpoint claims and invoke pump for
      backlog.
- [ ] Update purge behavior if checkpoint or progress rows need redaction when
      a simulation expires.
- [ ] Update roadmaps for `api`, `supabase`, `image-worker`, `web`, and
      `workflow` as each implementation slice lands.
- [ ] Run the narrow tests first, then `pnpm spec:check`, package typechecks,
      `pnpm test`, and `pnpm build` as the change approaches completion.

## Tests

Focused checks to create or update before implementation:

```bash
pnpm vitest run scripts/in-home-simulation-checkpoint-pump-migration.test.mjs
pnpm vitest run scripts/in-home-simulation-checkpoint-claim.test.mjs
pnpm vitest run scripts/in-home-simulation-worker-pump.test.mjs
pnpm vitest run scripts/in-home-simulation-realtime-progress.test.mjs
pnpm vitest run apps/web/src/lib/simulation-public-route-handlers.test.ts
pnpm --filter @mobel-unique/web test
```

Existing related tests that should remain green or be intentionally updated:

```bash
pnpm vitest run scripts/in-home-simulation-stage-1-checkpoint.test.mjs
pnpm vitest run scripts/in-home-simulation-openai-fetch.test.mjs
pnpm vitest run scripts/in-home-simulation-worker-internal-fetch-timeouts.test.mjs
pnpm vitest run scripts/in-home-simulation-recovery-cron.test.mjs
pnpm vitest run scripts/in-home-simulation-requeue-recovered-jobs-migration.test.mjs
pnpm vitest run scripts/simulation-public-api-rpc-migration.test.mjs
```

Manual verification before launch:

- Back-wall happy path from upload to result with Realtime progress.
- Corner happy path from upload to result with Realtime progress.
- Regeneration while previous result remains visible.
- Realtime disconnect followed by fallback polling.
- Worker pump invocation failure followed by cron recovery.
- Expired claim recovery for every checkpoint type.
- RLS negative test with a second visitor token.
- Cost-meter pause leaves jobs recoverably queued and visible as delayed.

## Roadmap

Update these roadmaps as the implementation lands:

- `docs/roadmap/api.md`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Notes

- This plan should supersede the current launch-only timeout mitigation plans
  once the change request is accepted.
- Do not remove existing recovery cron behavior until the checkpoint recovery
  path is covered by tests.
- The Realtime contract must be privacy-reviewed before any public table is
  added to `supabase_realtime`.
- The public UI must not show provider names, prompt names, raw worker errors,
  storage paths, queue ids, or signed URLs.
