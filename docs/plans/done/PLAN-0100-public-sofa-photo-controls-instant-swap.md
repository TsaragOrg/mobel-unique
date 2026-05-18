# PLAN-0100 Public Sofa Photo Controls Instant Swap

Plan: PLAN-0100
Spec: SPEC-0012
Related specs: SPEC-0004, SPEC-0010
Status: done
Owner area: web
Depends on: PLAN-0082, PLAN-0094, PLAN-0095, PLAN-0097
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Make the previous and next photo buttons on `/sofas/[slug]` feel as fast as
fabric switching by warming the currently selected fabric's other visual
position images before the visitor clicks a `sofa-photo-control-button`.

## Workflow Decision

No new spec or change request is required.

`SPEC-0012` already requires low-friction fabric and visual position selection
on the public sofa detail page. This plan changes only local image warmup and
visible-image swap timing. It does not change route behavior, public API
contracts, public catalog response shape, image URL selection, storage,
permissions, simulation context handoff, or Shopify behavior.

## Current Fabric Solution Found

The fast fabric switch pattern already exists in
`apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx` and mirrors the
catalog card behavior from `apps/web/src/app/catalog/PublicCatalogPage.tsx`.

The current pattern has two parts:

1. A `useEffect` creates `new Image()` objects, sets each medium render URL as
   `src`, then calls `decode()` so the browser downloads and prepares those
   images before the visitor needs them.
2. The visible sofa image stays on the previous displayed fabric and visual
   position until the selected medium render finishes `decode()`. Only then are
   `displayedFabricId` and `displayedVisualPositionId` updated.

For fabrics, the detail page currently preloads every fabric render for the
active visual position. That is why clicking a fabric swatch can reuse warmed
image bytes.

## Current Photo-Control Problem

The current sofa detail preload only warms this direction:

- same visual position;
- every fabric.

When the visitor clicks `Photo suivante` or `Photo précédente`, the page changes
to a different visual position. The matching image for the already selected
fabric has usually not been preloaded yet. The existing deferred swap still
prevents a white flash, but the first photo-control click waits for the new
medium image to download and decode.

The missing warmup direction is:

- same selected fabric;
- every visual position.

## Architecture

Keep the current displayed-image model and extend only the preload coverage in
`PublicSofaDetailPage`.

Replace the existing detail preload loop with a cross-shaped warmup:

- preload every render whose `visual_position_id` equals the selected visual
  position, preserving the current fast fabric switch behavior;
- also preload every render whose `fabric_id` equals the selected fabric, making
  previous and next photo controls reuse the same warmup approach;
- keep using `render_medium_url`, `new Image()`, and `decode()`;
- keep original-resolution viewer URLs out of preload scope;
- keep the deferred visible swap effect unchanged unless tests prove it must
  read from a renamed value.

This warms at most the active visual-position row plus the active fabric column,
not the whole sofa render matrix. For example, a sofa with 10 fabrics and 4
visual positions warms up to 13 medium images instead of 40.

## Expected File Structure

- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`
  - Update the existing preload `useEffect` around the selected detail image.
  - Preload the union of active visual-position renders and active-fabric
    visual-position renders.
  - Keep the current deferred swap effect, photo button handlers, image viewer,
    stale-selection handling, and simulation context behavior.
  - Update Russian and French `.tsx` comments near the changed automatic block.
    Keep them simple and avoid the forbidden words from `AGENTS.md`: `hook`,
    `state`, `props`, `render`, `component`, `callback`, `mount`.

- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
  - Add a failing regression that verifies the profile medium image for the
    default fabric is preloaded before clicking `Photo suivante`.
  - Keep the existing regression that verifies every fabric is preloaded for the
    active visual position.
  - Keep existing deferred-swap and viewer tests.

- Modify after implementation: `docs/roadmap/web.md`
  - Add the completed public sofa detail behavior.

## Tasks

- [ ] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type fix --area web --work "Public sofa photo controls instant swap" --spec SPEC-0012 --plan PLAN-0100
  ```

- [ ] Add the active-plan row to `docs/plans/active/README.md` if it is not
      already present:

  ```md
  | PLAN-0100 | SPEC-0012 | active | web | Public sofa detail photo controls preload the selected fabric's other visual positions before previous or next photo clicks, matching the fast fabric-switch image warmup pattern. |
  ```

- [ ] Add the failing photo-control preload regression in
      `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx` near
      `"preloads every fabric render for the active visual position"`:

  ```tsx
  it("preloads every visual position render for the active fabric before photo controls are used", async () => {
    mockDetailResponse();

    render(<PublicSofaDetailPage slug="canape-rivoli" />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });

    await waitFor(() => {
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/boucle-face-medium.jpg",
      );
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/boucle-profil-medium.jpg",
      );
    });
  });
  ```

  Expected before implementation: FAIL because the current preload loop only
  warms `boucle-face-medium.jpg` and `sauge-face-medium.jpg` on first load.

- [ ] Extend the same test to cover fabric changes after the first assertion
      passes. Add this block below the first `waitFor`:

  ```tsx
  fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));

  await waitFor(() => {
    expect(InstantImage.loaded).toContain(
      "https://assets.example/rivoli/sauge-face-medium.jpg",
    );
    expect(InstantImage.loaded).toContain(
      "https://assets.example/rivoli/sauge-profil-medium.jpg",
    );
  });
  ```

  Expected before implementation: FAIL for `sauge-profil-medium.jpg` because
  the profile image for the newly selected fabric is not warmed until a photo
  control is clicked.

- [ ] Run the focused sofa detail test and confirm the new regression fails:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  ```

  Expected before implementation: FAIL on the new preload regression only. If
  existing tests also fail, record the failing test names before editing code.

- [ ] Update the preload block in
      `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`.

  Replace the current `useEffect` that preloads all fabrics for
  `selectedVisualPositionId` with this union-based loop:

  ```tsx
  // RU: Заранее качаем и готовим картинки для выбранного вида и выбранной ткани, чтобы кнопки ткани и фото отвечали быстрее.
  // FR: On telecharge et prepare a l'avance les images de la vue choisie et du tissu choisi pour accelerer les boutons de tissu et de photo.
  useEffect(() => {
    if (!detail || !selectedFabricId || !selectedVisualPositionId) {
      return;
    }

    const preloadedUrls = new Set<string>();

    for (const render of detail.renders) {
      const isSelectedVisualPosition =
        render.visual_position_id === selectedVisualPositionId;
      const isSelectedFabric = render.fabric_id === selectedFabricId;

      if (!isSelectedVisualPosition && !isSelectedFabric) {
        continue;
      }

      if (!render.render_medium_url || preloadedUrls.has(render.render_medium_url)) {
        continue;
      }

      preloadedUrls.add(render.render_medium_url);

      const preloader = new Image();
      preloader.src = render.render_medium_url;
      preloader.decode().catch(() => {
        // RU: Ошибка ранней подготовки безопасна: видимая картинка повторит попытку при переключении.
        // FR: Une erreur de preparation reste sans risque: l'image visible reessayera lors du changement.
      });
    }
  }, [detail, selectedFabricId, selectedVisualPositionId]);
  ```

  Keep the deferred visible swap effect below it as-is.

- [ ] Re-run the focused sofa detail test:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  ```

  Expected after implementation: PASS.

- [ ] Run the narrow web checks for this change:

  ```powershell
  pnpm --filter @mobel-unique/web typecheck
  pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  ```

  Expected: PASS.

- [ ] Run the broader web checks before completion:

  ```powershell
  pnpm --filter @mobel-unique/web test
  pnpm spec:check
  ```

  Expected: PASS.

- [ ] Update `docs/roadmap/web.md` after implementation and verification. Add
      a `Done` entry near the existing public sofa detail rows:

  ```md
  | Done | SPEC-0012 | PLAN-0100 | Public sofa detail photo controls now preload the selected fabric's other visual-position medium images before previous or next photo clicks, so photo navigation uses the same warmed-image path as fabric switching while the existing deferred visible swap still prevents white flashes. |
  ```

- [ ] Run local browser QA:

  ```powershell
  pnpm dev:web
  ```

  In a desktop browser:

  - open `http://127.0.0.1:3000/sofas/{published-slug}`;
  - use Network throttling such as Slow 4G;
  - wait for the initial sofa detail image to settle;
  - click `Photo suivante` and `Photo précédente`;
  - confirm the visible sofa image changes with the same perceived speed as
    clicking fabric swatches and does not flash white;
  - switch to another fabric, then repeat the photo-control clicks;
  - open the large image viewer and confirm it still uses the selected
    original-resolution image only on demand.

- [ ] Move this plan to `docs/plans/done` after implementation, roadmap update,
      automated checks, and browser QA are complete. Add a closure note listing
      the commands and manual scenarios that actually passed.

## Tests

Required focused checks:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
pnpm --filter @mobel-unique/web typecheck
```

Required broader checks before completion:

```powershell
pnpm --filter @mobel-unique/web test
pnpm spec:check
```

Manual browser check:

```powershell
pnpm dev:web
```

Then test photo controls and fabric swatches on a published sofa detail page
under throttled network conditions.

## Roadmap

Update after implementation:

- `docs/roadmap/web.md`

The roadmap entry should claim only the sofa detail photo-control preload
behavior. Do not claim API latency, image byte reduction, or production metric
improvement unless those measurements are captured separately.

## Notes

- This plan intentionally keeps the existing deferred image swap. The issue is
  missing preload coverage for the selected fabric's other visual positions,
  not the visible swap mechanism.
- Do not preload `render_original_url`. The full-screen viewer remains an
  explicit visitor action.
- Do not change public API shapes or storage paths.
- Do not introduce a shared image-preload helper yet. The change is one focused
  loop in the sofa detail page.
- Keep visible public copy in French and repository-authored plan text in
  English.

## Closure Note

Completed on 2026-05-18.

Automated checks:

- `pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
  failed before implementation on the new preload regression because
  `boucle-profil-medium.jpg` was not preloaded before photo controls were used.
- `pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
  passed after implementation with 12 tests passing.
- `pnpm --filter @mobel-unique/web typecheck` passed.
- `pnpm --filter @mobel-unique/web test` passed with 55 test files passing,
  554 tests passing, and 1 skipped test.
- `pnpm spec:check` passed after the roadmap update.

Manual browser QA:

- Ran the web app with `pnpm --filter @mobel-unique/web dev -p 3002 -H
  127.0.0.1` because ports 3000 and 3001 were already in use.
- Opened `http://127.0.0.1:3002/sofas/divan2` in Chrome DevTools with Slow 4G
  network throttling.
- Confirmed the initial page loaded 5 unique medium image URLs: the selected
  fabric's 3 visual positions plus the active visual-position row for the
  other fabrics. No original-resolution sofa image URL was requested before the
  large viewer opened.
- Clicked `Photo suivante` and `Photo precedente` for the default `white`
  fabric. The visible image changed to photo 2 and back to photo 1 after the
  warmed image was ready, with the previous image still visible immediately
  after each click.
- Switched to the `blue` fabric, waited for the selected fabric's other visual
  positions to warm, then repeated `Photo suivante` and `Photo precedente`.
  The visible image changed quickly and stayed nonblank during the clicks.
- Opened the large image viewer after selecting `blue`. The viewer used the
  selected original-resolution image only after the viewer action; the loaded
  viewer image completed with natural width 1536.
