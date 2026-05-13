# PLAN-0085 Public Catalog CDN Cache

Plan: PLAN-0085
Spec: SPEC-0010
Status: done
Owner area: web
Change request: CR-SPEC-0010-public-catalog-cdn-cache
Related spec: SPEC-0012
Depends on: PLAN-0024, PLAN-0084
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Give public catalog list and tag API responses a short CDN cache policy so
repeat public catalog visits do not always hit the runtime handler and Supabase.

## Architecture

Keep the current Next.js App Router route handlers runtime-backed by Supabase.
Do not switch the routes to static generation. Add explicit response cache
policies in `apps/web/src/lib/public-catalog-route-handlers.ts` so successful
catalog list/tag reads are cacheable by shared caches while detail and error
responses remain `no-store`.

The safe first scope is list and tags only:

- cache `GET /api/public/catalog`;
- cache `GET /api/public/catalog/tags`;
- keep `GET /api/public/sofas/{slug}` uncached because detail pages include
  price and availability behavior that may need immediate visibility after
  admin edits.

## Cache Policy

Successful list/tag responses must use:

```http
Cache-Control: public, s-maxage=3600, stale-while-revalidate=300
```

All errors and public sofa detail responses must use:

```http
Cache-Control: no-store
```

This accepts that public catalog list/tag updates can be delayed for up to one
hour, with a short extra stale refresh window while the CDN revalidates.

## Expected File Structure

- Modify: `apps/web/src/lib/public-catalog-route-handlers.ts`
  - Add named cache-control constants.
  - Let `jsonResponse` receive a cache policy option.
  - Use the public CDN cache policy for successful list and tag responses.
  - Keep the default cache policy as `no-store`.
  - Leave sofa detail responses on the default `no-store`.
- Modify: `apps/web/src/lib/public-catalog-route-handlers.test.ts`
  - Add route-handler expectations for successful list and tag cache headers.
  - Keep or add detail and error expectations for `no-store`.
- Modify after implementation: `docs/roadmap/web.md`
  - Add a completed row for `PLAN-0085`.
- Modify after implementation: `docs/roadmap/workflow.md`
  - Add a completed row linking the performance-audit priority to this CR and
    plan.

No `.tsx` files should change in this plan, so the repository's required
Russian/French `.tsx` comment rule should not be triggered.

## Tasks

- [x] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type fix --area web --work "Public catalog CDN cache" --spec SPEC-0010 --plan PLAN-0085
  ```

- [x] Add the failing route-handler cache tests in
  `apps/web/src/lib/public-catalog-route-handlers.test.ts`.

  In `returns only tags used by public-usable sofas`, add:

  ```ts
  expect(response.headers.get("Cache-Control")).toBe(
    "public, s-maxage=3600, stale-while-revalidate=300",
  );
  ```

  In `lists public catalog items with tag AND filters`, add:

  ```ts
  expect(response.headers.get("Cache-Control")).toBe(
    "public, s-maxage=3600, stale-while-revalidate=300",
  );
  ```

  Keep the existing sofa detail expectation:

  ```ts
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  ```

  In `maps unknown and unavailable sofa slugs safely`, add:

  ```ts
  expect(missing.headers.get("Cache-Control")).toBe("no-store");
  expect(unavailable.headers.get("Cache-Control")).toBe("no-store");
  ```

- [x] Add a validation-error cache regression to the same test file:

  ```ts
  it("does not cache invalid catalog list requests", async () => {
    const response = await handleListPublicCatalogRequest({
      createStore: createFakeStore,
      request: new Request("http://localhost/api/public/catalog?limit=bad"),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  ```

- [x] Run the focused route-handler test and confirm it fails before
  implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
  ```

  Expected before implementation: FAIL because successful list and tag responses
  still return `Cache-Control: no-store`.

- [x] Implement the cache policy in
  `apps/web/src/lib/public-catalog-route-handlers.ts`.

  Add constants near the input types:

  ```ts
  const PUBLIC_CATALOG_CACHE_CONTROL =
    "public, s-maxage=3600, stale-while-revalidate=300";
  const NO_STORE_CACHE_CONTROL = "no-store";
  ```

  Change the successful list response:

  ```ts
  return jsonResponse(
    {
      data: catalog,
      meta: {},
    },
    200,
    {
      cacheControl: PUBLIC_CATALOG_CACHE_CONTROL,
    },
  );
  ```

  Change the successful tags response:

  ```ts
  return jsonResponse(
    {
      data: tags,
      meta: {},
    },
    200,
    {
      cacheControl: PUBLIC_CATALOG_CACHE_CONTROL,
    },
  );
  ```

  Keep the sofa detail call without the cache option.

  Replace the helper with:

  ```ts
  function jsonResponse(
    body: unknown,
    status: number,
    options: { cacheControl?: string } = {},
  ) {
    return new Response(JSON.stringify(body), {
      headers: {
        "Cache-Control": options.cacheControl ?? NO_STORE_CACHE_CONTROL,
        "Content-Type": "application/json",
      },
      status,
    });
  }
  ```

- [x] Run the focused route-handler test again:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
  ```

  Expected after implementation: PASS.

- [x] Run the focused public catalog helper test to catch accidental response
  shape regressions:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts
  ```

  Expected: PASS.

- [x] Run package-level verification:

  ```powershell
  pnpm --filter @mobel-unique/web typecheck
  pnpm --filter @mobel-unique/web test
  ```

  Expected: PASS.

- [x] Run repository guardrails:

  ```powershell
  pnpm spec:check
  pnpm typecheck
  pnpm test
  ```

  Expected: PASS.

- [ ] Run a production-mode or preview-mode manual header check after deploy.

  Deferred until a Vercel preview or production deployment exists for this
  branch. The route-handler tests cover the response headers in code before
  deployment.

  Use a normal browser or curl-like request against the deployed app:

  ```powershell
  Invoke-WebRequest "https://<preview-or-prod-host>/api/public/catalog?limit=12" -Method Get
  Invoke-WebRequest "https://<preview-or-prod-host>/api/public/catalog/tags" -Method Get
  Invoke-WebRequest "https://<preview-or-prod-host>/api/public/sofas/<published-slug>" -Method Get
  ```

  Expected headers:

  - catalog list: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300`;
  - tags: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300`;
  - sofa detail: `Cache-Control: no-store`.

- [ ] Re-run the production public catalog Network check from
  `performance-audit` after deploy.

  Expected result:

  - repeat `/catalog` visits should show CDN cache behavior for catalog list
    and tags;
  - catalog data may remain stale for up to one hour plus the short stale
    refresh window;
  - public sofa detail still requests fresh JSON.

- [x] Update roadmaps after implementation and verification:

  - `docs/roadmap/web.md`;
  - `docs/roadmap/workflow.md`.

- [x] Move this plan to `docs/plans/done` after implementation, roadmap
  updates, focused tests, and broader local checks. The deployed header check
  and production Network check remain post-deploy follow-ups because no preview
  deployment existed before opening this PR. Add a closure note listing the
  commands that actually passed.

## Tests

Required focused checks:

```powershell
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts
```

Required package checks:

```powershell
pnpm --filter @mobel-unique/web typecheck
pnpm --filter @mobel-unique/web test
```

Required repository checks:

```powershell
pnpm spec:check
pnpm typecheck
pnpm test
```

Manual deployed header check:

```powershell
Invoke-WebRequest "https://<preview-or-prod-host>/api/public/catalog?limit=12" -Method Get
Invoke-WebRequest "https://<preview-or-prod-host>/api/public/catalog/tags" -Method Get
Invoke-WebRequest "https://<preview-or-prod-host>/api/public/sofas/<published-slug>" -Method Get
```

## Roadmap

Update these files after implementation:

- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

The web roadmap entry should say that successful public catalog list and tag API
responses now use a one-hour shared CDN cache with a short stale refresh window,
while sofa detail and errors remain uncached.

The workflow roadmap entry should say that the performance-audit priority for
public catalog API caching is tracked by the accepted change request and
`PLAN-0085`.

## Notes

- Context7 lookup for current Next.js docs confirmed that App Router route
  handlers are not cached by default, while response headers can still set HTTP
  cache behavior for dynamic responses.
- Keeping `force-dynamic` is intentional in this plan because the route still
  reads live Supabase-backed public catalog data at runtime.
- The cache policy is intentionally scoped away from sofa detail because
  `PLAN-0065` introduced public price data and published sofas allow price-only
  saves without unpublishing.
- Do not cache error responses. Caching a temporary `503` or validation failure
  would make recovery look broken to visitors.

## Closure Note

Implementation completed on branch
`fix/web/spec-0010-plan-0085-public-catalog-cdn-cache`.

The focused route-handler test was first run after adding cache expectations and
failed as expected because successful list and tag responses still returned
`Cache-Control: no-store`.

Passed local checks:

- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts`
- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm --filter @mobel-unique/web test`
- `pnpm spec:check`
- `pnpm typecheck`
- `pnpm test`
- `git diff --check`

Post-deploy follow-up:

- Check the deployed preview or production headers for
  `/api/public/catalog?limit=12`, `/api/public/catalog/tags`, and a published
  `/api/public/sofas/<slug>`.
- Re-run the public catalog Network check from `performance-audit` after the
  deployed environment is available.
