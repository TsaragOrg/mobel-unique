# PLAN-0021 Admin Render Candidate Review And Manual Upload

Plan: PLAN-0021
Spec: SPEC-0013
Status: done
Owner area: web
Depends on: PLAN-0019, PLAN-0020, SPEC-0006, SPEC-0009, SPEC-0010
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `package.json`
- `docs/plans`
- `docs/roadmap/api.md`
- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Deliver the next admin render workflow slice after render job queueing: an
authenticated administrator can review private AI-generated render candidates,
select one candidate as the current private render for a render cell, or upload
a manual render for the same cell. The flow must stop at private render coverage
completion and must not publish public assets.

This plan also performs the small workflow cleanup for `PLAN-0019`, which is
already merged into `dev`.

## Concrete Test Path

After implementation, a local seeded admin should be able to:

1. Confirm `PLAN-0019` is listed under `docs/plans/done` and no longer appears
   in `docs/plans/active/README.md`.
2. Sign in at `/admin/login`.
3. Open a draft sofa at `/admin/sofas/[sofa_id]`.
4. Use the existing render preparation flow to reach a render coverage cell with
   a successful fabric render job candidate.
5. Open candidate review for that render cell.
6. See each private generated candidate with safe metadata and a short-lived
   signed preview URL.
7. Select one candidate with `Use as current`.
8. Confirm the render coverage cell now has a private current render and remains
   unpublished.
9. Upload a valid manual render for another render cell.
10. Confirm the manual render becomes the current private render for that cell.
11. Refresh the page and confirm both current private render selections persist.
12. Confirm no public asset copy is created and the sofa is still not published.

## Scope

### Workflow Cleanup

Move the completed `PLAN-0019` file from `docs/plans/active` to
`docs/plans/done`, update active and done plan indexes, and keep roadmap entries
consistent with the fact that `PLAN-0019` is now done.

### Candidate Review API

Add:

- `GET /api/admin/render-cells/{render_cell_id}/candidates`;
- `POST /api/admin/render-candidates/{candidate_id}/use-as-current`.

Rules:

- only authenticated admins can list or select candidates;
- candidates must belong to the requested render cell context;
- signed preview URLs must be short-lived and must not expose raw private
  storage paths as durable browser state;
- the response can include safe operational metadata: candidate id, created
  time, generation mode, provider name/model, prompt version, dimensions,
  candidate job id, and whether it is currently selected;
- selecting a candidate updates `sofa_render_cells.current_private_asset_id`,
  `sofa_render_cells.accepted_fabric_render_candidate_id`, candidate
  `accepted_at`, `source_type = 'ai_generated'`, and `updated_at`;
- selecting a candidate must not write `current_public_asset_id`;
- worker success must not automatically select candidates.

### Manual Render Upload API

Extend the existing admin upload flow to support:

- upload purpose `manual_render`.

Add:

- `POST /api/admin/render-cells/{render_cell_id}/manual-render`.

Rules:

- manual render upload uses the existing signed upload initiation and completion
  flow;
- the completed asset must be private in `catalog-private-assets`;
- accepted content types are JPEG, PNG, and WebP, using the same image metadata
  validation style as existing admin render inputs;
- the manual render asset must belong to the same sofa, fabric, and visual
  matrix column as the target render cell;
- setting a manual render updates `sofa_render_cells.current_private_asset_id`,
  clears `accepted_fabric_render_candidate_id`, sets `source_type =
'manual_upload'`, and updates `updated_at`;
- setting a manual render must not write `current_public_asset_id`;
- manual upload does not publish anything.

### Admin UI

Extend the sofa edit render coverage section:

- show candidate count or candidate availability for each render cell;
- add an action to open candidate review for a cell;
- show candidate previews, metadata, selected/current state, and `Use as
current`;
- add a manual render upload action for a cell;
- refresh render coverage after candidate selection or manual render selection;
- show safe loading, empty, validation, expired signed URL, and failure states.

The UI can remain functionally simple. This plan does not require a final
gallery design system or bulk candidate comparison.

### Local Smoke Coverage

Add or extend a local smoke script proving:

- candidate listing returns a private signed preview URL;
- candidate selection marks the candidate as current private render coverage;
- manual render upload completion can be attached to a render cell;
- render coverage reflects private completion after both paths;
- neither path creates a public render asset or publishes the sofa.

## Out Of Scope

This plan does not include:

- publishing sofas;
- unpublishing or archiving sofas;
- creating public asset copies in `catalog-public-assets`;
- ZIP exports;
- public catalog or public sofa pages;
- fabric render job retry/cancel UI;
- provider execution changes;
- smart candidate ranking, approval notes, or persistent reject status.

## Tasks

- [x] Move `PLAN-0019` from active to done and update plan indexes.
- [x] Add failing catalog-store tests for candidate listing, candidate
      selection, manual render upload purpose, and manual render selection.
- [x] Add failing route-handler tests for the new admin endpoints.
- [x] Add failing UI tests for candidate review and manual upload actions in
      the render coverage section.
- [x] Confirm no new Supabase helper migration is required for safe candidate
      selection and manual render attachment.
- [x] Implement candidate listing with short-lived signed preview URLs.
- [x] Implement candidate selection as current private render coverage.
- [x] Extend upload parsing, validation, and completion for `manual_render`.
- [x] Implement manual render attachment to a render cell.
- [x] Extend the render coverage response with candidate availability needed by
      the UI.
- [x] Implement admin UI candidate review and manual upload controls.
- [x] Add or extend a local smoke script for the full private render completion
      flow.
- [x] Update relevant roadmaps.
- [x] Run the narrow test set, then the broader local quality gate.

## Tests

Add or update:

- `apps/web/src/lib/admin-catalog.test.ts`;
- `apps/web/src/lib/admin-catalog-route-handlers.test.ts`;
- `apps/web/src/app/admin/AdminCatalogPages.test.tsx`;
- `scripts/spec-0010-admin-render-prep-smoke.test.mjs` or a new focused smoke
  test script for candidate review and manual upload;
- Supabase migration tests if a helper function migration is added.

Expected checks:

- `pnpm --filter @mobel-unique/web test`;
- `pnpm --filter @mobel-unique/web typecheck`;
- `pnpm spec:check`;
- `pnpm test`;
- `pnpm typecheck`;
- `pnpm build`;
- `pnpm supabase:reset`;
- the focused local admin smoke command with local Supabase and web running.

## Manual Verification

The manual test for this plan should stop after private render coverage is
complete:

1. Start local Supabase and web.
2. Reset the database.
3. Sign in as the seeded admin.
4. Create or use a draft sofa.
5. Assign an active fabric with swatch and AI reference.
6. Create a visual matrix column and source photo.
7. Generate a fabric render job and run the worker until a candidate exists.
8. Review candidates from the render coverage cell.
9. Use one generated candidate as current.
10. Upload a manual render for another cell.
11. Confirm both cells show private render coverage.
12. Confirm the sofa remains draft and no public render is visible.

## Roadmap

Update:

- `docs/roadmap/api.md`;
- `docs/roadmap/web.md`;
- `docs/roadmap/supabase.md`;
- `docs/roadmap/workflow.md`.

## Notes

The implementation must preserve the accepted boundary from `SPEC-0006` and
`SPEC-0009`: the worker creates private candidates, and the admin explicitly
decides whether a candidate becomes the current private render. Publication is a
later separate transaction.

2026-05-03 follow-up: manual render uploads now immediately replace
source-photo-current cells in the open render cell sheet, and upload failures
are shown inside that same sheet.
