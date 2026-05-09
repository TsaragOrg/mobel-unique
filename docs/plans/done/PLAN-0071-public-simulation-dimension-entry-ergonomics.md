# PLAN-0071 Public Simulation Dimension Entry Ergonomics

Plan: PLAN-0071
Spec: SPEC-0015
Related change requests:

- CR-SPEC-0015-public-simulation-dimension-entry-ergonomics

Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/specs`
- `docs/roadmap`

## Goal

Improve the public in-home simulation measurement checkpoint so visitors can
clearly connect the generated guide image to the dimensions they must provide.

## Current State

The dimension screen displayed a heading, the signed guide image, and then a
plain vertical input form. The behavior worked, but the desktop layout did not
use the available space well and the relationship between colored guide lines
and inputs was not strong enough.

## Target Behavior

- Show the guide image and inputs inside one labelled measurement workspace.
- Keep the guide image prominent on desktop and stack cleanly on mobile.
- Place the dimension fields beside the guide image on wide screens.
- Keep the heading and guide image compact enough that the form is discoverable
  without requiring visitors to infer that fields exist below the image.
- Keep the inputs visually neutral while preserving field labels that reference
  the colored guide lines.
- Keep existing field labels, validation, centimetre entry, payload conversion,
  signed URL refresh, and submission behavior intact.

## Workstreams

### 1. Spec And Planning

- [x] Add the accepted change request for dimension-entry ergonomics.
- [x] Update `SPEC-0015` Screen 3 requirements.
- [x] Update the web roadmap.

### 2. Test Coverage

- [x] Add component coverage proving Screen 3 renders one labelled guide-and-form
      workspace.
- [x] Keep existing field rendering, validation, conversion, and submit tests
      passing.

### 3. Implementation

- [x] Restructure Screen 3 around a responsive guide-and-form workspace.
- [x] Reduce copy so the screen keeps only the necessary measurement context.
- [x] Keep neutral field rows without changing the submitted payload.
- [x] Add responsive CSS for desktop and mobile layouts.
- [x] Compact the heading and guide image so measurement fields remain
      discoverable without excessive scrolling.

### 4. Verification

- [x] Run focused Screen 3 tests.
- [x] Run web typecheck.
- [x] Run `pnpm spec:check`.

## Regression Risks

- Label restructuring could break accessibility or `getByLabelText` behavior
  for the numeric inputs.
- CSS changes could make the signed guide image too small on mobile or create
  text overflow in field rows.
- Any change to field order could accidentally alter the payload mapping, so the
  existing submit tests must keep passing.

## Closure Notes

Screen 3 now renders a compact measurement workspace with the signed guide
image as the primary visual reference and a neutral input group beside it on
desktop. The heading and guide image are compact enough that the form is visible
much earlier, especially on tablet-width and split-screen desktop layouts.
Mobile stacks the guide and inputs while preserving readable labels and stable
controls. Existing validation, centimetre-to-metre conversion, signed-guide
refresh, and submission behavior remain unchanged.
