# PLAN-0034 Fix SPEC-0007 Migration Timestamp Collision

Plan: PLAN-0034
Spec: SPEC-0007
Status: done
Owner area: supabase
Affected packages:

- `supabase/migrations`
- `scripts`
- `package.json`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Unblock the Supabase DEV deploy workflow after the SPEC-0007 in-home
simulation worker branch landed on `dev` with two migration files whose
timestamp prefixes collided with already-merged SPEC-0011 admin and admin
fabric-render-job-enqueue migrations:

| Old | New |
| --- | --- |
| `20260428000100_in_home_simulation_stage_1_claim.sql` | `20260428000150_in_home_simulation_stage_1_claim.sql` |
| `20260428000200_in_home_simulation_local_test_seed.sql` | `20260428000250_in_home_simulation_local_test_seed.sql` |

Postgres `supabase_migrations.schema_migrations.version` is unique per
timestamp prefix, so the deploy aborted with
`duplicate key value violates unique constraint "schema_migrations_pkey"
(SQLSTATE 23505)`.

## Tasks

- [x] Renumber the two SPEC-0007 migrations to no-longer-colliding
  timestamps without touching their bodies. Both migrations are
  idempotent (`CREATE OR REPLACE FUNCTION`, `ON CONFLICT (...) DO
  NOTHING`), so re-application under the new timestamps is safe.
- [x] Add a regression test that scans `supabase/migrations/` and fails
  if two files ever share a timestamp prefix.
- [x] Wire the new test into the root `pnpm test` gate.
- [x] Update the supabase and workflow roadmaps.

## Tests

```bash
pnpm vitest run scripts/supabase-migrations-unique.test.mjs
pnpm spec:check
```

## Roadmap

- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Notes

This plan only restores deployability; it does not change any SPEC-0007
behavior. The renumbered migrations remain ordered before the rest of
the SPEC-0007 chain (`000300`, `000400`, `000500`, `000600`, `001600`).
