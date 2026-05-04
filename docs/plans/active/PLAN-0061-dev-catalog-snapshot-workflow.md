# PLAN-0061 DEV Catalog Snapshot Workflow

Plan: PLAN-0061
Spec: SPEC-0009
Status: active
Owner area: workflow
Change request: CR-SPEC-0009-dev-catalog-snapshot-workflow
Depends on: SPEC-0001, SPEC-0009
Affected packages:

- `.github/workflows`
- `scripts`
- `supabase/catalog-snapshots`
- `docs/roadmap`

## Goal

Create a repeatable, manual, DEV-only workflow for replacing Supabase DEV sofa
catalog data with a catalog-only snapshot generated from the local Supabase
database, while excluding admin/auth and visitor simulation data.

## Scope

- Add a local export script for catalog data snapshots.
- Add a snapshot validator with table-scope guardrails.
- Add a manually triggered GitHub Actions workflow that validates and applies
  the snapshot to Supabase DEV only.
- Add a committed snapshot directory README explaining the two-step process and
  the storage object limitation.
- Add tests covering export scope, snapshot validation, and workflow guards.

## Out Of Scope

- Syncing Supabase Storage object bytes.
- Copying auth users, admin trusted devices, or visitor simulation records.
- Applying the snapshot automatically on merge.
- Applying any catalog snapshot to PROD.

## Tasks

- [x] Add snapshot export and validation scripts.
- [x] Add a manual Supabase DEV snapshot workflow with dry-run support.
- [x] Document the committed snapshot process and storage limitation.
- [x] Add regression tests for the export scope, validator, and workflow.
- [x] Update spec traceability and roadmaps.
- [x] Generate the current local catalog snapshot.
- [x] Run focused tests and spec guard.

## Verification

Expected commands:

- `pnpm exec vitest run scripts/dev-catalog-snapshot.test.mjs`
- `pnpm catalog:snapshot:export`
- `pnpm catalog:snapshot:validate`
- `pnpm spec:check`

## Notes

The snapshot intentionally stores catalog `storage_assets` metadata but not
Supabase Storage object bytes. If the matching bucket objects are absent from
DEV Storage, image references can exist in the database while image rendering
still fails until the storage objects are synchronized separately.
