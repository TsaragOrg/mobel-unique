# Admin Candidate Cell Direct Review

Plan: PLAN-0045
Spec: SPEC-0014
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Let administrators open candidate review directly from a Candidate render cell with one click.

## Tasks

- [x] Update the candidate-cell test so one click on a Candidate cell loads the review list.
- [x] Implement the smallest UI change that opens the existing review list when a Candidate cell sheet opens.
- [x] Keep non-Candidate cells unchanged.
- [x] Update the web roadmap.
- [x] Run the focused web test.

## Tests

- Updated `apps/web/src/app/admin/AdminCatalogPages.test.tsx` so `opens generated candidate review directly and attaches a manual render from coverage` expects candidate preview after clicking the Candidate cell, without clicking `Review candidates`.
- Kept the existing missing-cell sheet test as coverage that non-Candidate cells still open without candidate review.

## Roadmap

- Updated `docs/roadmap/web.md`.

## Notes

- This plan reuses the accepted SPEC-0014 candidate review behavior.
- No API, storage, worker, publication, or candidate selection rule changes are included.
