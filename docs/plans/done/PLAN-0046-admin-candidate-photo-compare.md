# Admin Candidate Photo Compare

Plan: PLAN-0046
Spec: SPEC-0014
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Let administrators open candidate comparison by clicking the candidate photo
instead of using a separate Compare button.

## Tasks

- [x] Update the candidate review test so candidate photos open the compare
      dialog directly.
- [x] Remove the visible Compare button from candidate rows.
- [x] Keep direct large-image preview available only inside the compare dialog.
- [x] Allow current candidates to open the compare dialog from their photo while
      keeping `Use candidate` disabled for the current candidate.
- [x] Leave candidate photos non-interactive when no source photo is available
      for comparison.
- [x] Update the SPEC-0014 manifest entry and web roadmap.
- [x] Run the focused web test.

## Tests

- Updated `apps/web/src/app/admin/AdminCatalogPages.test.tsx` so the candidate
  review flow verifies that no separate `Compare` button is present, candidate
  photos open the compare dialog, current candidates can be compared, and large
  image preview still opens from inside compare.
- Ran `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`.

## Roadmap

- Updated `docs/roadmap/web.md`.

## Notes

- This is a UI-only change.
- No API, storage, worker, publication, or candidate selection rule changes are
  included.
