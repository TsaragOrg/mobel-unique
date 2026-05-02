# Admin Fabric Swatch Cropper

Spec: SPEC-0016
Status: accepted
Layer: domain
Parent Spec: SPEC-0013
Depends On: SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013
Areas: web
Implementation Plans: PLAN-0049

## Traceability

This spec extends the protected admin fabric management experience described by
SPEC-0013. It follows the existing admin catalog, storage, API, and
authentication boundaries from the dependency specs. It feeds one web
implementation plan, PLAN-0049.

## Goal

Catalog admins need to upload square fabric swatches that are visually aligned
inside the square fabric selector. The admin should be able to choose the visible
square area before the swatch image is uploaded.

## Scope

- Add a square cropper to the admin fabric create and edit form for the
  `Swatch image` field.
- Show the cropper after an admin chooses a new swatch image file.
- Let the admin drag the image inside a square frame.
- Let the admin adjust zoom with a range control.
- Let the admin reset the crop to the default centered fit.
- Generate a square image file in the browser on form submit and upload that
  generated file through the existing swatch upload path.

## Out Of Scope

- Cropper support for `AI reference image`.
- Public catalog UI changes.
- Backend image processing changes.
- Storage schema or API contract changes.
- Retroactive edits to already uploaded swatch assets unless the admin chooses a
  new swatch file in the edit form.

## Users And Permissions

Only authenticated admins who can access the protected fabric create and edit
pages can use this cropper. The change does not introduce new roles,
permissions, or public access.

## User Flow

1. The admin opens the fabric create or edit page.
2. The admin chooses a file in `Swatch image`.
3. The form shows a square preview frame for that selected image.
4. The admin moves and zooms the image until the desired fabric area is inside
   the square.
5. The admin submits the form.
6. The browser creates a square swatch file from the selected crop.
7. The existing admin upload flow uploads the generated square swatch file.
8. The fabric mutation stores the returned swatch asset id as it does today.

If the admin edits a fabric and does not choose a new swatch image, the existing
swatch asset remains unchanged.

## Data Model

No data model changes are required. The generated square swatch uses the existing
storage asset metadata and fabric `swatch_asset_id` fields.

## API

No API changes are required. The feature uses the existing admin upload creation,
signed URL upload, upload completion, and fabric create or update calls.

## Worker Jobs

No worker job changes are required.

## Environment Variables

No environment variable changes are required.

## Acceptance Criteria

- Choosing a new swatch image in the admin fabric form shows square crop
  controls.
- The admin can move and zoom the selected swatch image before submitting.
- Submitting the form uploads a generated square swatch file instead of the raw
  selected swatch file.
- The `AI reference image` upload continues to use its selected file unchanged.
- Editing a fabric without choosing a new swatch image keeps the existing swatch
  asset.
- The implementation has focused web tests for the swatch cropper upload
  behavior.

## Open Questions

- None.
