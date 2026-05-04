# PLAN-0059 Admin Sofa Source Fabric Reassignment Safety

Plan: PLAN-0059
Spec: SPEC-0014
Status: active
Owner area: web
Change request: CR-SPEC-0014-admin-sofa-source-fabric-reassignment-safety
Depends on: PLAN-0023, PLAN-0052, SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0013, SPEC-0014
Affected packages:

- `apps/web`
- `supabase/migrations`
- `docs/roadmap`

## Goal

Make the View Columns save flow logically safe when an administrator changes the
source fabric line for an existing source image without uploading a new image.

The operation must update the visual matrix column, the current source photo,
and the old/new source-photo render cells as one logical mutation, with tests
that prove the admin cannot unknowingly leave the sofa in a partially updated
state.

## Background

The checkpoint commit `6792164` improved the admin sofa edit UX and added the
desired no-upload behavior for source fabric line corrections. Review found one
important follow-up risk: the current implementation can persist part of a
View Columns save before a later source-photo or render-cell synchronization
step fails.

This plan is the hardening pass before considering the sofa creation/edit work
ready for merge.

## Scope

### Included

- Treat source fabric reassignment as a transaction-backed admin mutation.
- Keep the UX rule that an existing source image does not need to be uploaded
  again when only its source fabric line changes.
- Keep the rule that a missing source image still requires upload before a
  source fabric line can be selected.
- Ensure the old source-fabric render cell is detached only when it still points
  to the moving source photo.
- Ensure the new source-fabric render cell is synchronized to the source photo.
- Reject `source_original_fabric_id` on visual matrix column creation payloads.
- Add focused tests before implementation.
- Update web and Supabase roadmaps.

### Excluded

- Changing fabric render worker behavior.
- Changing public publication rules.
- Regenerating AI-derived render cells after a source fabric correction.
- Adding drag-and-drop view column ordering.
- Changing storage bucket structure.
- Redesigning the rest of the sofa edit page beyond states directly affected by
  this save flow.

## Proposed Implementation

### 1. Tests First

Add or update failing tests for:

- visual matrix column create validation rejecting `source_original_fabric_id`;
- visual matrix column patch validation accepting `source_original_fabric_id`;
- the admin UI sending `source_original_fabric_id` without requiring upload when
  a current source photo exists;
- the admin UI requiring upload when no source photo exists and a source fabric
  line is selected;
- the Supabase-backed store using a transaction boundary for source fabric
  reassignment;
- old source render cell cleanup preserving cells that do not point to the
  moving source photo;
- new source render cell synchronization;
- mapped failure states leaving the workbench open with a visible error.

### 2. Add A Transaction Boundary

Prefer a service-role-only Postgres RPC in `supabase/migrations` that performs
the no-upload reassignment in one transaction.

The RPC should:

- lock the target visual matrix column;
- verify the column belongs to the sofa;
- lock the current source photo when source fabric reassignment is requested;
- verify the target fabric is assigned to the sofa;
- update visual matrix column fields from the patch payload;
- update the current source photo's `original_fabric_id`;
- clear the old source-fabric render cell only when it still references the
  moving source photo;
- upsert the new source-fabric render cell with the source photo asset as the
  current private render;
- avoid changing public asset fields;
- return the updated visual matrix column row.

If implementation details make one broad RPC too large, a narrower RPC may own
the source-photo and render-cell reassignment while the application orders
column metadata updates so a failed reassignment cannot be hidden as a
successful save. Any remaining non-atomic gap must be documented in this plan
before completion.

### 3. Wire The Admin Store

Update `createSupabaseAdminCatalogStore().updateVisualMatrixColumn` so:

- patches without `source_original_fabric_id` keep the simple direct update
  path;
- patches with `source_original_fabric_id` use the transaction boundary;
- Supabase RPC or database errors are mapped to stable admin validation errors;
- the returned column shape remains compatible with existing route handlers and
  UI code.

### 4. Tighten Payload Validation

Separate visual matrix column create and patch supported-field lists.

Rules:

- create payloads reject `source_original_fabric_id`;
- patch payloads accept it as an optional UUID;
- both paths continue rejecting unknown fields consistently.

### 5. Preserve UI Semantics

Keep the current View Columns edit workbench behavior:

- no upload required when a current source image exists;
- upload required when no current source image exists;
- save button disabled while saving;
- destructive actions disabled during save;
- error displayed inside the active workbench;
- workbench closes only after the full save completes.

Improve any raw validation-code strings that now surface directly in the
workbench.

## Tasks

- [x] Add failing validation tests for create-vs-patch payload handling.
- [x] Add failing store tests for transactional source fabric reassignment.
- [x] Add failing UI tests for no-upload reassignment and visible save failures.
- [x] Add the Supabase migration for the transaction boundary.
- [x] Wire `updateVisualMatrixColumn` to use the transaction boundary.
- [x] Remove or retire the current multi-step source fabric reassignment helper
      path after the transaction boundary is in place.
- [x] Tighten visual matrix create payload validation.
- [x] Normalize user-facing error copy for this save flow.
- [x] Update web and Supabase roadmaps.
- [x] Run the narrow web tests.
- [x] Run `pnpm --filter @mobel-unique/web typecheck`.
- [x] Run `pnpm spec:check`.
- [x] Run broader checks if the Supabase migration or route-handler behavior has
      cross-package impact.

## Implementation Notes

- Added `admin_update_visual_matrix_column_source_fabric` as the
  service-role-only transaction boundary for source fabric reassignment.
- `updateVisualMatrixColumn` now uses the RPC whenever
  `source_original_fabric_id` is present, so the previous multi-step application
  helper is no longer used.
- Visual matrix create payloads now reject `source_original_fabric_id` instead
  of accepting and ignoring it.
- The View Columns workbench keeps no-upload source fabric correction for
  existing source images, but now shows English validation messages for missing
  source fabric or missing source image cases.

## Tests

Expected additions or updates:

- `apps/web/src/lib/admin-catalog.test.ts`
- `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
- `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
- migration or SQL smoke coverage where the existing project test structure
  supports it.

Expected commands:

- `pnpm --filter @mobel-unique/web test`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`
- `pnpm typecheck` when the implementation touches shared types or route
  contracts outside the narrow web package.

## Manual Verification

Use a local admin sofa with at least two assigned fabric lines and one view
column with a current source image.

1. Open `/admin/sofas/[sofa_id]`.
2. Open View Columns.
3. Edit a view column that already has a source image.
4. Change only the source fabric line.
5. Save and confirm no image upload is required.
6. Confirm the workbench shows loading and closes only after success.
7. Refresh render coverage.
8. Confirm the old source fabric cell no longer points to that source photo.
9. Confirm the new source fabric cell is complete from `source_photo`.
10. Confirm existing manual or accepted AI cells not tied to the moving source
    photo were not overwritten.
11. Repeat with a simulated failure and confirm the error remains visible inside
    the workbench.

## Roadmap

Update:

- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`

## Completion Criteria

- The no-upload source fabric correction path has a transaction-backed mutation
  or an explicitly documented equivalent consistency guarantee.
- Create payload validation no longer accepts ignored source-fabric fields.
- Focused tests fail before the implementation and pass after it.
- Web typecheck and spec guard pass.
- Manual verification confirms no hidden partial-save behavior in the View
  Columns workbench.
