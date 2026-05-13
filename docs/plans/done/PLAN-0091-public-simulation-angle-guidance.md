# PLAN-0091 Public Simulation Angle Guidance

Plan: PLAN-0091
Spec: SPEC-0015
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Make the first public simulation upload screen clearly explain that the visitor
must photograph the room from the same point of view as the selected sofa
render, without adding a long instructional page or extra step and without
relying on text alone.

## Tasks

- [x] Update Screen 1 tests to cover concise same-angle guidance, the animated
  room placement guide, and side-view visibility.
- [x] Add a selected-sofa badge that names the view to reproduce.
- [x] Replace the empty room-photo upload icon with optimized WebP assets: an
  empty room image and a transparent sofa overlay animated into the placement
  area.
- [x] Keep the visual comparison layout between selected sofa and room photo.
- [x] Remove redundant explanatory copy around the upload target so the screen
  reads as two primary images: the selected sofa render and the room photo
  target.
- [x] Make the upload target bottom area explicit with an upload icon, a
  "Photo de votre intérieur" label, and concise upload/take-photo copy.
- [x] Register the accepted SPEC-0015 change request and implementation plan.
- [x] Update the web roadmap.
- [x] Run focused tests, typecheck, and specification guardrails.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/components/simulation/__tests__/Screen1PhotoUpload.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Roadmap

- `docs/roadmap/web.md`

## Notes

The screen keeps one upload target and one compact rule. The selected sofa
render remains the angle reference, while the empty target carries an animated
WebP room guide with no embedded words. Localized copy and accessibility text
remain in the React component.
