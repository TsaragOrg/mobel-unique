# PLAN-0009 Supabase Data Model And Storage

Plan: PLAN-0009
Spec: SPEC-0009
Status: done
Owner area: supabase
Affected packages:

- `supabase/migrations`
- `supabase/functions`
- `supabase/seed.sql`
- `scripts`
- `package.json`
- `docs/roadmap/supabase.md`

## Goal

Implement the Supabase database and storage foundation defined by `SPEC-0009`.

This plan delivers production-shaped migrations, RLS policies, storage buckets,
storage policies, public read helpers, publication-readiness guards, cleanup
helpers, and local smoke checks. It does not implement public API routes, admin
UI workflows, provider calls, or full worker execution behavior.

## Tasks

- [x] Add a local Supabase schema smoke test command before implementation.
- [x] Create the `SPEC-0009` production migration with required extensions,
      enum types or constrained text fields, shared timestamp triggers, and
      helper functions.
- [x] Create catalog tables for sofas, tags, fabrics, assignments, visual
      matrix columns, and source photos.
- [x] Create storage asset metadata, render coverage, fabric render job,
      candidate, ZIP export, verification, consent, simulation session,
      simulation job, simulation output, and worker event tables.
- [x] Add required constraints, foreign keys, indexes, uniqueness rules, and
      slug-freeze protection.
- [x] Add publication-readiness database helpers that server-side API logic can
      call before publishing a sofa.
- [x] Add public catalog read views or read functions that expose only published
      visitor-safe data.
- [x] Create `catalog-public-assets`, `catalog-private-assets`, and
      `simulation-private-artifacts` buckets with storage policies matching
      `SPEC-0009`.
- [x] Enable RLS on all application tables and add minimum policies for
      anonymous visitors, authenticated users, and service-side operations.
- [x] Preserve or migrate the `SPEC-0008` local worker foundation without
      breaking local worker smoke tests.
- [x] Add cleanup helper queries or functions for simulation retention, orphan
      uploads, purged simulation outputs, expired ZIP artifacts, and public
      asset deactivation.
- [x] Update local environment examples or scripts if new schema smoke checks
      need explicit Supabase local URLs or keys.
- [x] Update the Supabase roadmap after implementation.
- [x] Run the narrow schema smoke tests, then broader repository checks.

## Tests

Add or update tests before implementation:

- a local schema smoke test that fails when required `SPEC-0009` tables,
  buckets, RLS enablement, storage policies, or critical indexes are missing;
- a publication-readiness smoke check that rejects incomplete public sofas;
- a slug-freeze check that rejects `public_slug` changes after
  `first_published_at` is set;
- public read filtering checks proving draft and archived sofas are not exposed;
- public/private storage boundary checks proving anonymous users can read only
  public catalog objects and cannot write any bucket directly;
- render cell uniqueness and cross-sofa validation checks;
- fabric render and in-home simulation job claim index checks;
- simulation retention deadline cap checks;
- orphan upload cleanup selection checks;
- anonymous RLS denial checks for private catalog, worker, consent,
  verification, and simulation tables.

The schema smoke command may skip with a clear message when local Supabase is
not running, but it must fail clearly when local Supabase is running with an
incomplete or unsafe `SPEC-0009` schema.

## Roadmap

Update these roadmap files when implementation changes are made:

- `docs/roadmap/supabase.md`;
- `docs/roadmap/workflow.md` if new shared local quality-gate commands are
  added;
- `docs/roadmap/api.md` if Edge Function contracts or server-side API helpers
  are introduced;
- `docs/roadmap/image-worker.md` if the local worker smoke foundation changes
  beyond compatibility.

## Implementation Notes

Use `timestamptz` for timestamp fields unless a later spec requires a different
time representation.

The first implementation should keep browser-facing table access conservative:
anonymous users may read only explicit public read views or functions, and may
not insert, update, or delete application rows. Until an admin auth spec defines
administrator claims, admin mutations should be performed through service-side
Edge Function logic rather than broad direct table policies.

Queue tables remain owned by Supabase Queues. This plan creates durable domain
job tables and claim indexes, but queue names stay environment-specific and must
not mix local, DEV, and PROD resources.

Public catalog assets must use public copies in `catalog-public-assets`.
Private admin assets, render candidates, ZIP artifacts, and in-home simulation
artifacts must not be exposed through public bucket URLs.

Migrations should be production-safe forward migrations. If a rollback is not
safe after deployment, the implementation must include forward-fix notes in the
migration or linked implementation notes.

The schema smoke script uses the default local Supabase database URL when no
environment override is provided, so no new required environment variables are
needed for local verification.
