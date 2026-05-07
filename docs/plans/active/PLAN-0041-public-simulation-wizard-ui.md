# PLAN-0041 Public Simulation Wizard UI With French Copy And Worker Parity Gate

Plan: PLAN-0041
Spec: SPEC-0015
Status: active
Owner area: web
Affected packages:

- `apps/web/src/app/sofas/[slug]/simulate/page.tsx` (new)
- `apps/web/src/app/simulations/[simulation_job_id]/page.tsx` (new)
- `apps/web/src/components/simulation/*.tsx` (new — screens, dimension form, polling host)
- `apps/web/src/lib/simulation-client/compress.ts` (new)
- `apps/web/src/lib/simulation-client/upload.ts` (new — XHR + retry + idempotency-key)
- `apps/web/src/lib/simulation-client/poll.ts` (new — 2-second polling hook)
- `apps/web/src/lib/simulation-client/locale.ts` (new — French copy)
- `apps/web/src/lib/simulation-client/__tests__/*.test.ts` (new)
- `apps/web/src/components/simulation/__tests__/*.test.tsx` (new)
- `docs/roadmap/web.md`

## Goal

Ship the customer-facing simulation wizard at `/sofas/[slug]/simulate` and
the continuation page at `/simulations/[simulation_job_id]` with the six
screens described in SPEC-0015. The wizard authors French copy directly
with `// TODO: FR native review` markers on consent, retention, and error
strings. After this plan, a verified visitor can complete a full happy
path in the browser against the live API from PLAN-0040.

This plan introduces a Worker Behavior Parity Gate as a release blocker:
a single fixture photo flowing through the UI flow must produce a worker
artifact set (dots, lines, sofa output) that matches the terminal-harness
baseline within tolerance. If the gate fails, the UI compression step is
the prime suspect and must be loosened before the plan ships.

## Tasks

### Client-side helpers

- [ ] Add unit tests for `compress.ts`: 1600 px maximum edge, JPEG quality
      0.85, EXIF rotation baked into pixels, no upscaling, original-bytes
      fallback for files smaller than the threshold and for HEIC inputs
      that the browser cannot decode.
- [ ] Implement `compress.ts` using `<canvas>` and `createImageBitmap`.
- [ ] Add unit tests for `upload.ts`: progress events surface a 0-100
      percentage, the same `Idempotency-Key` UUID is reused across all
      three attempts, the retry harness honours 1-second and 3-second
      backoffs, and a final failure surfaces a stable error code.
- [ ] Implement `upload.ts` using `XMLHttpRequest`.
- [ ] Add unit tests for `poll.ts`: polls every 2 seconds, stops on
      terminal statuses (`succeeded`, `failed`, `canceled`, `expired`),
      stops when the document is hidden for more than the grace period,
      and resumes on visibility change.
- [ ] Implement `poll.ts` as a React hook.
- [ ] Add `locale.ts` with all visible French strings, organized per
      screen, and `// TODO: FR native review` markers above any string
      that carries legal weight (consent confirmation, retention notice,
      error messaging that quotes the retention deadline).

### Screen components

- [ ] Add component tests for Screen 1 (Photo Upload): shows the context
      strip, the corner disclaimer for corner-tagged sofas vs. the
      back-wall disclaimer otherwise, the camera capture button only on
      touch devices, the file picker on every device, the preview after
      file selection, the Continue button gating on a valid file, and the
      retry-after-failure honest screen.
- [ ] Implement Screen 1.
- [ ] Add component tests for Screen 2 (Room Preparation Processing):
      static processing indicator, no progress percentage, no cancel,
      polling cadence respected.
- [ ] Implement Screen 2.
- [ ] Add component tests for Screen 3 (Dimension Entry): correct field
      set per `room_geometry_mode`, signed guide image with `onError`
      refresh, validation gate on the Continue button, submission posts
      the right payload shape.
- [ ] Implement Screen 3.
- [ ] Add component tests for Screen 4 (Final Placement Processing):
      destructive full-screen indicator only when no previous result
      exists; translucent overlay over the previous result during
      regeneration.
- [ ] Implement Screen 4.
- [ ] Add component tests for Screen 5 (Result): regeneration button is
      removed from the DOM (not disabled) when unavailable, the muted
      retention notice always shows, the inline error message appears
      after a failed regeneration, the secondary "Back to sofa" link
      navigates to `/sofas/[slug]`.
- [ ] Implement Screen 5.
- [ ] Add component tests for Screen 6 (Error or Expired): the error
      variant offers Restart that reuses the existing access cookie
      without re-verifying, the expired variant offers only "Back to
      catalog" and never Restart, neither variant exposes provider
      details, sql errors, or storage paths.
- [ ] Implement Screen 6.

### Routing and host pages

- [ ] Add route test for `/sofas/[slug]/simulate` rendering Screen 1 only
      and replacing history with `/simulations/{id}` after job creation.
- [ ] Implement the wizard entry route.
- [ ] Add route test for `/simulations/[simulation_job_id]` selecting the
      right screen for each polled status.
- [ ] Implement the continuation route.
- [ ] Wire `<img onError>` lazy refresh against the status endpoint for
      both the dimension guide image and the result image.

### Worker behavior parity gate

- [ ] Add a CI-friendly E2E test that uploads a fixture room photo
      (`scripts/seed-simulation-test-data/fixtures/parity-room.jpg`)
      through the UI flow, polls until `succeeded`, downloads the result
      image, and asserts dot positions in the corners-annotated artifact,
      line positions in the dimension-guide artifact, and the sofa
      bounding-box centroid in the result image are within tolerance of
      the terminal-harness baseline (`fixtures/parity-baseline.json`).
- [ ] Document the parity baseline regeneration command in
      `docs/local-supabase-worker-development.md`.

### Cross-cutting

- [ ] Update `docs/roadmap/web.md`.
- [ ] Run `pnpm typecheck`, `pnpm test`, `pnpm spec:check`, `pnpm build`.

## Tests

- Helper unit tests for `compress`, `upload`, `poll`.
- Component tests for all six screens.
- Route tests for both pages.
- E2E parity gate test (release blocker).

## Roadmap

- `docs/roadmap/web.md`

## Notes

- Visible UI is rendered in French. The Locale module is the only place
  the strings live. PLAN-0042 captures native-review feedback and
  iterates on legally significant strings only.
- The compression step is the highest-risk place for worker output drift.
  The default 1600 px / 0.85 quality is chosen to keep the worker's 720 px
  internal compression downstream of a still-clean source image. If the
  parity gate reports drift, raise quality to 0.95 or skip compression
  for files under 5 MB before declaring the plan done.
- The dimension form's field order and labels match the colored guide
  lines deterministically; the order is part of the contract with the
  worker, not a stylistic decision.
- No download, share, or save controls anywhere in the wizard. No signed
  URL appears in visible markup, hidden attributes, or analytics
  payloads. The acceptance criteria in SPEC-0015 forbid them.
- This plan does not change worker code. Any divergence between UI flow
  and terminal flow must be solved on the UI side or by adjusting upload
  parameters; the worker remains a black box.

## Follow-up fix: simulation upload {data} envelope parsing (2026-05-03)

`apps/web/src/lib/simulation-client/upload.ts` `safeParseSuccess` was
written for a flat response shape (`{simulation_job_id, status,
created_at, retention_deadline}`), but the route handler in PLAN-0040
returns `{data: {...}}`. On a successful 201 the parser silently
returned `null`, the upload helper reported `INVALID_RESPONSE`, and
the wizard surfaced the generic "L'envoi n'a pas pu aboutir" error
even though the API succeeded and the job was queued. The parser now
unwraps `data` when present and falls back to the flat shape so the
existing tests and any non-enveloped callers continue to work. A new
test asserts the enveloped 201 path returns `ok: true` with the
correct `jobId`. This mirrors the PLAN-0050 envelope fix on the
email-gate `auth.ts` helpers.

## Follow-up fix: dimension entry centimetre input (2026-05-07)

`Screen3Dimensions` accepted visitor-entered values as raw metres while
the French wizard flow expects centimetre measurements. Visitors entering
values such as `420`, `270`, and `500` for a 4.2 m by 2.7 m by 5 m room
therefore tripped the `[0.5, 20] m` API-range gate and kept the Continue
button disabled. The screen now validates browser input in centimetres
(`50` to `2000` cm), displays the `cm` unit suffix, and converts the
submitted payload back to metres before calling the PLAN-0040 dimensions
endpoint so the worker and database contract remain unchanged. Component
tests cover the back-wall and corner conversions plus the disabled-state
range gate.
