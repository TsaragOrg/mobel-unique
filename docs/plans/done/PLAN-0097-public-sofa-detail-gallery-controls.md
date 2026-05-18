# PLAN-0097 Public Sofa Detail Gallery Controls

Plan: PLAN-0097
Spec: SPEC-0012
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Refine the public sofa detail page controls so the page remains readable when
many fabrics are available and image navigation stays familiar on desktop and
mobile.

## Scope

- Show fabric choices as image-first swatches instead of persistent text
  buttons.
- Keep the selected fabric name visible outside the swatch buttons.
- Replace the visual-position button set with previous and next photo controls
  below the product image.
- Make the image expand affordance quieter so it does not compete with product
  inspection.
- Remove the product image enter animation so fabric changes swap directly
  without a bounce effect.
- Replace the old floating catalog return text with an explicit, aligned
  return link above the product detail layout.
- Keep public API contracts, catalog data shape, simulation context handoff,
  storage behavior, and Shopify order behavior unchanged.

## Tasks

- [x] Update the sofa detail page tests to cover the selected fabric label and
      previous or next photo controls.
- [x] Update `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`.
- [x] Update public detail styles in `apps/web/src/app/globals.css`.
- [x] Remove the sofa detail image enter animation from the shared public CSS.
- [x] Update `docs/roadmap/web.md`.
- [x] Run the targeted web test, web typecheck, and specification guard.

## Tests

- `corepack pnpm --filter @mobel-unique/web exec vitest run 'src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx'`
- `corepack pnpm --filter @mobel-unique/web typecheck`
- `corepack pnpm spec:check`
- `node scripts/spec-guard.mjs origin/dev`

## Roadmap

Updated:

- `docs/roadmap/web.md`

## Notes

This is a public frontend-only ergonomics change under SPEC-0012. It does not
need a spec change request because the accepted public frontend spec already
covers low-friction fabric selection, sofa detail inspection, and simulation
entry from the public detail page.
