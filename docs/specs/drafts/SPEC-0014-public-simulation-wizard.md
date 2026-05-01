# Public Simulation Wizard

Spec: SPEC-0014
Status: draft
Layer: technical
Parent Spec: SPEC-0012
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0012
Areas: web, supabase
Implementation Plans: none yet

## Traceability

This spec was created to enable end-to-end production testing of the in-home
simulation worker delivered by `SPEC-0007` and its implementation plans
(`PLAN-0010`, `PLAN-0011`, `PLAN-0012`, `PLAN-0016`). The worker pipeline is
complete and validated, but no public-facing entry point exists yet to drive
real customer photos through it.

`SPEC-0012` defines the high-level public frontend experience including the
simulation wizard. This spec narrows that contract to the implementable subset
needed for the first production test, defers the catalog and email-verification
work owned by other team members through stubs, and pins the precise screens,
endpoints, and deviations the project owner has decided.

This spec consumes:

- `SPEC-0007` for worker job lifecycle, statuses, dimension checkpoint, and
  retention behavior.
- `SPEC-0009` for storage buckets, retention deadlines, and the
  `in_home_simulation_jobs` table schema.
- `SPEC-0010` for the public simulation API contracts.
- `SPEC-0012` for wizard step ordering, state mapping, and frontend boundary
  rules.
- `CR-SPEC-0012-allow-room-depth-in-mvp` to override the MVP dimension
  restriction.

This spec produces the implementation plans that build the simulation wizard
pages, the supporting public API endpoints, the test catalog seeding tooling,
and the worker cleanup needed to align with current product decisions.

## Goal

Deliver the customer-facing entry point that lets a verified visitor upload a
room photo, run it through the existing in-home simulation worker, enter
dimensions, view a generated result, and request regenerations within the
24-hour retention window. The result must be a live, end-to-end production
flow that can be tested with real photos against the production worker.

## Scope

The following work is in scope:

- The simulation wizard page at `/sofas/[slug]/simulate` covering wizard steps
  4-12 from `SPEC-0012` (upload through result and regeneration). Wizard steps
  1-3 (sofa context confirmation and email verification) are stubbed pending
  delivery of the catalog and email-verification work owned by another team
  member.
- The simulation continuation page at `/simulations/[simulation_job_id]` that
  resumes polling, dimension entry, processing, and result states.
- Five public API endpoints in `apps/web` route handlers that proxy authorized
  visitor actions to Supabase RPCs and Storage:
    - `POST /api/public/simulation/email-verifications` (stub)
    - `POST /api/public/simulation/email-verifications/{verification_request_id}/verify` (stub)
    - `POST /api/public/simulations`
    - `GET /api/public/simulations/{simulation_job_id}`
    - `POST /api/public/simulations/{simulation_job_id}/dimensions`
    - `POST /api/public/simulations/{simulation_job_id}/regenerations`
- A test catalog seed script at `scripts/seed-simulation-test-data.mjs` and a
  parity cleanup script that populate two test sofas (one straight, one
  corner-tagged) with associated fabrics, visual positions, renders, and
  fixture images.
- Worker cleanup tasks:
    - Remove the Gemini placement provider from
      `in-home-simulation-worker` (Gemini fallback is no longer used in this
      worker).
    - Update `lib/dimensions.ts` so `room_depth` is required in
      `supplied_dimensions` for both `back_wall` and `corner` modes.
    - Remove the scene classifier provider from
      `in-home-simulation-worker`. `room_geometry_mode` is now derived
      deterministically from the selected sofa's tags at job creation
      time (see Data Model). The worker no longer makes a vision-JSON
      call to classify the room photo into `back_wall`, `corner`, or
      `reshoot`; the existing validation provider continues to reject
      photos that are not usable interiors.
- Database migrations:
    - `idempotency_keys` table for safe upload retry.
    - Rate-limit counter tables for IP, email, and daily OpenAI cost ceilings.
- Cost protection in the upload endpoint and worker:
    - 3 simulations per IP per 24-hour window.
    - 2 simulations per verified email per 24-hour window.
    - $50 daily OpenAI spend cap that pauses worker dequeues when exceeded.
- Frontend client-side photo compression to 1600 px max edge, JPEG quality 85,
  with progress UI, automatic retry (2 attempts, 1s/3s backoff), camera
  capture button on mobile, and HEIC fallback to server-side conversion.
- Cookie-based access token storage with `Max-Age` of 24 hours. Tokens are
  never placed in URLs.
- Lazy signed-URL refresh on `<img>` `onError` events for guide and result
  artifacts.
- French copy authored against the existing home page style with
  `// TODO: FR native review` markers on legally significant strings (consent,
  retention, error messaging).

## Out Of Scope

The following work is intentionally excluded and must not be added to this
spec or its plans:

- The full public catalog page at `/catalog`. Owned by another team member.
- The sofa detail page at `/sofas/[slug]`. Owned by another team member. The
  simulation wizard does not render the sofa detail experience.
- Real email verification with code delivery, hash storage, brute-force
  protection, or commercial-consent persistence. Owned by another team
  member. This spec ships only the verification stub that returns a
  deterministic access token.
- A direct Shopify return action on the result screen. The result screen ends
  on a "Return to sofa" navigation back to `/sofas/[slug]` where the catalog
  owner provides the Shopify call-to-action.
- Analytics events.
- Production monitoring, alerting dashboards, observability tooling, error
  tracking, or admin operational dashboards.
- Visible AI-generation watermarks on the result image.
- A separate "delete my data now" GDPR right-to-erase flow. The 24-hour purge
  function is the only deletion path in this MVP.
- An OpenAI Zero Data Retention contract or DPA acquisition.
- Multi-sofa or multi-fabric comparison from a single simulation session. Each
  job is bound to one sofa, fabric, and visual-position selection.
- A customer-facing sofa orientation flip control for corner sofas. The
  worker generates one orientation deterministically.
- Resumable or chunked upload protocols. The browser sends one request per
  upload attempt with at most three total attempts.
- Step-by-step browser history navigation within the wizard. The wizard is a
  single client-side route; browser back returns to the sofa detail page.
- Server-side or client-side Gemini fallback inside `in-home-simulation-worker`
  for any pipeline stage. OpenAI is the only provider after this spec.
- A second isolated Supabase project for development. The single existing
  Supabase project is treated as production for the first launch.
- Image download buttons, share buttons, or any action that exposes the
  signed URL or generated artifact path to copy or distribution flows.

## Users And Permissions

The simulation wizard supports three actor states:

- **Anonymous visitor**: arrives at `/sofas/[slug]/simulate` from the sofa
  detail page. Cannot create a simulation job until they complete the
  verification stub (in development this is a no-op).
- **Verified visitor**: holds a valid `simulation_access_token` in the
  cookie set by the verification stub. Can create a simulation job, poll its
  status, submit dimensions, and request regenerations.
- **System actors**: the in-home simulation worker reads the job row and
  artifacts; the purge function deletes expired job artifacts. These are
  defined in `SPEC-0007` and unchanged by this spec.

Access rules are inherited from `SPEC-0010`:

- The access token is opaque, server-validated against a hashed copy, and
  scoped to simulation actions.
- A verified visitor sees only their own job. Cross-job access returns the
  same response shape as a not-found result.
- Browser code never receives Supabase service-role credentials, OpenAI keys,
  private bucket paths, or another visitor's data.

## User Flow

The end-to-end flow consumed by the wizard is:

1. The visitor arrives at `/sofas/[slug]/simulate` from the sofa detail page
   carrying selected `fabric_id` and `visual_position_id` in route or query
   state.
2. The verification stub on first request returns a deterministic access
   token. The token is set as an HTTP-only cookie with `Max-Age` 86400.
3. The visitor uploads or captures a room photo. The browser compresses the
   image and `POST`s it together with the sofa context as
   `multipart/form-data` with an `Idempotency-Key` header.
4. The server creates the simulation job, enqueues it for the worker, and
   returns the job id. The browser navigates to `/simulations/{job_id}` using
   `router.replace` so browser back returns to the sofa detail page.
5. The continuation page polls `GET /api/public/simulations/{job_id}` every
   2 seconds. While the status is `queued` or `room_prep_processing`, a
   minimal processing screen is shown.
6. When the status reaches `awaiting_dimensions`, the dimension entry screen
   is shown with the signed guide image and the input fields appropriate to
   the geometry mode. The visitor enters dimensions in metres and submits.
7. Polling resumes for `placement_queued` and `placement_processing`. If a
   previous successful result exists from a regeneration cycle, it remains
   visible behind a translucent veil with a small "new generation" indicator.
8. When the status reaches `succeeded`, the result screen is shown with the
   signed result image, a regeneration call-to-action when available, and a
   navigation back to the sofa detail page.
9. The visitor may request up to three successful regenerations. Failed
   regenerations do not consume one of the three successful generations.
10. Any terminal failure (`failed`, `canceled`) leads to the error screen
    with a "Recommencer" action that creates a fresh job under the same
    access token without re-verifying email.
11. Any expired job (`expired`) leads to the expiration screen with only a
    "Retour au catalogue" navigation. Restart from the expired state is not
    offered.

## Page Specifications

The wizard implementation uses a single Next.js client-side route at
`/sofas/[slug]/simulate` and a continuation route at
`/simulations/[simulation_job_id]`. Both routes render distinct screens based
on local wizard state (pre-job-creation) or polled API status
(post-job-creation).

Each screen below specifies its state trigger, visible elements, primary
action, and forbidden elements.

All visible UI strings quoted in the screens below are English descriptions
of the eventual rendered copy. The implementation plans must render the
equivalent French strings, and legally significant strings (consent,
retention, error messaging) must carry `// TODO: FR native review`
markers per the Scope section. The spec stays in English to satisfy the
repository specification-language guardrail.

### Screen 1: Photo Upload

Trigger: visitor at `/sofas/[slug]/simulate` with verified token, before any
job exists.

Visible elements:

- A narrow header strip displaying the sofa context as
  `{sofa_name} · {fabric_name} · {visual_position_label}`.
- A title "Photo of your room".
- Short instruction text.
- For corner-tagged sofas, a strong disclaimer instructing the visitor to
  photograph a corner of the room (two walls meeting), with at least one
  example wording about good and bad photos. For non-corner sofas, a
  shorter disclaimer guiding a frontal photo of one wall.
- Two buttons on mobile: "Take a photo" using
  `<input type="file" accept="image/*" capture="environment">` and
  "Choose a file" without `capture`. On non-touch devices, only the
  file picker is shown.
- After file selection: a preview of the selected image, a "Replace" link,
  and a primary "Continue" button.

Behavior:

- The browser compresses the file using `<canvas>` to a maximum edge of
  1600 px and JPEG quality 0.85 before upload. EXIF rotation is baked into
  pixels.
- HEIC files that the browser cannot decode are sent to the server as-is and
  normalized by the worker.
- On submit, an `Idempotency-Key` UUID is generated once and reused across
  retry attempts.
- Upload uses `XMLHttpRequest` with `progress` events to drive a progress UI.
- On a network failure, the browser retries automatically up to two more
  times with 1-second and 3-second backoffs. After three failures total, an
  honest "Could not upload" screen is shown with a "Try again" action that
  reuses the same `Idempotency-Key`.

Forbidden:

- No download or share controls.
- No exposure of private storage paths or signed URLs in markup or analytics.

### Screen 2: Room Preparation Processing

Trigger: status is `queued` or `room_prep_processing`.

Visible elements:

- The same context strip as Screen 1.
- A static processing indicator (icon or minimal CSS spinner).
- A title "Preparation".
- A short reassurance line ("This takes a minute").

Behavior:

- The continuation page polls the status endpoint every 2 seconds.
- No progress percentage is shown.
- No cancel button is shown.

### Screen 3: Dimension Entry

Trigger: status is `awaiting_dimensions`.

Visible elements:

- The context strip.
- A title "Measure your room".
- The signed dimension guide image (`dimension_guide_overlay.png`) at
  generous size, with `onError` handler that triggers a refresh of the
  signed URL via the status endpoint.
- The dimension input form, fields ordered to match the colored guide lines:
    - For `back_wall`: "Width (red)", "Height (blue)",
      "Depth (green)".
    - For `corner`: "Left wall (red)", "Right wall (red)",
      "Height (blue)", "Depth (green)".
- A primary "Continue" button. Disabled until all fields are filled with
  positive numbers below a sensible upper bound (e.g. 20).

Behavior:

- Submission posts to `POST /api/public/simulations/{id}/dimensions`. On
  success the page resumes polling for placement statuses.
- The geometry mode (`back_wall` or `corner`) comes from the status payload,
  not from any client-side guess. The worker assigns mode at job creation
  based on the chosen sofa's tags.

### Screen 4: Final Placement Processing

Trigger: status is `placement_queued` or `placement_processing`.

Visible elements when no previous result exists:

- The context strip.
- A static processing indicator.
- A title "Visualization".
- The reassurance line.

Visible elements when a previous successful result exists (regeneration in
progress):

- The previous result image rendered behind a translucent overlay with a
  small inline "New generation..." indicator.

Behavior:

- Polling continues every 2 seconds.
- The destructive full-screen loading pattern is forbidden when a previous
  result exists.

### Screen 5: Result

Trigger: status is `succeeded`.

Visible elements:

- The context strip.
- The signed latest result image (`output-{n}.png`), as the primary visual.
- A primary action "New generation" when `regeneration_available` is
  true. The action posts to
  `POST /api/public/simulations/{id}/regenerations`.
- A secondary text link "Back to sofa" that navigates to
  `/sofas/[slug]`.
- A short retention notice in muted text:
  "This image will be deleted in 24 hours."
- When a regeneration has just failed, a small inline error message above
  the actions: "The new generation failed. Showing the previous result."

Behavior:

- The `<img>` element uses `onError` to call the status endpoint for a fresh
  signed URL.
- When `regeneration_available` is false, the regeneration button is removed
  from the DOM (not disabled). "Back to sofa" becomes the primary
  action.

Forbidden:

- No download button.
- No share button.
- No long-term save action.
- No visible signed URL.
- No watermark or AI-generated label overlay.

### Screen 6: Error Or Expired

Trigger: status is `failed`, `canceled`, or `expired`.

Visible elements for `failed` and `canceled`:

- The context strip if the job row still has it.
- An error icon.
- A title "An error occurred".
- A short instruction line "Please try again with another photo." or
  similar safe wording.
- A primary action "Restart" that creates a new job under the same
  access cookie and routes the visitor back to Screen 1.
- A secondary text link "Back to sofa".

Visible elements for `expired`:

- No context strip (artifacts have been purged).
- An expiration icon.
- A title "This simulation has expired".
- A short notice "The images were deleted after 24 hours."
- Only a primary "Back to catalog" action linking to `/catalog`.
- No "Restart" action.

Forbidden:

- No exposure of provider error details, SQL errors, storage paths, internal
  ids, or stack traces in messages, attributes, or hidden HTML.

## Data Model

### Existing tables consumed (from SPEC-0007 and SPEC-0009)

- `in_home_simulation_jobs` is the durable job row keyed by `id`.
- `simulation_generated_outputs` records each successful placement output.
- `worker_job_events` logs every status transition.
- The pgmq queue used for room-prep and placement messages.
- The `simulation-private-artifacts` bucket holds per-job inputs, guides, and
  outputs. The public catalog bucket holds rendered sofa assets.

### New tables

`idempotency_keys` records served simulation-creation requests so retries
return the same job:

- `key_hash` text primary key, set to a server-side hash of the
  `Idempotency-Key` header.
- `simulation_job_id` uuid, foreign key to `in_home_simulation_jobs.id`,
  nullable until the job is created.
- `created_at` timestamptz, default now.
- `expires_at` timestamptz, defaults to `now() + interval '24 hours'`.

The purge function adds a step that deletes `idempotency_keys` rows where
`expires_at` has passed.

`simulation_rate_limits` records visitor-side rate-limit counters:

- `subject_kind` text, one of `ip` or `email`.
- `subject_value_hash` text, hashed source value.
- `window_start` timestamptz aligned to the rolling 24-hour boundary.
- `count` integer, default 1.
- Composite primary key on `(subject_kind, subject_value_hash, window_start)`.

`simulation_cost_meter` records OpenAI spend approximations to enforce the
$50 daily ceiling:

- `cost_date` date primary key.
- `usd_cost_estimate_cents` integer, default 0, monotonically incremented.
- `worker_paused` boolean, default false, flipped to true when the daily cap
  is reached.

The job-claim RPCs check `simulation_cost_meter.worker_paused` before
returning a row. When paused, claims return zero rows, and the worker exits
without doing OpenAI calls.

### `supplied_dimensions` shape change

Per `CR-SPEC-0012-allow-room-depth-in-mvp`, `supplied_dimensions` jsonb is now:

For `back_wall`:

```json
{
  "wall_width": 4.2,
  "wall_height": 2.7,
  "room_depth": 5.0
}
```

For `corner`:

```json
{
  "left_wall_width": 3.4,
  "right_wall_width": 4.0,
  "room_height": 2.7,
  "room_depth": 5.0
}
```

`room_depth` is required in both modes. The worker placement prompts consume
it deterministically.

### Geometry mode source

`room_geometry_mode` is set at job creation time by inspecting the chosen
sofa's tags. If any tag in the agreed corner-tag set is present, the mode is
`corner`. Otherwise it defaults to `back_wall`. The exact tag name is an open
question coordinated with the catalog owner before launch. The decision must
be reflected in the seed script and in the upload endpoint logic.

The worker does not classify scene mode from the room photo. The mode is
authoritative on the job row. The worker reads it and proceeds directly to
the corners step for the matching dot count (4 for `back_wall`, 6 for
`corner`). If the visitor uploads a photo that does not match the expected
geometry (for example a flat back-wall photo when the sofa is tagged as
corner), the existing geometric validator on the corners step rejects the
result after the configured retry budget and the job fails with
`corners_failed`. This trades one vision-JSON call per simulation for the
deterministic catalog-tag contract.

## API

All public simulation endpoints are implemented as Next.js route handlers
under `apps/web/src/app/api/public/simulation*` and `apps/web/src/app/api/public/simulations*`.
They never expose Supabase service-role credentials, OpenAI keys, private
bucket paths, or another visitor's data to the browser.

### `POST /api/public/simulation/email-verifications` (STUB)

Stub implementation for the development and first-launch period.

Request body:

```json
{
  "email": "visitor@example.com",
  "consent_email_use": true,
  "consent_marketing": false
}
```

Response:

```json
{
  "verification_request_id": "stub-{uuid}",
  "expires_at": "..."
}
```

The stub does not send any email, does not validate the email shape beyond
basic format, accepts any consent payload that has `consent_email_use=true`,
and stores no records. The contract surface matches the SPEC-0010 expectation
so the catalog owner can replace the implementation without changing
clients.

### `POST /api/public/simulation/email-verifications/{verification_request_id}/verify` (STUB)

Stub implementation.

Request body:

```json
{
  "code": "any-six-digits-or-empty"
}
```

Response:

```json
{
  "simulation_access_token": "dev-token-{verification_request_id}",
  "expires_at": "..."
}
```

The stub returns a deterministic access token derived from the request id and
sets a `simulation_access_token` HTTP-only cookie with `Max-Age=86400`,
`SameSite=Lax`, and `Secure` outside local development.

### `POST /api/public/simulations`

Creates a simulation job atomically with the room photo upload.

Headers:

- `Authorization: Bearer {simulation_access_token}` or cookie equivalent.
- `Idempotency-Key: {uuid}` required.

Request type: `multipart/form-data`.

Required form fields:

- `sofa_slug`
- `fabric_id`
- `visual_position_id`
- `room_photo` (binary)

Server behavior:

- Validate the access token by hashed comparison.
- Rate-limit checks against `simulation_rate_limits` for the request IP and
  the email tied to the access token. Reject with a safe error when limits
  are exceeded.
- Deduplicate against `idempotency_keys` by `Idempotency-Key` hash. If a row
  with a `simulation_job_id` already exists, return the existing job.
- Validate the sofa, fabric, and visual position triple is currently
  publishable.
- Determine `room_geometry_mode` from sofa tags.
- Upload the photo to
  `simulations/{job_id}/inputs/room.{ext}` in
  `simulation-private-artifacts`.
- Create the row in `in_home_simulation_jobs` with `status = 'queued'`,
  `retention_deadline = now() + interval '24 hours'`,
  `room_geometry_mode` set as above, and the public-catalog references
  recorded.
- Enqueue the room-prep work message in the pgmq queue.
- Insert the `idempotency_keys` row pointing at the new `simulation_job_id`.
- Increment the rate-limit counters.

Response:

```json
{
  "simulation_job_id": "...",
  "status": "queued",
  "created_at": "...",
  "retention_deadline": "..."
}
```

Failure modes return safe French error messages with no provider details,
storage paths, or sql errors. On storage upload success but DB failure, the
uploaded object is moved to an orphan-cleanup prefix consumed by the existing
purge function.

### `GET /api/public/simulations/{simulation_job_id}`

Returns the current job status and short-lived signed URLs for any artifacts
the visitor is allowed to see at the current state.

Headers:

- `Authorization: Bearer {simulation_access_token}` or cookie equivalent.

Response shape mirrors `SPEC-0010` Step 6 example, with the following
additions specific to this spec:

- For `awaiting_dimensions`, `required_dimensions` always includes
  `room_depth` for both modes.
- The signed URL for `dimension_guide_overlay.png` is included when status is
  `awaiting_dimensions`.
- The signed URL for the latest `output-{n}.png` is included when status is
  `succeeded` or when a previous result remains visible during a
  regeneration.

### `POST /api/public/simulations/{simulation_job_id}/dimensions`

Submits the dimensions and queues stage 2 placement.

Request body for `back_wall`:

```json
{
  "wall_width": 4.2,
  "wall_height": 2.7,
  "room_depth": 5.0
}
```

Request body for `corner`:

```json
{
  "left_wall_width": 3.4,
  "right_wall_width": 4.0,
  "room_height": 2.7,
  "room_depth": 5.0
}
```

Server behavior:

- Verify token and job ownership.
- Validate fields against the job's `room_geometry_mode`.
- Reject if any value is non-positive or above the configured upper bound.
- Persist into `supplied_dimensions` and transition the job to
  `placement_queued`.
- Enqueue the placement message.

### `POST /api/public/simulations/{simulation_job_id}/regenerations`

Requests another placement attempt for an already successful job.

Server behavior:

- Verify token and job ownership.
- Reject if the job is not in `succeeded`.
- Reject if `generated_output_count` has reached three successes.
- Reserve the next `reserved_generation_index` and transition status to
  `placement_queued`.
- Enqueue the placement message with the regeneration intent.

## Worker Jobs

This spec does not change the in-home simulation pipeline behavior validated
by `PLAN-0016`. It only requires the following cleanups to align with current
product decisions:

- Remove `lib/providers/gemini-placement.ts` and any references to the
  Gemini provider in `lib/providers.ts` and the worker's claim/dispatch path.
- Remove the `GEMINI_API_KEY` environment dependency from
  `in-home-simulation-worker`.
- Remove or update tests that exercise the Gemini placement path.
- Make `room_depth` a required key in `supplied_dimensions` validation in
  `lib/dimensions.ts` for both modes. Update related tests.
- The placement provider already consumes `room_depth` when present; ensure
  the prompt path treats absence as an error condition rather than as
  "unspecified".
- Remove `lib/providers/openai-scene-classifier.ts` and any references to
  the scene classifier provider role in `lib/providers.ts` and the Stage 1
  pipeline. The corresponding sub-step in Stage 1 is removed; the worker
  reads `room_geometry_mode` from the job row and proceeds directly to
  the corners step.
- Remove the `IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE` environment dependency
  used to drive the mock scene classifier. Update related tests.
- Preserve the existing validation provider that checks the room photo is a
  usable interior. That provider is unchanged.

The worker's rate-limit awareness is added by the new `simulation_cost_meter`
check in the claim RPCs. When the meter is paused, the worker dequeues
nothing and exits cleanly.

## Environment Variables

Web application (`apps/web`):

- `NEXT_PUBLIC_SUPABASE_URL` (existing).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (existing).
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only) for storage upload and RPC
  invocation when the public anon role is insufficient.
- `NEXT_PUBLIC_SITE_URL` for token cookie scope and email-link generation
  when the catalog owner ships real verification.
- `SIMULATION_QUEUE_NAME` consistent with the worker config.
- `SIMULATION_RATE_LIMIT_IP_PER_DAY=3`.
- `SIMULATION_RATE_LIMIT_EMAIL_PER_DAY=2`.

In-home simulation worker (`supabase/functions/in-home-simulation-worker`):

- `OPENAI_API_KEY` (required).
- `IN_HOME_SIMULATION_QUEUE_NAME` (existing).
- `IN_HOME_SIMULATION_MAX_EDGE_PX=720` (existing).
- `MAX_PLACEMENT_ATTEMPTS=3` (existing).
- `PLACEMENT_TOLERANCE_PCT=5` (existing).
- `SIMULATION_RETENTION_HOURS=24` (existing).
- `SIMULATION_DAILY_COST_CAP_USD=50` for the cost meter.
- `GEMINI_API_KEY` is removed.
- `IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE` is removed (no longer needed
  once the scene classifier is removed).

## Cost Protection

Three layered protections operate concurrently:

- **Per-IP limit**: 3 simulation creations per IP per rolling 24 hours,
  enforced in `POST /api/public/simulations`.
- **Per-email limit**: 2 simulation creations per verified email per rolling
  24 hours, enforced in `POST /api/public/simulations`.
- **Daily cost cap**: a $50 daily soft accountancy ceiling. The
  `simulation_cost_meter` is incremented in the worker after each paid
  OpenAI call using a small fixed-cost estimator. When the daily total
  exceeds the cap, the meter sets `worker_paused = true` for the day. The
  claim RPCs short-circuit while paused. New jobs continue to be created at
  the API level but remain in `queued` until the next day, when the cron
  reset clears the meter.
- **OpenAI dashboard hard limit**: configure a $100 monthly hard limit
  inside the OpenAI account as the final backstop independent of our code.

## Cross-team Contracts

The following items must be confirmed with the catalog owner before
production launch. They are not blockers for development against stubs.

- The exact tag value(s) that mean "corner sofa". The seed script and the
  upload endpoint must use the same value. The catalog owner is
  responsible for tagging every corner sofa with one of those values.
  An untagged corner sofa silently falls back to `back_wall` mode at job
  creation, which causes the worker to ask for a back-wall photo and to
  fail at the corners step when the visitor uploads the actual L-shape
  scene. Mis-tagging is therefore the single biggest catalog risk for
  this flow and must be communicated to the catalog owner explicitly.
- The verification stub is owned by this spec only for the launch window.
  When the catalog owner ships real verification, the route handler bodies
  for the two email-verification endpoints are replaced. The contracts
  defined in `SPEC-0010` and reaffirmed here remain the boundary.
- The route shapes `/sofas/[slug]/simulate` and `/simulations/[id]` are
  fixed.

## Acceptance Criteria

- A verified visitor can complete a full happy path on a `back_wall` test
  sofa from upload through dimension entry, placement, viewing the result,
  and at least one regeneration.
- A verified visitor can complete a full happy path on a `corner` test sofa
  with the dimension form correctly showing four required inputs including
  `room_depth`.
- A bad-input photo path produces the error screen, allows "Recommencer"
  without re-verifying email, and a subsequent good photo completes the
  flow.
- Closing the browser and reopening `/simulations/{job_id}` within 24 hours
  with the cookie intact resumes the latest state without re-verification.
- A job whose `retention_deadline` has elapsed presents the expired screen
  with no restart action.
- Three consecutive uploads from the same IP succeed; the fourth is rejected
  with a safe rate-limit message.
- A duplicate `Idempotency-Key` returns the same `simulation_job_id` and
  does not create a second job or duplicate storage object.
- The L-shape disclaimer is visibly present on the upload screen for any
  sofa whose tags trigger `corner` mode.
- The result screen never exposes signed URLs in visible text, hidden
  attributes, or analytics payloads, and no download or share controls are
  rendered.
- The Gemini placement provider, its tests, and `GEMINI_API_KEY`
  dependency are absent from the in-home simulation worker.
- The scene classifier provider, its tests, and the
  `IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE` dependency are absent from the
  in-home simulation worker. `room_geometry_mode` on every new job is
  set by the upload endpoint based on the selected sofa's tags and is
  consumed unchanged by the worker.
- A passing run of `pnpm spec:check`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` after implementation.

The acceptance test plan that exercises the criteria above is captured in
the implementation plans and run manually for the first launch.

## Open Questions

- The exact tag name (or set) for corner sofas, to be confirmed with the
  catalog owner before the first production deploy.
- The purpose of the Railway service in the project's infrastructure. Not
  blocking.
- Whether a custom domain replaces the Vercel-issued domain before the
  first public launch. Not blocking; the Vercel domain is sufficient for
  development and first prod test.
- The exact wording of the L-shape disclaimer on the upload screen will be
  drafted by Claude in French and reviewed by a native speaker before
  launch.
