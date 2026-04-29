# PLAN-0019 Admin Render Preparation Foundation

Plan: PLAN-0019
Spec: SPEC-0013
Status: done
Owner area: web
Depends on: PLAN-0006, PLAN-0010, PLAN-0011, PLAN-0016, PLAN-0017, PLAN-0018, SPEC-0006, SPEC-0009, SPEC-0010
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `package.json`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Deliver the next admin catalog slice required before connecting the fabric
render worker: an authenticated administrator can define sofa visual matrix
columns, upload source photos for render generation, inspect the render coverage
matrix, and create an initial fabric render job that is persisted in
`fabric_render_jobs` and queued for worker processing.

This plan stops at the job handoff boundary. It must create worker-ready jobs,
but it must not implement worker execution, Gemini invocation from the admin UI,
candidate review, candidate selection, publication, or ZIP export.

## Concrete Test Path

After implementation, a local seeded admin should be able to:

1. Sign in at `/admin/login`.
2. Open a draft sofa at `/admin/sofas/[sofa_id]`.
3. Confirm the sofa already has at least one active assigned fabric with
   non-null `public_order`.
4. Create one visual matrix column with:
   - sequence `1`;
   - an admin label;
   - an optional public label.
5. Upload one source photo for that visual matrix column with:
   - purpose `sofa_source_photo`;
   - one original assigned fabric;
   - a valid private image within render input limits.
6. Confirm the render coverage section shows a matrix with:
   - assigned fabrics as rows;
   - active visual matrix columns as columns;
   - one cell for the sofa, fabric, and visual matrix column.
7. Confirm the cell is eligible for initial generation when:
   - the column has a current source photo;
   - the fabric has a private AI reference image;
   - no equivalent active render job already exists.
8. Click `Generate` for the eligible cell.
9. Confirm `POST /api/admin/fabric-render-jobs` creates a durable job with
   status `queued`.
10. Confirm the render coverage matrix shows the queued job state for that cell.
11. Confirm the worker has not run yet and no generated candidate is selected as
    the current render.

## Scope

This plan includes the minimum admin, API, and local smoke coverage needed to
prepare real fabric render jobs for the existing worker foundation.

### Visual Matrix Column Endpoints

Add:

- `GET /api/admin/sofas/{sofa_id}/visual-matrix-columns`;
- `POST /api/admin/sofas/{sofa_id}/visual-matrix-columns`;
- `PATCH /api/admin/visual-matrix-columns/{column_id}`;
- `DELETE /api/admin/visual-matrix-columns/{column_id}`.

Create fields:

- `sequence`;
- `admin_label`;
- `public_label`, nullable.

Patch fields:

- `sequence`;
- `admin_label`;
- `public_label`, nullable.

Rules:

- visual matrix columns belong to one sofa;
- sequence values are positive integers;
- sequence values are unique among active columns for the same sofa;
- blank admin labels are rejected;
- deleting a column is a soft delete that sets `deleted_at`;
- deleting a column requires explicit UI confirmation;
- archived sofas and published sofas must fail closed for mutation until a
  later publication-state plan defines the complete behavior;
- browser-visible errors must not expose SQL, private storage paths, service
  credentials, provider keys, or stack traces.

### Sofa Source Photo Uploads

Extend the existing admin upload flow to support only the new render input
purpose required here:

- `sofa_source_photo`.

Upload create input may include:

- `sofa_id`;
- `visual_matrix_column_id`;
- `original_fabric_id`.

Rules:

- upload initiation and completion require admin authorization;
- browser writes happen only through signed upload capabilities created by the
  admin API;
- the API chooses the private bucket and object path;
- source photo assets remain private in `catalog-private-assets`;
- source photos must be JPEG, PNG, or WebP;
- source photos must be rejected if the longest edge is greater than 2048 px;
- source photos must be rejected unless the sofa, visual matrix column, and
  original fabric form a valid relationship;
- completing a source photo upload creates the `storage_assets` metadata row and
  the `sofa_source_photos` relationship;
- the visual matrix column can set the completed source photo as
  `current_source_photo_id`.

### Render Coverage Endpoint

Add:

- `GET /api/admin/sofas/{sofa_id}/render-coverage`.

Response data must include:

- active visual matrix columns in sequence order;
- assigned fabrics for the sofa;
- render cells for every assigned fabric and active visual matrix column pair;
- current private render state for each cell;
- current source type when available;
- whether each cell is complete for publication preparation;
- latest active or recent fabric render job state for each cell;
- whether an initial generation can be requested for each cell;
- safe blocker codes for incomplete or ineligible cells.

Rules:

- the endpoint must create or return enough render cell identity for admin
  actions without exposing private object paths;
- private review URLs are out of scope for this plan because candidates are not
  being reviewed yet;
- the endpoint must not expose provider secrets, service credentials, raw
  private storage paths, SQL details, or stack traces.

### Fabric Render Job Endpoints

Add:

- `POST /api/admin/fabric-render-jobs`;
- `GET /api/admin/fabric-render-jobs/{job_id}`.

Initial generation create fields:

- `sofa_id`;
- `fabric_id`;
- `visual_matrix_column_id`;
- `generation_mode`, only `initial` in this plan;
- `prompt_note`, nullable;
- `idempotency_key`, optional.

Rules:

- only `initial` generation mode is implemented in this plan;
- `refine` mode is rejected with a stable validation error until candidate
  review exists;
- initial mode requires an active draft sofa;
- initial mode requires an active assigned fabric;
- initial mode requires an active visual matrix column for that sofa;
- initial mode requires a current source photo usable as the target sofa input;
- initial mode requires the fabric's private AI reference image;
- the API must ensure a `sofa_render_cells` row exists for the sofa, fabric, and
  visual matrix column;
- no equivalent active `queued` or `processing` job may exist for the same cell,
  mode, provider, model, prompt version, and prompt note unless the
  implementation explicitly records a new idempotent request;
- job creation writes the durable `fabric_render_jobs` row;
- job creation sends the queue message needed by the existing fabric render
  worker foundation;
- the worker must not be invoked directly by the browser;
- job responses must not include queue internals, private paths, provider keys,
  service credentials, SQL details, or stack traces.

### Admin UI

Extend `/admin/sofas/[sofa_id]` with:

- visual matrix column management;
- source photo upload and current source photo state;
- render coverage matrix;
- generate initial render action for eligible cells;
- queued, processing, failed, succeeded, and canceled job status display when
  returned by the API;
- readiness refresh after visual matrix, source photo, or render job changes.

The UI may be simple and form-based. The important outcome is that a real admin
can create the minimum source context and queue a fabric render job.

## Out Of Scope

This plan does not include:

- fabric render worker execution;
- Gemini provider calls from admin routes;
- real-time job polling beyond explicit refresh or simple post-action refresh;
- refine mode;
- manual render upload;
- private candidate signed review URLs;
- candidate listing UI;
- candidate comparison UI;
- selecting a candidate as current render;
- publication, unpublication, sofa archive, public asset copies, or slug freeze;
- ZIP export request or download;
- public catalog endpoints and public storefront pages;
- in-home simulation behavior.

## Architecture

Use the existing first-party Next.js route-handler boundary in `apps/web`.

Implementation should:

- keep route handlers thin and authorization-first;
- use service-role Supabase access only after admin authorization succeeds;
- reuse existing JSON envelope and error response conventions;
- keep validation, response shaping, and store behavior covered by focused unit
  tests;
- avoid returning raw Supabase table names, private object paths, queue table
  names, worker-only function names, provider details, stack traces, or service
  credentials to browser-visible responses;
- reuse the existing `fabric_render_jobs`, `sofa_render_cells`,
  `visual_matrix_columns`, `sofa_source_photos`, and queue foundation from
  `SPEC-0009`, `PLAN-0006`, and `PLAN-0010`;
- split render-preparation helpers out of `admin-catalog.ts` if the file would
  otherwise become too broad.

## Expected File Structure

Expected implementation files:

- Modify or split from `apps/web/src/lib/admin-catalog.ts`
  - Own visual matrix validation, source photo upload context validation, render
    coverage shaping, render cell creation, job creation, queue enqueueing, and
    safe job response shaping.
- Modify or split from `apps/web/src/lib/admin-catalog.test.ts`
  - Test validation, response shaping, relationship rules, duplicate active job
    rules, and private data redaction.
- Modify `apps/web/src/lib/admin-catalog-route-handlers.ts`
  - Add route-handler orchestration for visual matrix, render coverage, and job
    endpoints.
- Modify `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Test auth, envelopes, validation errors, fake-store behavior, and conflict
    mapping for the new routes.
- Create route files under:
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/visual-matrix-columns/route.ts`;
  - `apps/web/src/app/api/admin/visual-matrix-columns/[column_id]/route.ts`;
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/render-coverage/route.ts`;
  - `apps/web/src/app/api/admin/fabric-render-jobs/route.ts`;
  - `apps/web/src/app/api/admin/fabric-render-jobs/[job_id]/route.ts`.
- Modify existing upload route support under:
  - `apps/web/src/app/api/admin/uploads/route.ts`;
  - `apps/web/src/app/api/admin/uploads/[upload_id]/complete/route.ts`.
- Modify `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Add visual matrix, source photo, render coverage, and generate-job UI to the
    sofa edit page.
- Modify `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Cover visual matrix creation, source photo upload, render coverage loading,
    and initial job creation through first-party admin facade methods.
- Create `supabase/migrations/20260428000200_admin_fabric_render_job_enqueue.sql`
  - Add a service-role helper for enqueueing durable fabric render jobs into the
    local render queue.
- Create `scripts/spec-0010-admin-render-prep-smoke.mjs`
  - Exercise the local admin render preparation flow against local web and local
    Supabase when available, and skip clearly when unavailable.
- Create `scripts/spec-0010-admin-render-prep-smoke.test.mjs`
  - Test pass and skip behavior with mocked `fetch`.
- Modify `package.json`
  - Add a local smoke script and include the smoke-script test in the root
    `test` command.
- Update roadmaps when implementation is complete:
  - `docs/roadmap/api.md`;
  - `docs/roadmap/web.md`;
  - `docs/roadmap/workflow.md`.

## Tasks

- [x] Add failing tests for visual matrix payload validation and response
      shaping.
- [x] Add failing tests for `sofa_source_photo` upload initiation and
      completion validation.
- [x] Add failing tests for source photo relationship validation between sofa,
      visual matrix column, original fabric, and uploaded asset.
- [x] Add failing route-handler tests proving anonymous users receive `401` and
      authenticated non-admin users receive `403` for the new endpoints.
- [x] Add failing route-handler tests for visual matrix list, create, patch, and
      soft-delete.
- [x] Add failing route-handler tests for render coverage matrix loading.
- [x] Add failing tests proving render cells are created or returned for each
      assigned fabric and active visual matrix column pair.
- [x] Add failing tests proving initial render job creation validates sofa,
      fabric, visual matrix column, current source photo, and fabric AI
      reference relationships.
- [x] Add failing tests proving duplicate active fabric render jobs return a
      safe conflict response.
- [x] Add failing tests proving `refine` mode is rejected in this plan.
- [x] Implement visual matrix store operations.
- [x] Implement `sofa_source_photo` upload descriptor and completion behavior.
- [x] Implement source photo relationship persistence and current source photo
      assignment.
- [x] Implement render coverage store operations.
- [x] Implement render cell ensure/load behavior.
- [x] Implement initial fabric render job creation and queue enqueueing.
- [x] Implement fabric render job get/status endpoint.
- [x] Implement the Next.js API route files listed in this plan.
- [x] Extend the admin sofa edit UI with visual matrix and source photo
      controls.
- [x] Extend the admin sofa edit UI with render coverage and generate-job
      controls.
- [x] Add the local admin render preparation smoke script and smoke-script unit
      test.
- [x] Wire the smoke-script test into `package.json`.
- [x] Update the API, web, and workflow roadmaps after implementation.
- [x] Run focused web tests, typecheck, spec check, root tests, and build.

## Tests

Add or update tests before implementation:

- visual matrix create rejects unsupported fields, blank labels, invalid
  sequence values, duplicate active sequence values, unknown sofas, archived
  sofas, and published-sofa mutations;
- visual matrix delete soft-deletes and keeps historical references;
- source photo upload rejects unsupported purposes, unsupported content types,
  oversized files, missing context ids, unknown sofas, unknown columns, unknown
  fabrics, and mismatched relationships;
- source photo completion creates safe asset metadata and does not expose raw
  private object paths;
- render coverage returns active columns, assigned fabrics, render cells, safe
  blocker codes, and job states without private paths;
- render coverage creates or returns stable render cell ids for assigned fabric
  and active column pairs;
- initial render job creation rejects missing source photos, missing fabric AI
  references, archived fabrics, unassigned fabrics, deleted columns, and
  duplicate active jobs;
- initial render job creation creates a queued durable job and sends a queue
  message;
- job status response returns safe status, attempt metadata, and readable
  failure messages without provider secrets or private paths;
- `/admin/sofas/[sofa_id]` can create a visual matrix column, upload a source
  photo, display render coverage, and queue an initial render job through
  first-party `/api/admin/*` calls;
- UI and API responses do not display service-role keys, raw private storage
  paths, queue internals, provider keys, SQL details, or stack traces.

## Roadmap

Update these files only when the implementation is complete:

- `docs/roadmap/api.md`;
- `docs/roadmap/web.md`;
- `docs/roadmap/workflow.md`.

## Notes

Keep this slice as the worker handoff foundation. The outcome should make real
fabric render jobs manually queueable from the admin UI, but it should not
execute worker processing or review generated candidates. The next plan can then
connect the worker processing path to these queued jobs and expose candidate
review.
