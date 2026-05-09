# CR-SPEC-0010-SPEC-0013 Admin Generation Input WebP JPEG Normalization

Target spec ids: SPEC-0010, SPEC-0013
Related spec ids: SPEC-0006, SPEC-0009
Status: accepted

## Reason For Change

Admin upload creation and completion currently accept `image/webp` for all
admin image purposes. That is valid for fabric swatches, but it is unsafe for
generation input assets. Fabric render worker input validation accepts only
JPEG and PNG assets, and the in-home simulation placement worker sends the
published sofa render bytes to the provider as a prepared sofa reference. A
manual render can become that prepared sofa reference, but manual render uploads
currently do not get the same browser resize/compression preparation as other
generation inputs.

This allows a `fabric_ai_reference`, `sofa_source_photo`, or `manual_render`
WebP upload to become an active `storage_assets` row, and it also allows large
manual render images to become downstream generation inputs without a bounded
pixel size.

## Proposed Change

### Admin Frontend Upload Behavior

Update `SPEC-0013` so the admin frontend normalizes WebP generation input files
before signed upload:

- `fabric_ai_reference`, `sofa_source_photo`, and `manual_render` uploads must
  be prepared in the browser before `POST /api/admin/uploads`;
- the Sofa edit View Columns image upload is included because it creates
  `sofa_source_photo` assets;
- the Sofa edit Render Cell manual upload is included because it creates
  `manual_render` assets that can become prepared sofa references for in-home
  simulation;
- if any selected generation input file is `image/webp`, the browser must decode
  it and write a JPEG file through canvas before upload;
- if a WebP `fabric_ai_reference` or `sofa_source_photo` is also oversized, the
  same canvas pass should resize it to the existing 2048 px longest-edge limit
  and output JPEG;
- `manual_render` files must also be checked in the browser, and if their
  longest edge is greater than 2048 px, the browser must resize them to 2048 px
  or less before upload;
- WebP `manual_render` files should be converted to JPEG in the same canvas pass;
- non-WebP `manual_render` files should preserve JPEG or PNG output type while
  resizing, so PNG transparency is not removed by this change request;
- prepared WebP generation input file names should use a `.jpg` extension so
  the storage object path and file metadata match the JPEG content type;
- the upload `byte_size` and `content_type` sent to `POST /api/admin/uploads`
  must describe the prepared file;
- the browser must upload only the prepared file, not the selected original
  when conversion or resizing changed it;
- the admin UI should show a short informational message when a WebP generation
  input was converted, with resize details included when resize also happened.

### API Upload Contract

Update `SPEC-0010` so upload validation matches generation input constraints:

- `fabric_swatch` uploads may continue to accept `image/webp`;
- `fabric_ai_reference`, `sofa_source_photo`, and `manual_render` upload
  creation must reject `image/webp` so a browser bypass cannot create a
  generation-incompatible input asset;
- upload completion must continue to validate actual image metadata and reject
  invalid files before creating usable `storage_assets` rows;
- the API must continue to reject `fabric_ai_reference` and
  `sofa_source_photo` assets whose stored image metadata exceeds 2048 px on the
  longest edge;
- the API must also reject `manual_render` assets whose stored image metadata
  exceeds 2048 px on the longest edge.

### Scope Boundaries

This change applies only to admin generation input uploads:

- `fabric_ai_reference`;
- `sofa_source_photo`;
- `manual_render`.

This change does not require:

- adding WebP support to the fabric render worker;
- adding WebP support to the in-home simulation placement worker;
- changing Gemini provider requests;
- converting existing stored WebP assets automatically;
- changing `fabric_swatch` WebP behavior;
- forcing non-WebP PNG manual renders to JPEG;
- changing generated output normalization;
- changing public simulation upload behavior.

## Impact

- Admin UI: WebP generation inputs become JPEG files before signed upload.
- API facade: upload creation becomes purpose-aware for allowed image content
  types.
- Storage: new generation input assets no longer use `image/webp`.
- Worker: no behavior change; existing JPEG and PNG input constraints remain
  valid.
- Existing data: any already stored `fabric_ai_reference` or
  `sofa_source_photo` WebP assets, or manual render WebP assets used by
  published sofas, and any oversized manual render assets still need manual
  replacement or a later backfill if they are required for generation.
- Tests: add focused coverage for WebP-to-JPEG preparation and purpose-specific
  upload validation.

## Approval Note

Accepted after project investigation confirmed that the admin upload API accepts
`image/webp`, existing DEV snapshot data contains WebP fabric AI references,
`fabric_render_worker_validate_input_asset` rejects WebP render inputs, and
public simulation jobs resolve the current private render asset as the prepared
sofa reference for placement generation.
