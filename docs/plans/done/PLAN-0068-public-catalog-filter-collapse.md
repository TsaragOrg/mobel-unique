# PLAN-0068 Public Catalog Filter Collapse

Plan: PLAN-0068
Spec: SPEC-0012
Status: done
Owner area: web
Affected packages:

- `apps/web`

## Goal

Keep the public catalog filter area compact when many public tags exist. The
catalog should fit as many mobile filters as their label widths allow on one
top line inside the public page side gutters, place `Voir plus` below that row,
keep tablet and desktop filters on one line with `Voir plus` at the end when
tags are hidden, and let visitors open a responsive popup with the full filter
list without changing API behavior. Catalog sofa cards should also keep their
visible tag chips and remaining tag count in one compact block capped at two
visual lines. Public sofa detail pages should keep the tag list in the same
left-to-right chip flow, span the full public info block, show a compact
two-line preview, and let visitors open the full tag list.

## Tasks

- [x] Add failing catalog page tests for hidden filters, popup open/close, and
      selected hidden filter visibility.
- [x] Implement the mobile short filter list, one-line tablet/desktop filter
      list, and full filter popup in the catalog page.
- [x] Add public filter popup styles in the existing public catalog visual
      system.
- [x] Keep catalog card visible tags and `+N tag` in the same two-line chip
      block.
- [x] Keep public sofa detail tags in a two-line preview with a full-list
      toggle.
- [x] Update the web roadmap.
- [x] Run focused catalog tests, web typecheck, and spec guard.
- [x] Move this plan to `docs/plans/done` after verification.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/app/catalog/PublicCatalogPage.test.tsx src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx src/app/globals.test.ts`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Roadmap

Updated:

- `docs/roadmap/web.md`

## Notes

- Use French UI copy for public catalog controls.
- Do not change public catalog API routes, query parameters, or tag ordering.
- On mobile, measure filter label widths and keep as many tags as fit on one
  top line, then show `Voir plus` below that line.
- On tablet and desktop, fit as many tags as possible into one line and reserve
  room for `Voir plus` at the end when tags remain hidden.
- Open `Voir plus` into a popup titled `Tous les filtres`.
- On mobile, let the short inline controls fill the top line inside the same
  side gutters as the rest of the public page, keep `Voir plus` as a full-width
  rounded control within those gutters below them, and keep popup filter
  buttons compact, centered, rounded, and on the white page background so long
  multi-word public labels stay readable.
- Keep `Voir plus` solid, not dashed, and use the same dark hover language as
  the public controls.
- Keep catalog card tag chips and the remaining tag count inside the same list;
  cap the card tag block at two visual rows so long tag labels cannot stretch
  the card.
- Keep public sofa detail tags in a flex chip list capped at two visual rows
  until visitors open `Voir plus`; the compact and expanded lists should span
  the full public info block and fill it left to right instead of stacking
  vertically or staying in one narrow column.

## Implementation Notes

Completed on `fix/web/spec-0012-plan-0068-public-catalog-filter-collapse`.

Browser QA covered the real DEV catalog at desktop, tablet, and mobile widths.
The catalog fit mobile filters by measured label width inside the public page
gutters with `Voir plus` below the top row, kept tablet and desktop filters on
one line with the popup trigger at the end, opened a
responsive popup with the full filter list, closed from the `Fermer les filtres`
control, kept a selected hidden filter visible in the short list when possible,
used compact mobile controls for long labels, and removed the dashed visual
style from `Voir plus` without adding a separate mobile filter background. Sofa
cards also keep the first public tags and the `+N tag` count in the same compact
two-line chip block. Public sofa detail pages now show a full-width two-line tag
preview with `Voir plus` / `Voir moins`, and the expanded tag list keeps the
same left-to-right chip flow. The public shell header also keeps only the
MOBEL UNIQUE brand mark, removing the redundant top-right `Catalogue` link from
catalog and sofa detail pages while leaving the detail page back link in place.
