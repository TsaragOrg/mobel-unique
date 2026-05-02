# PLAN-0040 Public Simulation API Endpoints

Plan: PLAN-0040
Spec: SPEC-0015
Status: active
Owner area: web
Affected packages:

- `apps/web/src/app/api/public/simulation/email-verifications/route.ts` (new)
- `apps/web/src/app/api/public/simulation/email-verifications/[verification_request_id]/verify/route.ts` (new)
- `apps/web/src/app/api/public/simulations/route.ts` (new)
- `apps/web/src/app/api/public/simulations/[simulation_job_id]/route.ts` (new)
- `apps/web/src/app/api/public/simulations/[simulation_job_id]/dimensions/route.ts` (new)
- `apps/web/src/app/api/public/simulations/[simulation_job_id]/regenerations/route.ts` (new)
- `apps/web/src/lib/simulation-access-token.ts` (new)
- `apps/web/src/lib/simulation-rate-limit.ts` (new)
- `apps/web/src/lib/simulation-idempotency.ts` (new)
- `apps/web/src/lib/simulation-public-api.ts` (new — shared types)
- `apps/web/src/lib/simulation-public-route-handlers.ts` (new)
- `apps/web/src/lib/simulation-public-server.ts` (new)
- `supabase/migrations/20260502000900_simulation_rate_limit_increment.sql` (new)
- `supabase/migrations/20260502001000_simulation_idempotency_key_acquire.sql` (new)
- `scripts/simulation-public-api-rpc-migration.test.mjs` (new)
- `apps/web/.env.example`
- `docs/roadmap/web.md`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Ship the five public simulation route handlers from SPEC-0015 plus the
supporting auth, rate-limit, idempotency, and signed-URL helpers. After
this plan, the wizard UI in PLAN-0041 can drive the entire flow against
real backend behavior, and the API surface is curl-testable on its own.

The room-prep upload endpoint is the only place that talks to Supabase
Storage from the public surface. It must persist uploaded photos at
`simulations/{job_id}/inputs/room.{ext}` to match the worker's expected
storage layout exactly, and the queue message it enqueues must use the
existing `IN_HOME_SIMULATION_QUEUE_NAME` payload shape.

## Tasks

### Auth, rate limit, idempotency helpers

- [x] Add unit tests for `simulation-access-token.ts` covering issuance
      (deterministic stub token), HttpOnly+SameSite=Lax+Secure cookie
      attributes, hashed validation, and 24-hour TTL.
- [x] Implement `simulation-access-token.ts`.
- [x] Add unit tests for `simulation-rate-limit.ts` covering the rolling
      24-hour windows, the `subject_kind in ('ip','email')` split, hashed
      subject values, and the configurable per-IP and per-email caps.
- [x] Implement `simulation-rate-limit.ts` reading
      `SIMULATION_RATE_LIMIT_IP_PER_DAY` (default 3) and
      `SIMULATION_RATE_LIMIT_EMAIL_PER_DAY` (default 2).
- [x] Add unit tests for `simulation-idempotency.ts` covering happy-path
      (new key), duplicate (returns existing job id), and an expired-key
      record being treated as new.
- [x] Implement `simulation-idempotency.ts`.
- [x] Add shared types in `simulation-public-api.ts` mirroring the SPEC-0015
      payload shapes (request/response for each endpoint, status response
      with optional signed URLs).
- [x] Add atomic RPC migration `increment_simulation_rate_limit` so the
      rate-limit increment is race-free at the 24-hour window boundary,
      plus matching Vitest regression in
      `scripts/simulation-public-api-rpc-migration.test.mjs`.
- [x] Add atomic RPC migration `acquire_simulation_idempotency_key` and
      `finalize_simulation_idempotency_key` so duplicate Idempotency-Key
      requests return the original `simulation_job_id` without ever
      double-creating a job, plus matching Vitest regression.

### Email verification stubs

- [x] Add route handler test for
      `POST /api/public/simulation/email-verifications` — accepts
      `email + consent_email_use=true`, returns deterministic
      `verification_request_id` and `expires_at`, persists nothing.
- [x] Implement the stub route handler.
- [x] Add route handler test for `.../verify` — returns deterministic
      `simulation_access_token` and sets the cookie.
- [x] Implement the verify stub.

### `POST /api/public/simulations` (upload + create job)

- [x] Add SQL helper RPC
      `resolve_simulation_room_geometry_mode(p_sofa_slug, p_corner_tag_slug)`
      so the API can derive the mode from sofa tags before uploading.
      Returns null when the sofa is not publishable. Vitest regression
      in `scripts/simulation-resolve-geometry-mode-migration.test.mjs`.
- [x] Route handler tests covering: happy path back_wall, happy path
      corner (mode='corner' on job row), missing token, missing
      `Idempotency-Key`, missing/invalid form fields, unsupported
      content-type, empty file, oversize file, rate limit tripped (per
      IP and per email), duplicate `Idempotency-Key` returning the
      existing job, idempotency in-flight 409, idempotency cross-visitor
      collision 409, catalog cannot resolve sofa, atomic rollback when
      create-job returns triple_not_publishable or throws, no rollback
      when only the upload throws or only the enqueue throws,
      finalize-throws is non-fatal, header case-insensitive parsing,
      configurable corner-tag slug.
- [x] Implement the route handler. Storage upload path is
      `simulations/{job_id}/inputs/room.{ext}`. The queue message uses
      `SIMULATION_QUEUE_NAME` (env-driven; aliases
      `IN_HOME_SIMULATION_QUEUE_NAME`) and the existing payload shape
      so the worker behaves identically to terminal-harness inputs.
- [x] Add a corner-tag detection helper that reads the sofa row's tags
      and sets `room_geometry_mode` accordingly. The helper is the
      `resolve_simulation_room_geometry_mode` SQL RPC; the API calls it
      before upload and passes the resolved mode into the create-job
      RPC. Default `corner` tag slug is `corner` and is configurable
      via `SIMULATION_CORNER_TAG_SLUG`.

### `GET /api/public/simulations/{id}`

- [x] Add atomic SQL RPC `create_in_home_simulation_job_for_visitor`
      (production create-job, idempotent get-or-create on email/consent/
      session, returns zero rows when the sofa+fabric+visual triple is
      not publishable) and `get_in_home_simulation_job_for_visitor`
      (owned-job read filtered by `simulation_sessions.access_token_hash`).
      Both gated by `service_role` only. Vitest regressions added in
      `scripts/simulation-create-job-for-visitor-migration.test.mjs`
      and `scripts/simulation-get-job-for-visitor-migration.test.mjs`.
- [x] Extend `simulation-access-token.ts` with
      `deriveSimulationSessionTokenHash` and
      `deriveSimulationSessionEmailHash` helpers that produce the same
      hashes the SQL RPCs derive from the `verification_request_id`,
      so the API can resolve ownership without a round-trip.
- [x] Route handler tests for each status (`queued`,
      `room_prep_processing`, `awaiting_dimensions`, `placement_queued`,
      `placement_processing`, `succeeded`, `failed`, `canceled`,
      `expired`), with the `awaiting_dimensions` response carrying a
      signed URL for `dimension_guide_overlay.png` and the `succeeded`
      response carrying a signed URL for the latest `output-{n}.png`.
- [x] Implement the route handler. Signed URLs are short-lived (default
      120 seconds). The handler must reject cross-job access with the
      same response shape as a not-found result.

### `POST /api/public/simulations/{id}/dimensions`

- [x] Port the worker's `lib/dimensions.ts` validator into a web-side
      pure helper `simulation-dimensions.ts` (same range bounds,
      same per-mode key requirements, `room_depth` required in both
      modes per CR-SPEC-0012). Vitest covers happy paths, missing
      keys, non-numeric values, and the boundary values.
- [x] Route handler tests for happy path (valid `back_wall` payload with
      `room_depth`, valid `corner` payload with `room_depth`), validation
      failures (missing key, non-positive value, value above the
      configured upper bound), and ownership rejection.
- [x] Implement the route handler. The accepted shape matches the
      worker's `lib/dimensions.ts` validator after PLAN-0038 (i.e.
      `room_depth` is required in both modes).
- [x] On success, persist `supplied_dimensions`, transition to
      `placement_queued`, and enqueue the placement message using the
      existing payload shape (delegates to the existing
      `submit_in_home_simulation_dimensions` SQL RPC, which already
      enforces atomic state transition + pgmq enqueue).

### `POST /api/public/simulations/{id}/regenerations`

- [x] Route handler tests for happy path (job is `succeeded` and below
      the three-result limit), rejection when the job is not in
      `succeeded`, rejection when the limit is reached, and ownership.
- [x] Implement the route handler. It reserves the next
      `reserved_generation_index`, transitions the job to
      `placement_queued`, and enqueues a placement message with the
      regeneration intent (delegates to the existing
      `request_in_home_simulation_regeneration` SQL RPC, which already
      enforces the three-result cap, reserves the index, and enqueues
      `{job_id, type, generation_index}`).

### Cross-cutting

- [x] Add `apps/web/.env.example` entries for
      `SUPABASE_SERVICE_ROLE_KEY`, `SIMULATION_ACCESS_TOKEN_SECRET`,
      `SIMULATION_RATE_LIMIT_SUBJECT_SALT`,
      `SIMULATION_RATE_LIMIT_IP_PER_DAY`,
      `SIMULATION_RATE_LIMIT_EMAIL_PER_DAY`,
      `SIMULATION_QUEUE_NAME`, `SIMULATION_CORNER_TAG_SLUG`,
      `SIMULATION_RETENTION_HOURS`, `NEXT_PUBLIC_SITE_URL`.
- [x] Update `env-example.test.ts` so the SPEC-0015 server-side env
      contract is asserted (no `NEXT_PUBLIC_*` prefix on the
      service-role key, all the simulation env names documented).
- [x] Update `docs/roadmap/web.md`, `docs/roadmap/supabase.md`, and
      `docs/roadmap/workflow.md`.
- [x] Run `pnpm typecheck`, `pnpm test`, `pnpm spec:check`.

## Tests

- Helper unit tests (auth, rate limit, idempotency).
- Per-endpoint integration tests using the test catalog seeded by
  PLAN-0039.
- An end-to-end test that runs the full happy path against a mock worker
  fixture and asserts the storage path, queue payload, and DB job row are
  byte-identical to the worker's expected inputs.

## Roadmap

- `docs/roadmap/web.md`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Delivery split

Phase A (helpers + types + RPC migrations) and Phase B (email
verification stubs) ship in the first PR; Phase C (POST/GET/dimensions/
regenerations endpoints with the production create-job RPC, multipart
upload, atomic rollback, and pgmq enqueue) and Phase D (env.example +
roadmap follow-up + final smoke) ship in a follow-up PR off `dev`.
Splitting keeps the diff reviewable, lets the foundation merge before
the heavier DB integration work, and respects the recorded ship
workflow that prefers atomic per-PR merges.

## Notes

- Worker behavior parity check is a hard rule for this plan: the upload
  endpoint must hand the worker the same storage path, the same queue
  payload shape, and the same `supplied_dimensions` JSON shape as the
  terminal harness produces. Any drift will change worker output, which
  is forbidden.
- Email verification stays a stub for the SPEC-0015 launch window. The
  catalog owner replaces the implementation later without changing the
  contract.
- Service-role credentials and OpenAI keys never leave the route
  handler; the browser never sees them.
- Cookies are HttpOnly, SameSite=Lax, Secure outside local development,
  with `Max-Age=86400`.
- Signed URLs are minted from the private bucket; the bucket must remain
  private after this plan ships.
- Rate-limit subject hashes use a per-environment salt to avoid leaking
  raw IPs/emails into the database.
