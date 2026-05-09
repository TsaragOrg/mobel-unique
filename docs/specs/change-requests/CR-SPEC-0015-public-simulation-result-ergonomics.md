# CR-SPEC-0015 Public Simulation Result Ergonomics

Target spec ids: SPEC-0015
Related spec ids: SPEC-0007
Status: accepted
Implementation Plans: PLAN-0072

## Reason For Change

The public in-home simulation result screen displayed the final image followed
by actions in a simple vertical flow. The behavior was correct, but the page did
not use desktop space well and could push key actions below the image. The final
result is the highest-value screen in the wizard, so the image must remain easy
to inspect while the next available actions stay visible.

## Proposed Change

Screen 5 must present the signed latest result image and the action area inside
one responsive result workspace. On desktop, the image should be large and
inspectable while a compact action panel sits beside it. On mobile, the same
content should stack without hiding actions below excessive whitespace.

The action panel should include a discreet generated-result count, the
regeneration action when available, the return-to-sofa action, the retention
notice, and the inline regeneration failure notice when needed. When the
regeneration limit is reached, the regeneration button remains absent and the
panel explains that the limit has been reached.

## Acceptance Criteria

- Screen 5 displays the signed latest result image and actions inside one
  responsive result workspace.
- Desktop layout places a compact action panel beside the result image when
  space allows.
- Mobile layout stacks the image and actions without hiding actions below a
  full-height image.
- The generated-result count is visible using the public generation cap.
- When regeneration is unavailable, the regeneration button is removed and the
  limit state is visible.
- While a regeneration request is being submitted, the regeneration button shows
  a submitting state.
- Existing signed-result refresh, regeneration request, previous-result failure
  handling, and retention behavior remain unchanged.
