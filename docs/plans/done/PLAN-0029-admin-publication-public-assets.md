# PLAN-0029 Admin Publication Public Assets

Plan: PLAN-0029
Spec: SPEC-0010
Status: done
Owner area: web
Depends on: PLAN-0021, PLAN-0024, PLAN-0026, SPEC-0006, SPEC-0009, SPEC-0010, SPEC-0013
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Deliver the first admin publication workflow: an authenticated administrator can
publish a complete sofa by copying selected private render coverage into public
catalog assets, and can unpublish the sofa without deleting private working
renders.

## Architecture

The existing worker and admin render preparation flow already produce private
current renders. This plan keeps that boundary: workers and manual uploads
remain private, while the publish API creates public copies and updates the
public read model references.

The Next.js admin facade owns storage byte copying from `catalog-private-assets`
to `catalog-public-assets` with service-role credentials. A Supabase RPC owns
the database mutation so sofa lifecycle and `sofa_render_cells.current_public_asset_id`
are updated together after the public objects are uploaded.

## Scope

This plan includes:

- an admin-only `POST /api/admin/sofas/{sofa_id}/publish` endpoint;
- an admin-only `POST /api/admin/sofas/{sofa_id}/unpublish` endpoint;
- public render asset metadata creation for selected current private render
  cells;
- public object upload paths under `catalog-public-assets`;
- readiness behavior that allows a draft sofa with complete private coverage to
  publish for the first time;
- public read model refresh through existing public views;
- admin sofa edit UI actions for publish and unpublish;
- deterministic unit and source tests.

This plan does not include:

- ZIP exports;
- public storefront page design changes;
- in-home simulation worker implementation;
- public asset garbage collection beyond clearing current public references on
  unpublish;
- changing the fabric render worker.

## Expected File Structure

- Create: `supabase/migrations/20260430000100_admin_sofa_publication.sql`
  - Adds the publish/unpublish RPCs and updates publication readiness so draft
    sofas can be ready based on private current renders.
- Modify: `scripts/fabric-render-worker-migration.test.mjs` or create a focused
  source test if the existing migration test stays worker-specific.
  - Verifies the migration contains public-copy publication behavior, unpublish
    behavior, and readiness changes.
- Modify: `apps/web/src/lib/admin-catalog.ts`
  - Adds store methods for publish and unpublish.
  - Downloads current private render bytes and uploads public copies.
  - Calls the publication RPC with public asset metadata.
- Modify: `apps/web/src/lib/admin-catalog.test.ts`
  - Tests readiness behavior, publish public copy behavior, and unpublish
    behavior through the catalog store.
- Modify: `apps/web/src/lib/admin-catalog-route-handlers.ts`
  - Adds route handlers for publish and unpublish.
- Modify: `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Tests admin authorization, safe responses, and error envelopes.
- Create:
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/publish/route.ts`
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/unpublish/route.ts`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Adds publish/unpublish actions to the sofa edit publication section.
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Tests the UI calls the first-party admin endpoints and refreshes readiness.

## Tasks

- [x] Add failing migration/source tests for publication RPC behavior.
- [x] Add failing catalog-store tests for publish and unpublish.
- [x] Add failing route-handler tests for publish and unpublish.
- [x] Add failing admin UI tests for publish and unpublish actions.
- [x] Implement the Supabase publication migration.
- [x] Implement catalog-store public copy and lifecycle methods.
- [x] Implement route handlers and Next.js route files.
- [x] Implement admin UI publication actions.
- [x] Update active/done plan indexes and roadmaps.
- [x] Run focused tests, typecheck, and spec guard.

## Tests

Required focused checks:

```powershell
pnpm.cmd vitest run scripts/fabric-render-worker-migration.test.mjs
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts src/app/admin/AdminCatalogPages.test.tsx
pnpm.cmd --filter @mobel-unique/web typecheck
pnpm.cmd spec:check
```

Expected behavior:

- publish rejects missing sofas and incomplete private render coverage;
- publish copies every current private render required for public fabrics and
  active visual positions into `catalog-public-assets`;
- publish updates `current_public_asset_id` without changing private
  `current_private_asset_id`;
- publish sets sofa lifecycle to `published` and keeps public slug generation
  under the existing database trigger;
- unpublish returns the sofa to `draft` and clears current public render
  references while keeping private render coverage;
- browser-visible responses do not include service-role keys, private object
  paths, raw SQL, or worker internals.

## Roadmap

Update these files when implementation starts and completes:

- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Notes

The publish action is the bridge between worker output and public storefront
data. It must not make raw private candidates public. It creates public copies
from the administrator-selected current private render coverage.
