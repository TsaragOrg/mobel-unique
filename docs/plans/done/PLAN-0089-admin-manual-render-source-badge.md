# PLAN-0089 Admin Manual Render Source Badge

Plan: PLAN-0089
Spec: SPEC-0014
Related specs: SPEC-0013, SPEC-0005, SPEC-0009, SPEC-0010
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Show the existing `SI` source-image marker on Sofa edit render cells after an
administrator replaces a cell with a manual render upload.

## Workflow Decision

No new spec or change request is required.

`SPEC-0014` already owns the simplified Sofa edit render-cell workflow and
`SPEC-0013` already defines the admin render coverage flow. This plan only
changes how the existing render-cell matrix labels an administrator-supplied
current image. It does not change API contracts, storage layout, database
semantics, publication behavior, image upload validation, or render generation.

## Current Problem

The Renders matrix currently shows the `SI` marker only when a ready render cell
has `source_type = "source_photo"`. After the administrator clicks
`Remplacer manuellement`, the backend correctly returns `source_type =
"manual_upload"` and clears `source_photo_id`, so the matrix stops showing the
marker even though the current image is still an administrator-supplied source
image and not an AI-generated render.

## Architecture

Keep the backend data model unchanged.

Add a UI-only helper in `apps/web/src/app/admin/AdminCatalogPages.tsx` for the
render-cell badge rule. The helper should return true for ready private cells
whose current image source is either `source_photo` or `manual_upload`.

Keep `isSourcePhotoCompleteCell` limited to real source-photo cells. That helper
also controls the detail-sheet sentence `La photo source est le rendu actuel`,
which must not appear for manual uploads.

## Tasks

- [x] Add a failing admin UI regression test for a ready manual-upload render
      cell showing `SI` in the matrix.
- [x] Update the existing manual replacement test so the matrix shows `SI`
      after upload while the detail sheet still says `Envoi manuel`.
- [x] Add the minimal UI helper and use it for the visual `SI` badge and render
      cell accessible label.
- [x] Run the focused admin UI test, web typecheck, and spec guard.
- [x] Move this plan to `docs/plans/done`, update `docs/plans/active/README.md`,
      and update `docs/roadmap/web.md`.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Acceptance Criteria

- A ready `manual_upload` render cell with a current private render shows the
  `admin-render-cell-source-badge` marker with text `SI`.
- A ready `source_photo` render cell keeps the existing `SI` marker behavior.
- A ready `ai_generated` render cell without a manual upload does not show `SI`.
- The render-cell detail sheet still labels manual uploads as `Envoi manuel`.
- The detail-sheet source-photo-only sentence remains limited to true source
  photo cells.

## Notes

This is a frontend-only admin fix. It does not add environment variables and
does not touch DEV or PROD credentials.

## Closure Notes

The implementation keeps `manual_upload` as the stored source type and changes
only the admin render-cell matrix badge rule.
