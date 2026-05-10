# PLAN-0066 Public Sofa Image Viewer

Plan: PLAN-0066
Spec: SPEC-0012
Status: done
Owner area: web
Change request: CR-SPEC-0012-public-sofa-image-viewer
Depends on: SPEC-0004, SPEC-0012, PLAN-0048, PLAN-0065
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Add a mobile-first full-screen image viewer to the public sofa detail page so
visitors can inspect the selected sofa render without zooming the whole page.

## Scope

- Open the image viewer by clicking or tapping the selected render.
- Show the selected render nearly full-screen on mobile and desktop.
- Keep the image contained, not cropped.
- Close the viewer with a visible close button, backdrop click, or Escape.
- Close the viewer when fabric or visual position changes.
- Do not add plus/minus zoom controls.
- Do not open the viewer when the current image is unavailable.

## Tasks

- [x] Add a failing test to `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
      for opening the viewer and closing it through the close button and Escape.
- [x] Implement the smallest page changes in
      `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx`.
- [x] Add public viewer styles in `apps/web/src/app/globals.css`.
- [x] Update `docs/roadmap/web.md`.
- [x] Run the targeted web test, web typecheck, and spec guard.
- [x] Move this plan to `docs/plans/done` after verification.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Roadmap

Update:

- `docs/roadmap/web.md`

## Notes

This is a public frontend-only enhancement. It must not change public API
responses, storage URLs, Supabase policies, admin workflows, or simulation
wizard behavior.

## Implementation Notes

Completed on `feature/web/spec-0012-plan-0066-public-sofa-image-viewer`.

Verification completed:

- `pnpm --filter @mobel-unique/web test -- src/app/sofas/[slug]/PublicSofaDetailPage.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`
