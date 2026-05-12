# CR-SPEC-0010 SPEC-0012 Public Catalog Card Preview Data

Target spec ids: SPEC-0010, SPEC-0012
Related spec ids: SPEC-0009, SPEC-0004
Status: accepted
Implementation Plans: PLAN-0084

## Reason For Change

The 2026-05-12 production performance audit found that public catalog cards make
extra sofa detail API requests to power fabric preview. A mobile `/catalog`
trace included a `/api/public/sofas/arte-angle` request that took about 648 ms.

The current `/api/public/catalog` response already provides the sofa card shell
and default image, but each card then fetches `/api/public/sofas/{public_slug}`
to get public fabrics, small swatches, and medium render URLs for fabric
switching. When a catalog page shows many cards, this creates one detail API
request per card.

The catalog page should receive all data needed for card-level fabric preview
from `/api/public/catalog`. The detail endpoint should remain for full sofa
detail pages and direct deep links, but catalog cards should not use it as a
per-card preview preload.

## Proposed Change

Update `SPEC-0010` public catalog API behavior so each
`GET /api/public/catalog` item includes a bounded list of card preview fabrics.

Each catalog item must continue to include the existing compatibility fields:

```ts
default_fabric_id: string;
default_visual_position_id: string;
default_render_medium_url: string;
default_render_url: string;
```

Each catalog item must also include:

```ts
fabrics: Array<{
  id: string;
  is_premium: boolean;
  public_name: string;
  public_order: number;
  swatch_small_url: string;
  swatch_small_width_px: number | null;
  swatch_small_height_px: number | null;
  swatch_small_content_type: string;
  render_medium_url: string;
  render_medium_width_px: number | null;
  render_medium_height_px: number | null;
  render_medium_content_type: string;
}>;
```

The `fabrics` array is scoped to the catalog card use case:

- include only public fabrics that are complete for the sofa;
- keep the existing public fabric order;
- return the small swatch URL for the selector button;
- return the medium render URL for the sofa's default visual position;
- keep full multi-position render selection on `GET /api/public/sofas/{slug}`;
- keep `default_render_url` as a compatibility alias to
  `default_render_medium_url`.

Update `SPEC-0012` public catalog frontend behavior:

- catalog cards must use the `fabrics` array from `/api/public/catalog`;
- catalog card fabric switching must not fetch `/api/public/sofas/{slug}`;
- clicking a fabric button must update the card image from already loaded
  catalog data;
- opening the sofa detail page from a card must continue to preserve the
  selected fabric through the existing internal navigation storage;
- the detail page still fetches `GET /api/public/sofas/{slug}` for the full
  public sofa state.

This change does not require a database migration because the public catalog
store already reads sofas, fabrics, visual positions, and render cells together.
The implementation should reshape existing public data into the catalog item
response.

## Impact

- API: `GET /api/public/catalog` adds card preview fabric data to each item.
- Web UI: `/catalog` removes the per-card detail fetch and uses catalog item
  data for fabric buttons and card image swaps.
- Tests: public catalog helper, route handler, catalog page, and smoke tests
  need coverage for the embedded card preview data and for the absence of
  per-card detail API calls.
- Performance: mobile catalog avoids one detail API request per visible card.
- Roadmaps: update `docs/roadmap/web.md` and `docs/roadmap/workflow.md` after
  implementation.

## Acceptance Criteria

- `GET /api/public/catalog?limit=12` returns each card's public fabrics with
  `swatch_small_url` and default-position `render_medium_url`.
- Public catalog responses still do not expose private paths, service-role
  keys, signed private URLs, raw SQL, stack traces, internal names, or render
  cell ids.
- The `/catalog` page makes no `/api/public/sofas/{slug}` requests while cards
  load or while the visitor changes fabrics in a card.
- Changing a fabric in one catalog card updates only that card image from the
  already loaded catalog response.
- Catalog card fabric buttons keep using `swatch_small_url`.
- Catalog card sofa images keep using medium render delivery.
- Opening a detail page from a fabric-previewed card still preserves the
  selected fabric for internal navigation.
- `GET /api/public/sofas/{slug}` remains available and unchanged for full
  detail pages.
- Existing catalog pagination, tag filtering, empty state, and no-results state
  keep their current behavior.
- Focused tests fail before the implementation and pass after the change.

## Approval Note

Accepted from the 2026-05-12 production performance audit priority list. This
is a narrow API-shape and public catalog UI performance change, not a new
product workflow.
