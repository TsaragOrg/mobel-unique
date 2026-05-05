# CR-SPEC-0016 Save Swatch Crop Action

Target spec id: SPEC-0016

## Reason For Change

The accepted swatch cropper spec required a reset action, but admin UX feedback
showed that a `Reset crop` button can confuse non-technical users. After they
adjust the swatch image and zoom, they may click `Reset crop` expecting it to
save their crop, which discards the intended crop selection.

## Proposed Change

Replace the visible `Reset crop` action in the admin fabric create and edit
swatch cropper with a `Save crop` action. The save action must keep the
currently selected crop unchanged and show a clear visual confirmation after it
is clicked. The final fabric create or edit submit still performs the actual
upload through the existing signed upload flow.

The cropper still appears only after selecting a new `Swatch image`, and the
admin can still drag, pinch, use the mouse wheel, and use the zoom slider before
saving the fabric form.

## Impact

- Plans: follow up on PLAN-0049 without reopening storage, API, or worker work.
- Tests: update focused admin page tests so `Save crop` is visible, `Reset crop`
  is absent, saving the crop shows confirmation, and saving does not reset
  zoomed crop values.
- Roadmaps: update the web roadmap entry for PLAN-0049.
- API, database, worker: no change.
- UI: removes the destructive reset affordance from the swatch cropper and adds
  a saved confirmation style.

## Approval Note

Requested by admin UX feedback during implementation review on 2026-05-03.
