# PLAN-0087 Public Catalog Detail CLS Skeletons

Plan: PLAN-0087
Spec: SPEC-0012
Related specs: SPEC-0004, SPEC-0009, SPEC-0010
Status: active
Owner area: web
Depends on: PLAN-0048, PLAN-0067, PLAN-0082, PLAN-0083, PLAN-0084, PLAN-0086
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Reduce the measured layout shift on `/catalog` and `/sofas/[slug]` by replacing
the generic 150 px loading panel with skeleton layouts that reserve space close
to the final catalog cards and sofa detail hero area.

## Workflow Decision

No new spec or change request is required.

`SPEC-0012` already requires loading states for the public catalog and sofa
detail pages. This plan changes the visual shape of those loading states only.
It does not change route behavior, public API contracts, data model, storage,
permissions, public copy intent, or simulation flow.

The performance evidence comes from `performance-audit/report.md`:

- production `/catalog` desktop CLS `0.150`;
- production `/catalog` mobile CLS `0.153`;
- production `/sofas/eva-ll` mobile CLS `0.160`;
- current loading UI uses `.public-status-panel` with `min-height: 150px`,
  then swaps to much taller catalog/detail content.

## Current Problem

The current loading branches in these files show a short status panel:

- `apps/web/src/app/catalog/PublicCatalogPage.tsx`
- `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`

The shared style at `apps/web/src/app/globals.css` uses:

```css
.public-status-panel {
  min-height: 150px;
}
```

After data loads, the page replaces that small block with:

- a multi-card catalog grid where each card has a `4 / 3` image area plus card
  controls;
- a sofa detail two-column hero where the media area is square on desktop and
  `4 / 3` on mobile.

That replacement is the likely source of the `0.15` to `0.16` CLS observed in
production traces.

## Architecture

Keep the current data loading flow and API calls. Only change the loading UI.

Catalog loading should render a grid skeleton using the same outer catalog grid
and card structure as real catalog cards. The skeleton should reserve image,
title, metadata, tag, fabric swatch, and action areas for the first visible
cards.

Sofa detail loading should render a detail skeleton using the same outer
`.sofa-detail`, `.sofa-detail-media`, `.sofa-detail-image`, and
`.sofa-detail-copy` structure as the ready detail page. The skeleton should
reserve the hero image, heading, selector, action, info, and note areas.

Use CSS-only placeholder blocks. Do not add dependencies. Do not use external
images. Keep skeleton motion static or very subtle and respect reduced-motion.

## Expected File Structure

- Modify: `apps/web/src/app/catalog/PublicCatalogPage.tsx`
  - Add a catalog loading skeleton branch.
  - Keep the existing error, empty, no-results, grid, and load-more behavior.
  - Add or update required `.tsx` comments in Russian and French.
- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`
  - Add a sofa detail loading skeleton branch for `idle` and `loading`.
  - Keep the existing ready, error, unavailable, image viewer, and selection
    behavior.
  - Add or update required `.tsx` comments in Russian and French.
- Modify: `apps/web/src/app/globals.css`
  - Add shared skeleton block styles.
  - Add catalog skeleton card styles.
  - Add sofa detail skeleton styles.
  - Add responsive styles matching existing catalog/detail breakpoints.
- Modify: `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`
  - Add a focused loading skeleton regression.
- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
  - Add a focused loading skeleton regression.
- Modify: `apps/web/src/app/globals.test.ts`
  - Add CSS source regressions for stable catalog/detail skeleton geometry.
- Modify after implementation: `docs/roadmap/web.md`
  - Add the completed web behavior.
- Modify after implementation: `docs/roadmap/workflow.md`
  - Track performance-audit priority 6 against this plan.

## Tasks

- [x] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type fix --area web --work "Public catalog detail CLS skeletons" --spec SPEC-0012 --plan PLAN-0087
  ```

- [x] Add the catalog loading skeleton regression in
  `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`.

  Add a test near the other `PublicCatalogPage` tests:

  ```tsx
  it("uses a catalog-card shaped skeleton while the first catalog page loads", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const { container } = render(<PublicCatalogPage />);

    expect(
      screen.getByRole("region", { name: "Chargement du catalogue" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".public-status-panel")).toBeNull();
    expect(container.querySelectorAll(".catalog-card-skeleton")).toHaveLength(6);
    expect(
      container.querySelectorAll(
        ".catalog-card-skeleton .catalog-card-image",
      ),
    ).toHaveLength(6);
    expect(
      container.querySelectorAll(".catalog-card-skeleton .catalog-card-body"),
    ).toHaveLength(6);
  });
  ```

- [x] Run the catalog page test and confirm it fails before implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
  ```

  Expected before implementation: FAIL because the loading branch still renders
  `.public-status-panel` and no `.catalog-card-skeleton` elements.

- [x] Add the sofa detail loading skeleton regression in
  `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`.

  Add a test near the first direct-entry test:

  ```tsx
  it("uses a detail-hero shaped skeleton while the sofa detail loads", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const { container } = render(<PublicSofaDetailPage slug="canape-rivoli" />);

    expect(
      screen.getByRole("article", { name: "Chargement du canape" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".public-status-panel")).toBeNull();
    expect(container.querySelector(".sofa-detail-skeleton")).toBeInTheDocument();
    expect(
      container.querySelector(".sofa-detail-skeleton .sofa-detail-image"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".sofa-detail-skeleton .sofa-detail-copy"),
    ).toBeInTheDocument();
  });
  ```

- [x] Run the sofa detail test and confirm it fails before implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  ```

  Expected before implementation: FAIL because the loading branch still renders
  `.public-status-panel` and no `.sofa-detail-skeleton`.

- [x] Add CSS source regressions in `apps/web/src/app/globals.test.ts`.

  Add one test for catalog skeleton geometry:

  ```ts
  it("keeps catalog loading skeletons aligned to the real card grid", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");

    expect(css).toContain(".catalog-skeleton-grid");
    expect(css).toContain(".catalog-card-skeleton");
    expect(css).toContain(".catalog-card-skeleton .catalog-card-image");
    expect(css).toContain(".catalog-skeleton-action");
    expect(css).toContain(`@media (max-width: 1040px) {
  .catalog-grid {`);
    expect(css).toContain(`@media (max-width: 680px) {
  .public-header {`);
  });
  ```

  Add one test for sofa detail skeleton geometry:

  ```ts
  it("keeps sofa detail loading skeletons aligned to the real hero layout", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\r\n/g, "\n");

    expect(css).toContain(".sofa-detail-skeleton");
    expect(css).toContain(".sofa-detail-skeleton .sofa-detail-image");
    expect(css).toContain(".sofa-detail-skeleton .sofa-detail-copy");
    expect(css).toContain(".sofa-detail-skeleton-actions");
    expect(css).toContain(".sofa-detail-skeleton-info");
  });
  ```

- [x] Run the CSS source test and confirm it fails before implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/globals.test.ts
  ```

  Expected before implementation: FAIL because the skeleton selectors do not
  exist yet.

- [x] Implement the catalog skeleton in
  `apps/web/src/app/catalog/PublicCatalogPage.tsx`.

  Add a skeleton count near the other catalog constants:

  ```ts
  const CATALOG_SKELETON_CARD_COUNT = 6;
  ```

  Replace the `status === "loading"` branch with:

  ```tsx
  {status === "loading" ? <CatalogLoadingSkeleton /> : null}
  ```

  Add this helper in the same file:

  ```tsx
  function CatalogLoadingSkeleton() {
    return (
      <section
        aria-busy="true"
        aria-label="Chargement du catalogue"
        aria-live="polite"
        className="catalog-grid catalog-skeleton-grid"
      >
        {Array.from({ length: CATALOG_SKELETON_CARD_COUNT }, (_, index) => (
          <article
            aria-hidden="true"
            className="catalog-card catalog-card-skeleton"
            key={index}
          >
            <div className="catalog-card-image catalog-skeleton-block" />
            <div className="catalog-card-body">
              <span className="catalog-skeleton-line catalog-skeleton-title" />
              <span className="catalog-skeleton-line catalog-skeleton-meta" />
              <span className="catalog-skeleton-chip-row" />
              <span className="catalog-skeleton-swatch-row" />
              <span className="catalog-skeleton-action" />
            </div>
          </article>
        ))}
      </section>
    );
  }
  ```

  Add or update nearby Russian and French comments as required by `AGENTS.md`.
  Keep the comments simple and do not use these forbidden words: `hook`,
  `state`, `props`, `render`, `component`, `callback`, `mount`.

- [x] Implement the sofa detail skeleton in
  `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`.

  Replace the `status === "loading" || status === "idle"` branch with:

  ```tsx
  {status === "loading" || status === "idle" ? <SofaDetailLoadingSkeleton /> : null}
  ```

  Add this helper in the same file:

  ```tsx
  function SofaDetailLoadingSkeleton() {
    return (
      <article
        aria-busy="true"
        aria-label="Chargement du canape"
        aria-live="polite"
        className="sofa-detail sofa-detail-skeleton"
      >
        <section className="sofa-detail-media" aria-hidden="true">
          <div className="sofa-detail-image catalog-skeleton-block" />
        </section>
        <section className="sofa-detail-copy" aria-hidden="true">
          <div className="sofa-detail-skeleton-heading">
            <span className="catalog-skeleton-line sofa-detail-skeleton-eyebrow" />
            <span className="catalog-skeleton-line sofa-detail-skeleton-title" />
            <span className="catalog-skeleton-line sofa-detail-skeleton-description" />
          </div>
          <div className="sofa-detail-skeleton-selector">
            <span className="catalog-skeleton-line sofa-detail-skeleton-label" />
            <span className="sofa-detail-skeleton-choice-row" />
            <span className="catalog-skeleton-line sofa-detail-skeleton-label" />
            <span className="sofa-detail-skeleton-view-row" />
          </div>
          <div className="sofa-detail-skeleton-actions">
            <span />
            <span />
          </div>
          <div className="sofa-detail-skeleton-info">
            <span />
            <span />
          </div>
          <span className="catalog-skeleton-line sofa-detail-skeleton-note" />
        </section>
      </article>
    );
  }
  ```

  Add or update nearby Russian and French comments as required by `AGENTS.md`.
  Keep the comments simple and do not use the forbidden words listed above.

- [x] Add shared skeleton CSS in `apps/web/src/app/globals.css` near the public
  catalog/detail styles.

  Use this structure and adjust only if the final CSS tests require exact
  formatting changes:

  ```css
  .catalog-skeleton-grid {
    border-bottom: 1px solid var(--public-line);
  }

  .catalog-card-skeleton {
    pointer-events: none;
  }

  .catalog-skeleton-block,
  .catalog-skeleton-line,
  .catalog-skeleton-chip-row,
  .catalog-skeleton-swatch-row,
  .catalog-skeleton-action,
  .sofa-detail-skeleton-actions span,
  .sofa-detail-skeleton-info span,
  .sofa-detail-skeleton-choice-row,
  .sofa-detail-skeleton-view-row {
    background: linear-gradient(90deg, #eeeeeb, #f8f8f6, #eeeeeb);
    background-size: 220% 100%;
  }

  .catalog-skeleton-line,
  .catalog-skeleton-chip-row,
  .catalog-skeleton-swatch-row,
  .catalog-skeleton-action,
  .sofa-detail-skeleton-actions span,
  .sofa-detail-skeleton-info span,
  .sofa-detail-skeleton-choice-row,
  .sofa-detail-skeleton-view-row {
    display: block;
  }

  .catalog-card-skeleton .catalog-card-image {
    background: #f4f4f1;
  }

  .catalog-skeleton-title {
    height: 24px;
    width: 72%;
  }

  .catalog-skeleton-meta {
    height: 16px;
    width: 56%;
  }

  .catalog-skeleton-chip-row {
    height: 30px;
    width: 86%;
  }

  .catalog-skeleton-swatch-row {
    height: 46px;
    justify-self: center;
    width: 214px;
  }

  .catalog-skeleton-action {
    height: 54px;
    justify-self: center;
    width: min(220px, 76%);
  }

  .sofa-detail-skeleton {
    pointer-events: none;
  }

  .sofa-detail-skeleton .sofa-detail-image {
    background: #f4f4f1;
  }

  .sofa-detail-skeleton-heading,
  .sofa-detail-skeleton-selector {
    display: grid;
    gap: 14px;
  }

  .sofa-detail-skeleton-eyebrow {
    height: 14px;
    width: 112px;
  }

  .sofa-detail-skeleton-title {
    height: clamp(42px, 5vw, 68px);
    width: min(520px, 88%);
  }

  .sofa-detail-skeleton-description {
    height: 18px;
    width: min(620px, 100%);
  }

  .sofa-detail-skeleton-label {
    height: 18px;
    width: 74px;
  }

  .sofa-detail-skeleton-choice-row {
    height: 46px;
    width: min(520px, 100%);
  }

  .sofa-detail-skeleton-view-row {
    height: 46px;
    width: min(340px, 100%);
  }

  .sofa-detail-skeleton-actions {
    display: grid;
    gap: 10px;
    grid-template-columns: 1fr 1fr;
  }

  .sofa-detail-skeleton-actions span {
    height: 50px;
  }

  .sofa-detail-skeleton-info {
    border-top: 1px solid var(--public-line);
    display: grid;
    gap: 24px;
    grid-template-columns: 1fr 1fr;
    padding-top: 24px;
  }

  .sofa-detail-skeleton-info span {
    height: 76px;
  }

  .sofa-detail-skeleton-note {
    height: 42px;
    width: 100%;
  }

  @media (prefers-reduced-motion: no-preference) {
    .catalog-skeleton-block,
    .catalog-skeleton-line,
    .catalog-skeleton-chip-row,
    .catalog-skeleton-swatch-row,
    .catalog-skeleton-action,
    .sofa-detail-skeleton-actions span,
    .sofa-detail-skeleton-info span,
    .sofa-detail-skeleton-choice-row,
    .sofa-detail-skeleton-view-row {
      animation: public-skeleton-sheen 1.6s ease-in-out infinite;
    }
  }

  @keyframes public-skeleton-sheen {
    0% {
      background-position: 100% 0;
    }

    100% {
      background-position: -100% 0;
    }
  }
  ```

- [x] Add responsive skeleton CSS inside the existing `@media (max-width:
  680px)` block:

  ```css
  .sofa-detail-skeleton-actions,
  .sofa-detail-skeleton-info {
    grid-template-columns: 1fr;
  }

  .catalog-skeleton-swatch-row {
    width: min(214px, 100%);
  }
  ```

- [x] Run the three focused tests after implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
  pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  pnpm --filter @mobel-unique/web test -- src/app/globals.test.ts
  ```

  Expected after implementation: PASS.

- [x] Run the combined focused test command:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx src/app/globals.test.ts
  ```

  Expected: PASS.

- [x] Run package verification:

  ```powershell
  pnpm --filter @mobel-unique/web typecheck
  pnpm --filter @mobel-unique/web test
  ```

  Expected: PASS.

- [x] Update roadmaps after implementation and verification:

  - `docs/roadmap/web.md`
  - `docs/roadmap/workflow.md`

  Web roadmap entry:

  ```md
  Public catalog and sofa detail loading states now reserve card and hero-shaped skeleton space, reducing the layout shift caused by replacing the old 150 px loading panel with full catalog/detail content.
  ```

  Workflow roadmap entry:

  ```md
  Performance-audit priority 6 is tracked by PLAN-0087 without a new spec or change request because SPEC-0012 already requires public catalog and sofa detail loading states; the implementation replaces the short generic loading panel with card and hero-shaped skeletons.
  ```

- [x] Run repository guardrails:

  ```powershell
  pnpm spec:check
  pnpm typecheck
  pnpm test
  ```

  Expected: PASS.

- [x] Run local browser QA:

  ```powershell
  pnpm dev:web
  ```

  In Chrome DevTools, throttle the API by adding a temporary breakpoint or
  network throttling and inspect:

  - `http://127.0.0.1:3000/catalog`
  - `http://127.0.0.1:3000/sofas/{published-slug}`

  Expected:

  - catalog loading shows multiple card-shaped placeholders before cards;
  - sofa detail loading shows the hero/image and selector-shaped placeholders;
  - no large jump from a 150 px panel to the final layout is visible;
  - error, empty, no-results, and unavailable states still use safe French copy.

- [ ] After deploy or preview availability, re-run the production public traces
  from `performance-audit` for `/catalog` and `/sofas/eva-ll`.

  Expected:

  - `/catalog` desktop and mobile CLS are lower than the previous `0.150` and
    `0.153` captures;
  - `/sofas/eva-ll` mobile CLS is lower than the previous `0.160` capture;
  - target threshold is CLS below `0.10`; below `0.05` is preferred if the data
    and image timings allow it.

- [ ] Move this plan to `docs/plans/done` only after implementation, roadmap
  updates, focused tests, broader checks, and browser verification are complete.
  Add a closure note listing the commands and trace checks that actually passed.

## Tests

Required focused checks:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
pnpm --filter @mobel-unique/web test -- src/app/globals.test.ts
```

Required combined checks:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx src/app/globals.test.ts
pnpm --filter @mobel-unique/web typecheck
pnpm --filter @mobel-unique/web test
pnpm spec:check
pnpm typecheck
pnpm test
```

Manual browser checks:

```powershell
pnpm dev:web
```

Then inspect `/catalog` and `/sofas/{published-slug}` under delayed API
conditions.

## Roadmap

Update these files after implementation:

- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

The roadmap entries should claim only the loading skeleton and CLS behavior.
Do not claim image byte reduction, API latency reduction, or production CLS
improvement until those traces are actually re-run.

## Progress

Implementation progress on 2026-05-12:

- Created the workflow branch with `--allow-dirty` because the plan and active
  README were already dirty before implementation.
- Confirmed the three new focused regressions failed before implementation.
- Implemented catalog and sofa detail loading skeletons with CSS-only
  placeholders and responsive rules.
- Updated `docs/roadmap/web.md` and `docs/roadmap/workflow.md`.
- Passed focused checks, package checks, `pnpm spec:check`, `pnpm typecheck`,
  and `pnpm test`.
- Ran local browser QA on `http://127.0.0.1:3004` with delayed API fetches for
  `/catalog` and `/sofas/mobel-local-published-complete`.

Still pending before moving this plan to `docs/plans/done`:

- Re-run preview or production traces when a deploy or preview is available.
- Add the final closure note with the trace results that actually passed.

## Notes

- Do not change public API requests in this plan.
- Do not change image URL selection in this plan; that was handled by prior
  image-delivery plans.
- Keep `.public-status-panel` for error, empty, no-results, and unavailable
  states. Only the initial loading states need the skeleton replacement.
- Keep public visible copy in French.
- Keep repository-authored plan and roadmap text in English.
- If dependencies are missing during implementation, record that clearly in the
  closure note instead of claiming checks passed.
