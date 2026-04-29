# PLAN-0024 Public Catalog Read Foundation

Plan: PLAN-0024
Spec: SPEC-0010
Status: done
Owner area: api
Depends on: SPEC-0004, SPEC-0009, SPEC-0012
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Deliver the first public customer-flow foundation: safe public read endpoints
for published catalog data and published sofa detail state.

This plan intentionally starts with the public data/API boundary before visual
page implementation. It implements the public catalog read contracts from
`SPEC-0010` so the page flows in `SPEC-0012` can build on a safe data source.
The public storefront pages, simulation wizard, email verification, room photo
upload, in-home simulation worker, result display, and regeneration flow should
build on this read foundation through later plans.

## Concrete Test Path

After implementation, a local public visitor should be able to:

1. Open `GET /api/public/catalog/tags` and see only tags assigned to published
   public sofas.
2. Open `GET /api/public/catalog` and see only published, public-usable sofas
   with default render URLs, dimensions, tags, Shopify URL, and default
   fabric/visual-position ids.
3. Apply one or more `tag` query filters and receive `AND` behavior.
4. Request another catalog page with `cursor` and avoid duplicate sofas.
5. Open `GET /api/public/sofas/{public_slug}` and receive the selected sofa,
   public fabrics, public visual positions, public renders, and defaults.
6. Confirm draft, archived, unpublished, and incomplete sofas are not returned
   from public reads.
7. Confirm browser-visible responses never include internal names, private
   bucket paths, raw storage object paths, provider metadata, worker state,
   private render candidates, SQL details, stack traces, or service-role
   configuration.

## Scope

### Public Read Endpoints

Implement these logical endpoints through first-party Next.js route handlers:

- `GET /api/public/catalog`;
- `GET /api/public/catalog/tags`;
- `GET /api/public/sofas/{public_slug}`.

All successful responses must use the shared API envelope convention:

```json
{
  "data": {},
  "meta": {}
}
```

Expected error envelope:

```json
{
  "error": {
    "code": "READABLE_ERROR_CODE",
    "message": "Readable message.",
    "details": {}
  }
}
```

### Catalog List

`GET /api/public/catalog` must support:

- repeated `tag` query parameters;
- optional `limit`, capped server-side;
- optional opaque `cursor`;
- deterministic ordering by manual public order when present, then newest
  published sofa creation time, then a stable id tie-breaker;
- cursor-based pagination;
- duplicate prevention across overlapping pages;
- safe handling of unknown, stale, or invalid tag slugs.

Catalog items must include:

- public sofa id;
- `public_slug`;
- `public_name`;
- optional `public_description`;
- public dimensions;
- public tags in API order;
- `default_fabric_id`;
- `default_visual_position_id`;
- `default_render_url`;
- `shopify_order_url`.

The endpoint must not expose fabric preview data unless it can do so without
expanding the accepted public API contract unsafely. Catalog fabric preview can
be implemented in a later frontend plan by lazy-loading public sofa detail data
for the selected card, or by an accepted additive public API change.

### Catalog Tags

`GET /api/public/catalog/tags` must return only public tags assigned to at
least one published sofa that is public-usable.

If no public tags exist, the endpoint returns an empty `items` array. The later
catalog page should hide the filter area in that state.

### Sofa Detail

`GET /api/public/sofas/{public_slug}` must return:

- the public sofa object;
- all public fabrics for the sofa;
- all public visual positions for the sofa;
- all public render cells for public fabric/visual-position combinations;
- default fabric and default visual position ids.

Rules:

- defaults are the first public fabric by public order and the first visual
  position by sequence;
- public render URLs must be stable public `catalog-public-assets` URLs;
- raw storage object paths must never be returned;
- `404 SOFA_NOT_FOUND` is used when the slug was never known or cannot be
  disclosed safely;
- `410 SOFA_UNAVAILABLE` is used only when the slug belongs to a previously
  public sofa that is now unavailable and the response can remain safe.

### Public Read Data Support

Use the existing public read views from `SPEC-0009`:

- `public_catalog_sofas`;
- `public_catalog_tags`;
- `public_sofa_fabrics`;
- `public_sofa_visual_positions`;
- `public_sofa_render_cells`.

Add a small Supabase migration only if needed to expose a safe per-sofa public
tag mapping for public API assembly and tag filtering. The expected shape is a
view equivalent to:

- `sofa_id`;
- `slug`;
- `public_label`.

The view must include only published sofas and public tag fields, and it must be
granted to `anon` and `authenticated`.

The normal read path should use anonymous/public-safe views. A server-only
service-role lookup may be used only for the `410 SOFA_UNAVAILABLE`
classification, with a redacted response.

## Out Of Scope

This plan does not include:

- public home page implementation;
- `/catalog` page implementation;
- `/sofas/[slug]` page implementation;
- catalog card fabric preview UI;
- public shell/header/footer design;
- simulation wizard routes;
- email verification;
- visitor room photo upload;
- public simulation job creation, polling, dimensions, result, or regeneration;
- in-home simulation worker implementation;
- admin publication, unpublication, archive, or ZIP export workflows;
- Shopify theme changes;
- analytics and consent banner behavior;
- final legal/privacy wording.

Admin publication remains a parallel dependency for real non-empty public
catalog data. This plan may use focused test fixtures or local smoke seed data
that create public assets directly, but it must not implement admin publication
shortcuts.

## Architecture

Add a public catalog service layer in `apps/web` that keeps route handlers thin:

- request parsing and validation;
- cursor encoding and decoding;
- public asset URL shaping;
- public read store operations;
- response shaping and redaction;
- safe error mapping.

Public browser-facing code must not read Supabase tables directly and must not
receive service-role credentials. Raw Supabase table names and private storage
paths must not appear in visitor-visible errors.

## File Structure

Expected implementation files:

- Create: `apps/web/src/lib/public-catalog.ts`
  - Owns public catalog types, query parsing, cursor handling, response
    shaping, public asset URL generation, and store-facing operations.
- Create: `apps/web/src/lib/public-catalog.test.ts`
  - Tests validation, cursor behavior, tag filter handling, default selection,
    URL shaping, and redaction.
- Create: `apps/web/src/lib/public-catalog-route-handlers.ts`
  - Owns route-handler orchestration around the public catalog service.
- Create: `apps/web/src/lib/public-catalog-route-handlers.test.ts`
  - Tests route envelopes, public read behavior, error mapping, and redaction
    with fake stores.
- Create route files under:
  - `apps/web/src/app/api/public/catalog/route.ts`;
  - `apps/web/src/app/api/public/catalog/tags/route.ts`;
  - `apps/web/src/app/api/public/sofas/[public_slug]/route.ts`.
- Create a Supabase migration for a safe per-sofa public tag view if route
  implementation cannot assemble tags from existing public views without
  unsafe service-role reads.
- Create: `scripts/spec-0012-public-catalog-smoke.mjs`
  - Exercises the public read path against local Supabase and local web when
    available, and skips clearly when they are not running or no public fixture
    exists.
- Create: `scripts/spec-0012-public-catalog-smoke.test.mjs`
  - Tests smoke-script pass and skip behavior with mocked `fetch`.

## Tasks

- [x] Add failing unit tests for public catalog query parsing, cursor parsing,
      cursor serialization, and invalid query handling.
- [x] Add failing tests for public response shaping and redaction.
- [x] Add failing tests for stable public asset URL generation from public
      `catalog-public-assets` records.
- [x] Add failing route-handler tests for `GET /api/public/catalog/tags`.
- [x] Add failing route-handler tests for `GET /api/public/catalog` including
      tag `AND` filtering and cursor pagination.
- [x] Add failing route-handler tests for `GET /api/public/sofas/{public_slug}`
      including defaults, complete render matrix shaping, `404`, and `410`.
- [x] Add the safe per-sofa public tag view migration if needed.
- [x] Implement the public catalog service and store.
- [x] Implement the public route handlers.
- [x] Add the local public catalog smoke script and smoke-script tests.
- [x] Wire the smoke-script test into the root test workflow if it can skip
      cleanly without local services.
- [x] Update relevant roadmaps.
- [x] Run the narrowest relevant tests first, then broader checks.
- [x] Move this plan to `docs/plans/done` when verified.

## Tests

Add or update:

- `apps/web/src/lib/public-catalog.test.ts`;
- `apps/web/src/lib/public-catalog-route-handlers.test.ts`;
- `scripts/spec-0012-public-catalog-smoke.mjs`;
- `scripts/spec-0012-public-catalog-smoke.test.mjs`.

Expected checks:

- `pnpm --filter @mobel-unique/web test`;
- `pnpm --filter @mobel-unique/web typecheck`;
- `pnpm spec:check`;
- `pnpm test`;
- `pnpm typecheck`;
- `pnpm build`.

Optional local verification with local Supabase and web running:

- `pnpm supabase:reset`;
- `pnpm dev:web`;
- public catalog smoke command added by this plan.

If dependencies are not installed or local services are not running, the smoke
script must report that clearly instead of pretending the public path passed.

## Follow-Up Plan Sequence

The remaining public customer flow should be split into later plans:

1. Public storefront pages: replace the home placeholder and build `/catalog`
   and `/sofas/[slug]` against these public read endpoints.
2. Public simulation entry and email verification: implement
   `/sofas/[slug]/simulate`, email consent, verification request, verification
   code confirmation, and opaque token storage.
3. Public simulation job creation: upload room photo, create a verified
   simulation job, and navigate to `/simulations/[simulation_job_id]`.
4. Simulation status UI and dimensions: polling, awaiting-dimensions state,
   guide image display, dimension form, and dimension submission.
5. In-home simulation worker: stage-one room preparation, stage-two placement,
   private artifacts, queue handling, and signed result access.
6. Result, regeneration, and retention states: latest result display,
   regeneration limit, expired state, Shopify return, and catalog return.

## Roadmap

Update:

- `docs/roadmap/api.md`;
- `docs/roadmap/supabase.md`;
- `docs/roadmap/web.md`;
- `docs/roadmap/workflow.md`.

The roadmap updates for this plan must claim only the public read API
foundation. They must not claim public page implementation or simulation
completion.

## Notes

This plan exists because the current public frontend is still the repository
foundation placeholder and the public API route directory does not exist yet.

The most important boundary is data exposure. Public responses may expose
published public ids, slugs, labels, dimensions, public tags, Shopify URLs, and
stable public asset URLs. They must never expose private storage paths,
admin-only names, render candidate metadata, worker state, provider details, or
service-side credentials.
