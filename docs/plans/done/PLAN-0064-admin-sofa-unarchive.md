# PLAN-0064 Admin Sofa Unarchive

Plan: PLAN-0064
Spec: SPEC-0013
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `supabase`

## Goal

Add the missing admin sofa restore workflow so administrators can move an archived sofa back to draft from the Publish step.

## Tasks

- [x] Add tests for the unarchive API boundary, migration SQL, sofa edit restore action, and default API dependency route.
- [x] Add a Supabase unarchive RPC that moves an archived sofa back to draft.
- [x] Add the first-party admin API route and store method for `POST /api/admin/sofas/{sofa_id}/unarchive`.
- [x] Add the sofa edit Publish-step restore action when the sofa is archived.
- [x] Update relevant roadmaps.
- [x] Run the narrow checks, typecheck, and spec guard.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`
- `pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog-route-handlers.test.ts src/lib/admin-catalog.test.ts`
- `pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Roadmap

- Update `docs/roadmap/web.md`.
- Update `docs/roadmap/supabase.md`.
- Update `docs/roadmap/workflow.md`.

## Notes

Restoring from archive returns the sofa to `draft`. It does not publish the sofa again and does not recreate public render asset references.
