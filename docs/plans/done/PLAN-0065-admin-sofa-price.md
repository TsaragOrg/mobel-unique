# PLAN-0065 Admin Sofa Price

Plan: PLAN-0065
Spec: SPEC-0014
Status: done
Owner area: web
Change request: CR-SPEC-0009-SPEC-0010-SPEC-0013-SPEC-0014-admin-sofa-price
Depends on: SPEC-0009, SPEC-0010, SPEC-0013, SPEC-0014, PLAN-0052
Affected packages:

- `apps/web`
- `supabase/migrations`
- `docs/roadmap`

## Goal

Add optional whole-euro sofa pricing to the admin sofa workflow and public sofa
detail experience while storing the value internally as integer cents.

## Scope

- Add nullable `price_cents` and fixed `price_currency` fields to sofas.
- Accept only whole euro input in the admin Sofa basics form.
- Show price or `Price not entered` on the admin sofas list.
- Include nullable price in public catalog and public sofa detail API responses.
- Show formatted whole-euro price on the public sofa detail page only.
- Keep publish allowed when the price is empty.

## Tasks

- [x] Add failing tests for admin price input, validation, response shaping,
      public API price output, public detail display, and migration SQL.
- [x] Add the Supabase migration for sofa price columns, checks, and public
      catalog sofa view output.
- [x] Extend admin catalog validation, store select lists, and response shaping
      for `price_cents` and `price_currency`.
- [x] Extend public catalog records and response shaping with nullable price.
- [x] Add the Sofa basics price field and admin sofa list price display.
- [x] Add the public sofa detail price display.
- [x] Update roadmaps and run the targeted verification commands.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx src/lib/admin-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx src/app/sofas/[slug]/simulate/PublicSimulationWizardEntry.test.tsx`
- `pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog-store-sofa-price.test.ts`
- `pnpm exec vitest run scripts/admin-sofa-price-migration.test.mjs`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Notes

The admin enters whole euros such as `1299`. The API payload stores and returns
`price_cents: 129900`. Public responses expose `price.amount_cents` and
`price.currency`, and the frontend formats this with a trailing euro symbol.
Published sofas allow price-only saves without unpublishing.
