# PLAN-0094 Public Catalog Image Cache Boundary

Plan: PLAN-0094
Spec: SPEC-0012
Status: active
Owner area: web
Related plans: PLAN-0085, PLAN-0090
Affected packages:

- `apps/web`
- `scripts/backfill-catalog-image-variants.mjs`
- `scripts/backfill-catalog-image-variants.test.mjs`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Move public catalog caching to the right boundary: public catalog JSON must not
stay stale after admin publish/unpublish changes, while public image objects
remain cache-friendly through immutable, UUID-based Storage paths.

This plan fixes the production failure mode where `/api/public/catalog` can
serve an old fabric/render URL after a sofa is unpublished and republished,
while `/api/public/sofas/{slug}` already shows the fresh database state.

## Current Behavior

- `GET /api/public/catalog` and `GET /api/public/catalog/tags` return:

  ```http
  Cache-Control: public, s-maxage=3600, stale-while-revalidate=300
  ```

- `GET /api/public/sofas/{slug}` returns `no-store`.
- Public Storage URLs include UUID path components for publication copies and
  generated variants, but public render copy uploads and variant uploads do not
  consistently set explicit long-lived Storage cache metadata.
- Admin signed uploads currently send `cacheControl=3600` for all upload
  purposes, including public fabric swatches.

## Target Behavior

- Public catalog data endpoints return fresh data:

  ```http
  Cache-Control: no-store
  ```

- Public image objects use long-lived cache metadata:

  ```http
  Cache-Control: public, max-age=31536000, immutable
  ```

  Supabase Storage upload APIs expose this as a `cacheControl` value, so the
  implementation should use `31536000` where the SDK expects seconds. Where raw
  REST upload is used, verify the required header shape before implementation.

- Private catalog images may keep short cache metadata or the current default;
  this plan is only about public catalog images.

## Scope

- Reverse the long shared-cache policy introduced by PLAN-0085 for successful
  public catalog list/tag JSON responses.
- Keep public sofa detail and all error responses on `no-store`.
- Add explicit long-lived cache metadata for public catalog image uploads:
  - published render copies created during publication;
  - public generated image variants;
  - public fabric swatch signed uploads;
  - public backfilled variants created by the backfill script.
- Do not change public catalog response shape, SQL read models, or UI layout.
- Do not use Supabase Storage Image Transformations.

## Tasks

- [ ] Update route-handler tests first:
  - `GET /api/public/catalog` success returns `Cache-Control: no-store`;
  - `GET /api/public/catalog/tags` success returns `Cache-Control: no-store`;
  - public sofa detail remains `no-store`;
  - validation and unavailable/error responses remain `no-store`.
- [ ] Update public image upload tests first:
  - publication copies to `catalog-public-assets` include long-lived cache
    metadata;
  - generated public variants include long-lived cache metadata;
  - public fabric swatch signed uploads send `cacheControl=31536000`;
  - private signed uploads do not accidentally inherit the public immutable
    policy.
- [ ] Update backfill tests first:
  - public variant uploads include the same image cache metadata;
  - private/local render backfills are not forced into an unsafe public cache
    policy unless the object is in `catalog-public-assets`.
- [ ] Implement the smallest code changes:
  - remove or stop using `PUBLIC_CATALOG_CACHE_CONTROL` for list/tag JSON;
  - introduce named constants for public image cache metadata;
  - pass cache metadata through Supabase SDK uploads;
  - pass cache metadata through the backfill script's raw Storage upload path
    after confirming the Supabase Storage header format.
- [ ] Update relevant roadmap files when the implementation is complete.
- [ ] Run the focused tests, then the broader web checks.

## Tests

Required focused checks:

```bash
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts src/app/admin/AdminCatalogPages.test.tsx
pnpm vitest run scripts/backfill-catalog-image-variants.test.mjs
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

Production verification after deployment:

```bash
curl -I "https://<prod-host>/api/public/catalog?limit=12"
curl -I "https://<prod-host>/api/public/catalog/tags"
curl -I "https://<supabase-project>.supabase.co/storage/v1/object/public/catalog-public-assets/<public-image-path>"
```

Expected:

- catalog and tags responses show `Cache-Control: no-store`;
- public image responses show long-lived cache metadata;
- after publishing/unpublishing/re-publishing a sofa, `/catalog` does not show
  stale fabric or render URLs while already fetched image URLs can still be
  cached by the browser/CDN.

## Roadmap

- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Notes

No accepted spec change is required before implementation. SPEC-0012 already
requires public catalog correctness, stable public image URLs, and safe image
unavailable handling. This plan changes the operational cache boundary created
by PLAN-0085 after production evidence showed that caching catalog JSON for one
hour can expose obsolete Storage URLs after publish/unpublish workflows.

The plan relies on immutable public image paths. If any public image upload path
can overwrite an existing public object path, that path must either stop using
long-lived immutable metadata or be changed to include a unique asset/version
component before this plan ships.
