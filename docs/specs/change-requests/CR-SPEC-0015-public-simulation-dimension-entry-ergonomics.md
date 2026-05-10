# CR-SPEC-0015 Public Simulation Dimension Entry Ergonomics

Target spec ids: SPEC-0015
Related spec ids: SPEC-0007
Status: accepted
Implementation Plans: PLAN-0071

## Reason For Change

The public in-home simulation dimension-entry screen showed the generated guide
image and the required numeric inputs as a simple vertical sequence. On desktop,
that made the visitor compare the photo and the form mentally instead of seeing
them as one measurement task. The form was functional but not ergonomic enough
for a critical checkpoint that blocks final placement generation.

The screen needs to make the generated guide image the primary reference,
explain that each colored line maps to a specific input, and arrange the inputs
in a way that remains easy to scan on desktop and mobile.

## Proposed Change

Screen 3 must present the signed dimension guide image and the measurement form
inside one labelled workspace. The guide image should remain large and visible,
especially on desktop, while the inputs are grouped beside it on wider screens
and below it on smaller screens.

Each input row must use sober neutral styling. The color relationship stays in
the existing field labels, which name the red, blue, and green guide lines
without making the input controls visually colorful.

The top of the screen must stay compact enough that the visitor discovers the
dimension fields without needing to infer that hidden inputs exist below the
guide image. The guide image should be sized as a reference, not as a
full-screen hero.

## Acceptance Criteria

- Screen 3 displays the guide image and measurement fields inside one coherent
  measurement workspace.
- Desktop layout keeps the guide image large and places the input group beside
  the image when space allows.
- Mobile layout stacks the guide image and fields without hiding or overlapping
  text.
- The heading and guide image do not push the measurement fields below the
  obvious first-screen task area on desktop or tablet-sized widths.
- Input rows keep the existing required fields, field order, and payload shape
  while using neutral control styling.
- Existing validation, centimetre-to-metre conversion, signed guide refresh, and
  dimension submission behavior remain unchanged.
