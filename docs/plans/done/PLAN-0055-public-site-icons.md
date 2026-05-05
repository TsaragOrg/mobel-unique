# PLAN-0055 Public Site Icons

Plan: PLAN-0055
Spec: SPEC-0012
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `scripts`
- `docs/roadmap`

## Goal

Add production-ready public site icons for browser tabs, modern metadata
surfaces, and Apple home-screen usage.

## Scope

- Generate the public App Router icon files from the provided transparent PNG
  logo without changing the logo shape.
- Use the public site background color for the square tile so the black logo
  matches the page surface in browser and home-screen contexts.
- Keep the icon set limited to `favicon.ico`, `icon.png`, and
  `apple-icon.png`.
- Do not add a PWA manifest or Android-specific icon set in this pass.

## Tasks

- [x] Add a tested favicon asset generator.
- [x] Preserve transparent-source logo pixels and center them on the
      site-background tile.
- [x] Generate `apps/web/src/app/favicon.ico` with 16, 32, and 48 px entries.
- [x] Generate `apps/web/src/app/icon.png` at 512x512.
- [x] Generate `apps/web/src/app/apple-icon.png` at 180x180.
- [x] Update `docs/roadmap/web.md`.
- [x] Run focused generator tests, asset verification, and web build.

## Tests

- The generator finds visible logo bounds from alpha pixels.
- The generated square PNG icons have the expected dimensions and opaque
  site-background corners.
- The ICO encoder writes 16, 32, and 48 px PNG entries.
- The resize path smooths alpha edges instead of duplicating source pixels.
- The web build accepts the App Router metadata icon files.

## Roadmap

- Update `docs/roadmap/web.md` and `docs/roadmap/workflow.md` with the
  completed public site icon work.
