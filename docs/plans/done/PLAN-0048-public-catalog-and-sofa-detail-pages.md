# PLAN-0048 Public Catalog And Sofa Detail Pages

Plan: PLAN-0048
Spec: SPEC-0012
Status: done
Owner area: web
Depends on: SPEC-0004, SPEC-0009, SPEC-0010, SPEC-0012, PLAN-0024, PLAN-0043
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Build the public catalog storefront on top of the existing public read API so
visitors can browse the published sofas currently available in DEV, filter them
by public tags, preview public fabric options where available, open a sofa
detail page, choose fabric and visual position, and continue toward the future
simulation wizard.

The implementation must preserve the current public homepage visual direction:
minimal MÖBEL UNIQUE brand presence, white paper background, black primary
actions, light typography, restrained dividers, product-first imagery, and
mobile-first composition. The catalog must feel like the natural next page after
the transformation hero, not like a generic ecommerce grid.

## Scope

### Public Catalog `/catalog`

Implement an indexable public catalog page that uses:

- `GET /api/public/catalog`;
- `GET /api/public/catalog/tags`.

The page must show:

- a public shell consistent with the home page header/footer style;
- a French catalog heading and short simulation-first context;
- dynamically generated tag filters only when public tags exist;
- published sofa cards from the API;
- default render imagery, public name, compact metadata, up to three public tags,
  and a simulation-oriented action;
- loading, empty, no-results, data-load failure, retry, and broken-image
  placeholder states;
- cursor-based `Charger plus` pagination that appends items without replacing
  existing cards.

Catalog filters must use `AND` behavior through repeated `tag` query
parameters, reset pagination when changed, preserve browser back-button
behavior, and ignore stale or unknown tag slugs safely.

### Catalog Fabric Preview

Catalog cards must support a simple fabric preview without expanding the public
catalog API contract unless implementation proves an additive API change is
needed.

Preferred approach:

- render the catalog list from `GET /api/public/catalog`;
- lazy-load `GET /api/public/sofas/{public_slug}` for a card only when fabric
  preview controls are needed or activated;
- show only public fabrics returned by the sofa detail endpoint;
- use a stable visible swatch limit per breakpoint and a `+N` indicator for
  hidden fabrics;
- swap only the active card image to the selected fabric's default visual
  position render;
- store preview state locally per card;
- persist the selected fabric for internal catalog-to-detail navigation with
  session-scoped client state, not public URL parameters, so direct and Shopify
  entries still use default selections.

### Sofa Detail `/sofas/[slug]`

Implement an indexable public sofa detail page that uses:

- `GET /api/public/sofas/{public_slug}`.

The page must show:

- public sofa name;
- selected public render;
- fabric selector;
- visual position selector;
- primary simulation CTA pointing to `/sofas/[slug]/simulate` with selected
  context preserved through implementation-approved state;
- secondary Shopify order action only when a valid Shopify URL exists;
- public description, dimensions in centimeters, and all public tags when
  present;
- AI limitation and simulation expectation copy in French;
- path back to `/catalog`.

Default entry from direct URLs and Shopify links must use the first public fabric
and first public visual position returned by the API. Internal catalog entry may
reuse a valid session-scoped previewed fabric. Stale fabric or visual position
state must block simulation launch and offer a valid selection or return path.

### Out Of Scope

This plan does not include:

- simulation wizard implementation;
- email verification;
- room photo upload;
- simulation job creation or polling;
- result display or regeneration;
- public catalog API contract changes unless fabric preview cannot be completed
  safely with the existing detail endpoint;
- admin catalog changes;
- Shopify theme changes;
- analytics and consent integration;
- final legal or privacy pages.

## Information Architecture

The public route structure for this plan is:

- Home `/`
  - Catalog `/catalog`
    - Sofa detail `/sofas/[slug]`
      - Future simulation wizard `/sofas/[slug]/simulate`

Primary navigation remains intentionally small:

- brand link to `/`;
- catalog link to `/catalog`;
- no cart, checkout, account, price, stock, or admin navigation.

The catalog is the main browsing surface. Sofa detail is the decision surface
where full fabric and visual position selection happens. The future simulation
wizard remains downstream and private/noindex.

## Design Direction

Use the home page as the visual source of truth:

- white background and black text/action foundation;
- light Helvetica/Avenir-like typography already used by `.home-shell`;
- restrained lines instead of decorative cards or gradients;
- product images as the primary visual weight;
- black filled primary CTA, quiet secondary links;
- mobile-first stacking with comfortable touch targets;
- stable aspect ratios for cards, images, swatches, and sticky actions;
- no nested cards, floating decorative sections, price/stock badges, or
  ecommerce-heavy controls.

Catalog cards may use a light bordered product tile, but the page itself should
remain unframed and editorial like the homepage. Detail selection controls must
make selected state visible without relying on color alone.

## Implementation Sequence

1. Create the feature branch with:
   `pnpm branch:create -- --type feature --area web --work "Public catalog storefront" --spec SPEC-0012 --plan PLAN-0048`.
2. Add failing tests for the `/catalog` page shell, French copy, API loading,
   empty/error states, hidden filters when no tags exist, tag `AND` query
   behavior, and load-more append behavior.
3. Implement the minimal public shell reuse or shared public layout needed by
   `/`, `/catalog`, and `/sofas/[slug]` without changing admin styling.
4. Implement `/catalog` data loading against the public API routes with safe
   loading, retry, empty, no-results, and broken-image states.
5. Add failing tests for catalog fabric preview: lazy detail fetch, visible
   swatch limit, `+N` indicator, card-local image swap, and no incomplete fabric
   exposure.
6. Implement fabric preview with session-scoped internal selection preservation.
7. Add failing tests for `/sofas/[slug]`: default selections, internal previewed
   fabric restoration, fabric changes preserving visual position, visual
   position changes preserving fabric, stale selection blocking simulation, and
   404/410 safe states.
8. Implement `/sofas/[slug]` detail UI, selection state, sticky mobile
   simulation CTA, Shopify secondary action, dimensions, tags, and French safe
   messages.
9. Add metadata/noindex checks where relevant: `/catalog` indexable, published
   sofa detail indexable, unavailable/detail error states safe and not leaking
   private details.
10. Update `docs/roadmap/web.md`.
11. Run narrow web tests first, then typecheck and spec guard.
12. Run local browser QA against DEV/local data at mobile and desktop widths.
13. Move this plan to `docs/plans/done` after verification.

## Tests

Add or update:

- `apps/web/src/app/catalog/page.test.tsx`;
- `apps/web/src/app/catalog/PublicCatalogPage.test.tsx` if a client component is
  introduced;
- `apps/web/src/app/sofas/[slug]/page.test.tsx`;
- `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx` if a client
  component is introduced;
- shared public shell tests if shell markup is extracted from the home page;
- existing home page tests only if shell extraction changes visible home
  behavior.

Required behavior coverage:

- catalog renders published sofas from the public API;
- filter controls hide when no public tags exist;
- multiple filters use `AND` query behavior;
- no-results state includes a clear reset action;
- `Charger plus` appears when `next_cursor` is present;
- load-more appends cards without replacing existing cards;
- load-more failure keeps existing cards visible and offers retry;
- changing or clearing filters resets pagination;
- duplicate cards do not appear across overlapping pages or retries;
- catalog fabric preview lazy-loads public sofa detail data safely;
- fabric preview uses a stable visible limit and remaining-count indicator;
- fabric preview updates only the selected card image;
- catalog-to-detail navigation preserves previewed fabric only through
  session-scoped internal state;
- direct sofa detail entry uses default fabric and visual position;
- sofa detail fabric change preserves selected visual position;
- sofa detail visual position change preserves selected fabric;
- stale selections block simulation and show a French safe message;
- unavailable sofa states do not reveal draft, archived, unpublished, or
  incomplete status;
- public UI copy is French and does not expose admin/private storage details.

Expected checks:

- `pnpm --filter @mobel-unique/web test -- src/app/catalog/page.test.tsx`;
- `pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/page.test.tsx`;
- `pnpm --filter @mobel-unique/web test`;
- `pnpm --filter @mobel-unique/web typecheck`;
- `pnpm spec:check`;
- `pnpm test`;
- `pnpm typecheck`;
- `pnpm build`.

If dependencies or local services are unavailable, the implementation notes must
state that clearly instead of claiming the checks passed.

## Roadmap

Update:

- `docs/roadmap/web.md`

The roadmap update should claim only public catalog and public sofa detail page
implementation. Simulation wizard work stays in its own plan.

## Notes

- `PLAN-0024` already delivered safe public read endpoints, so this plan should
  not read Supabase tables directly from browser-facing code.
- There are currently three published sofas in DEV, which is enough to verify
  the real catalog page without fake public data.
- Use public API responses exactly as shaped today: public names, public slugs,
  public dimensions, public tags, stable public asset URLs, default fabric id,
  default visual position id, and Shopify URL.
- Do not display prices, stock, cart, checkout, customer account UI, admin links,
  private IDs beyond accepted public response IDs, storage paths, provider
  metadata, worker status, stack traces, or service configuration.
- If catalog fabric preview proves too expensive with lazy detail fetches, write
  an explicit additive public API change request before expanding the catalog
  endpoint response shape.

## Implementation Notes

Completed on the feature branch
`feature/web/spec-0012-plan-0045-public-catalog-storefront`.

Verification completed:

- `pnpm --filter @mobel-unique/web test`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Local browser QA completed against `http://localhost:3002` with local public
catalog data at desktop and mobile widths. The browser QA covered catalog
loading, tag filter URL state, fabric preview image swapping, internal
catalog-to-detail fabric restoration, detail selectors, dimensions, tags,
Shopify secondary action, and the simulation CTA path.
