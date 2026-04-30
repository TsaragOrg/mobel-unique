# PLAN-0028 Admin Render Input Client Resize

Plan: PLAN-0028
Spec: SPEC-0013
Status: done
Owner area: web
Depends on: SPEC-0010, SPEC-0013, CR-SPEC-0010-SPEC-0013-admin-render-input-client-resize
Change request: CR-SPEC-0010-SPEC-0013-admin-render-input-client-resize
Affected packages:

- `apps/web`
- `docs/plans`
- `docs/roadmap/web.md`

## Goal

Resize oversized admin render input photos in the browser before signed upload
so large originals are not stored and `fabric_ai_reference` and
`sofa_source_photo` assets stay within the 2048 px render input limit.

## Architecture

Add a small browser-side image preparation helper for admin upload files. The
helper will return the original file when no resize is needed and a new
prepared `File` when the selected image exceeds the 2048 px longest-edge limit.
The existing admin upload flow will call this helper before `createUpload`, so
the signed upload request, direct storage upload, and completion call all use
the prepared file.

The server-side upload completion guard remains unchanged and continues to
reject invalid or oversized render inputs.

## Scope

### Included

- Resize `fabric_ai_reference` files before upload when the longest edge is
  greater than 2048 px.
- Resize `sofa_source_photo` files before upload when the longest edge is
  greater than 2048 px.
- Preserve aspect ratio and avoid crop, padding, stretching, or reframing.
- Send prepared file `byte_size` and `content_type` to `POST /api/admin/uploads`.
- Upload only the prepared file to the signed URL.
- Show an informational admin message when a file was resized.
- Keep existing server-side validation.
- Update the web roadmap.

### Excluded

- Server-side image resizing.
- Storage of original oversized admin files.
- Changes to `fabric_swatch` upload behavior.
- Changes to `manual_render` upload behavior.
- Worker or provider behavior changes.
- Generated output normalization changes.

## Implementation Notes

Use a focused helper in `apps/web/src/lib/admin-image-upload.ts`.

Recommended exported shape:

```ts
export const ADMIN_RENDER_INPUT_MAX_EDGE_PX = 2048;

export type AdminImageUploadPurpose =
  | "fabric_swatch"
  | "fabric_ai_reference"
  | "sofa_source_photo"
  | "manual_render";

export interface PreparedAdminImageUpload {
  file: File;
  message: string | null;
  resized: boolean;
}

export async function prepareAdminImageUploadFile(input: {
  file: File;
  purpose: AdminImageUploadPurpose;
}): Promise<PreparedAdminImageUpload>;
```

Rules:

- return the original file for `fabric_swatch` and `manual_render`;
- return the original file for render input images already at or below 2048 px;
- resize only `fabric_ai_reference` and `sofa_source_photo` files over 2048 px;
- prefer the original type when it is `image/jpeg`, `image/png`, or
  `image/webp`;
- use quality `0.9` for lossy canvas output when supported;
- include source and output dimensions in the informational message.

## Tasks

- [x] Add helper tests in `apps/web/src/lib/admin-image-upload.test.ts`.
      Cover unchanged non-render purposes, unchanged small render inputs, and
      resized oversized render inputs.
- [x] Implement `apps/web/src/lib/admin-image-upload.ts`.
      Use browser image decoding and canvas output, with test seams for image
      dimensions and canvas blob creation.
- [x] Update `apps/web/src/app/admin/AdminCatalogPages.tsx`.
      Call the helper before `createUpload` in fabric image upload and source
      photo upload flows. Add a small informational message state near the
      affected upload forms. Keep the existing signed upload sequence.
- [x] Update `apps/web/src/app/admin/AdminCatalogPages.test.tsx`.
      Prove `createUpload` receives the prepared file size and content type,
      `uploadToSignedUrl` receives the prepared file, and resize messages are
      shown for AI reference and source photo uploads.
- [x] Keep or add route-handler test coverage that server completion rejects
      oversized `fabric_ai_reference` and `sofa_source_photo` files if a client
      bypasses browser resizing.
- [x] Update `docs/roadmap/web.md` with PLAN-0028.
- [x] Run the narrow web tests first, then the web typecheck, then
      `pnpm spec:check`.
- [x] Move this plan to `docs/plans/done` only after implementation and
      verification pass.

## Tests

Run focused tests first:

```bash
pnpm --filter @mobel-unique/web test -- admin-image-upload
pnpm --filter @mobel-unique/web test -- AdminCatalogPages
pnpm --filter @mobel-unique/web test -- admin-catalog-route-handlers
```

Then run:

```bash
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

If the implementation changes shared behavior beyond the admin web package,
run broader checks:

```bash
pnpm test
pnpm typecheck
```

## Manual Verification

1. Start the web app locally.
2. Sign in as the seeded admin.
3. Create or open a draft fabric.
4. Select an AI reference image larger than 2048 px on the longest edge.
5. Save and confirm the UI reports that the image was resized before upload.
6. Confirm the completed asset reports dimensions no larger than 2048 px.
7. Open a draft sofa with a visual matrix column.
8. Upload a source photo larger than 2048 px on the longest edge.
9. Confirm the UI reports that the image was resized before upload.
10. Confirm the source photo upload completes and render coverage refreshes.

## Roadmap

Update:

- `docs/roadmap/web.md`.

## Notes

The upload completion path in `apps/web/src/lib/admin-catalog.ts` already reads
image metadata from stored bytes and rejects oversized render inputs. That guard
must remain in place because browser-side resizing is a convenience, not a
security boundary.
