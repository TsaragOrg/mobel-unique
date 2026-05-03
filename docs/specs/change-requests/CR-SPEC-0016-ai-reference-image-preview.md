# CR-SPEC-0016 AI Reference Image Preview

Target spec id: SPEC-0016

## Reason For Change

The admin fabric form already shows a visual swatch cropper after a swatch image
is selected, but the `AI reference image` field only shows the native file input
name. Admin feedback showed that this can make the selected reference image feel
hidden, so users may not be confident that they attached the right image before
creating or saving the fabric.

## Proposed Change

After an admin selects a new `AI reference image`, show an immediate image
preview below the file field. The preview should use the same calm framed visual
treatment as the swatch cropper, without adding crop or zoom controls. Choosing a
different reference image updates the preview, and clearing the field removes it.

The existing upload behavior remains unchanged: the selected AI reference file
continues through the current preparation and signed upload path.

## Impact

- Plans: follow up on PLAN-0049 admin fabric image UX.
- Tests: add a focused admin page test for the AI reference preview.
- Roadmaps: update the web roadmap entry for PLAN-0049.
- API, database, worker: no change.
- UI: adds immediate feedback for the selected AI reference file.

## Approval Note

Requested by admin UX feedback during implementation review on 2026-05-03.
