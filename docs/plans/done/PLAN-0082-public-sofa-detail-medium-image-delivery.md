# PLAN-0082 Public Sofa Detail Medium Image Delivery

Plan: PLAN-0082
Spec: SPEC-0012
Status: done
Owner area: web
Change request: CR-SPEC-0012-public-sofa-detail-medium-image-delivery
Depends on: SPEC-0004, SPEC-0009, SPEC-0010, SPEC-0012, PLAN-0048, PLAN-0066, PLAN-0067
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Make the public sofa detail page load medium render bytes for the normal
selected sofa image, while keeping original render bytes lazy until the visitor
opens the full-screen image viewer.

## Implementation Note

Closed on 2026-05-12 after the public sofa detail page, focused tests, and web
roadmap were updated. The normal selected page image now uses
`render_medium_url`; the large image viewer remains on `render_original_url`.

Passed verification:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

## Architecture

This is a frontend-only delivery-size fix. The public sofa detail API already
returns `render_medium_url` and `render_original_url` for each selected render,
so the page should choose the URL that matches the visual surface instead of
changing API or storage behavior.

The inline detail image uses medium delivery. The full-screen image viewer keeps
original delivery because that is the explicit inspection surface.

## Scope

This plan includes:

- updating `PublicSofaDetailPage.tsx` to track separate medium and original
  render URLs for the selected render;
- using the medium URL for the normal inline `<img>`;
- using the original URL only inside the full-screen viewer;
- keeping fabric and visual position changes synchronized with the two URLs;
- keeping the required Russian and French `.tsx` comments current;
- updating focused public sofa detail tests;
- updating `docs/roadmap/web.md` after implementation.

This plan does not include:

- changing `apps/web/src/lib/public-catalog.ts`;
- changing public API response fields or compatibility aliases;
- changing Supabase migrations, storage variant generation, or backfill scripts;
- changing catalog card image behavior;
- changing viewer layout, zoom controls, or public copy.

## Expected File Structure

- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`
  - Add a selected medium URL derived from `selectedRender.render_medium_url`.
  - Keep the selected original URL derived from `selectedRender.render_original_url`.
  - Point the normal detail image at the medium URL.
  - Point the full-screen viewer image at the original URL.
  - Keep image failure behavior safe when the selected fabric or view changes.
- Modify: `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
  - Update existing assertions that currently expect the inline image to use
    original delivery.
  - Assert that the viewer image still uses original delivery.
  - Assert fabric and visual position changes keep inline images on medium
    delivery.
- Modify: `docs/roadmap/web.md`
  - Add one done entry after implementation and verification.

## Implementation Sequence

1. Create the workflow branch:

   ```powershell
   pnpm branch:create -- --type fix --area web --work "Public sofa detail medium image delivery" --spec SPEC-0012 --plan PLAN-0082
   ```

2. Update `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx` first.
   Change the direct-entry inline image expectation from:

   ```ts
   expect(container.querySelector('img[alt="Canapé Rivoli en Bouclé ivoire, Face"]')).toHaveAttribute(
     "src",
     "https://assets.example/rivoli/boucle-face-original.png",
   );
   ```

   to:

   ```ts
   expect(container.querySelector('img[alt="Canapé Rivoli en Bouclé ivoire, Face"]')).toHaveAttribute(
     "src",
     "https://assets.example/rivoli/boucle-face-medium.jpg",
   );
   ```

3. Update the session-restored fabric assertion in the same test file from the
   `sauge-face-original.png` URL to:

   ```ts
   "https://assets.example/rivoli/sauge-face-medium.jpg"
   ```

4. Update the fabric and visual position selection assertions in the same test
   file so the inline image expects:

   ```ts
   "https://assets.example/rivoli/boucle-profil-medium.jpg"
   "https://assets.example/rivoli/sauge-profil-medium.jpg"
   ```

5. Keep the viewer test assertion on original delivery:

   ```ts
   expect(
     within(dialog).getByRole("img", {
       name: "Canapé Rivoli en Bouclé ivoire, Face",
     }),
   ).toHaveAttribute(
     "src",
     "https://assets.example/rivoli/boucle-face-original.png",
   );
   ```

6. Run the focused test and confirm it fails before the page change:

   ```powershell
   pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
   ```

   Expected before implementation: at least the updated inline image assertions
   fail because the page still uses `render_original_url` for the normal image.

7. Update `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`.
   Replace the single selected image URL with two purpose-specific values:

   ```ts
   const selectedRenderMediumUrl = selectedRender?.render_medium_url ?? null;
   const selectedRenderOriginalUrl =
     selectedRender?.render_original_url ?? selectedRender?.render_url ?? null;
   ```

8. Update the required nearby `.tsx` comments so they explain, in Russian and
   French, that the normal page image uses the lighter medium image and the
   large viewer uses the original image. Keep the comment wording simple and do
   not use the forbidden words listed in `AGENTS.md`.

9. Point the inline image availability check and `src` at the medium URL:

   ```tsx
   {imageFailed || !selectedRenderMediumUrl ? (
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
         onError={handleSelectedImageError}
         src={selectedRenderMediumUrl}
       />
       <span className="sofa-detail-image-viewer-icon">
         <PublicExpandIcon />
       </span>
     </button>
   )}
   ```

10. Keep the existing full-screen viewer block gated by
    `isImageViewerOpen && selectedRenderOriginalUrl`. In that block, leave the
    viewer image on original delivery:

    ```tsx
    src={selectedRenderOriginalUrl}
    ```

11. Run the focused public detail test again:

    ```powershell
    pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
    ```

    Expected after implementation: PASS.

12. Run the package typecheck:

    ```powershell
    pnpm --filter @mobel-unique/web typecheck
    ```

    Expected: PASS.

13. Update `docs/roadmap/web.md` with a done entry for `SPEC-0012` and
    `PLAN-0082`. Use this exact behavior summary:

    ```md
    Public sofa detail now loads medium render delivery for the normal selected page image while keeping original render delivery lazy for the large viewer.
    ```

14. Run the spec guard:

    ```powershell
    pnpm spec:check
    ```

    Expected: PASS.

15. Optional browser verification when a local or DEV published sofa is
    available:

    ```powershell
    pnpm dev:web
    ```

    In browser DevTools Network on `/sofas/{slug}`, confirm the first selected
    sofa image request uses the medium render URL. Then open the large image
    viewer and confirm the original render URL is requested only after that
    action.

16. Move this plan to `docs/plans/done` only after implementation, roadmap
    update, and verification are complete. Add an implementation note listing
    the verification commands that actually passed.

## Tests

Required focused check:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
```

Required package check:

```powershell
pnpm --filter @mobel-unique/web typecheck
```

Required repository guardrail:

```powershell
pnpm spec:check
```

Optional broader checks if nearby public catalog behavior changes unexpectedly:

```powershell
pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx
pnpm --filter @mobel-unique/web test
```

## Roadmap

Update:

- `docs/roadmap/web.md`

The roadmap entry should say that public sofa detail now loads medium render
delivery for the normal page image and reserves original render delivery for the
large viewer.

## Notes

- `PLAN-0067` already delivered the public medium and original URL fields. This
  plan consumes those fields correctly in the detail page.
- `render_url` remains a compatibility alias to original delivery in the public
  detail API. The page must use the explicit fields instead of relying on that
  alias.
- No dependency install is needed.
- If dependencies are not installed during implementation, record that clearly
  in the implementation notes instead of claiming verification passed.
