# CR-SPEC-0009 SPEC-0010 SPEC-0012 SPEC-0016 Fabric Swatch Small Delivery

Target spec ids: SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0016
Related spec ids: SPEC-0005, SPEC-0013
Status: accepted
Implementation Plans: PLAN-0083

## Reason For Change

The 2026-05-12 production performance audit found that public fabric swatches
are too large for their visible use. The `/catalog` page loaded a 741.8 KB
fabric swatch for a small circular selector, and `/sofas/eva-ll` loaded a
741.9 KB fabric swatch in the detail fabric selector.

The existing public UI shows swatches at small button sizes. In the catalog the
visible circle is about 34 px, so the browser should not load the canonical
swatch asset for that surface. The current API returns only `swatch_url`, which
points at the public swatch object. The frontend then uses that full swatch URL
in:

- `apps/web/src/app/catalog/PublicCatalogPage.tsx`
- `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`

The existing catalog render image variant work intentionally left fabric
swatches on their existing behavior. This change adds the missing swatch-sized
delivery path without changing the admin cropper workflow.

## Proposed Change

Update `SPEC-0009` data and storage behavior so public fabric swatches support
a durable small delivery variant:

- add a stored `swatch_small` delivery variant for `fabric_swatch_public`
  assets;
- use a maximum longest edge of 96 px for `swatch_small`;
- keep the existing canonical public swatch asset as the source image;
- keep the variant in `catalog-public-assets`;
- link the variant to the canonical swatch through `storage_asset_variants`;
- keep variant generation idempotent and safe to retry;
- do not use Supabase Storage Image Transformations or browser-built transform
  URLs;
- backfill existing public fabric swatches before the public UI depends on the
  new field.

Update `SPEC-0010` API behavior so public fabric responses expose explicit
small swatch fields:

```ts
swatch_url: string;
swatch_small_url: string;
swatch_small_width_px: number | null;
swatch_small_height_px: number | null;
swatch_small_content_type: string;
```

`swatch_url` remains for compatibility. Public page code must use
`swatch_small_url` for small fabric selector buttons.

Update `SPEC-0012` public frontend behavior:

- `/catalog` fabric buttons must load `swatch_small_url`;
- `/sofas/{slug}` fabric buttons must load `swatch_small_url`;
- public page code must not fall back to `swatch_url` for these buttons when
  `swatch_small_url` is present;
- image unavailable behavior must stay safe and must not expose private paths
  or service credentials.

Update `SPEC-0016` admin fabric swatch cropper behavior:

- the existing cropper still creates the canonical square swatch asset;
- the server-side upload completion flow creates or records the 96 px
  `swatch_small` delivery variant after the canonical swatch is available;
- the cropper UI, zoom behavior, and saved crop behavior do not change.

## Impact

- Plans: add `PLAN-0083` for the migration, backfill, API response, and public
  UI switch.
- Data model: extend `storage_asset_variants.variant_kind` to accept
  `swatch_small` and expose small swatch metadata through public read paths.
- Supabase Storage: add generated public variant objects for existing and new
  public fabric swatches.
- API: public catalog and public sofa detail responses add `swatch_small_*`
  fields for each fabric.
- Web UI: catalog and sofa detail fabric selector images use
  `swatch_small_url`.
- Admin upload flow: fabric swatch upload completion creates the small variant.
- Scripts: backfill and local fixture/snapshot tooling include public fabric
  swatch small variants.
- Tests: migration/source tests, variant helper tests, public API tests, public
  page tests, backfill tests, and smoke tests cover the new behavior.
- Roadmaps: update web, supabase, and workflow roadmaps after implementation.

## Acceptance Criteria

- Existing published public fabric swatches can be backfilled with a
  `swatch_small` variant whose longest edge is at most 96 px.
- New admin fabric swatch uploads create the canonical swatch and the
  `swatch_small` variant before the swatch is used by public pages.
- Public catalog fabric buttons load `swatch_small_url`, not the canonical
  `swatch_url`.
- Public sofa detail fabric buttons load `swatch_small_url`, not the canonical
  `swatch_url`.
- Existing render image variant behavior for `small` and `medium` remains
  unchanged.
- Public API responses never expose private bucket paths, service-role keys,
  signed private URLs, raw SQL, or stack traces.
- The implementation uses stored first-party variants only and does not use
  Supabase Storage Image Transformations.
- Focused tests fail before the UI switch and pass after the implementation.

## Approval Note

Accepted from the 2026-05-12 production performance audit priority list. This
is a narrow delivery-size change for public fabric swatch buttons, not a new
product feature or a change to the admin cropper interaction.
