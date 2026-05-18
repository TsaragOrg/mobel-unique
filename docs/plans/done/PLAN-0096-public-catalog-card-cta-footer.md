# PLAN-0096 Public Catalog Card CTA Footer

Plan: PLAN-0096
Spec: SPEC-0004
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Make the public catalog easier to scan on desktop and make the catalog card
simulation action unmistakable. Desktop should show two larger card columns,
and each card should end with a clean white footer CTA that clearly tells the
visitor they can view the sofa at home from a room photo without competing with
the product image.

## Current Behavior

`apps/web/src/app/catalog/PublicCatalogPage.tsx` renders the card link as a
small centered pill:

```tsx
<a className="catalog-card-link" href={`/sofas/${item.public_slug}`} onClick={rememberSelection}>
  <span>Simuler</span>
</a>
```

The card grid currently allows three desktop columns, which makes the cards
feel compressed and reduces the visual impact of the sofa image and CTA.

## Target Behavior

The catalog grid uses exactly two columns on desktop and tablet, then one
column on mobile.

The card link renders as a full-width card footer:

```tsx
<a className="catalog-card-link" href={`/sofas/${item.public_slug}`} onClick={rememberSelection}>
  <span>Voir ce canapé chez vous</span>
  <small>Avec une photo de votre pièce</small>
</a>
```

The footer keeps a white background, a light separator, and a subtle arrow
affordance so it reads as clickable without pulling attention away from the
sofa photo.

Catalog items keep the existing editorial grid language, with row spacing,
thin dividers, and a neutral arrow affordance inside the footer CTA so the
action belongs to the product above it without turning the page into boxed
cards.

The internal card layout explicitly pins the fabric preview to the content row
and the CTA to the footer row, so cards with fewer tags still keep their CTA
aligned with neighboring cards.

The link still points at `/sofas/{public_slug}` and still calls
`rememberSelection` on click so the active fabric selection is persisted
into session storage before navigation.

## Scope

- Public catalog grid desktop column count.
- Public catalog card CTA copy and white footer presentation.
- Card heading, image link, fabric swatches, and the rest of the card are
  unchanged.
- Public sofa detail page (`/sofas/[slug]`) is unchanged.
- The simulator entry button copy on `/sofas/[slug]/simulate` is unchanged;
  SPEC-0004 §"In-Home Simulation Flow" still allows that screen to use
  `Simuler` or `Générer` as the start action label.

## Tasks

1. Update `apps/web/src/app/catalog/PublicCatalogPage.tsx` so the card CTA uses
   a concise home-simulation message.
2. Update `apps/web/src/app/globals.css` so the catalog grid uses two columns
   on desktop and the CTA occupies the full card footer.
3. Update
   `apps/web/src/app/catalog/PublicCatalogPage.test.tsx` so the navigation
   test asserts the new CTA copy while still selecting the catalog card link by
   its `href` (`/sofas/canape-rivoli`).
4. Update `apps/web/src/app/globals.test.ts` to cover the two-column grid and
   full-width CTA footer styles.
5. Update `docs/roadmap/web.md` with the revised PLAN-0096 entry.

## Tests

- `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`: the existing test
  "shows card fabric controls automatically and swaps only the active card
  image" asserts the new CTA copy and continues to assert that clicking the
  card link persists the selected fabric to session storage.
- `apps/web/src/app/globals.test.ts`: catalog style tests assert the two-column
  grid and full-width CTA footer.

## Roadmap

`docs/roadmap/web.md` gets a new entry under the public catalog section
referencing PLAN-0096 and SPEC-0004.

## Notes

The CTA uses `Voir ce canapé chez vous` to make the entry point more concrete
on the catalog card. The dedicated simulation flow can still use `Simuler` or
`Générer` for the start action labels described by SPEC-0004.

## Closure Notes

Implemented the two-column public catalog grid, clearer row separation, aligned
card footers, and the white full-width card footer CTA. Verified the catalog
visually on desktop and mobile, including the subtle hover affordance and the
single-column mobile layout.

Checks:

- `corepack pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/globals.test.ts`
- `corepack pnpm --filter @mobel-unique/web typecheck`
- `corepack pnpm spec:check`
