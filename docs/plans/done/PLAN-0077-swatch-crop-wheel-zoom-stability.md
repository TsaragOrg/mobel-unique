# PLAN-0077 Swatch Crop Wheel Zoom Stability

Plan: PLAN-0077
Spec: SPEC-0016
Status: done
Owner area: web
Depends on: PLAN-0049
Affected packages:

- `apps/web`

## Goal

Stabilize admin fabric swatch crop wheel zoom so the crop frame responds to a
wheel event immediately after it is rendered. The behavior remains the
SPEC-0016 cropper behavior from PLAN-0049: wheel-up over the preview increases
zoom by ten percent, wheel-down decreases it, and form submission sends the
selected square crop to the existing upload preparation path.

## Change

- Move swatch crop wheel handling from an effect-installed native listener to
  the rendered crop frame's React `onWheel` handler.
- Keep the same zoom step, crop clamping, saved-state reset, and upload payload
  behavior.
- Update the existing admin page wheel-zoom test to wait for the React state
  update after firing the wheel event.

## Verification

- `pnpm --filter @mobel-unique/web exec vitest run src/app/admin/AdminCatalogPages.test.tsx`
- `pnpm --filter @mobel-unique/web test`

## Roadmap

- `docs/roadmap/web.md`

Completed on 2026-05-10 after reproducing the CI failure shape and verifying the
focused admin page suite plus the full web package test suite.
