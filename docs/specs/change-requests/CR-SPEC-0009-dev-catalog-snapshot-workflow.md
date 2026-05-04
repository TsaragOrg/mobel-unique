# CR-SPEC-0009 DEV Catalog Snapshot Workflow

Target spec ids: SPEC-0009, SPEC-0001
Status: accepted
Implementation Plans: PLAN-0061

## Reason For Change

The team needs a controlled way to copy the current local sofa catalog data into
the Supabase DEV database without copying admin authentication state or visitor
simulation data.

GitHub Actions cannot read a developer's local Supabase database directly. A
safe refresh therefore needs two explicit steps: generate a committed,
catalog-only SQL snapshot from the local database, then manually trigger a DEV
workflow that validates and applies that snapshot.

## Proposed Change

- Add a local snapshot export script for catalog data.
- Limit the snapshot to sofas, fabrics, public tags, sofa-fabric and sofa-tag
  assignments, visual matrix columns, source photos, render cells, render jobs,
  render candidates, render exports, and catalog `storage_assets` metadata.
- Exclude auth tables, trusted admin devices, visitor email and simulation
  records, rate-limit and cost-meter state, worker event logs, storage schema
  metadata, and storage object bytes.
- Add a validator that rejects snapshots outside the committed DEV snapshot
  directory or snapshots referencing tables outside the approved catalog scope.
- Add a manually triggered GitHub workflow that targets only Supabase DEV
  secrets, requires `REPLACE_DEV_CATALOG`, supports dry-run validation, and
  applies the committed snapshot only when explicitly confirmed.

## Impact

- Database: no migration. The workflow applies data-only SQL to DEV when
  manually triggered.
- Workflow: a new manual DEV-only GitHub Actions workflow applies the snapshot.
- Local tooling: a new export command writes a catalog-only SQL snapshot from
  the local Supabase database.
- Storage: object bytes are not included. The DEV database can reference assets
  whose files still need to exist in DEV Storage.

## Acceptance Criteria

- The export command refuses non-local database URLs by default.
- The generated SQL avoids auth, admin, visitor simulation, worker log, and
  storage schema tables.
- The workflow can be dry-run before apply.
- The workflow uses only Supabase DEV project secrets and refuses to run from a
  non-`dev` branch.
- The snapshot validator runs before any DEV database apply step.
