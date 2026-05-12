# PLAN-0086 Public Catalog Page-Scoped Read

Plan: PLAN-0086
Spec: SPEC-0010
Related specs: SPEC-0009, SPEC-0012
Related change request: CR-SPEC-0010-SPEC-0012-public-catalog-card-preview-data
Status: done
Owner area: web
Depends on: PLAN-0067, PLAN-0083, PLAN-0084, PLAN-0085
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Make `GET /api/public/catalog?limit=12` read only the page-scoped public card
data needed for the visible catalog cards, while preserving the existing
response contract and instant fabric switching inside each loaded card.

The endpoint must still return, for each visible sofa card:

- the sofa public metadata used by the card;
- the default medium render URL;
- public tags used by the card;
- public card fabrics in public order;
- each fabric's small swatch URL;
- each fabric's medium render URL for the sofa default visual position;
- price and dimensions when they are already part of the public card response.

## Workflow Decision

No new spec or change request is required for this implementation.

`SPEC-0010` already defines the public catalog endpoint as a paginated API with
`limit`, `cursor`, public tag filtering, visitor-safe fields, and no private
data exposure. The accepted
`CR-SPEC-0010-SPEC-0012-public-catalog-card-preview-data` already defines the
embedded card fabric payload that this work must preserve.

This plan changes the internal read strategy only: filtering, cursor ordering,
limit, and field selection move closer to Supabase. The browser-visible JSON
shape should remain compatible.

## Current Problem

`apps/web/src/lib/public-catalog.ts` currently serves catalog list requests by
calling `readPublicCatalogData()`. That helper reads all rows from these public
views:

- `public_catalog_sofas`
- `public_sofa_tags`
- `public_sofa_fabrics`
- `public_sofa_visual_positions`
- `public_sofa_render_cells`

Then Node.js builds usable sofa states, applies tag filters, sorts, applies the
cursor, slices to the requested limit, and shapes the response.

This works with small data, but it scales poorly because `limit=12` can still
read all public sofas, all public fabrics, all visual positions, and all public
render cells before choosing the visible page.

## Architecture

Add a Supabase RPC dedicated to the public catalog card list:

```sql
public.list_public_catalog_cards(
  p_limit integer,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_cursor_manual_public_order integer default null,
  p_tag_slugs text[] default array[]::text[]
)
```

The RPC returns one row per page-scoped public sofa. Each row contains only the
columns and JSON arrays needed to build the existing
`PublicCatalogItemResponse`.

The RPC must:

- cap `p_limit` server-side at 49 rows so the application can request
  `input.limit + 1` and detect `next_cursor`;
- apply selected tag slugs with the existing `AND` behavior before pagination;
- apply the current sort order in Supabase:
  `manual_public_order nulls last`, then `created_at desc`, then `id`;
- apply cursor filtering in Supabase using the same sort key;
- return only sofas that have at least one public visual position and at least
  one complete public fabric;
- return only the default-position medium render per card fabric, not the full
  detail render matrix;
- use existing public views where possible so the public/private filtering
  stays consistent;
- expose object paths only inside the server-side RPC result consumed by
  `apps/web`; the HTTP response must still expose public URLs, not raw paths.

Keep `GET /api/public/sofas/{slug}` on the existing full-detail read path. Sofa
detail still needs the complete fabric, visual position, and render matrix.

Keep `GET /api/public/catalog/tags` unchanged in this plan unless the
implementation naturally extracts a smaller shared helper. The priority here is
the list endpoint that currently has to load all card data before applying
`limit`.

## Expected File Structure

- Create: `supabase/migrations/20260512000300_public_catalog_page_scoped_read.sql`
  - Add the page-scoped catalog card RPC.
  - Grant execute to `anon` and `authenticated`.
  - Keep the function `stable`, `security invoker`, and scoped to public views.
- Create: `scripts/public-catalog-page-scoped-read-migration.test.mjs`
  - Source-test the migration function signature, server-side limit cap,
    tag `AND` filtering, cursor ordering, page-scoped joins, visitor-safe grants,
    and absence of service-role-only behavior.
- Modify: `package.json`
  - Add the migration test to `test:root:parallel`.
- Modify: `apps/web/src/lib/public-catalog.ts`
  - Add a page-scoped store method for catalog list reads.
  - Change `listPublicCatalog()` to use the new page-scoped method.
  - Keep the current full read path for tags and sofa detail.
  - Preserve all public response types and URLs.
- Modify: `apps/web/src/lib/public-catalog.test.ts`
  - Add regression coverage that catalog list reads use only the page-scoped
    store method.
  - Preserve existing response-shape and no-private-leak assertions.
- Modify: `apps/web/src/lib/public-catalog-route-handlers.test.ts`
  - Add route-handler coverage for `limit + 1`, tag forwarding, cursor
    forwarding, and no private leaks in the HTTP response.
- Modify after implementation: `docs/roadmap/web.md`
  - Add the completed catalog page-scoped read behavior.
- Modify after implementation: `docs/roadmap/workflow.md`
  - Add the performance-audit priority tracking entry.

No `.tsx` files should change in this plan. The catalog UI already consumes the
card-scoped `fabrics` array from `PLAN-0084`.

## Public API Compatibility

The HTTP response for each item must keep the current shape:

```ts
{
  default_fabric_id: string;
  default_render_medium_content_type: string;
  default_render_medium_height_px: number | null;
  default_render_medium_url: string;
  default_render_medium_width_px: number | null;
  default_render_url: string;
  default_visual_position_id: string;
  dimensions: {
    depth_cm: number | null;
    footprint_measurements: unknown;
    footprint_type: string | null;
    height_cm: number | null;
    length_cm: number | null;
  };
  fabrics: Array<{
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
  }>;
  id: string;
  price: { amount_cents: number; currency: "EUR" } | null;
  public_description: string | null;
  public_name: string;
  public_slug: string;
  shopify_order_url: string | null;
  tags: Array<{
    public_label: string;
    slug: string;
  }>;
}
```

`default_render_url` must remain a compatibility alias for
`default_render_medium_url`.

## Tasks

- [ ] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type fix --area web --work "Public catalog page scoped read" --spec SPEC-0010 --plan PLAN-0086
  ```

- [ ] Write the migration regression first in
  `scripts/public-catalog-page-scoped-read-migration.test.mjs`.

  Required assertions:

  ```js
  import { readFileSync } from "node:fs";
  import { describe, expect, it } from "vitest";

  const PATH =
    "supabase/migrations/20260512000300_public_catalog_page_scoped_read.sql";

  describe("PLAN-0086 public catalog page-scoped read RPC", () => {
    const sql = readFileSync(PATH, "utf8");

    it("creates the page-scoped public catalog card function", () => {
      expect(sql).toContain(
        "create or replace function public.list_public_catalog_cards",
      );
      expect(sql).toContain("p_limit integer");
      expect(sql).toContain("p_cursor_created_at timestamptz default null");
      expect(sql).toContain("p_cursor_id uuid default null");
      expect(sql).toContain(
        "p_cursor_manual_public_order integer default null",
      );
      expect(sql).toContain("p_tag_slugs text[] default array[]::text[]");
    });

    it("keeps execution visitor-safe", () => {
      expect(sql).toContain("stable");
      expect(sql).toContain("security invoker");
      expect(sql).toContain("set search_path = public, extensions");
      expect(sql).toContain(
        "grant execute on function public.list_public_catalog_cards",
      );
      expect(sql).toContain("to anon, authenticated");
      expect(sql).not.toContain("service_role");
      expect(sql).not.toContain("security definer");
    });

    it("caps page size and fetches one extra row for cursor detection", () => {
      expect(sql).toContain("least(greatest(coalesce(p_limit, 12), 1), 49)");
      expect(sql).toContain("limit bounded_limit");
    });

    it("applies tag AND filtering before pagination", () => {
      expect(sql).toContain("requested_tags");
      expect(sql).toContain("not exists");
      expect(sql).toContain("public.public_sofa_tags");
      expect(sql).toContain("tag.slug = requested_tag.slug");
    });

    it("applies the catalog sort cursor in SQL", () => {
      expect(sql).toContain("manual_public_order");
      expect(sql).toContain("created_at desc");
      expect(sql).toContain("candidate.id");
      expect(sql).toContain("p_cursor_created_at");
      expect(sql).toContain("p_cursor_id");
      expect(sql).toContain("sofa.created_at < p_cursor_created_at");
    });

    it("returns only card-scoped fabrics and default-position medium renders", () => {
      expect(sql).toContain("public.public_sofa_fabrics");
      expect(sql).toContain("public.public_sofa_visual_positions");
      expect(sql).toContain("public.public_sofa_render_cells");
      expect(sql).toContain("render_medium_object_path");
      expect(sql).toContain("public_swatch_small_object_path");
      expect(sql).not.toContain("render_original_object_path");
    });
  });
  ```

- [ ] Run the migration regression and confirm it fails before the migration
  exists:

  ```powershell
  pnpm vitest run scripts/public-catalog-page-scoped-read-migration.test.mjs
  ```

  Expected before implementation: FAIL because the migration file does not
  exist.

- [ ] Create
  `supabase/migrations/20260512000300_public_catalog_page_scoped_read.sql`.

  The SQL function should use this shape:

  ```sql
  -- PLAN-0086 Public Catalog Page-Scoped Read
  --
  -- Returns only the public data needed to shape one catalog card page.

  create or replace function public.list_public_catalog_cards(
    p_limit integer,
    p_cursor_created_at timestamptz default null,
    p_cursor_id uuid default null,
    p_cursor_manual_public_order integer default null,
    p_tag_slugs text[] default array[]::text[]
  )
  returns table (
    id uuid,
    public_name text,
    public_slug text,
    shopify_order_url text,
    public_description text,
    length_cm integer,
    depth_cm integer,
    height_cm integer,
    footprint_type text,
    footprint_measurements jsonb,
    manual_public_order integer,
    created_at timestamptz,
    price_cents integer,
    price_currency text,
    default_fabric_id uuid,
    default_visual_position_id uuid,
    default_render_medium_object_path text,
    default_render_medium_content_type text,
    default_render_medium_width_px integer,
    default_render_medium_height_px integer,
    tags jsonb,
    fabrics jsonb
  )
  language sql
  stable
  security invoker
  set search_path = public, extensions
  as $$
    with
      limits as (
        select least(greatest(coalesce(p_limit, 12), 1), 49) as bounded_limit
      ),
      requested_tags as (
        select distinct btrim(tag_slug) as slug
        from unnest(coalesce(p_tag_slugs, array[]::text[])) as tag_slug
        where btrim(tag_slug) <> ''
      ),
      usable_candidates as (
        select
          sofa.*,
          default_fabric.id as default_fabric_id,
          default_position.id as default_visual_position_id,
          default_render.render_medium_object_path as default_render_medium_object_path,
          default_render.render_medium_content_type as default_render_medium_content_type,
          default_render.render_medium_width_px as default_render_medium_width_px,
          default_render.render_medium_height_px as default_render_medium_height_px
        from public.public_catalog_sofas sofa
        join lateral (
          select fabric.*
          from public.public_sofa_fabrics fabric
          where fabric.sofa_id = sofa.id
          order by fabric.public_order, fabric.id
          limit 1
        ) default_fabric on true
        join lateral (
          select position.*
          from public.public_sofa_visual_positions position
          where position.sofa_id = sofa.id
          order by position.sequence, position.id
          limit 1
        ) default_position on true
        join public.public_sofa_render_cells default_render
          on default_render.sofa_id = sofa.id
          and default_render.fabric_id = default_fabric.id
          and default_render.visual_matrix_column_id = default_position.id
        where not exists (
          select 1
          from requested_tags requested_tag
          where not exists (
            select 1
            from public.public_sofa_tags tag
            where tag.sofa_id = sofa.id
              and tag.slug = requested_tag.slug
          )
        )
        and (
          p_cursor_created_at is null
          or coalesce(sofa.manual_public_order, 2147483647)
            > coalesce(p_cursor_manual_public_order, 2147483647)
          or (
            coalesce(sofa.manual_public_order, 2147483647)
              = coalesce(p_cursor_manual_public_order, 2147483647)
            and sofa.created_at < p_cursor_created_at
          )
          or (
            coalesce(sofa.manual_public_order, 2147483647)
              = coalesce(p_cursor_manual_public_order, 2147483647)
            and sofa.created_at = p_cursor_created_at
            and sofa.id > p_cursor_id
          )
        )
      ),
      candidates as (
        select *
        from usable_candidates candidate
        order by
          coalesce(candidate.manual_public_order, 2147483647),
          candidate.created_at desc,
          candidate.id
        limit (select bounded_limit from limits)
      )
    select
      candidate.id,
      candidate.public_name,
      candidate.public_slug,
      candidate.shopify_order_url,
      candidate.public_description,
      candidate.length_cm,
      candidate.depth_cm,
      candidate.height_cm,
      candidate.footprint_type,
      candidate.footprint_measurements,
      candidate.manual_public_order,
      candidate.created_at,
      candidate.price_cents,
      candidate.price_currency,
      candidate.default_fabric_id,
      candidate.default_visual_position_id,
      candidate.default_render_medium_object_path,
      candidate.default_render_medium_content_type,
      candidate.default_render_medium_width_px,
      candidate.default_render_medium_height_px,
      coalesce(card_tags.tags, '[]'::jsonb) as tags,
      coalesce(card_fabrics.fabrics, '[]'::jsonb) as fabrics
    from candidates candidate
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'public_label', tag.public_label,
          'slug', tag.slug
        )
        order by tag.public_label, tag.slug
      ) as tags
      from public.public_sofa_tags tag
      where tag.sofa_id = candidate.id
    ) card_tags on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', fabric.id,
          'is_premium', fabric.is_premium,
          'public_name', fabric.public_name,
          'public_order', fabric.public_order,
          'render_medium_content_type', fabric_render.render_medium_content_type,
          'render_medium_height_px', fabric_render.render_medium_height_px,
          'render_medium_object_path', fabric_render.render_medium_object_path,
          'render_medium_width_px', fabric_render.render_medium_width_px,
          'swatch_small_content_type', fabric.public_swatch_small_content_type,
          'swatch_small_height_px', fabric.public_swatch_small_height_px,
          'swatch_small_object_path', fabric.public_swatch_small_object_path,
          'swatch_small_width_px', fabric.public_swatch_small_width_px
        )
        order by fabric.public_order, fabric.id
      ) as fabrics
      from public.public_sofa_fabrics fabric
      join public.public_sofa_render_cells fabric_render
        on fabric_render.sofa_id = candidate.id
        and fabric_render.fabric_id = fabric.id
        and fabric_render.visual_matrix_column_id = candidate.default_visual_position_id
      where fabric.sofa_id = candidate.id
    ) card_fabrics on true;
  $$;

  revoke all on function public.list_public_catalog_cards(
    integer,
    timestamptz,
    uuid,
    integer,
    text[]
  ) from public;

  grant execute on function public.list_public_catalog_cards(
    integer,
    timestamptz,
    uuid,
    integer,
    text[]
  ) to anon, authenticated;
  ```

  If the migration test or local Supabase reset catches a Postgres type issue,
  keep the same behavior and adjust the exact SQL types to match the schema.

- [ ] Run the migration regression again:

  ```powershell
  pnpm vitest run scripts/public-catalog-page-scoped-read-migration.test.mjs
  ```

  Expected after migration implementation: PASS.

- [ ] Add the migration regression to `package.json` under
  `test:root:parallel`.

  Add this file to the long `vitest run` command:

  ```text
  scripts/public-catalog-page-scoped-read-migration.test.mjs
  ```

- [ ] Add page-scoped store types in `apps/web/src/lib/public-catalog.ts`.

  Add a store method:

  ```ts
  listPublicCatalogCards(
    input: CatalogListInput & { limit: number },
  ): Promise<Array<PublicCatalogCardRow | JsonObject>>;
  ```

  Add a row type whose fields match the RPC output:

  ```ts
  interface PublicCatalogCardRow {
    created_at: string;
    default_fabric_id: string;
    default_render_medium_content_type: string;
    default_render_medium_height_px?: number | null;
    default_render_medium_object_path: string;
    default_render_medium_width_px?: number | null;
    default_visual_position_id: string;
    depth_cm?: number | null;
    fabrics: unknown;
    footprint_measurements?: unknown;
    footprint_type?: string | null;
    height_cm?: number | null;
    id: string;
    length_cm?: number | null;
    manual_public_order?: number | null;
    price_cents?: number | null;
    price_currency?: string | null;
    public_description?: string | null;
    public_name: string;
    public_slug: string;
    shopify_order_url?: string | null;
    tags: unknown;
  }
  ```

- [ ] Update `createSupabasePublicCatalogStore()` so
  `listPublicCatalogCards()` calls the RPC:

  ```ts
  async listPublicCatalogCards(input) {
    const { data, error } = await anonClient.rpc(
      "list_public_catalog_cards",
      {
        p_cursor_created_at: input.cursor?.created_at ?? null,
        p_cursor_id: input.cursor?.id ?? null,
        p_cursor_manual_public_order:
          input.cursor?.manual_public_order ?? null,
        p_limit: input.limit,
        p_tag_slugs: input.tags,
      },
    );

    if (error) {
      throw error;
    }

    return data ?? [];
  }
  ```

  Keep the existing `listPublicSofas()`, `listPublicFabrics()`,
  `listPublicRenderCells()`, `listPublicSofaTags()`, and
  `listPublicVisualPositions()` methods for tag and sofa detail reads.

- [ ] Change `listPublicCatalog()` to use only
  `store.listPublicCatalogCards()`.

  Required behavior:

  ```ts
  export async function listPublicCatalog(
    store: PublicCatalogStore,
    input: CatalogListInput,
  ): Promise<PublicCatalogListResponse> {
    const rows = (
      await store.listPublicCatalogCards({
        ...input,
        limit: input.limit + 1,
      })
    )
      .map(shapeCatalogCardRow)
      .filter(isDefined);

    const page = rows.slice(0, input.limit);
    const hasNextPage = rows.length > input.limit;
    const lastPageItem = page[page.length - 1];

    return {
      items: page.map((row) =>
        shapeCatalogItemResponseFromCardRow(row, store.publicAssetBaseUrl),
      ),
      next_cursor:
        hasNextPage && lastPageItem
          ? encodeCatalogCursor({
              created_at: lastPageItem.created_at,
              id: lastPageItem.id,
              manual_public_order: lastPageItem.manual_public_order ?? null,
            })
          : null,
    };
  }
  ```

  The implementation may use different helper names, but it must not call
  `readPublicCatalogData()` from `listPublicCatalog()`.

- [ ] Add row-shaping helpers in `apps/web/src/lib/public-catalog.ts`.

  They must:

  - validate `tags` as an array of `{ public_label, slug }`;
  - validate `fabrics` as an array with the card fabric fields from the RPC;
  - build URLs with `buildPublicStorageUrl()`;
  - keep `default_render_url === default_render_medium_url`;
  - keep `price` shaped through the existing `shapePrice()` behavior;
  - drop malformed rows rather than leaking unexpected fields.

- [ ] Write the focused helper regression in
  `apps/web/src/lib/public-catalog.test.ts`.

  Add a test store where `listPublicCatalogCards()` returns three card rows
  when called with `limit=3`, and all legacy broad list methods throw if called.

  Required expectations:

  ```ts
  const result = await listPublicCatalog(createPageScopedStore(), {
    cursor: null,
    limit: 2,
    tags: ["angle"],
  });

  expect(result.items).toHaveLength(2);
  expect(result.next_cursor).toEqual(expect.any(String));
  expect(result.items[0].fabrics[0]).toMatchObject({
    public_name: "Boucle ivoire",
    render_medium_url: expect.stringContaining("front-medium.jpg"),
    swatch_small_url: expect.stringContaining("swatch-small.jpg"),
  });
  expect(JSON.stringify(result)).not.toContain("object_path");
  expect(JSON.stringify(result)).not.toContain("render_cell_id");
  expect(JSON.stringify(result)).not.toContain("catalog-private-assets");
  ```

- [ ] Run the focused helper test:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts
  ```

  Expected after implementation: PASS.

- [ ] Add route-handler coverage in
  `apps/web/src/lib/public-catalog-route-handlers.test.ts`.

  Use a fake store that records the `listPublicCatalogCards()` input. Assert:

  ```ts
  expect(seenInput).toMatchObject({
    limit: 13,
    tags: ["angle", "convertible"],
  });
  expect(seenInput.cursor).toBeNull();
  ```

  Add a second request with `cursor=<first next_cursor>` and assert the cursor
  values are forwarded to the store.

  Keep the existing cache assertion:

  ```ts
  expect(response.headers.get("Cache-Control")).toBe(
    "public, s-maxage=3600, stale-while-revalidate=300",
  );
  ```

- [ ] Run the route-handler test:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
  ```

  Expected after implementation: PASS.

- [ ] Run the public catalog smoke script unit test:

  ```powershell
  pnpm vitest run scripts/spec-0012-public-catalog-smoke.test.mjs
  ```

  Expected: PASS.

- [ ] Run focused verification:

  ```powershell
  pnpm vitest run scripts/public-catalog-page-scoped-read-migration.test.mjs
  pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts
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

- [ ] If local Supabase is available, validate the migration with a DB reset:

  ```powershell
  pnpm supabase:reset
  ```

  Expected: PASS. If local dependencies or secrets are missing, record that in
  the closure note instead of claiming DB reset passed.

- [ ] Run local manual API verification:

  ```powershell
  pnpm dev:web
  ```

  Then request:

  ```powershell
  Invoke-WebRequest "http://127.0.0.1:3000/api/public/catalog?limit=12" -Method Get
  ```

  Expected:

  - the response keeps the same public JSON fields as before;
  - each item has `fabrics`;
  - each fabric has `swatch_small_url` and `render_medium_url`;
  - no response text contains `object_path`, `render_cell_id`,
    `catalog-private-assets`, `service_role`, or `internal_name`.

- [ ] After deploy, re-run the production public catalog Network check from
  `performance-audit`.

  Expected:

  - `/api/public/catalog?limit=12` still returns all card data needed for
    instant fabric switching;
  - the server no longer reads all catalog sofas, fabrics, positions, tags, and
    render cells for the first page;
  - catalog card fabric switching still makes no `/api/public/sofas/{slug}`
    request;
  - catalog list and tags keep the CDN cache behavior from `PLAN-0085`.

- [ ] Update roadmaps after implementation and verification:

  - `docs/roadmap/web.md`
  - `docs/roadmap/workflow.md`

- [ ] Move this plan to `docs/plans/done` only after implementation, roadmap
  updates, focused tests, broader checks, and manual verification are complete.
  Add a closure note listing the commands that actually passed.

## Tests

Required focused checks:

```powershell
pnpm vitest run scripts/public-catalog-page-scoped-read-migration.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts
pnpm vitest run scripts/spec-0012-public-catalog-smoke.test.mjs
```

Required combined checks:

```powershell
pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts
pnpm --filter @mobel-unique/web typecheck
pnpm --filter @mobel-unique/web test
pnpm spec:check
pnpm typecheck
pnpm test
```

Optional local DB check when Supabase local dependencies are available:

```powershell
pnpm supabase:reset
```

Manual API check:

```powershell
pnpm dev:web
Invoke-WebRequest "http://127.0.0.1:3000/api/public/catalog?limit=12" -Method Get
```

## Roadmap

Update these files after implementation:

- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

The web roadmap entry should say that public catalog list reads now use a
page-scoped Supabase RPC, so `limit=12` returns only the visible sofas and their
card-ready fabric/swatch/default-position medium render data instead of loading
all public catalog views into Node.js first.

The workflow roadmap entry should say that performance-audit priority 5 is
tracked by `PLAN-0086` without a new spec or CR because the existing accepted
catalog API contract already requires paginated, visitor-safe catalog data.

## Notes

- This plan intentionally does not remove the full in-memory read path used by
  sofa detail. Detail still needs the full public matrix for one sofa.
- This plan intentionally keeps public asset URL construction in
  `apps/web/src/lib/public-catalog.ts`; the database returns public object
  paths to server-side code, and the HTTP response returns URLs.
- If production EXPLAIN output later shows the RPC needs new indexes, add the
  smallest index migration in the same implementation branch and update this
  plan's closure note with the evidence.

## Closure Note

Implementation completed on branch
`fix/web/spec-0010-plan-0086-public-catalog-page-scoped-read`.

The migration regression was first run before the migration existed and failed
as expected with `ENOENT` for
`supabase/migrations/20260512000300_public_catalog_page_scoped_read.sql`.

The focused helper regression was first run after adding the page-scoped store
expectation and failed as expected because `listPublicCatalog()` still called
the broad public view methods.

Passed local checks:

- `pnpm vitest run scripts/public-catalog-page-scoped-read-migration.test.mjs`
- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts`
- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog-route-handlers.test.ts`
- `pnpm vitest run scripts/spec-0012-public-catalog-smoke.test.mjs`
- `pnpm --filter @mobel-unique/web test -- src/lib/public-catalog.test.ts src/lib/public-catalog-route-handlers.test.ts`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm --filter @mobel-unique/web test`
- `pnpm spec:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm seed:local:admin-fixtures`

Local Supabase reset evidence:

- `pnpm supabase:reset` applied all migrations, including
  `20260512000300_public_catalog_page_scoped_read.sql`, and completed
  `supabase db reset`.
- The full command exited 1 after that because
  `scripts/ensure-local-realtime-compat.mjs` could not spawn `psql`
  (`spawnSync psql ENOENT`).

Manual API check:

- A local web server was started on `http://127.0.0.1:3003`.
- A Node `fetch` request to
  `http://127.0.0.1:3003/api/public/catalog?limit=12` returned status `200`,
  cache header `public, s-maxage=3600, stale-while-revalidate=300`, one catalog
  item, three card fabrics on that item, `swatch_small_url` and
  `render_medium_url` on the fabric data, and no `object_path`,
  `render_cell_id`, `catalog-private-assets`, `service_role`, or
  `internal_name` in the response text.

Post-deploy follow-up:

- Re-run the production public catalog Network check from `performance-audit`
  after this branch is deployed.
