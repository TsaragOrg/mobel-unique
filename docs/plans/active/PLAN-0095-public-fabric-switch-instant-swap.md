# PLAN-0095 Public Fabric Switch Instant Swap

Plan: PLAN-0095
Spec: SPEC-0012
Related specs: SPEC-0004, SPEC-0010
Status: active
Owner area: web
Depends on: PLAN-0082, PLAN-0083, PLAN-0084, PLAN-0086, PLAN-0094
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Make public fabric switching feel instant by preloading every fabric render
variant for the visible card or detail position, and by keeping the previously
displayed render image visible until the next image is fully decoded.

Together these two changes:

- Eliminate the white flash that desktop browsers show on `/catalog` and
  `/sofas/[slug]` when the bound `<img>` `src` changes and the previous bitmap
  is dropped before the next bitmap arrives.
- Eliminate the perceived first-switch network delay by warming the browser
  HTTP cache through hidden image preloaders so subsequent fabric switches are
  served from cache.

## Workflow Decision

No new spec or change request is required.

`SPEC-0012` already requires correct, low-friction public fabric and visual
position selection on `/catalog` and `/sofas/[slug]`. This plan changes the
local image swap behavior only. It does not change route behavior, public API
contracts, public catalog response shape, image URL selection, data model,
storage, signed URL rules, or simulation flow.

The performance evidence comes from production at
`https://mobel-unique-web.vercel.app/`:

- on a desktop browser, switching a fabric in a catalog card or on the sofa
  detail page paints a brief white area where the previous render disappears
  immediately and the new render only appears after the network fetch
  completes;
- on a mobile browser, the same interaction shows a perceptible delay but no
  white flash because Safari and recent mobile Chromium browsers keep the
  previous decoded image visible until the new one is ready.

PLAN-0094 already made public catalog image objects long-cacheable, so the
bytes for already-loaded variants stay reusable. This plan turns that cache
into a no-flash, no-delay user experience.

## Current Problem

In `apps/web/src/app/catalog/PublicCatalogPage.tsx`, the catalog card renders
one `<img>` whose `src` is bound directly to `activeRenderUrl`:

```tsx
const activeRenderUrl =
  selectedFabric?.render_medium_url ?? item.default_render_medium_url;
// ...
<img
  alt={item.public_name}
  decoding="async"
  loading="lazy"
  onError={() => setImageFailed(true)}
  src={activeRenderUrl}
/>
```

When the visitor clicks a non-default fabric swatch:

- `setSelectedFabricId` updates state synchronously.
- React re-renders with the new `src`.
- The browser empties the `<img>` content and starts the network request for
  the new render.
- On desktop browsers the empty `<img>` paints the underlying card background,
  which is `--public-paper: #ffffff`, so the visitor sees a white flash for
  the duration of the network fetch.

Other fabric variants for the card are never preloaded, so every first-time
switch is gated by a network round trip even when bandwidth is available
during initial page load.

The same single-`<img>` swap pattern is used in
`apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx` for
`selectedRenderPreviewUrl`, with the same result for fabric switches and
visual position switches.

## Architecture

Apply the same two-step pattern in both pages:

1. **Preload variant images.** When a card mounts (catalog) or when the
   detail data and current visual position are available (sofa detail),
   create hidden `Image` instances for the relevant render URLs so the
   browser fetches them into its HTTP cache eagerly.

   - Catalog cards preload every fabric `render_medium_url` for that card.
   - Sofa detail preloads, for the currently selected visual position only,
     the `render_medium_url` of every render in `detail.renders` whose
     `visual_position_id` matches the currently selected visual position.
     Switching visual position triggers a fresh preload pass for that new
     position.
   - Original-resolution viewer images (`render_original_url`) are not
     preloaded. The viewer is opened on demand and is acceptable to fetch
     then.

2. **Defer the visible swap until the next render is decoded.** The visible
   `<img>` stays bound to a "displayed" identifier that only updates once a
   hidden preloader for the next render reports `onload`. While the load is
   in flight, the visible `<img>` keeps showing the previous render. On
   preloader `onerror`, swap immediately so the visible `<img>`'s own
   `onError` handler can run and reveal the existing "Image indisponible"
   fallback.

   - Catalog cards track a `displayedRenderUrl` value. The visible `<img>`'s
     `src` is bound to this displayed URL. The card's existing `imageFailed`
     fallback is preserved.
   - Sofa detail tracks `displayedFabricId` and `displayedVisualPositionId`.
     The visible `<img>`'s `src` and `alt` are derived from those displayed
     identifiers, so the alt text and the visible bitmap stay in sync. The
     image viewer dialog continues to read from the active selection (so
     opening the viewer after a switch shows the newly selected high-res
     image), because the viewer is opened on user click after the visible
     swap has already happened.

Keep the existing fabric and visual position click handlers, error handling,
catalog `loading="lazy"` hint, image viewer behavior, body scroll lock,
selection warning, and all CSS untouched. The preload and swap logic lives
entirely in `useEffect` blocks driven by the existing render URL.

The pattern is intentionally local. Do not introduce a shared module yet;
both call sites have small enough state shape to inline the logic and keep
file boundaries clear.

## Expected File Structure

- Modify: `apps/web/src/app/catalog/PublicCatalogPage.tsx`
  - Add hidden preloaders for every fabric `render_medium_url` in the card.
  - Add a "displayed render URL" effect that swaps only after the preloader
    for the active render reports `onload`/`onerror`.
  - Bind the visible `<img>` `src` to the displayed render URL instead of the
    active render URL.
  - Keep the existing fabric click handler, `imageFailed` fallback,
    `loading="lazy"` hint, and Russian/French comments per `CLAUDE.md`
    (avoid forbidden words: `hook`, `state`, `props`, `render`,
    `component`, `callback`, `mount`).

- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`
  - Add hidden preloaders for every render at the currently selected visual
    position.
  - Track displayed fabric id and displayed visual position id, derive
    displayed render and displayed alt from those values.
  - Add an effect that swaps the displayed identifiers only after the
    preloader for the active render reports `onload`/`onerror`.
  - Bind the visible thumbnail `<img>` `src` and `alt` to the displayed
    render. Keep the original-resolution viewer reading from the active
    selection.
  - Keep existing fabric/visual position handlers, `imageFailed` fallback,
    selection warning, and Russian/French comments.

- Modify: `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`
  - Add a `beforeEach` that stubs the global `Image` constructor with an
    instant-load test double that records every requested `src` and fires
    `onload` on the next microtask.
  - Update existing fabric-switch assertions to `await waitFor(...)` where
    they read post-click `<img>` `src` so the deferred swap microtask is
    observed.
  - Add a new test that the visible card `<img>` keeps its previous `src`
    until the preloader for the new render reports `onload`, then swaps.
  - Add a new test that, after the card mounts, the non-default fabric
    `render_medium_url` values are requested as preloaded images.

- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
  - Add a `beforeEach` that stubs the global `Image` constructor with the
    same instant-load test double pattern.
  - Update existing fabric/visual-position-switch assertions to
    `await waitFor(...)` where they read post-click visible `<img>` `src`.
  - Add a new test that the visible detail `<img>` keeps its previous `src`
    until the preloader for the new render reports `onload`, then swaps.
  - Add a new test that, after the detail data loads, the non-active fabric
    renders for the current visual position are requested as preloaded
    images, and that switching the visual position triggers a preload pass
    for that new position.

- Modify: `docs/plans/active/README.md`
  - Add a row for PLAN-0095.

- Modify after implementation: `docs/roadmap/web.md`
  - Add the completed web behavior.

## Tasks

- [ ] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type fix --area web --work "Public fabric switch instant swap" --spec SPEC-0012 --plan PLAN-0095
  ```

- [ ] Register the active plan in `docs/plans/active/README.md` by adding the
  following row to the table (sorted by plan id):

  ```md
  | PLAN-0095 | SPEC-0012 | active | web | Public fabric switching preloads variant renders and keeps the previous render visible until the next render is decoded, removing the desktop white flash and the first-switch network delay. |
  ```

- [ ] Add a `beforeEach` `Image` test double to
  `apps/web/src/app/catalog/PublicCatalogPage.test.tsx` near the existing
  `beforeEach`/`afterEach` block.

  Add this test double inside the existing `describe` (or at module scope if
  there is no `describe`), and arrange a tracking array that resets per test:

  ```tsx
  // RU: Этот класс заменяет встроенную картинку браузера, чтобы она сразу сообщала о готовности.
  // FR: Cette classe remplace l'image du navigateur pour qu'elle signale tout de suite qu'elle est prete.
  class InstantImage {
    private _src = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    static loaded: string[] = [];

    set src(value: string) {
      this._src = value;
      InstantImage.loaded.push(value);
      queueMicrotask(() => this.onload?.());
    }

    get src() {
      return this._src;
    }
  }

  beforeEach(() => {
    InstantImage.loaded = [];
    vi.stubGlobal("Image", InstantImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });
  ```

  If the file already has a `beforeEach`/`afterEach` for `fetch` and
  `cleanup`, merge the new lines into them rather than duplicating. Keep the
  Russian/French comment block above the class.

- [ ] Add the failing preload test in
  `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`. Place it near the
  other catalog rendering tests:

  ```tsx
  it("preloads every fabric render variant for a catalog card", async () => {
    mockCatalogResponses({ items: [rivoli], next_cursor: null });

    render(<PublicCatalogPage />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });

    await waitFor(() => {
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/boucle-face-medium.jpg",
      );
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/sauge-face-medium.jpg",
      );
    });
  });
  ```

  If `mockCatalogResponses` is not the helper name in this file, replace the
  call with the existing helper used by sibling tests. Do not invent a new
  helper.

- [ ] Add the failing deferred-swap test in
  `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`. Place it next to the
  preload test:

  ```tsx
  it("keeps the previous catalog card image visible until the next render is decoded", async () => {
    mockCatalogResponses({ items: [rivoli], next_cursor: null });

    let resolveSauge: (() => void) | null = null;

    class GatedImage extends InstantImage {
      set src(value: string) {
        if (value === "https://assets.example/rivoli/sauge-face-medium.jpg") {
          InstantImage.loaded.push(value);
          (this as unknown as { _src: string })._src = value;
          resolveSauge = () => this.onload?.();
          return;
        }

        super.src = value;
      }
    }

    vi.stubGlobal("Image", GatedImage);

    const { container } = render(<PublicCatalogPage />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });

    fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));

    expect(
      container.querySelector('img[alt="Canapé Rivoli"]'),
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/boucle-face-medium.jpg",
    );

    resolveSauge?.();

    await waitFor(() =>
      expect(
        container.querySelector('img[alt="Canapé Rivoli"]'),
      ).toHaveAttribute(
        "src",
        "https://assets.example/rivoli/sauge-face-medium.jpg",
      ),
    );
  });
  ```

- [ ] Run the catalog focused tests and confirm the two new tests fail before
  implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
  ```

  Expected before implementation: FAIL on the two new tests because the
  current code does not preload variants and swaps the visible `src`
  synchronously on click.

  If existing fabric-switch tests in this file already check post-click
  `src` synchronously, list the failures from this run. Do not "fix" them
  in this step. Update them in the dedicated existing-test update step
  below so the failures and the updates are reviewed together.

- [ ] Update existing catalog fabric-switch assertions in
  `apps/web/src/app/catalog/PublicCatalogPage.test.tsx` to await the
  deferred swap.

  For every `expect(<img>).toHaveAttribute("src", "...medium...")` call that
  runs immediately after a `fireEvent.click(... fabric swatch ...)`, wrap
  the assertion in `await waitFor(() => ...)`. Do not change the URL values
  or query selectors. Example transformation:

  Before:

  ```tsx
  fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));
  expect(container.querySelector('img[alt="Canapé Rivoli"]')).toHaveAttribute(
    "src",
    "https://assets.example/rivoli/sauge-face-medium.jpg",
  );
  ```

  After:

  ```tsx
  fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));
  await waitFor(() =>
    expect(
      container.querySelector('img[alt="Canapé Rivoli"]'),
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/sauge-face-medium.jpg",
    ),
  );
  ```

  Keep all other assertions and click sequences identical.

- [ ] Add the same `Image` `beforeEach` test double to
  `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx` using the
  same `InstantImage` class structure. Merge with any existing
  `beforeEach`/`afterEach` block in that file.

- [ ] Add the failing preload test for sofa detail in
  `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`. Place it
  near the other detail rendering tests:

  ```tsx
  it("preloads every fabric render for the active visual position", async () => {
    mockDetailResponse();

    render(<PublicSofaDetailPage slug="canape-rivoli" />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });

    await waitFor(() => {
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/boucle-face-medium.jpg",
      );
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/sauge-face-medium.jpg",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Profil" }));

    await waitFor(() => {
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/boucle-profil-medium.jpg",
      );
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/sauge-profil-medium.jpg",
      );
    });
  });
  ```

- [ ] Add the failing deferred-swap test in
  `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`. Place it
  next to the preload test:

  ```tsx
  it("keeps the previous detail image visible until the next render is decoded", async () => {
    mockDetailResponse();

    let resolveSauge: (() => void) | null = null;

    class GatedImage extends InstantImage {
      set src(value: string) {
        if (value === "https://assets.example/rivoli/sauge-face-medium.jpg") {
          InstantImage.loaded.push(value);
          (this as unknown as { _src: string })._src = value;
          resolveSauge = () => this.onload?.();
          return;
        }

        super.src = value;
      }
    }

    vi.stubGlobal("Image", GatedImage);

    const { container } = render(<PublicSofaDetailPage slug="canape-rivoli" />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });

    fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));

    expect(
      container.querySelector(
        'img[alt="Canapé Rivoli en Bouclé ivoire, Face"]',
      ),
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/boucle-face-medium.jpg",
    );

    resolveSauge?.();

    await waitFor(() =>
      expect(
        container.querySelector(
          'img[alt="Canapé Rivoli en Velours sauge, Face"]',
        ),
      ).toHaveAttribute(
        "src",
        "https://assets.example/rivoli/sauge-face-medium.jpg",
      ),
    );
  });
  ```

- [ ] Run the sofa detail focused tests and confirm the two new tests fail
  before implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  ```

  Expected before implementation: FAIL on the two new tests. Note any other
  failing tests caused by the synchronous-swap assumption; update them in
  the dedicated step below.

- [ ] Update existing sofa detail fabric/visual-position-switch assertions
  in `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx` to await
  the deferred swap.

  Apply the same transformation rule as the catalog test update: wrap any
  immediate post-click `expect(<img>).toHaveAttribute("src", ...medium...)`
  in `await waitFor(() => ...)`. Existing assertions on
  `aria-pressed`, on swatch button thumbnails (`...small.png` URLs), on
  visible position labels, and on the image viewer original `src` inside
  the dialog do not need to change.

  Example transformation:

  Before:

  ```tsx
  fireEvent.click(screen.getByRole("button", { name: "Profil" }));
  expect(
    container.querySelector('img[alt="Canapé Rivoli en Bouclé ivoire, Profil"]'),
  ).toHaveAttribute(
    "src",
    "https://assets.example/rivoli/boucle-profil-medium.jpg",
  );
  ```

  After:

  ```tsx
  fireEvent.click(screen.getByRole("button", { name: "Profil" }));
  await waitFor(() =>
    expect(
      container.querySelector(
        'img[alt="Canapé Rivoli en Bouclé ivoire, Profil"]',
      ),
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/boucle-profil-medium.jpg",
    ),
  );
  ```

- [ ] Implement preload and deferred swap in
  `apps/web/src/app/catalog/PublicCatalogPage.tsx` inside `CatalogCard`.

  Add the `useEffect` import to the existing `react` import line. Inside
  `CatalogCard`, after the existing `useState` lines and before the existing
  `selectFabric` function, add:

  ```tsx
  // RU: Здесь хранится адрес картинки, которая сейчас видна посетителю на карточке.
  // FR: Ici on garde l'adresse de l'image visible en ce moment sur la carte.
  const [displayedRenderUrl, setDisplayedRenderUrl] = useState(
    item.default_render_medium_url,
  );

  // RU: Заранее качаем картинки всех тканей карточки, чтобы переключение было быстрым.
  // FR: On telecharge a l'avance les images de tous les tissus de la carte pour un changement rapide.
  useEffect(() => {
    const preloaders: HTMLImageElement[] = [];

    for (const fabric of item.fabrics) {
      if (!fabric.render_medium_url) {
        continue;
      }

      const preloader = new Image();
      preloader.src = fabric.render_medium_url;
      preloaders.push(preloader);
    }

    return () => {
      for (const preloader of preloaders) {
        preloader.onload = null;
        preloader.onerror = null;
      }
    };
  }, [item.fabrics]);

  // RU: Меняем видимую картинку только когда новая уже скачалась, чтобы не было пустого белого места.
  // FR: On change l'image visible seulement quand la nouvelle est prete, pour eviter un blanc.
  useEffect(() => {
    if (activeRenderUrl === displayedRenderUrl) {
      return;
    }

    let isCurrent = true;
    const preloader = new Image();

    function finishSwap() {
      if (isCurrent) {
        setDisplayedRenderUrl(activeRenderUrl);
      }
    }

    preloader.onload = finishSwap;
    preloader.onerror = finishSwap;
    preloader.src = activeRenderUrl;

    return () => {
      isCurrent = false;
      preloader.onload = null;
      preloader.onerror = null;
    };
  }, [activeRenderUrl, displayedRenderUrl]);
  ```

  Update the visible `<img>` to bind to `displayedRenderUrl`:

  ```tsx
  <img
    alt={item.public_name}
    decoding="async"
    loading="lazy"
    onError={() => setImageFailed(true)}
    src={displayedRenderUrl}
  />
  ```

  Add `useEffect` to the existing `react` import line if it is not already
  imported there.

- [ ] Implement preload and deferred swap in
  `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`.

  Add `displayedFabricId` and `displayedVisualPositionId` state next to the
  existing selection state:

  ```tsx
  // RU: Здесь хранится ткань, которая сейчас видна на большой картинке дивана.
  // FR: Ici on garde le tissu visible en ce moment sur la grande image du canape.
  const [displayedFabricId, setDisplayedFabricId] = useState<string | null>(null);
  // RU: Здесь хранится вид дивана, который сейчас виден на большой картинке.
  // FR: Ici on garde la vue du canape visible en ce moment sur la grande image.
  const [displayedVisualPositionId, setDisplayedVisualPositionId] =
    useState<string | null>(null);
  ```

  Inside the existing `loadDetail` async function, set both displayed
  identifiers immediately to the resolved selection alongside the existing
  `setSelectedFabricId` and `setSelectedVisualPositionId` calls. Use the
  same conditional value the selected setter uses, so the visible image
  matches the initial selection on first paint.

  Replace the existing `selectedFabric`, `selectedVisualPosition`,
  `selectedRender`, `selectedRenderPreviewUrl`, and `selectedImageAlt`
  derivations with two parallel sets so the visible thumbnail uses the
  displayed identifiers and the action/viewer logic continues to use the
  selected identifiers:

  ```tsx
  // RU: Эти данные находят выбранные ткань, вид и картинку для кнопок и большой просмотровой.
  // FR: Ces donnees trouvent le tissu, la vue et l'image choisis pour les boutons et la grande vue.
  const selectedFabric = useMemo(
    () => detail?.fabrics.find((fabric) => fabric.id === selectedFabricId) ?? null,
    [detail?.fabrics, selectedFabricId],
  );
  const selectedVisualPosition = useMemo(
    () =>
      detail?.visual_positions.find(
        (position) => position.id === selectedVisualPositionId,
      ) ?? null,
    [detail?.visual_positions, selectedVisualPositionId],
  );
  const selectedRender = useMemo(
    () =>
      detail?.renders.find(
        (render) =>
          render.fabric_id === selectedFabricId &&
          render.visual_position_id === selectedVisualPositionId,
      ) ?? null,
    [detail?.renders, selectedFabricId, selectedVisualPositionId],
  );
  const selectedRenderPreviewUrl =
    selectedRender?.render_medium_url ??
    selectedRender?.render_url ??
    selectedRender?.render_original_url ??
    null;
  const selectedRenderOriginalUrl =
    selectedRender?.render_original_url ??
    selectedRender?.render_url ??
    selectedRender?.render_medium_url ??
    null;

  // RU: Эти данные находят ткань, вид и картинку, которые сейчас видны на странице.
  // FR: Ces donnees trouvent le tissu, la vue et l'image visibles en ce moment sur la page.
  const displayedFabric = useMemo(
    () => detail?.fabrics.find((fabric) => fabric.id === displayedFabricId) ?? null,
    [detail?.fabrics, displayedFabricId],
  );
  const displayedVisualPosition = useMemo(
    () =>
      detail?.visual_positions.find(
        (position) => position.id === displayedVisualPositionId,
      ) ?? null,
    [detail?.visual_positions, displayedVisualPositionId],
  );
  const displayedRender = useMemo(
    () =>
      detail?.renders.find(
        (render) =>
          render.fabric_id === displayedFabricId &&
          render.visual_position_id === displayedVisualPositionId,
      ) ?? null,
    [detail?.renders, displayedFabricId, displayedVisualPositionId],
  );
  const displayedRenderPreviewUrl =
    displayedRender?.render_medium_url ??
    displayedRender?.render_url ??
    displayedRender?.render_original_url ??
    null;
  ```

  Update `selectedImageAlt` to read from displayed values:

  ```tsx
  // RU: Этот текст описывает картинку, которая сейчас видна, для читателей экрана.
  // FR: Ce texte decrit l'image visible en ce moment pour les lecteurs d'ecran.
  const selectedImageAlt = detail
    ? `${detail.sofa.public_name} en ${displayedFabric?.public_name ?? "tissu sélectionné"}, ${displayedVisualPosition?.public_label ?? "vue sélectionnée"}`
    : "";
  ```

  Update `canOpenImageViewer` to keep using the active selection (the
  viewer opens on demand and shows the new high-res):

  ```tsx
  const canOpenImageViewer = Boolean(selectedRenderOriginalUrl && !imageFailed);
  ```

  Add the preload effect for the active visual position. Place it after the
  existing image-viewer escape effect:

  ```tsx
  // RU: Заранее качаем картинки всех тканей выбранного вида, чтобы переключение было быстрым.
  // FR: On telecharge a l'avance les images de tous les tissus de la vue choisie pour un changement rapide.
  useEffect(() => {
    if (!detail || !selectedVisualPositionId) {
      return;
    }

    const preloaders: HTMLImageElement[] = [];

    for (const render of detail.renders) {
      if (render.visual_position_id !== selectedVisualPositionId) {
        continue;
      }

      if (!render.render_medium_url) {
        continue;
      }

      const preloader = new Image();
      preloader.src = render.render_medium_url;
      preloaders.push(preloader);
    }

    return () => {
      for (const preloader of preloaders) {
        preloader.onload = null;
        preloader.onerror = null;
      }
    };
  }, [detail, selectedVisualPositionId]);
  ```

  Add the deferred-swap effect that promotes the selected identifiers to
  the displayed identifiers only after the active render is decoded. Place
  it after the preload effect:

  ```tsx
  // RU: Меняем видимую картинку только когда новая уже скачалась, чтобы не было пустого белого места.
  // FR: On change l'image visible seulement quand la nouvelle est prete, pour eviter un blanc.
  useEffect(() => {
    if (
      !selectedFabricId ||
      !selectedVisualPositionId ||
      !selectedRenderPreviewUrl
    ) {
      return;
    }

    if (
      selectedFabricId === displayedFabricId &&
      selectedVisualPositionId === displayedVisualPositionId
    ) {
      return;
    }

    let isCurrent = true;
    const preloader = new Image();

    function finishSwap() {
      if (isCurrent) {
        setDisplayedFabricId(selectedFabricId);
        setDisplayedVisualPositionId(selectedVisualPositionId);
      }
    }

    preloader.onload = finishSwap;
    preloader.onerror = finishSwap;
    preloader.src = selectedRenderPreviewUrl;

    return () => {
      isCurrent = false;
      preloader.onload = null;
      preloader.onerror = null;
    };
  }, [
    displayedFabricId,
    displayedVisualPositionId,
    selectedFabricId,
    selectedRenderPreviewUrl,
    selectedVisualPositionId,
  ]);
  ```

  Update the visible `<img>` `src` and `alt` to use displayed values, and
  guard against the case where no displayed render is available yet:

  ```tsx
  {imageFailed || !displayedRenderPreviewUrl ? (
    <span>Image indisponible</span>
  ) : (
    <button
      aria-label="Agrandir l'image du canapé"
      className="sofa-detail-image-button"
      onClick={openImageViewer}
      type="button"
    >
      <img
        alt={selectedImageAlt}
        decoding="async"
        onError={handleSelectedImageError}
        src={displayedRenderPreviewUrl}
      />
      <span className="sofa-detail-image-viewer-icon">
        <PublicExpandIcon />
      </span>
    </button>
  )}
  ```

  Inside `loadDetail`, when the resolved `selectedFabricId` and
  `selectedVisualPositionId` are computed, also call:

  ```tsx
  setDisplayedFabricId(
    hasStaleFabric
      ? null
      : storedFabric && fabricIds.has(storedFabric)
        ? storedFabric
        : body.data.defaults.fabric_id,
  );
  setDisplayedVisualPositionId(
    hasStaleVisualPosition
      ? null
      : storedVisualPosition && visualPositionIds.has(storedVisualPosition)
        ? storedVisualPosition
        : body.data.defaults.visual_position_id,
  );
  ```

  Inside `resetToDefaults`, after setting the selected identifiers, also
  call:

  ```tsx
  setDisplayedFabricId(detail.defaults.fabric_id);
  setDisplayedVisualPositionId(detail.defaults.visual_position_id);
  ```

  No other handlers (`chooseFabric`, `chooseVisualPosition`, viewer
  open/close, image error) need to set displayed identifiers directly. The
  deferred-swap effect promotes them once the active render is decoded.

- [ ] Run the catalog focused tests after implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
  ```

  Expected: PASS, including the two new tests and all updated existing
  tests.

- [ ] Run the sofa detail focused tests after implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  ```

  Expected: PASS, including the two new tests and all updated existing
  tests.

- [ ] Run the combined web focused checks:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
  pnpm --filter @mobel-unique/web typecheck
  pnpm --filter @mobel-unique/web test
  ```

  Expected: PASS.

- [ ] Update `docs/roadmap/web.md`. Add an entry near the existing public
  catalog/detail entries:

  ```md
  Public catalog cards and the public sofa detail page now preload every fabric render variant for the visible card or active visual position and keep the previously displayed render visible until the next render is decoded, removing the desktop white flash and the first-switch network delay observed in production.
  ```

  Do not claim CLS, byte-size, or production-trace improvements. This plan
  changes perceived switch latency only.

- [ ] Run repository guardrails:

  ```powershell
  pnpm spec:check
  pnpm typecheck
  pnpm test
  ```

  Expected: PASS. If `pnpm spec:check` reports that PLAN-0095 must be added
  to `docs/specs/manifest.json` under SPEC-0012's
  `implementationPlans` array, add it as the only manifest change in this
  plan and re-run `pnpm spec:check` until it passes.

- [ ] Run local browser QA:

  ```powershell
  pnpm dev:web
  ```

  In Chrome DevTools (or another desktop browser):

  - Open `http://127.0.0.1:3000/catalog`. In the Network panel, set
    throttling to "Slow 4G". Click between fabric swatches inside a single
    card; the visible image should switch only after a brief delay on the
    very first switch and then feel instant on repeat switches without any
    white flash between renders.
  - Open `http://127.0.0.1:3000/sofas/{published-slug}`. Repeat the test by
    clicking different fabrics and different visual positions; the visible
    hero image should never flash white during the swap.
  - Confirm the existing "Image indisponible" fallback still appears when a
    network response is forced to fail (DevTools "Block request URL" on a
    target render URL).
  - Confirm the image viewer (Agrandir) still opens the high-res image of
    the most recently selected fabric and visual position.

  On a mobile browser (or device emulation), confirm the existing
  no-flash, slight-delay behavior is unchanged.

- [ ] After implementation, verification, and roadmap update, move this
  plan to `docs/plans/done` with a short closure note listing the
  commands that actually passed and the manual browser scenarios that
  were checked.

## Tests

Required focused checks before and after implementation:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx
pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
```

Required combined checks before opening a PR:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
pnpm --filter @mobel-unique/web typecheck
pnpm --filter @mobel-unique/web test
pnpm spec:check
pnpm typecheck
pnpm test
```

Manual browser checks (desktop and mobile):

```powershell
pnpm dev:web
```

Then exercise the catalog card swatch switching and the sofa detail
fabric/visual-position switching scenarios listed in the QA task.

## Roadmap

Update after implementation:

- `docs/roadmap/web.md`

The roadmap entry should claim only the preload + deferred swap behavior on
public catalog cards and the public sofa detail page. Do not claim
production CLS, image byte reduction, or API latency improvements.

## Notes

- Do not change public API requests, response shapes, or image URL
  selection. PLAN-0094 already moved public catalog images to long-lived,
  immutable Storage paths; this plan relies on that to keep preloads cheap
  on repeat visits.
- Do not preload original-resolution viewer URLs. The viewer is opened on
  user action and is acceptable to fetch then.
- Do not introduce a shared preload/swap module yet. Both call sites are
  small and the inline pattern is easier to read and review.
- Keep the catalog card image `loading="lazy"` hint. It still helps below-
  the-fold cards. The preload effect runs only for cards that are mounted,
  so off-screen cards do not preload until they enter the React tree.
- Keep `.tsx` Russian and French comments simple and avoid the forbidden
  words listed in `CLAUDE.md`: `hook`, `state`, `props`, `render`,
  `component`, `callback`, `mount`.
- If `vi.stubGlobal("Image", InstantImage)` does not stub the constructor
  used by `new Image()` in the test environment, fall back to
  `globalThis.Image = InstantImage as unknown as typeof Image` inside
  `beforeEach` and restore it in `afterEach`. Document the fallback in the
  closure note if used.
- If during implementation the existing tests rely on a helper named
  differently from `mockCatalogResponses` or `mockDetailResponse`, use the
  helper that exists in the file. Do not create a new helper just for the
  new tests; reuse the existing fixtures and mock setup.
