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
- `apps/web/.env.example`
- `docs/roadmap/web.md`
- `docs/roadmap/api.md`

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

- [ ] Add unit tests for `simulation-access-token.ts` covering issuance
      (deterministic stub token), HttpOnly+SameSite=Lax+Secure cookie
      attributes, hashed validation, and 24-hour TTL.
- [ ] Implement `simulation-access-token.ts`.
- [ ] Add unit tests for `simulation-rate-limit.ts` covering the rolling
      24-hour windows, the `subject_kind in ('ip','email')` split, hashed
      subject values, and the configurable per-IP and per-email caps.
- [ ] Implement `simulation-rate-limit.ts` reading
      `SIMULATION_RATE_LIMIT_IP_PER_DAY` (default 3) and
      `SIMULATION_RATE_LIMIT_EMAIL_PER_DAY` (default 2).
- [ ] Add unit tests for `simulation-idempotency.ts` covering happy-path
      (new key), duplicate (returns existing job id), and an expired-key
      record being treated as new.
- [ ] Implement `simulation-idempotency.ts`.
- [ ] Add shared types in `simulation-public-api.ts` mirroring the SPEC-0015
      payload shapes (request/response for each endpoint, status response
      with optional signed URLs).

### Email verification stubs

- [ ] Add route handler test for
      `POST /api/public/simulation/email-verifications` — accepts
      `email + consent_email_use=true`, returns deterministic
      `verification_request_id` and `expires_at`, persists nothing.
- [ ] Implement the stub route handler.
- [ ] Add route handler test for `.../verify` — returns deterministic
      `simulation_access_token` and sets the cookie.
- [ ] Implement the verify stub.

### `POST /api/public/simulations` (upload + create job)

- [ ] Route handler tests covering: happy path with a small JPEG fixture,
      missing token (401-equivalent), expired token, invalid sofa/fabric/
      visual-position triple (rejected), rate limit tripped (per IP and
      per email), duplicate `Idempotency-Key` returning the existing job
      id without reuploading, atomic rollback when DB job creation fails
      after storage upload succeeds (orphan path under
      `simulations/orphans/{key_hash}/...`), and a corner-tagged sofa
      producing `room_geometry_mode = 'corner'` on the job row.
- [ ] Implement the route handler. Storage upload path must be
      `simulations/{job_id}/inputs/room.{ext}`. The queue message must use
      `IN_HOME_SIMULATION_QUEUE_NAME` and the existing payload shape so
      the worker behaves identically to terminal-harness inputs.
- [ ] Add a corner-tag detection helper that reads the sofa row's tags
      and sets `room_geometry_mode` accordingly. Default to `back_wall`
      when no corner tag is present.

### `GET /api/public/simulations/{id}`

- [ ] Route handler tests for each status (`queued`,
      `room_prep_processing`, `awaiting_dimensions`, `placement_queued`,
      `placement_processing`, `succeeded`, `failed`, `canceled`,
      `expired`), with the `awaiting_dimensions` response carrying a
      signed URL for `dimension_guide_overlay.png` and the `succeeded`
      response carrying a signed URL for the latest `output-{n}.png`.
- [ ] Implement the route handler. Signed URLs are short-lived (default
      120 seconds). The handler must reject cross-job access with the
      same response shape as a not-found result.

### `POST /api/public/simulations/{id}/dimensions`

- [ ] Route handler tests for happy path (valid `back_wall` payload with
      `room_depth`, valid `corner` payload with `room_depth`), validation
      failures (missing key, non-positive value, value above the
      configured upper bound), and ownership rejection.
- [ ] Implement the route handler. The accepted shape must match the
      worker's `lib/dimensions.ts` validator after PLAN-0038 (i.e.
      `room_depth` is required in both modes).
- [ ] On success, persist `supplied_dimensions`, transition to
      `placement_queued`, and enqueue the placement message using the
      existing payload shape.

### `POST /api/public/simulations/{id}/regenerations`

- [ ] Route handler tests for happy path (job is `succeeded` and below
      the three-result limit), rejection when the job is not in
      `succeeded`, rejection when the limit is reached, and ownership.
- [ ] Implement the route handler. It must reserve the next
      `reserved_generation_index`, transition the job to
      `placement_queued`, and enqueue a placement message with the
      regeneration intent.

### Cross-cutting

- [ ] Add `apps/web/.env.example` entries for
      `SIMULATION_RATE_LIMIT_IP_PER_DAY`,
      `SIMULATION_RATE_LIMIT_EMAIL_PER_DAY`,
      `SIMULATION_QUEUE_NAME`, `NEXT_PUBLIC_SITE_URL`.
- [ ] Update `docs/roadmap/web.md` and `docs/roadmap/api.md`.
- [ ] Run `pnpm typecheck`, `pnpm test`, `pnpm spec:check`.

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
