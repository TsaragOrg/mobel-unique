# PLAN-0084 Public Catalog Card Preview Data

Plan: PLAN-0084
Spec: SPEC-0010
Related spec: SPEC-0012
Change request: CR-SPEC-0010-SPEC-0012-public-catalog-card-preview-data
Status: done
Owner area: web
Depends on: PLAN-0067, PLAN-0082, PLAN-0083
Affected packages:

- `apps/web`
- `scripts`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Make `/api/public/catalog` return all data needed for catalog card fabric
preview so `/catalog` no longer performs one `/api/public/sofas/{slug}` detail
request per visible card.

## Architecture

Keep the current public catalog store read path. It already loads sofas, tags,
fabrics, visual positions, and render cells together, then builds usable sofa
states in memory.

Extend the catalog item response with a card-scoped `fabrics` array. Each entry
contains the small swatch URL and the medium render URL for the sofa's default
visual position. The full sofa detail endpoint remains responsible for the
complete fabric, visual position, and render matrix state on `/sofas/{slug}`.

This is an additive public API change. Existing fields such as
`default_render_url`, `default_render_medium_url`, `default_fabric_id`, and
`default_visual_position_id` remain available.

## Scope

This plan includes:

- adding the catalog card fabric preview shape to `PublicCatalogItemResponse`;
- shaping card fabric preview data inside `listPublicCatalog`;
- updating `/api/public/catalog` tests and smoke checks;
- removing catalog card detail prefetching from `PublicCatalogPage.tsx`;
- keeping fabric switching instant from already loaded catalog data;
- preserving selected-fabric handoff to `/sofas/{slug}`;
- keeping required Russian and French `.tsx` comments current in changed files;
- updating roadmaps after implementation.

This plan does not include:

- changing the database schema or Supabase views;
- changing public image variant generation or backfill behavior;
- changing `/api/public/sofas/{slug}` response shape;
- changing sofa detail page visual-position behavior;
- changing catalog layout, filters, pagination, copy, or image sizes.

## Expected File Structure

- Modify: `apps/web/src/lib/public-catalog.ts`
  - Add `PublicCatalogCardFabricResponse`.
  - Add `fabrics: PublicCatalogCardFabricResponse[]` to
    `PublicCatalogItemResponse`.
  - Add a helper that maps complete public fabrics to card preview data using
    the sofa's default visual position.
  - Build `swatch_small_url` from `public_swatch_small_object_path`.
  - Build `render_medium_url` from `render_medium_object_path`.
- Modify: `apps/web/src/lib/public-catalog.test.ts`
  - Add helper coverage for embedded card fabric preview data.
  - Assert no private paths or raw object path field names leak into catalog
    JSON.
- Modify: `apps/web/src/lib/public-catalog-route-handlers.test.ts`
  - Add route-handler coverage for `/api/public/catalog` returning card
    preview fabrics.
- Modify: `apps/web/src/app/catalog/PublicCatalogPage.tsx`
  - Remove the per-card `fetchSofaDetail` call and its loading/error state.
  - Use `item.fabrics` for visible swatches, hidden count, and card image
    changes.
  - Keep the selected fabric handoff in session storage.
  - Update the required Russian/French comments without using forbidden words
    from `AGENTS.md`.
- Modify: `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`
  - Update fixture catalog items to include `fabrics`.
  - Assert initial card render uses medium catalog data.
  - Assert fabric switching uses already loaded catalog data.
  - Assert no `/api/public/sofas/{slug}` request is made on catalog load or
    fabric switching.
- Modify: `scripts/spec-0012-public-catalog-smoke.mjs`
  - Assert the first catalog item includes a non-empty `fabrics` array.
  - Assert each first-card fabric has `swatch_small_url` and
    `render_medium_url`.
  - Keep the existing full detail smoke request for `/sofas/{slug}` because it
    validates the detail page API contract, not catalog card prefetching.
- Modify: `scripts/spec-0012-public-catalog-smoke.test.mjs`
  - Update the fetch mock catalog response with card fabric preview data.
  - Add a failing mock case for a catalog item missing card fabric data.
- Modify: `docs/roadmap/web.md`
  - Add the completed public catalog card preview data behavior after
    implementation.
- Modify: `docs/roadmap/workflow.md`
  - Add the completed CR and plan tracking after implementation.

## Public API Shape

Each `GET /api/public/catalog` item should include:

```ts
{
  default_fabric_id: string;
  default_render_medium_content_type: string;
  default_render_medium_height_px: number | null;
  default_render_medium_url: string;
  default_render_medium_width_px: number | null;
  default_render_url: string;
  default_visual_position_id: string;
  fabrics: Array<{
    id: string;
    is_premium: boolean;
    public_name: string;
    public_order: number;
    swatch_small_content_type: string;
    swatch_small_height_px: number | null;
    swatch_small_url: string;
    swatch_small_width_px: number | null;
    render_medium_content_type: string;
    render_medium_height_px: number | null;
    render_medium_url: string;
    render_medium_width_px: number | null;
  }>;
}
```

`fabrics` must follow the same public fabric order used by the detail response.
Each `render_medium_url` must point at the render cell for that fabric and the
catalog item's `default_visual_position_id`.

The browser must not construct storage URLs. `public-catalog.ts` remains the
only place that builds public catalog asset URLs from database-provided object
paths.

## Tasks

- [ ] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type feature --area web --work "Public catalog card preview data" --spec SPEC-0010 --plan PLAN-0084
  ```

- [ ] Write the failing public catalog helper test in
  `apps/web/src/lib/public-catalog.test.ts`.

  Add an assertion to `shapes catalog cards with explicit medium render delivery
  fields` or a new test named
  `shapes catalog cards with embedded fabric preview data`.

  Required expectation:

  ```ts
  expect(result.items[0].fabrics).toEqual([
    expect.objectContaining({
      id: "00000000-0000-4000-8000-000000000501",
      public_name: "Fabric",
      public_order: 1,
      swatch_small_content_type: "image/jpeg",
      swatch_small_height_px: 48,
      swatch_small_width_px: 96,
      render_medium_content_type: "image/jpeg",
      render_medium_height_px: 960,
      render_medium_width_px: 1280,
    }),
  ]);
  expect(result.items[0].fabrics[0].swatch_small_url).toContain(
    "catalog/fabrics/fabric/swatch-small.jpg",
  );
  expect(result.items[0].fabrics[0].render_medium_url).toContain(
    "catalog/sofas/test/front-medium.jpg",
  );
  expect(JSON.stringify(result.items[0])).not.toContain("catalog-private-assets");
  expect(JSON.stringify(result.items[0])).not.toContain("object_path");
  ```

- [ ] Run the focused helper test and confirm it fails before implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts
  ```

  Expected before implementation: FAIL because catalog items do not expose
  `fabrics`.

- [ ] Implement the public catalog response shape in
  `apps/web/src/lib/public-catalog.ts`.

  Add this type near `PublicCatalogItemResponse`:

  ```ts
  export interface PublicCatalogCardFabricResponse {
    id: string;
    is_premium: boolean;
    public_name: string;
    public_order: number;
    render_medium_content_type: string;
    render_medium_height_px: number | null;
    render_medium_url: string;
    render_medium_width_px: number | null;
    swatch_small_content_type: string;
    swatch_small_height_px: number | null;
    swatch_small_url: string;
    swatch_small_width_px: number | null;
  }
  ```

  Add `fabrics: PublicCatalogCardFabricResponse[]` to
  `PublicCatalogItemResponse`.

  Add a helper with this behavior:

  ```ts
  function shapeCatalogCardFabrics(
    state: UsableSofaState,
    publicAssetBaseUrl: string,
  ): PublicCatalogCardFabricResponse[] {
    return state.fabrics
      .map((fabric) => {
        const defaultPositionRender = state.renders.find(
          (render) =>
            render.fabric_id === fabric.id &&
            render.visual_matrix_column_id === state.defaultVisualPosition.id,
        );

        if (!defaultPositionRender) {
          return null;
        }

        return {
          id: fabric.id,
          is_premium: fabric.is_premium,
          public_name: fabric.public_name,
          public_order: fabric.public_order,
          render_medium_content_type:
            defaultPositionRender.render_medium_content_type,
          render_medium_height_px:
            defaultPositionRender.render_medium_height_px ?? null,
          render_medium_url: buildPublicStorageUrl(
            publicAssetBaseUrl,
            defaultPositionRender.render_medium_object_path,
          ),
          render_medium_width_px:
            defaultPositionRender.render_medium_width_px ?? null,
          swatch_small_content_type: fabric.public_swatch_small_content_type,
          swatch_small_height_px: fabric.public_swatch_small_height_px ?? null,
          swatch_small_url: buildPublicStorageUrl(
            publicAssetBaseUrl,
            fabric.public_swatch_small_object_path,
          ),
          swatch_small_width_px: fabric.public_swatch_small_width_px ?? null,
        };
      })
      .filter(isDefined);
  }
  ```

  Then call it from `shapeCatalogItemResponse`:

  ```ts
  fabrics: shapeCatalogCardFabrics(state, publicAssetBaseUrl),
  ```

- [ ] Run the focused helper test again:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts
  ```

  Expected after implementation: PASS.

- [ ] Add the route-handler regression in
  `apps/web/src/lib/public-catalog-route-handlers.test.ts`.

  Required expectation after calling `handleListPublicCatalogRequest`:

  ```ts
  const body = await response.json();

  expect(body.data.items[0].fabrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: fabrics[0].id,
        render_medium_url: expect.stringContaining("front-medium.jpg"),
        swatch_small_url: expect.stringContaining("swatch-small.jpg"),
      }),
      expect.objectContaining({
        id: fabrics[1].id,
        render_medium_url: expect.stringContaining("front-medium.jpg"),
        swatch_small_url: expect.stringContaining("swatch-small.jpg"),
      }),
    ]),
  );
  expect(JSON.stringify(body)).not.toContain("render_cell_id");
  expect(JSON.stringify(body)).not.toContain("object_path");
  ```

- [ ] Run the focused route-handler test:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
  ```

  Expected after implementation: PASS.

- [ ] Update `apps/web/src/app/catalog/PublicCatalogPage.test.tsx` fixtures
  first.

  Add `fabrics` to `rivoli`:

  ```ts
  fabrics: [
    {
      id: "fabric-boucle",
      is_premium: false,
      public_name: "Boucle ivoire",
      public_order: 1,
      render_medium_content_type: "image/jpeg",
      render_medium_height_px: 960,
      render_medium_url: "https://assets.example/rivoli/boucle-face-medium.jpg",
      render_medium_width_px: 1280,
      swatch_small_content_type: "image/png",
      swatch_small_height_px: 96,
      swatch_small_url: "https://assets.example/fabrics/boucle-small.png",
      swatch_small_width_px: 96,
    },
    {
      id: "fabric-sauge",
      is_premium: true,
      public_name: "Velours sauge",
      public_order: 2,
      render_medium_content_type: "image/jpeg",
      render_medium_height_px: 960,
      render_medium_url: "https://assets.example/rivoli/sauge-face-medium.jpg",
      render_medium_width_px: 1280,
      swatch_small_content_type: "image/png",
      swatch_small_height_px: 96,
      swatch_small_url: "https://assets.example/fabrics/sauge-small.png",
      swatch_small_width_px: 96,
    },
  ],
  ```

  Add equivalent one-fabric data to `marais`.

- [ ] Update the existing catalog card fabric test so it no longer mocks
  `/api/public/sofas/canape-rivoli` or `/api/public/sofas/canape-marais`.

  Required expectation:

  ```ts
  expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog/tags");
  expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog?limit=12");
  expect(
    fetchMock.mock.calls.some(([input]) =>
      String(input).startsWith("/api/public/sofas/"),
    ),
  ).toBe(false);
  ```

  Keep the existing assertions that selecting `Velours sauge` changes only the
  Rivoli card image and preserves the selected fabric in session storage.

- [ ] Run the catalog page test and confirm it fails before the UI change:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
  ```

  Expected before UI implementation: FAIL because `CatalogCard` still calls the
  detail endpoint.

- [ ] Implement the catalog page UI change in
  `apps/web/src/app/catalog/PublicCatalogPage.tsx`.

  Remove:

  - `PublicSofaDetailResponse` import;
  - `DetailStatus`;
  - `detailStatus`;
  - `detail`;
  - the automatic block that calls `fetchSofaDetail`;
  - the `fetchSofaDetail` function;
  - loading/error copy for per-card fabric loading.

  Use catalog item data:

  ```ts
  const [selectedFabricId, setSelectedFabricId] = useState(
    item.default_fabric_id,
  );
  const selectedFabric =
    item.fabrics.find((fabric) => fabric.id === selectedFabricId) ??
    item.fabrics.find((fabric) => fabric.id === item.default_fabric_id);
  const activeRenderUrl =
    selectedFabric?.render_medium_url ?? item.default_render_medium_url;
  const visibleFabrics = item.fabrics.slice(0, VISIBLE_FABRIC_LIMIT);
  const hiddenFabricCount = Math.max(
    0,
    item.fabrics.length - VISIBLE_FABRIC_LIMIT,
  );
  ```

  Keep `selectFabric` and `rememberSelection`, but make them use the catalog
  item fabric ids.

  Update nearby comments in Russian and French. The comments must explain that
  the catalog response already contains the fabrics and images used by the card.
  Do not use these forbidden words in `.tsx` comments: `hook`, `state`,
  `props`, `render`, `component`, `callback`, `mount`.

- [ ] Run the catalog page test again:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
  ```

  Expected after implementation: PASS.

- [ ] Update `scripts/spec-0012-public-catalog-smoke.test.mjs` first.

  Add catalog item `fabrics` to the fetch mock and add a case where the catalog
  item is missing `fabrics`. Expected result for the missing case:

  ```ts
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("catalog item is missing fabrics");
  ```

- [ ] Update `scripts/spec-0012-public-catalog-smoke.mjs`.

  After the existing required catalog item field checks, add:

  ```js
  if (!Array.isArray(firstItem.fabrics) || firstItem.fabrics.length === 0) {
    fail(`catalog item is missing fabrics: ${JSON.stringify(firstItem)}`);
  }

  const firstFabric = firstItem.fabrics[0];

  for (const requiredFabricField of [
    "id",
    "public_name",
    "swatch_small_url",
    "render_medium_url",
  ]) {
    if (!firstFabric?.[requiredFabricField]) {
      fail(
        `catalog item fabric is missing ${requiredFabricField}: ${JSON.stringify(firstFabric)}`,
      );
    }
  }
  ```

- [ ] Run the smoke script unit test:

  ```powershell
  pnpm vitest run scripts/spec-0012-public-catalog-smoke.test.mjs
  ```

  Expected after implementation: PASS.

- [ ] Run focused verification:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts src/app/catalog/PublicCatalogPage.test.tsx
  pnpm vitest run scripts/spec-0012-public-catalog-smoke.test.mjs
  ```

  Expected: PASS.

- [ ] Run package-level verification:

  ```powershell
  pnpm --filter @mobel-unique/web typecheck
  pnpm --filter @mobel-unique/web test
  ```

  Expected: PASS.

- [ ] Run repository guardrails:

  ```powershell
  pnpm spec:check
  pnpm typecheck
  pnpm test
  ```

  Expected: PASS.

- [ ] Run local manual browser verification:

  ```powershell
  pnpm dev:web
  ```

  Then open `/catalog`, use DevTools Network, and verify:

  - the page requests `/api/public/catalog/tags`;
  - the page requests `/api/public/catalog?limit=12`;
  - changing fabric buttons does not request `/api/public/sofas/{slug}`;
  - the visible card image changes to an already returned medium render URL;
  - opening the detail page still requests `/api/public/sofas/{slug}` once for
    the detail page itself.

- [ ] Update roadmaps after implementation and verification:

  - `docs/roadmap/web.md`
  - `docs/roadmap/workflow.md`

- [ ] Move this plan to `docs/plans/done` only after implementation, roadmap
  updates, focused tests, broader checks, and manual browser verification are
  complete. Add a closure note listing the commands that actually passed.

## Tests

Required focused checks:

```powershell
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
pnpm vitest run scripts/spec-0012-public-catalog-smoke.test.mjs
```

Required combined checks:

```powershell
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts src/app/catalog/PublicCatalogPage.test.tsx
pnpm --filter @mobel-unique/web typecheck
pnpm --filter @mobel-unique/web test
pnpm spec:check
pnpm typecheck
pnpm test
```

Manual check:

```powershell
pnpm dev:web
```

Use the browser Network panel on `/catalog` to confirm fabric switching does
not issue `/api/public/sofas/{slug}` requests.

## Roadmap

Update these files after implementation:

- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

The web roadmap entry should say that public catalog cards now receive fabric
preview swatches and medium card render URLs directly from `/api/public/catalog`
and no longer preload sofa detail API data per card.

The workflow roadmap entry should say that the performance-audit priority for
catalog detail-request removal is tracked by the accepted CR and `PLAN-0084`.

## Closure Note

Completed on 2026-05-12.

Passed checks:

- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts`
- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts`
- `pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx`
- `pnpm vitest run scripts/spec-0012-public-catalog-smoke.test.mjs`
- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts src/app/catalog/PublicCatalogPage.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm --filter @mobel-unique/web test`
- `pnpm spec:check`
- `pnpm typecheck`
- `pnpm test`

Manual browser verification used the existing `next dev` server on
`http://localhost:3000`. On `/catalog`, the Network panel showed
`/api/public/catalog/tags` and `/api/public/catalog?limit=12`; changing a
fabric button did not request `/api/public/sofas/{slug}` and changed the card
image to the medium URL already present in the catalog response. Opening
`/sofas/mobel-local-published-complete` then requested
`/api/public/sofas/mobel-local-published-complete` once for the detail page.

## Rollout Notes

No migration or backfill is required. The rollout is a web/API deployment
because the Next.js public catalog route and the public catalog page live in
`apps/web`.

Deploy after tests pass, then re-run the production public audit Network check
for `/catalog` on mobile. The expected result is that `/catalog` no longer
requests `/api/public/sofas/{slug}` until the visitor actually opens a sofa
detail page.

## Notes

- `PLAN-0067` and `PLAN-0083` already provide the stored medium render and
  small swatch delivery fields needed by this plan.
- `PLAN-0082` keeps the sofa detail page's normal image on medium delivery.
  This plan does not change detail-page image selection.
- The catalog payload will be larger because it embeds card preview data, but
  it replaces many request round trips with one bounded catalog response.
  Implementation should keep the embedded data scoped to the default visual
  position to avoid returning the full detail render matrix in catalog lists.
