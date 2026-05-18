# Admin Render Candidate Deletion

Plan: PLAN-0101
Spec: SPEC-0013
Change request: CR-SPEC-0010-SPEC-0013-admin-render-candidate-deletion
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/specs`
- `docs/plans`
- `docs/roadmap`

## Goal

Let administrators delete unwanted unselected render candidates from the sofa
edit render candidate review list.

## Delivered

- Added `DELETE /api/admin/render-candidates/{candidate_id}`.
- Added `deleteRenderCandidate(candidateId)` to the admin catalog store.
- Deleting a candidate is allowed only for draft sofas.
- The current candidate is protected when either
  `accepted_fabric_render_candidate_id` or `current_private_asset_id` points to
  it.
- Successful deletion removes the `fabric_render_candidates` row and marks the
  candidate storage asset as deleted.
- The admin candidate review list now shows the existing delete icon only for
  unselected candidates.
- The first delete click asks for confirmation, the second click deletes.
- The open review list removes the deleted candidate immediately and refreshes
  render coverage.

## Tests

- Added store coverage in `apps/web/src/lib/admin-catalog.test.ts`.
- Added route-handler coverage in
  `apps/web/src/lib/admin-catalog-route-handlers.test.ts`.
- Added admin UI coverage in
  `apps/web/src/app/admin/AdminCatalogPages.test.tsx`.

## Verification

```bash
pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts src/app/admin/AdminCatalogPages.test.tsx
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

Final focused verification passed on 2026-05-18 with 121 Vitest tests,
`tsc --noEmit`, and the specification guard.

## Notes

No database migration was required. The existing candidate table allows deleting
unselected candidate rows, and `storage_assets` already has a `deleted`
lifecycle state.
