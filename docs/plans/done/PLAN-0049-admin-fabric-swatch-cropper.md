# PLAN-0049 Admin Fabric Swatch Cropper

Plan: PLAN-0049
Spec: SPEC-0016
Status: done
Owner area: web
Depends on: SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013, PLAN-0018, PLAN-0044
Affected packages:

- `apps/web`

## Goal

Add a browser-side square cropper to the protected admin fabric create and edit
forms so newly selected swatch images are uploaded as generated square files
through the existing signed upload flow.

This plan must not change storage schema, API contracts, upload route handlers,
fabric mutation contracts, public catalog pages, or AI reference upload behavior.

## Follow-up UX Adjustment

Admin review on 2026-05-03 changed two fabric form details without changing the
upload contract:

- replace the confusing `Reset crop` cropper action with `Save crop`, including
  a visible saved confirmation while keeping the chosen crop unchanged;
- show an immediate framed preview after a new `AI reference image` file is
  selected, so admins can visually confirm the attached reference image before
  creating or saving the fabric.

These changes are documented by
`docs/specs/change-requests/CR-SPEC-0016-save-swatch-crop-action.md` and
`docs/specs/change-requests/CR-SPEC-0016-ai-reference-image-preview.md`.

## Current Surface

- `apps/web/src/app/admin/AdminCatalogPages.tsx` owns the protected fabric
  create and edit pages, the shared `FabricForm`, and the current fabric upload
  flow.
- `apps/web/src/lib/admin-image-upload.ts` already owns browser image
  preparation before signed uploads.
- `apps/web/src/app/admin/AdminCatalogPages.test.tsx` covers fabric create,
  edit, archive, and upload behavior through mocked admin page dependencies.
- `apps/web/src/lib/admin-image-upload.test.ts` covers canvas-based upload
  preparation.
- `apps/web/src/app/globals.css` owns admin form and image preview styling.

## Architecture

Keep the cropper entirely inside the admin web UI. The user selects a swatch
file, the form reads its image dimensions, and the UI stores a square source
rectangle in image pixels:

```ts
interface FabricSwatchCrop {
  sourceSize: number;
  sourceX: number;
  sourceY: number;
}
```

Default reset behavior uses the largest centered square that fits inside the
selected source image:

```ts
const sourceSize = Math.min(width, height);
const sourceX = Math.round((width - sourceSize) / 2);
const sourceY = Math.round((height - sourceSize) / 2);
```

Zoom reduces `sourceSize` while keeping the crop centered and clamped inside the
image. The admin can zoom with the range control, with a two-finger pinch on
touch-capable devices, or with the mouse wheel while the pointer is over the
crop frame. Zoom is capped at `500%`. Dragging moves `sourceX` and `sourceY`,
also clamped inside the image. The preview frame must stay square at every
viewport width.

On form submit, the existing `buildFabricPayload` path still decides whether a
new swatch file exists. When it exists, the upload preparation step creates a
generated `512x512` image file from the chosen crop rectangle and sends that
file through the existing `fabric_swatch` signed upload path. The AI reference
file keeps using its current preparation path unchanged.

## Expected File Structure

- Modify `apps/web/src/lib/admin-image-upload.ts`
  - Add `ADMIN_FABRIC_SWATCH_OUTPUT_PX = 512`.
  - Add `FabricSwatchCrop` and `FabricSwatchCropInput` exports.
  - Add `getDefaultFabricSwatchCrop({ width, height })`.
  - Add a private `normalizeFabricSwatchCrop` helper that clamps `sourceX`,
    `sourceY`, and `sourceSize`.
  - Extend `prepareAdminImageUploadFile` with optional
    `fabricSwatchCrop?: FabricSwatchCrop`.
  - For `purpose: "fabric_swatch"` with a crop, load the image, draw the crop
    source rectangle into a `512x512` canvas, and return a generated `File`
    using the original file name and content type.
  - Keep `fabric_swatch` unchanged when no crop is provided so older tests and
    any non-crop caller remain safe.
- Modify `apps/web/src/lib/admin-image-upload.test.ts`
  - Cover default centered square crop for wide and tall source images.
  - Cover crop normalization when a crop rectangle would leave image bounds.
  - Cover generated swatch file creation: output size, output content type,
    `drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512)`,
    and original image cleanup.
  - Preserve existing AI reference and source-photo resize tests.
- Modify `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Add RU/FR comments for every new value, automatic block, action handler,
    and large cropper section, following the repository TSX comment rules.
  - Add a selected swatch crop model for `FabricCreateContent` and
    `FabricEditContent`.
  - Update `FabricForm` so choosing `Swatch image` shows a square crop preview,
    zoom range control, and reset button.
  - Add pointer dragging inside the square frame for desktop and touch-capable
    browsers.
  - Add two-finger pinch zoom for touch-capable browsers and mouse wheel zoom
    over the square frame for desktop browsers.
  - Pass the selected crop to `buildFabricPayload`.
  - Pass the crop only to the `fabric_swatch` upload preparation call.
  - Keep edit behavior unchanged when the admin does not choose a new swatch
    file.
- Modify `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Cover crop controls appearing only after selecting a new swatch image.
  - Cover fabric create uploading the generated square swatch file instead of
    the raw selected swatch file.
  - Cover AI reference upload continuing to use its selected or resized file
    without a swatch crop.
  - Cover fabric edit without a new swatch keeping the existing swatch asset.
  - Cover fabric edit with a new swatch uploading the generated square swatch
    file.
  - Cover reset returning to the centered square crop.
  - Cover mouse wheel zoom and two-finger pinch zoom updating the submitted
    swatch crop.
- Modify `apps/web/src/app/globals.css`
  - Add admin cropper classes for the square frame, draggable image, crop
    overlay, zoom row, reset button placement, and mobile widths.
  - Keep admin cropper styling scoped under existing admin selectors.
- Update `docs/roadmap/web.md` when implementation is complete.

## Tasks

- [x] Create the feature branch:

  ```bash
  pnpm branch:create -- --type feature --area web --work "Admin fabric swatch cropper" --spec SPEC-0016 --plan PLAN-0049
  ```

- [x] Add failing tests in `apps/web/src/lib/admin-image-upload.test.ts` for
      default crop calculation, crop clamping, and generated square swatch file
      creation.

- [x] Run the focused helper test and confirm it fails for missing crop support:

  ```bash
  pnpm --filter @mobel-unique/web test -- src/lib/admin-image-upload.test.ts
  ```

  Expected before implementation: failure because the crop exports and generated
  swatch preparation do not exist yet.

- [x] Implement the crop helper changes in
      `apps/web/src/lib/admin-image-upload.ts`.

- [x] Run the focused helper test again and confirm it passes:

  ```bash
  pnpm --filter @mobel-unique/web test -- src/lib/admin-image-upload.test.ts
  ```

- [x] Add failing UI tests in
      `apps/web/src/app/admin/AdminCatalogPages.test.tsx` for create-page crop
      controls, create upload using the generated swatch file, edit without a
      new swatch keeping the existing asset, edit with a new swatch using the
      generated file, AI reference upload staying unchanged, and crop reset.

- [x] Run the focused admin page test and confirm it fails for missing cropper
      UI behavior:

  ```bash
  pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
  ```

- [x] Implement the cropper UI, selected swatch crop values, reset action,
      pointer dragging, zoom range, and submit wiring in
      `apps/web/src/app/admin/AdminCatalogPages.tsx`.

- [x] Add the cropper styles in `apps/web/src/app/globals.css`.

- [x] Run the focused admin page test again and confirm it passes:

  ```bash
  pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
  ```

- [x] Run the web typecheck:

  ```bash
  pnpm --filter @mobel-unique/web typecheck
  ```

- [x] Browser-check `/admin/fabrics/new` and `/admin/fabrics/[fabric_id]` with a
      seeded local admin session:
  - selecting a swatch image opens crop controls;
  - dragging changes the visible crop;
  - zoom changes the visible crop;
  - mouse wheel over the crop frame changes the visible crop;
  - two-finger pinch on the crop frame changes the visible crop;
  - reset returns to the centered square crop;
  - submitting creates or updates the fabric;
  - editing without a new swatch keeps the old swatch.

- [x] Update `docs/roadmap/web.md` from Active to Done for PLAN-0049 after
      implementation and verification.

- [x] Run the workflow checks before closing the plan:

  ```bash
  pnpm spec:check
  pnpm --filter @mobel-unique/web build
  ```

## Tests

Required focused tests:

- `pnpm --filter @mobel-unique/web test -- src/lib/admin-image-upload.test.ts`
- `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`

Required workflow checks before completion:

- `pnpm spec:check`
- `pnpm --filter @mobel-unique/web build`

Broader checks are recommended before PR if nearby admin catalog behavior has
changed more than expected:

- `pnpm --filter @mobel-unique/web test`
- `pnpm test`

## Roadmap

Update:

- `docs/roadmap/web.md`

The roadmap should track PLAN-0049 as Active while implementation is in
progress, then Done after the tests and browser checks pass.

## Notes

- Do not add backend image processing for this plan.
- Do not change upload API payloads or fabric mutation payloads.
- Do not crop `AI reference image`.
- Do not retroactively change already uploaded swatch assets.
- Do not add a cropper dependency unless implementation proves native canvas and
  pointer events cannot meet the accepted spec.
- Keep all repository-authored code, docs, tests, UI copy, and roadmap text in
  English. The required RU/FR explanatory comments in `.tsx` files are the
  repository-specific exception for this workspace.
