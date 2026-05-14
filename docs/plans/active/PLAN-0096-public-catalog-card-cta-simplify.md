# PLAN-0096 Public Catalog Card CTA Simplify

Plan: PLAN-0096
Spec: SPEC-0004
Status: active
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Simplify the public catalog card call-to-action so each card link reads
`Simuler` only. Today the link contains a leading sparkle glyph and the
dynamic sofa name (`✧ Simuler Canapé Rivoli`). The sparkle adds visual noise
and the sofa name duplicates the heading already rendered above the link.

## Current Behavior

`apps/web/src/app/catalog/PublicCatalogPage.tsx` renders the card link as:

```tsx
<a className="catalog-card-link" href={`/sofas/${item.public_slug}`} onClick={rememberSelection}>
  <span aria-hidden="true">✧</span>
  <span>Simuler {item.public_name}</span>
</a>
```

The sofa name appears twice on each card: once in the card heading and once
in the link label.

## Target Behavior

The card link renders only the literal text `Simuler`:

```tsx
<a className="catalog-card-link" href={`/sofas/${item.public_slug}`} onClick={rememberSelection}>
  <span>Simuler</span>
</a>
```

The link still points at `/sofas/{public_slug}` and still calls
`rememberSelection` on click so the active fabric selection is persisted
into session storage before navigation.

## Scope

- Public catalog page CTA copy only.
- Card heading, image link, fabric swatches, and the rest of the card are
  unchanged.
- Public sofa detail page (`/sofas/[slug]`) is unchanged.
- The simulator entry button copy on `/sofas/[slug]/simulate` is unchanged;
  SPEC-0004 §"In-Home Simulation Flow" still allows that screen to use
  `Simuler` or `Générer` as the start action label.

## Tasks

1. Update the rendered link in `apps/web/src/app/catalog/PublicCatalogPage.tsx`
   to drop the sparkle span and the dynamic sofa name, leaving a single
   `Simuler` label inside the link.
2. Update
   `apps/web/src/app/catalog/PublicCatalogPage.test.tsx` so the navigation
   test selects the catalog card link by its `href` (`/sofas/canape-rivoli`)
   instead of by the accessible name `"Simuler Canapé Rivoli"`, because
   every card now produces the same accessible name `"Simuler"`.
3. Update `docs/roadmap/web.md` with a PLAN-0096 entry.

## Tests

- `apps/web/src/app/catalog/PublicCatalogPage.test.tsx`: the existing test
  "shows card fabric controls automatically and swaps only the active card
  image" continues to assert that clicking the card link persists the
  selected fabric to session storage. The selector switches to a stable
  `href`-based lookup so multiple cards sharing the `"Simuler"` accessible
  name no longer cause ambiguous matches.
- No new test file is required; the change is a UI copy adjustment covered
  by the existing card navigation assertion.

## Roadmap

`docs/roadmap/web.md` gets a new entry under the public catalog section
referencing PLAN-0096 and SPEC-0004.

## Notes

This plan deliberately keeps `Simuler` as the link label rather than
`Voir ce canapé` or `Découvrir`, because SPEC-0004 §"In-Home Simulation
Flow" anchors the public simulation start action on `Simuler`, and the
catalog card is the first surface where the visitor sees that verb.
