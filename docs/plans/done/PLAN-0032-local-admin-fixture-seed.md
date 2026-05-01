# PLAN-0032 Local Admin Fixture Seed

Plan: PLAN-0032
Spec: SPEC-0008
Change request: CR-SPEC-0008-local-admin-fixture-seed
Status: done
Owner area: workflow
Affected packages:

- `scripts`
- `fixtures/local-admin-catalog`
- `docs`

## Goal

Make repeated local admin testing practical by seeding reusable catalog fixtures
after a local Supabase reset.

## Scope

- Add a local-only fixture seed script.
- Load fixture images into local Supabase Storage.
- Create storage asset records, fabrics, sofas, tags, assignments, visual
  positions, source photos, and render cells.
- Run the seed automatically after `pnpm supabase:reset`.
- Keep a database-only reset command available.
- Document the real image fixture contract.

## Verification

```bash
pnpm vitest run scripts/seed-local-admin-fixtures.test.mjs
```

The full local smoke path can be verified with:

```bash
pnpm supabase:reset
pnpm supabase:functions:serve
pnpm dev:web
```

Then log in as the local admin and open the seeded sofas.
