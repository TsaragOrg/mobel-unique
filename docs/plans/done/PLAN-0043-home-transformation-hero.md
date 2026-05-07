# PLAN-0043 Home Transformation Hero

Plan: PLAN-0043
Spec: SPEC-0012
Change Request: CR-SPEC-0012-home-transformation-hero
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Replace the current public home page with a mobile-first simulation landing page
based on the provided reference design. The page should use the newly supplied
sofa transformation video as the primary visual asset, showing the fabric moving
from green to white.

## Tasks

- [x] Update the home-page test first for the new visible copy, process flow,
      upload cue, and video asset.
- [x] Rebuild the `/` page markup around the new hero layout.
- [x] Update the hero video component to use the green-to-white asset and keep
      reduced-motion behavior.
- [x] Replace the home-page CSS with the new responsive desktop and mobile
      layout.
- [x] Update the web roadmap.
- [x] Run the narrow web tests and typecheck.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/app/page.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Roadmap

- `docs/roadmap/web.md`

## Notes

- The page remains static and does not implement the public simulation wizard.
- The visible upload cue is part of the home-page simulation pitch; the primary
  path still points visitors toward the public catalog as required by SPEC-0012.
- The public header must not introduce cart, checkout, account, price, stock, or
  admin navigation.
- The hero transformation uses optimized browser assets under
  `apps/web/public/videos`: WebM VP9, MP4 H.264 with `faststart`, and a compact
  poster image. The page loads separate forward and reverse clips at 864x486 and
  24 fps, with each motion segment sped up by 2.4x to about 3.4 seconds. The
  first page view plays the forward clip once and stops. The `Changer la couleur`
  control alternates between the forward and reverse clips without relying on
  unsupported negative playback rates.
- Follow-up on 2026-05-04: the home page no longer shows the upload cue or
  upload-oriented hero copy. The headline now presents the broader sofa
  collection, and the color-change control sits at the lower side of the sofa
  visual on desktop and mobile.
- Follow-up on 2026-05-07: the public home header now keeps only the MÖBEL
  UNIQUE brand mark at the top. The previous right-side public navigation links
  and compact collection link were removed because the page already explains the
  simulation path and the primary catalog action remains in the hero.
