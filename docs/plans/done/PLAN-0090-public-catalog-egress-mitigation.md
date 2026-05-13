# PLAN-0090 Public Catalog Egress Mitigation

Plan: PLAN-0090
Spec: SPEC-0012
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Reduce avoidable Supabase Storage cached egress from the public catalog and
sofa detail browsing path without changing the public catalog contract or the
visitor simulation flow.

## Tasks

- [x] Update the public sofa detail page to use the medium render variant for
  the inline product image.
- [x] Keep the original render URL available for the full-screen image viewer.
- [x] Add lazy/async image loading hints to public catalog and sofa detail
  images that can otherwise load offscreen.
- [x] Update focused public sofa detail tests.
- [x] Update the web roadmap.
- [x] Run the relevant web tests and typecheck.

## Tests

- `pnpm --filter @mobel-unique/web test -- PublicSofaDetailPage.test.tsx PublicCatalogPage.test.tsx`
- `pnpm --filter @mobel-unique/web test -- 'src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx'`
- `pnpm --filter @mobel-unique/web typecheck`

## Roadmap

- `docs/roadmap/web.md`

## Notes

This is an operational follow-up to the catalog image variant delivery work.
The API still exposes explicit original and medium render fields; the change is
limited to choosing the bounded medium variant for normal page rendering and
deferring the original image request until the visitor opens the viewer.
