# CR-SPEC-0010-SPEC-0013 Admin Render Input Client Resize

Target spec ids: SPEC-0010, SPEC-0013
Related spec ids: SPEC-0005, SPEC-0006, SPEC-0009
Status: accepted

## Reason For Change

Accepted upload contracts require sofa source photos and fabric AI reference
images to be rejected when their longest edge is greater than 2048 px. That
keeps render-generation inputs inside provider and worker limits, but it makes
the admin workflow inconvenient because administrators must manually resize
large product photos before upload.

The product decision is that large original admin render inputs do not need to
be retained. The admin frontend should therefore normalize oversized render
input photos before creating a signed upload request, while the API remains the
authoritative validator.

## Proposed Change

### Admin Frontend Upload Behavior

Update `SPEC-0013` so the admin frontend prepares render input image files
before signed upload:

- `fabric_ai_reference` and `sofa_source_photo` uploads must be checked in the
  browser before `POST /api/admin/uploads`;
- if either image has a longest edge greater than 2048 px, the browser must
  resize it so the longest edge is exactly 2048 px or less;
- resizing must preserve the original aspect ratio;
- resizing must not crop, pad, stretch, rotate, or visually reframe the image;
- the frontend must upload only the prepared file, not the original oversized
  file;
- if a selected render input file is WebP, the browser must convert the
  prepared upload to JPEG because the worker input path accepts JPEG and PNG
  references;
- the upload `byte_size` and `content_type` sent to `POST /api/admin/uploads`
  must describe the prepared file;
- the admin UI should show a short informational message when a selected file
  was resized or converted before upload;
- unsupported image types must still fail before becoming usable assets.

### API Upload Contract

Update `SPEC-0010` to clarify that admin upload clients may transform selected
files before requesting a signed upload capability:

- the API receives metadata for the file that will actually be uploaded;
- the API must still validate content type, byte size, and image dimensions
  after signed upload completion;
- the API must still reject `fabric_ai_reference` and `sofa_source_photo`
  assets whose stored image metadata exceeds 2048 px on the longest edge;
- the API must not trust the browser resize as a substitute for server-side
  validation.

### Scope Boundaries

This change applies only to render-generation input uploads:

- `fabric_ai_reference`;
- `sofa_source_photo`.

This change does not require keeping original oversized files in Supabase
storage, adding a server-side image processing pipeline, changing worker input
validation, or changing generated output normalization.

`fabric_swatch` and `manual_render` uploads keep their existing behavior unless
a later accepted change request defines separate normalization rules for them.

## Impact

- Admin UI: image preparation must happen before signed upload creation for the
  two render input purposes.
- API facade: upload creation and completion stay structurally the same, but
  tests should prove that prepared file metadata is what the browser sends.
- Storage: no original oversized admin render input files are stored.
- Worker: no behavior change; existing 2048 px and content-type input guards
  remain valid.
- Tests: add client-side helper and admin UI tests for resized and unchanged
  upload paths, and keep server-side oversized rejection tests or coverage.
- Roadmap: update the web roadmap after implementation.

## Approval Note

Accepted after reviewing the current implementation. The existing code uploads
the original browser `File` directly to the signed URL and then rejects
oversized render input images during completion. The desired workflow is to
make admin uploads easier by resizing oversized render inputs before upload
while preserving the server-side 2048 px guard.
