# PLAN-0018 Admin Fabric Management And Assignment

Plan: PLAN-0018
Spec: SPEC-0013
Status: done
Owner area: web
Depends on: PLAN-0011, PLAN-0016, PLAN-0017, SPEC-0009, SPEC-0010
Affected packages:

- `apps/web`
- `scripts`
- `package.json`
- `docs/roadmap/api.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Deliver the next concrete admin catalog slice: an authenticated administrator can
upload the minimum fabric assets, create and maintain reusable fabric records,
assign active fabrics to draft sofas, control public fabric intent through
`public_order`, and verify that publication readiness no longer fails only
because the sofa has no active public fabric.

This plan extends the first-party `/api/admin/*` facade and the protected
`/admin` UI. Browser-facing code must not call Supabase tables, buckets, raw
Edge Function URLs, or service-role credentials directly.

## Concrete Test Path

After implementation, a local seeded admin should be able to:

1. Sign in at `/admin/login`.
2. Open `/admin/fabrics`.
3. Create a fabric at `/admin/fabrics/new` with:
   - an internal fabric name;
   - a public fabric name;
   - one swatch image;
   - one AI reference image;
   - a premium or non-premium value.
4. See the fabric in `/admin/fabrics` with active state, premium state, swatch
   availability, and AI reference availability.
5. Edit the fabric at `/admin/fabrics/[fabric_id]`.
6. Open an existing draft sofa at `/admin/sofas/[sofa_id]`.
7. Assign the active fabric to the sofa.
8. Set `public_order` to `1` for that sofa fabric assignment.
9. Confirm publication readiness no longer includes
   `MISSING_PUBLIC_FABRIC`.
10. Confirm the sofa can still remain blocked by other legitimate readiness
    errors, such as missing public metadata, missing active visual positions, or
    incomplete render coverage.
11. Archive a fabric and confirm archived fabrics remain visible to admins but
    cannot be newly assigned to sofas.

## Scope

This plan includes the minimal upload, fabric, and assignment behavior needed to
continue the admin catalog flow.

### Admin Upload Endpoints

Add only the upload purposes required for fabric creation:

- `POST /api/admin/uploads`;
- `POST /api/admin/uploads/{upload_id}/complete`.

Supported `purpose` values in this plan:

- `fabric_swatch`;
- `fabric_ai_reference`.

Rules:

- upload initiation requires admin authorization;
- upload completion requires admin authorization;
- unsupported upload purposes must return a stable validation error in this
  plan;
- browser writes must happen only through the scoped signed upload capability
  created by the admin API;
- the API chooses bucket and object path;
- `fabric_ai_reference` assets remain private in `catalog-private-assets`;
- the fabric swatch asset attached to `fabrics.swatch_asset_id` must be an
  active public `catalog-public-assets` asset by the time the fabric can be used
  as a public-ordered sofa fabric;
- raw private object paths, service credentials, provider keys, SQL details, and
  stack traces must not be returned in browser-visible errors;
- image content type, byte size, and image dimensions must be validated
  server-side before an asset can be attached to a fabric.

The first implementation may keep the upload model narrow. It does not need to
support sofa source photos or manual render uploads yet.

### Fabric Endpoints

Add:

- `GET /api/admin/fabrics`;
- `POST /api/admin/fabrics`;
- `GET /api/admin/fabrics/{fabric_id}`;
- `PATCH /api/admin/fabrics/{fabric_id}`;
- `POST /api/admin/fabrics/{fabric_id}/archive`.

Fabric create fields:

- `internal_name`;
- `public_name`;
- `swatch_asset_id`;
- `ai_reference_asset_id`;
- `is_premium`.

Fabric patch fields:

- `internal_name`;
- `public_name`;
- `swatch_asset_id`;
- `ai_reference_asset_id`;
- `is_premium`.

Rules:

- fabrics are created as `active`;
- blank names are rejected;
- unsupported fields are rejected;
- `swatch_asset_id` must refer to an active fabric swatch asset usable for public
  catalog behavior;
- `ai_reference_asset_id` must refer to an active private fabric AI reference
  asset;
- fabric delete is not offered;
- archive is the only MVP removal action;
- archived fabrics remain visible to administrators;
- archived fabrics cannot be newly assigned to sofas;
- archiving preserves historical references and must not hard-delete any fabric,
  asset, sofa assignment, render, job, candidate, or simulation metadata.

### Sofa Fabric Assignment Endpoints

Add:

- `GET /api/admin/sofas/{sofa_id}/fabrics`;
- `PUT /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`;
- `PATCH /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`;
- `DELETE /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`.

Assignment fields:

- `public_order`, nullable non-negative integer.

Rules:

- assignment alone does not make a fabric publicly selectable;
- `public_order: null` means assigned but not intended for public selection;
- non-null `public_order` means the admin intends the fabric to be publicly
  selectable once the rest of readiness passes;
- active fabrics can be assigned to draft sofas;
- archived fabrics cannot be newly assigned;
- duplicate `public_order` values for the same sofa return `409 Conflict`;
- removing an assignment from a draft sofa removes its public fabric intent;
- mutation of published or archived sofa assignments must fail closed with a
  safe conflict response until a publication-state plan defines the full public
  read-model transaction behavior.

### Admin UI

Add protected pages:

- `/admin/fabrics`;
- `/admin/fabrics/new`;
- `/admin/fabrics/[fabric_id]`.

Extend existing protected pages:

- `/admin` with a fabric management entry point;
- `/admin/sofas/[sofa_id]` with a fabric assignment section.

The UI must support:

- fabric list loading, empty, error, and archived states;
- fabric create with swatch upload, AI reference upload, and premium toggle;
- fabric edit and archive confirmation;
- sofa fabric assignment from active fabrics;
- assigned fabric list with `public_order` editing;
- unassign action for draft sofas;
- publication-readiness refresh after fabric assignment changes;
- auth failure handling consistent with existing admin catalog pages.

## Out Of Scope

This plan does not include:

- sofa source photo uploads;
- visual matrix column CRUD;
- manual render uploads;
- render coverage matrix implementation;
- fabric render job creation, retry, cancel, candidate listing, or candidate
  selection;
- publication, unpublication, sofa archive, slug freeze, or full public asset
  copy transaction;
- ZIP export request or download;
- public catalog endpoints and public storefront pages;
- price, stock, cart, checkout, Shopify synchronization, or fabric price
  adjustment fields;
- a generic asset management UI outside the fabric upload flow.

## Architecture

Use the existing `PLAN-0011` and `PLAN-0016` first-party Next.js route-handler
boundary in `apps/web`.

Implementation should:

- keep route handlers thin and authorization-first;
- use service-role Supabase access only after admin authorization succeeds;
- reuse the existing JSON envelope and error response conventions;
- keep validation and response shaping covered by focused unit tests;
- avoid exposing raw Supabase table names, private storage paths, provider
  details, stack traces, or service credentials to browser-visible responses;
- prefer extending the existing admin catalog service layer, but split fabric or
  upload helpers into focused modules if the implementation would otherwise make
  `admin-catalog.ts` too broad.

## Expected File Structure

Expected implementation files:

- Modify or split from `apps/web/src/lib/admin-catalog.ts`
  - Own fabric validation, response shaping, store operations, assignment
    operations, and upload asset validation for this slice.
- Modify or split from `apps/web/src/lib/admin-catalog.test.ts`
  - Test validation, response shaping, asset rules, archive behavior, assignment
    rules, and conflict mapping.
- Modify `apps/web/src/lib/admin-catalog-route-handlers.ts`
  - Add route-handler orchestration for upload, fabric, and assignment
    endpoints.
- Modify `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Test auth, envelopes, validation errors, and fake-store behavior for the new
    routes.
- Create route files under:
  - `apps/web/src/app/api/admin/uploads/route.ts`;
  - `apps/web/src/app/api/admin/uploads/[upload_id]/complete/route.ts`;
  - `apps/web/src/app/api/admin/fabrics/route.ts`;
  - `apps/web/src/app/api/admin/fabrics/[fabric_id]/route.ts`;
  - `apps/web/src/app/api/admin/fabrics/[fabric_id]/archive/route.ts`;
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/fabrics/route.ts`;
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/fabrics/[fabric_id]/route.ts`.
- Modify `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Add fabric pages and sofa assignment UI.
- Modify `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Cover fabric and assignment UI behavior.
- Create page files under:
  - `apps/web/src/app/admin/fabrics/page.tsx`;
  - `apps/web/src/app/admin/fabrics/new/page.tsx`;
  - `apps/web/src/app/admin/fabrics/[fabric_id]/page.tsx`.
- Modify `apps/web/src/app/admin/AdminDashboard.tsx`
  - Add the fabric management entry point.
- Modify `apps/web/src/app/admin/AdminDashboard.test.tsx`
  - Cover the dashboard entry point.
- Create `scripts/spec-0010-admin-fabrics-smoke.mjs`
  - Exercise the manual fabric create, assign, and readiness flow against local
    web and local Supabase when available, and skip clearly when unavailable.
- Create `scripts/spec-0010-admin-fabrics-smoke.test.mjs`
  - Test pass and skip behavior with mocked `fetch`.
- Modify `package.json`
  - Add a local smoke script and include the smoke-script test in the root
    `test` command.
- Update roadmaps when implementation is complete:
  - `docs/roadmap/api.md`;
  - `docs/roadmap/web.md`;
  - `docs/roadmap/workflow.md`.

## Tasks

- [x] Add failing tests for fabric payload validation and response shaping.
- [x] Add failing tests for upload initiation and completion validation for
      `fabric_swatch` and `fabric_ai_reference`.
- [x] Add failing route-handler tests proving anonymous users receive `401` and
      authenticated non-admin users receive `403`.
- [x] Add failing route-handler tests for fabric list, create, get, patch, and
      archive.
- [x] Add failing route-handler tests for sofa fabric list, assign, public order
      patch, and unassign.
- [x] Add failing tests proving archived fabrics cannot be newly assigned.
- [x] Add failing tests proving duplicate sofa fabric `public_order` returns a
      safe conflict response.
- [x] Add failing tests proving readiness no longer reports
      `MISSING_PUBLIC_FABRIC` after assigning an active fabric with non-null
      `public_order`.
- [x] Implement upload request validation and completion for the two fabric
      upload purposes.
- [x] Implement fabric store operations.
- [x] Implement sofa fabric assignment store operations.
- [x] Implement the Next.js API route files listed in this plan.
- [x] Add fabric dashboard navigation.
- [x] Implement `/admin/fabrics`.
- [x] Implement `/admin/fabrics/new`.
- [x] Implement `/admin/fabrics/[fabric_id]`.
- [x] Extend `/admin/sofas/[sofa_id]` with fabric assignment and public order
      controls.
- [x] Add the local admin fabrics smoke script and smoke-script unit test.
- [x] Wire the smoke-script test into `package.json`.
- [x] Update the API, web, and workflow roadmaps after implementation.
- [x] Run focused web tests, typecheck, spec check, root tests, and build.

## Tests

Add or update tests before implementation:

- upload initiation rejects unsupported purposes, unsupported content types,
  oversized files, missing byte sizes, and unauthenticated requests;
- upload completion rejects missing uploads, incomplete objects, invalid image
  metadata, and mismatched asset purposes;
- fabric create rejects blank names, unsupported fields, missing assets, archived
  assets, wrong asset kinds, and duplicate unsafe states;
- fabric list includes active and archived fabrics for admins;
- fabric archive preserves the row and sets archived state instead of deleting;
- archived fabrics cannot be newly assigned to sofas;
- assigned fabrics can be public-ordered and unassigned on draft sofas;
- assignment mutations reject unknown sofas, unknown fabrics, archived fabrics,
  invalid `public_order`, and duplicate public order values;
- readiness response changes after a public-ordered active fabric is assigned;
- `/admin/fabrics` loads, creates, edits, archives, and shows asset availability
  through first-party `/api/admin/*` calls;
- `/admin/sofas/[sofa_id]` assigns fabrics and refreshes readiness through
  first-party `/api/admin/*` calls;
- UI and API responses do not display service-role keys, raw private storage
  paths, provider keys, SQL details, or stack traces.

## Roadmap

Update these files only when the implementation is complete:

- `docs/roadmap/api.md`;
- `docs/roadmap/web.md`;
- `docs/roadmap/workflow.md`.

## Notes

Keep this slice strict. The outcome should make fabric management and sofa
fabric assignment manually testable, but it should not begin the render matrix or
publication transaction before their own plans define those behaviors.
