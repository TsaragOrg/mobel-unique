# PLAN-0083 Fabric Swatch Small Delivery

Plan: PLAN-0083
Spec: SPEC-0012
Status: done
Owner area: web
Change request: CR-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0016-fabric-swatch-small-delivery
Depends on: SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0016, PLAN-0048, PLAN-0049, PLAN-0067, PLAN-0082
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Make public fabric selector buttons load a dedicated 96 px swatch image instead
of the canonical public swatch asset that measured about 741.8 KB in the
production audit.

## Architecture

Reuse the first-party stored variant model from `PLAN-0067`, but add a
swatch-specific delivery kind named `swatch_small`. The canonical
`fabric_swatch_public` asset remains the source of truth, while public catalog
and sofa detail selectors receive a new `swatch_small_url` field and use that
field for their button images.

The 96 px variant is generated server-side after new fabric swatch uploads and
by the existing backfill script for already published swatches. No browser code
constructs storage paths or transform URLs.

## Scope

This plan includes:

- adding `swatch_small` as a supported stored variant kind;
- generating 96 px variants for new `fabric_swatch_public` uploads;
- backfilling existing active public fabric swatches;
- exposing `swatch_small_*` fields through public fabric API data;
- switching `/catalog` fabric buttons to `swatch_small_url`;
- switching `/sofas/{slug}` fabric buttons to `swatch_small_url`;
- keeping the required Russian and French `.tsx` comments current in changed
  `.tsx` files;
- updating focused tests, smoke tests, and roadmaps.

This plan does not include:

- changing the admin swatch cropper UI or crop math;
- changing the canonical swatch upload size of 512 px;
- changing render image `small` and `medium` presets;
- using Supabase Storage Image Transformations;
- changing sofa render image delivery;
- changing public layout, copy, or selector behavior beyond the image URL.

## Expected File Structure

- Create: `scripts/fabric-swatch-small-delivery-migration.test.mjs`
  - Verifies the migration allows `swatch_small` variant links.
  - Verifies `public_sofa_fabrics` exposes `public_swatch_small_*` columns.
  - Verifies public swatch small reads require active original and active
    variant assets in `catalog-public-assets`.
- Create: `supabase/migrations/20260512000200_fabric_swatch_small_delivery.sql`
  - Extends the `storage_asset_variants_kind_check` constraint to allow
    `swatch_small`.
  - Replaces `public_sofa_fabrics` with original swatch columns and
    `public_swatch_small_asset_id`, `public_swatch_small_object_path`,
    `public_swatch_small_content_type`, `public_swatch_small_width_px`, and
    `public_swatch_small_height_px`.
  - Joins the `swatch_small` variant only when both original and variant assets
    are active public assets in `catalog-public-assets`.
- Modify: `apps/web/src/lib/catalog-image-variants.ts`
  - Add `swatch_small` to the shared variant type.
  - Keep render presets unchanged: `small` is 320 px and `medium` is 1280 px.
  - Add a 96 px `swatch_small` preset.
  - Let callers request a concrete list of variant kinds so render code still
    requests only `small` and `medium`.
  - Add a small wrapper for fabric swatches that requests only `swatch_small`.
- Modify: `apps/web/src/lib/catalog-image-variants.test.ts`
  - Assert render `small` still calculates a 320 px longest edge.
  - Assert `swatch_small` calculates a 96 px longest edge.
  - Assert fabric swatch variant generation creates only `swatch_small`.
  - Assert render variant generation does not create `swatch_small`.
- Modify: `apps/web/src/lib/admin-catalog.ts`
  - During `completeUpload` for `fabric_swatch`, create or reuse the
    `swatch_small` variant before returning the completed asset.
  - Keep existing source photo and manual render variant behavior unchanged.
- Modify: `apps/web/src/lib/admin-catalog.test.ts`
  - Assert fabric swatch upload completion calls the swatch-small variant path.
  - Assert fabric swatch upload completion fails safely when the variant cannot
    be created.
  - Assert render upload completion still creates only `small` and `medium`.
- Modify: `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Cover the full create-upload and complete-upload route path for a fabric
    swatch that receives a `swatch_small` variant.
- Modify: `apps/web/src/lib/public-catalog.ts`
  - Add `swatch_small_url`, `swatch_small_width_px`,
    `swatch_small_height_px`, and `swatch_small_content_type` to public fabric
    responses.
  - Build `swatch_small_url` from the database-provided
    `public_swatch_small_object_path`.
  - Keep `swatch_url` as the compatibility URL for the canonical swatch asset.
- Modify: `apps/web/src/lib/public-catalog.test.ts`
  - Assert public fabric shaping includes both `swatch_url` and
    `swatch_small_url`.
  - Assert `swatch_small_url` is built from the small variant object path.
  - Assert private paths are not exposed.
- Modify: `apps/web/src/lib/public-catalog-route-handlers.test.ts`
  - Assert `/api/public/catalog` includes `swatch_small_url` for fetched sofa
    detail fabric data.
  - Assert `/api/public/sofas/{slug}` includes `swatch_small_url` for each
    fabric.
- Modify: `apps/web/src/app/catalog/PublicCatalogPage.tsx`
  - Update the required top and nearby comments if behavior text changes.
  - Use `fabric.swatch_small_url` for catalog swatch button images.
- Modify: `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`
  - Assert catalog fabric button images use `swatch_small_url`.
  - Assert fabric preview swaps still update the sofa render image normally.
- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`
  - Update the required top and nearby comments if behavior text changes.
  - Use `fabric.swatch_small_url` for sofa detail fabric button images.
- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
  - Assert detail fabric button images use `swatch_small_url`.
  - Assert selecting a fabric still updates the selected render.
- Modify: `scripts/backfill-catalog-image-variants.mjs`
  - Include active `fabric_swatch_public` assets in the scan.
  - Generate only `swatch_small` for fabric swatches.
  - Preserve existing `small` and `medium` behavior for render-related assets.
  - Keep local, DEV, and PROD environment separation and `--confirm-prod`.
- Modify: `scripts/backfill-catalog-image-variants.test.mjs`
  - Assert fabric swatches plan and create one `swatch_small` variant.
  - Assert render assets still plan and create `small` and `medium`.
  - Assert dry-run output counts swatch variants without writing storage.
- Modify: `scripts/seed-local-admin-fixtures.mjs`
  - Create `swatch_small` variants for seeded public fabric swatches.
- Modify: `scripts/seed-local-admin-fixtures.test.mjs`
  - Assert fixture seeding writes swatch small variant links.
- Modify: `scripts/dev-catalog-snapshot.test.mjs`
  - Assert DEV catalog snapshots include swatch small variant rows.
- Modify: `scripts/spec-0012-public-catalog-smoke.mjs`
  - Verify public catalog/detail fabric data includes `swatch_small_url`.
- Modify: `scripts/spec-0012-public-catalog-smoke.test.mjs`
  - Cover the smoke assertion without requiring network access.
- Modify: `docs/roadmap/web.md`
  - Add the completed public UI behavior after implementation.
- Modify: `docs/roadmap/supabase.md`
  - Add the completed storage/view/backfill behavior after implementation.
- Modify: `docs/roadmap/workflow.md`
  - Add the completed CR and plan tracking after implementation.

## Public API Shape

Each public sofa detail fabric entry should include:

```ts
{
  id: string;
  is_premium: boolean;
  public_name: string;
  public_order: number;
  swatch_url: string;
  swatch_small_url: string;
  swatch_small_width_px: number | null;
  swatch_small_height_px: number | null;
  swatch_small_content_type: string;
}
```

`swatch_url` remains a compatibility field for the canonical public swatch.
Public selector buttons must use `swatch_small_url`.

## Implementation Sequence

1. Create the workflow branch:

   ```powershell
   pnpm branch:create -- --type feature --area web --work "Fabric swatch small delivery" --spec SPEC-0012 --plan PLAN-0083
   ```

2. Add `scripts/fabric-swatch-small-delivery-migration.test.mjs` with source
   checks for the new migration.

3. Run the new migration source test and confirm it fails before the migration:

   ```powershell
   pnpm vitest run scripts/fabric-swatch-small-delivery-migration.test.mjs
   ```

   Expected before implementation: FAIL because the migration file and
   `swatch_small` public view fields do not exist.

4. Add `supabase/migrations/20260512000200_fabric_swatch_small_delivery.sql`
   with the constraint update and `public_sofa_fabrics` view replacement.

5. Run the migration checks:

   ```powershell
   pnpm vitest run scripts/fabric-swatch-small-delivery-migration.test.mjs scripts/spec-0009-schema-smoke.test.mjs
   ```

   Expected after the migration: PASS.

6. Update `apps/web/src/lib/catalog-image-variants.test.ts` first with tests
   for the 96 px `swatch_small` preset and caller-selected variant kinds.

7. Run the focused variant helper test and confirm it fails before the helper
   change:

   ```powershell
   pnpm --filter @mobel-unique/web test -- src/lib/catalog-image-variants.test.ts
   ```

   Expected before implementation: FAIL because `swatch_small` is unsupported.

8. Update `apps/web/src/lib/catalog-image-variants.ts` so render callers keep
   `small` and `medium`, while fabric swatch callers request `swatch_small`.

9. Run the focused helper test again:

   ```powershell
   pnpm --filter @mobel-unique/web test -- src/lib/catalog-image-variants.test.ts
   ```

   Expected after implementation: PASS.

10. Add failing admin upload tests in `apps/web/src/lib/admin-catalog.test.ts`
    and `apps/web/src/lib/admin-catalog-route-handlers.test.ts` for fabric
    swatch upload completion creating `swatch_small`.

11. Update `apps/web/src/lib/admin-catalog.ts` to create the `swatch_small`
    variant during `fabric_swatch` upload completion.

12. Run the focused admin tests:

    ```powershell
    pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts
    ```

    Expected after implementation: PASS.

13. Add failing public API tests in `apps/web/src/lib/public-catalog.test.ts`
    and `apps/web/src/lib/public-catalog-route-handlers.test.ts` for
    `swatch_small_url`.

14. Update `apps/web/src/lib/public-catalog.ts` to shape `swatch_small_*`
    fields from the public fabric records.

15. Run the focused public API tests:

    ```powershell
    pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts
    ```

    Expected after implementation: PASS.

16. Add failing public page tests in
    `apps/web/src/app/catalog/PublicCatalogPage.test.tsx` and
    `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`.

17. Update `apps/web/src/app/catalog/PublicCatalogPage.tsx` and
    `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx` to use
    `fabric.swatch_small_url` for selector images. Keep the required Russian
    and French comments current and avoid the forbidden words from `AGENTS.md`.

18. Run the focused public page tests:

    ```powershell
    pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
    ```

    Expected after implementation: PASS.

19. Add failing backfill and fixture tests in
    `scripts/backfill-catalog-image-variants.test.mjs`,
    `scripts/seed-local-admin-fixtures.test.mjs`,
    `scripts/dev-catalog-snapshot.test.mjs`, and
    `scripts/spec-0012-public-catalog-smoke.test.mjs`.

20. Update the backfill, fixture seed, snapshot, and public catalog smoke
    scripts.

21. Run the focused script tests:

    ```powershell
    pnpm vitest run scripts/backfill-catalog-image-variants.test.mjs scripts/seed-local-admin-fixtures.test.mjs scripts/dev-catalog-snapshot.test.mjs scripts/spec-0012-public-catalog-smoke.test.mjs
    ```

    Expected after implementation: PASS.

22. Run package-level verification:

    ```powershell
    pnpm --filter @mobel-unique/web typecheck
    pnpm --filter @mobel-unique/web test
    ```

    Expected: PASS.

23. Run repository guardrails:

    ```powershell
    pnpm spec:check
    pnpm typecheck
    pnpm test
    ```

    Expected: PASS.

24. Run local backfill verification after local schema reset and seed are
    available:

    ```powershell
    pnpm catalog:variants:backfill:local -- --dry-run
    pnpm catalog:variants:backfill:local
    ```

    Expected: dry-run reports missing `swatch_small` variants before the write;
    the write creates them; a second dry-run reports no missing fabric swatch
    small variants.

25. Update roadmaps after implementation and verification:

    - `docs/roadmap/web.md`
    - `docs/roadmap/supabase.md`
    - `docs/roadmap/workflow.md`

26. Move this plan to `docs/plans/done` only after implementation, backfill
    notes, roadmap updates, and verification are complete. Add a closure note
    listing the commands that actually passed.

## Tests

Required focused checks:

```powershell
pnpm vitest run scripts/fabric-swatch-small-delivery-migration.test.mjs scripts/spec-0009-schema-smoke.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/catalog-image-variants.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
pnpm vitest run scripts/backfill-catalog-image-variants.test.mjs scripts/seed-local-admin-fixtures.test.mjs scripts/dev-catalog-snapshot.test.mjs scripts/spec-0012-public-catalog-smoke.test.mjs
```

Required broader checks:

```powershell
pnpm --filter @mobel-unique/web typecheck
pnpm --filter @mobel-unique/web test
pnpm spec:check
pnpm typecheck
pnpm test
```

Manual browser verification after backfill:

1. Open `/catalog` with a published sofa that has multiple fabrics.
2. In DevTools Network, filter image requests and select fabric buttons.
3. Confirm selector image requests use small variant paths and no 741 KB
   canonical swatch is loaded for the buttons.
4. Open `/sofas/{slug}` and repeat the fabric selector check.

## Roadmap

Update these files after implementation:

- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

The web roadmap entry should say that public catalog and sofa detail fabric
selectors now load 96 px swatch variants through `swatch_small_url`.

The supabase roadmap entry should say that public fabric swatches now have
stored `swatch_small` variants, public view metadata, upload completion
generation, and backfill coverage.

The workflow roadmap entry should say that the performance-audit swatch
delivery fix is tracked by the accepted CR and `PLAN-0083`.

## Closure Note

Completed on 2026-05-12.

Implementation completed the stored `swatch_small` pipeline from upload
completion through public API shaping, public selector usage, backfill, local
fixture seeding, DEV snapshot export coverage, and public smoke validation.

Backfill note:

- The backfill script now scans active `fabric_swatch_public` assets and creates
  only `swatch_small` for those assets while preserving `small` and `medium` for
  render-related assets.
- Live local, DEV, and PROD backfill writes remain rollout operations and should
  follow the rollout order below after the target environment is reset, seeded,
  deployed, and intentionally selected.

Verification passed:

```powershell
pnpm vitest run scripts/fabric-swatch-small-delivery-migration.test.mjs scripts/spec-0009-schema-smoke.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/catalog-image-variants.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
pnpm vitest run scripts/backfill-catalog-image-variants.test.mjs scripts/seed-local-admin-fixtures.test.mjs scripts/dev-catalog-snapshot.test.mjs scripts/spec-0012-public-catalog-smoke.test.mjs
pnpm --filter @mobel-unique/web typecheck
pnpm --filter @mobel-unique/web test
pnpm spec:check
pnpm typecheck
pnpm test
```

## Rollout Notes

Rollout order matters:

1. Deploy the schema and server code that can create and read `swatch_small`.
2. Run the backfill in DEV and verify counts.
3. Run the PROD dry-run.
4. Run the PROD write with the existing `--confirm-prod` guard.
5. Deploy or enable the UI switch that uses `swatch_small_url`.
6. Re-run the production public audit image request check for `/catalog` and
   `/sofas/{slug}`.

If the UI switch reaches production before the PROD backfill, public selector
buttons can lose swatch images or keep failing tests. Do not rely on canonical
swatch fallback for these buttons because that would preserve the performance
problem this plan is meant to remove.

## Notes

- `PLAN-0067` already created the durable variant relationship table. This plan
  extends that model for swatch-specific delivery size.
- `PLAN-0082` already corrected sofa render delivery on the detail page. This
  plan is separate because it targets fabric selector swatches.
- No new dependency is expected because `imagescript` is already used by the
  catalog image variant pipeline.
- If dependencies are not installed during implementation, record that clearly
  in the implementation note instead of claiming checks passed.
