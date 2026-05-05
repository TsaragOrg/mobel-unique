# PLAN-0063 Admin Sofa Archive

Plan: PLAN-0063
Spec: SPEC-0013
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `supabase`

## Goal

Add the missing admin sofa archive workflow so administrators can archive sofas instead of deleting them, hide archived sofas from the default sofa list, and reveal them on demand.

## Tasks

- [x] Add tests for the archive API boundary, admin response shaping, migration SQL, sofa edit archive action, and sofa list archive toggle.
- [x] Add a Supabase archive RPC that atomically removes public sofa references and sets the sofa to archived.
- [x] Add the first-party admin API route and store method for `POST /api/admin/sofas/{sofa_id}/archive`.
- [x] Add the sofa edit Publish-step archive action with confirmation.
- [x] Add the `/admin/sofas` archive toggle that hides archived sofas by default.
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

## Notes

`SPEC-0009`, `SPEC-0010`, and `SPEC-0013` already define sofa archive behavior, the archive API, and the admin page flow. This plan implements that accepted scope without adding restore or permanent delete behavior.
