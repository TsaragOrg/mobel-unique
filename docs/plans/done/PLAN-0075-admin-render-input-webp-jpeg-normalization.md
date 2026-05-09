# PLAN-0075 Admin Generation Input WebP JPEG Normalization

Plan: PLAN-0075
Spec: SPEC-0013
Change request: CR-SPEC-0010-SPEC-0013-admin-render-input-webp-jpeg-normalization
Status: done
Owner area: web
Depends on: SPEC-0006, SPEC-0009, SPEC-0010, SPEC-0013, PLAN-0028
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Prevent worker-incompatible and oversized generation input assets by preparing
admin `fabric_ai_reference`, `sofa_source_photo`, and `manual_render` uploads in
the browser before signed upload. WebP generation inputs become JPEG, and any
of those three upload purposes with a longest edge over 2048 px is resized
before upload.

## Architecture

Extend the existing admin image preparation helper instead of adding a new
upload path. `prepareAdminImageUploadFile` already sits before signed upload
creation, so it is the correct place to decode selected WebP generation inputs,
resize oversized generation inputs to the existing 2048 px longest-edge limit,
and return a prepared `File`.

Keep WebP support for `fabric_swatch`. Include `manual_render` because a manual
render can become the current private render for a published sofa, and public
simulation job creation resolves that current private render as the prepared
sofa asset for placement generation. Add purpose-aware content-type and
dimension validation in the admin upload API so browser bypasses and stale
clients cannot create new WebP or oversized generation input assets. Do not
change the fabric render worker, in-home simulation worker, provider request
shape, or existing stored assets in this plan.

## Scope

### Included

- Convert `fabric_ai_reference` WebP uploads to JPEG before `createUpload`.
- Convert `sofa_source_photo` WebP uploads to JPEG before `createUpload`.
- Convert `manual_render` WebP uploads to JPEG before `createUpload`.
- Resize oversized `manual_render` uploads before `createUpload` when the
  longest edge is greater than 2048 px.
- Include the Sofa edit View Columns source image upload, because that workflow
  calls `prepareAdminImageUploadFile` with purpose `sofa_source_photo`.
- Include the Sofa edit Render Cell manual upload, because that workflow creates
  `manual_render` assets that can later be used as prepared sofa references by
  public simulation jobs.
- Reuse the same canvas pass for WebP conversion and existing oversized-image
  resizing.
- Rename prepared WebP generation input files to a `.jpg` extension.
- Send prepared file `byte_size` and `content_type` to
  `POST /api/admin/uploads`.
- Upload only the prepared file to the signed upload URL.
- Keep `fabric_swatch` WebP uploads accepted.
- Preserve JPEG or PNG output type for non-WebP `manual_render` files while
  resizing, so this plan does not force PNG manual renders to JPEG.
- Reject `image/webp` for `fabric_ai_reference`, `sofa_source_photo`, and
  `manual_render` upload creation.
- Reject signed upload completion for generation input descriptors whose stored
  descriptor content type is `image/webp`.
- Reject signed upload completion for `manual_render` assets over 2048 px on
  the longest edge.
- Update the web roadmap after implementation.

### Excluded

- Worker-side WebP support.
- Gemini provider changes.
- Backfilling or converting existing stored WebP assets.
- Changing fabric swatch crop behavior.
- Forcing non-WebP PNG manual renders to JPEG.
- Changing generated output normalization.
- Changing public simulation image handling.

## Implementation Notes

Use focused changes in `apps/web/src/lib/admin-image-upload.ts`:

- Add a helper such as `isGenerationInputPurpose(purpose)` for
  `fabric_ai_reference`, `sofa_source_photo`, and `manual_render`.
- Add a helper such as `shouldPrepareRenderInput(file, purpose)` that returns
  true when the purpose is a generation input and either the image is WebP or,
  for `fabric_ai_reference`, `sofa_source_photo`, and `manual_render`, the
  longest edge is greater than `ADMIN_RENDER_INPUT_MAX_EDGE_PX`.
- When the selected generation input is WebP, force canvas output to
  `image/jpeg` even if no resize is needed.
- When the selected generation input is not WebP, preserve the output content
  type: JPEG stays JPEG, PNG stays PNG, and oversized `fabric_ai_reference`,
  `sofa_source_photo`, and `manual_render` inputs are resized.
- Add a filename helper that replaces `.webp` with `.jpg` for converted WebP
  files and appends `.jpg` when the selected file has no extension.
- Return an informational message when conversion happens. Use one message for
  conversion-only and one message for conversion plus resize so admins know why
  the uploaded file differs from the selected file.

Use purpose-aware upload validation in `apps/web/src/lib/admin-catalog.ts`:

- Replace the single `IMAGE_CONTENT_TYPES` validation check with a small helper
  that accepts `image/jpeg`, `image/png`, and `image/webp` for existing generic
  image uploads, but accepts only `image/jpeg` and `image/png` for
  `fabric_ai_reference`, `sofa_source_photo`, and `manual_render`.
- Use the same helper in `readUploadDescriptor` or completion preflight so an
  old or forged signed upload descriptor with `purpose:
  "fabric_ai_reference"` and `content_type: "image/webp"` cannot create a
  usable asset. Cover `manual_render` in the same guard.
- Keep `readWebpMetadata` because swatch behavior may still need WebP metadata.

## Tasks

- [ ] Add failing helper tests in
      `apps/web/src/lib/admin-image-upload.test.ts`.
      Cover:
      - a small `fabric_ai_reference` WebP file is converted to JPEG;
      - a small `sofa_source_photo` WebP file is converted to JPEG;
      - a small `manual_render` WebP file is converted to JPEG without resize;
      - an oversized `manual_render` JPEG file is resized before upload;
      - an oversized `manual_render` PNG file is resized while staying PNG;
      - an oversized WebP generation input is resized and converted in one canvas
        pass;
      - a WebP `fabric_swatch` keeps the current swatch behavior;
      - non-WebP generation inputs keep their JPEG or PNG output content type.
- [ ] Add or update an admin page test in
      `apps/web/src/app/admin/AdminCatalogPages.test.tsx` proving the Sofa edit
      View Columns source image upload receives a prepared JPEG when the
      selected `source_photo_*` file is WebP.
- [ ] Add or update an admin page test in
      `apps/web/src/app/admin/AdminCatalogPages.test.tsx` proving the Sofa edit
      Render Cell manual upload receives a prepared JPEG when the selected
      `manual_render_*` file is WebP.
- [ ] Add or update an admin page test in
      `apps/web/src/app/admin/AdminCatalogPages.test.tsx` proving the Sofa edit
      Render Cell manual upload uses the prepared resized file metadata and
      bytes when the selected `manual_render_*` file is oversized.
- [ ] Run the focused helper test and confirm the new preparation cases fail
      before implementation:

```bash
pnpm --filter @mobel-unique/web test -- admin-image-upload
```

- [ ] Implement the minimal `prepareAdminImageUploadFile` changes in
      `apps/web/src/lib/admin-image-upload.ts`.
- [ ] Re-run the helper test and confirm the generation input preparation cases
      pass:

```bash
pnpm --filter @mobel-unique/web test -- admin-image-upload
```

- [ ] Add failing upload validation tests in
      `apps/web/src/lib/admin-catalog.test.ts`.
      Cover:
      - `validateUploadCreatePayload` rejects `image/webp` for
        `fabric_ai_reference`;
      - `validateUploadCreatePayload` rejects `image/webp` for
        `sofa_source_photo`;
      - `validateUploadCreatePayload` rejects `image/webp` for
        `manual_render`;
      - `validateUploadCreatePayload` still accepts `image/webp` for
        `fabric_swatch`;
      - `validateUploadCreatePayload` still accepts `image/png` and
        `image/jpeg` for `manual_render`.
- [ ] Add a focused stale-descriptor completion test in
      `apps/web/src/lib/admin-catalog-store-upload.test.ts` or
      `apps/web/src/lib/admin-catalog-route-handlers.test.ts` proving a WebP
      generation input descriptor cannot become an active `storage_assets` row.
- [ ] Add a focused completion test in
      `apps/web/src/lib/admin-catalog-store-upload.test.ts` proving an
      oversized `manual_render` image cannot become an active `storage_assets`
      row when a browser bypasses preparation.
- [ ] Run the focused admin catalog tests and confirm the new API validation
      cases fail before implementation:

```bash
pnpm --filter @mobel-unique/web test -- admin-catalog admin-catalog-store-upload
```

- [ ] Implement purpose-aware content-type validation in
      `apps/web/src/lib/admin-catalog.ts`.
- [ ] Re-run the focused admin catalog tests and confirm the new validation
      cases pass:

```bash
pnpm --filter @mobel-unique/web test -- admin-catalog admin-catalog-store-upload
```

- [ ] Run the admin page tests to prove existing upload wiring still sends the
      prepared file metadata and prepared file bytes through the signed upload
      path:

```bash
pnpm --filter @mobel-unique/web test -- AdminCatalogPages
```

- [ ] Update `docs/roadmap/web.md` with a `Done` row for PLAN-0075 after the
      code and tests pass.
- [ ] Run the package quality checks:

```bash
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

- [ ] Move this file from `docs/plans/active` to `docs/plans/done` only after
      implementation and verification pass.

## Tests

Focused tests:

```bash
pnpm --filter @mobel-unique/web test -- admin-image-upload
pnpm --filter @mobel-unique/web test -- admin-catalog admin-catalog-store-upload
pnpm --filter @mobel-unique/web test -- AdminCatalogPages
```

Quality checks:

```bash
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

If the implementation touches shared upload behavior outside the planned files,
also run:

```bash
pnpm --filter @mobel-unique/web test
```

## Roadmap

Update `docs/roadmap/web.md` after implementation with a `Done` entry for
PLAN-0075.

## Notes

Existing DEV or PROD `fabric_ai_reference`, `sofa_source_photo`, and
`manual_render` WebP assets are not fixed by this plan. If those assets are
needed for generation, replace them through the admin UI after this plan ships
or create a separate accepted backfill plan. Existing oversized manual render
assets are also not changed by this plan.
