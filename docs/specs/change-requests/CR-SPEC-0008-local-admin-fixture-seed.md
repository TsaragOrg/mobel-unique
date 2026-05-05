# Change Request: Local Admin Fixture Seed

Spec: SPEC-0008

Status: Accepted

## Summary

Extend the local Supabase workflow so `pnpm supabase:reset` loads reusable admin
catalog fixture data after migrations and the SQL seed.

## Motivation

Manual admin testing currently requires repeatedly recreating fabrics, sofas,
source photos, assignments, and render cells after each local database reset.
That slows down testing of admin render generation and makes local validation
unnecessarily fragile.

## Change

- Add a local-only `seed:local:admin-fixtures` repository script.
- Make `supabase:reset` run the fixture seed after `supabase db reset`.
- Keep a `supabase:reset:db-only` escape hatch for database-only resets.
- Load fixture image objects into Supabase Storage and corresponding
  `storage_assets` rows.
- Seed at least three fabrics and at least two sofas.
- Seed visual positions, source photos, sofa-fabric assignments, and render
  cells so `Generate all` has eligible missing render cells.
- Support a local ignored fixture manifest and local ignored image directory.
- Refuse non-local Supabase URLs unless explicitly overridden.

## Acceptance Criteria

- Running `pnpm supabase:reset` locally leaves the admin catalog with reusable
  fixture fabrics and sofas.
- Running `pnpm seed:local:admin-fixtures` directly is idempotent for the same
  fixture manifest.
- The seed works without custom images by using placeholder images.
- Developers can provide real images through
  `fixtures/local-admin-catalog/manifest.json` and
  `fixtures/local-admin-catalog/images/`.
- The script does not target DEV or PROD by default.
