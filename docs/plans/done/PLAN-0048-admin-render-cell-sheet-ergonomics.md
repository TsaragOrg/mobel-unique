# Admin Render Cell Sheet Ergonomics

Plan: PLAN-0048
Spec: SPEC-0014
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Improve the Renders tab cell sheet so candidate review is easier to scan and
does not repeat the action that opened the current view.

## Tasks

- [x] Add regression coverage for candidate-review ergonomics in the render
      cell sheet.
- [x] Hide the duplicate `Review candidates` primary action when candidate
      review is already open.
- [x] Present each candidate as a structured row with preview, metadata, and
      grouped actions.
- [x] Rename the refinement opener to `Refine candidate`.
- [x] Move `Generate new candidate` into a separate follow-up action block.
- [x] Improve sheet close, candidate row, and responsive styling.
- [x] Update the web roadmap and SPEC-0014 manifest entry.
- [x] Run the focused web test.

## Tests

- Updated `apps/web/src/app/admin/AdminCatalogPages.test.tsx` so candidate
  cells open review without a duplicate `Review candidates` button, candidate
  rows expose grouped actions, and the follow-up generation block stays
  separate.
- Ran `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`.

## Roadmap

- Updated `docs/roadmap/web.md`.

## Notes

- This is a UI-only change.
- No API, storage, worker, publication, comparison, or candidate selection rule
  changes are included.
