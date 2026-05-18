# CR-SPEC-0010-SPEC-0013 Admin Render Candidate Deletion

Target spec ids: SPEC-0010, SPEC-0013

## Reason For Change

Admin render review can accumulate generated candidates that the administrator
does not want to keep. The current flow lets the administrator review a
candidate or select it as current, but it does not provide a cleanup action for
unselected candidates.

## Proposed Change

Add an authenticated admin-only delete action for render candidates that are not
the current private render for their render cell.

API behavior:

- add `DELETE /api/admin/render-candidates/{candidate_id}`;
- reject deletion when the candidate is the render cell's current candidate or
  its asset is the render cell's current private asset;
- reject deletion when the owning sofa is not `draft`, matching the existing
  candidate selection edit boundary;
- remove the `fabric_render_candidates` row for an unselected candidate;
- mark the candidate's private storage asset as deleted by setting
  `storage_assets.lifecycle_state = 'deleted'` and `deleted_at`;
- return `204 No Content` on success;
- return safe admin errors without raw private paths, SQL details, provider
  secrets, or service credentials.

Admin UI behavior:

- show the existing delete icon on candidate rows only when the candidate is not
  selected as current;
- require an explicit confirmation click before deleting;
- keep the selected/current candidate protected from deletion;
- remove the deleted candidate from the open review list without a full page
  refresh;
- refresh render coverage so the cell candidate count is updated.

## Impact

- Plans: add PLAN-0101 as a focused follow-up to the existing admin render
  candidate review flow.
- API: adds one admin route and one catalog store operation.
- Database: no migration is required because the existing foreign keys allow an
  unselected candidate row to be deleted, and storage assets already support the
  `deleted` lifecycle state.
- UI: adds a destructive cleanup affordance in the existing candidate review
  list.
- Worker, publication, ZIP export, public catalog, and public simulation flows:
  unchanged.

## Approval Note

Requested by admin UX feedback on 2026-05-18.
