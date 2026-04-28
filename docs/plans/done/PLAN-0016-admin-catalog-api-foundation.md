# PLAN-0016 Admin Catalog API Foundation

Plan: PLAN-0016
Spec: SPEC-0010
Status: done
Owner area: api
Depends on: PLAN-0011, SPEC-0009, SPEC-0011
Affected packages:

- `apps/web`
- `scripts`
- `package.json`
- `docs/roadmap/api.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Deliver the first concrete admin catalog API slice behind the existing
first-party `/api/admin/*` facade: an authenticated administrator can create,
list, retrieve, and edit draft sofa metadata, manage reusable public tags, and
verify that a newly created sofa is not publication-ready yet.

This plan intentionally avoids uploads, fabrics, render coverage, publication,
archive, unpublish, and ZIP exports. The outcome must be small enough to test
end to end while still proving the admin catalog boundary, JSON envelopes,
authorization, validation, and Supabase data access pattern that later catalog
plans will reuse.

## Concrete Test Path

After this plan is implemented, a local seeded admin should be able to:

1. Register or restore a trusted admin device using the `PLAN-0011` auth flow.
2. Create a tag through `POST /api/admin/tags`.
3. Create a draft sofa through `POST /api/admin/sofas`, assigning that tag.
4. Retrieve the sofa through `GET /api/admin/sofas/{sofa_id}`.
5. List the sofa through `GET /api/admin/sofas`.
6. Edit draft public metadata and tag assignments through
   `PATCH /api/admin/sofas/{sofa_id}`.
7. Confirm `GET /api/admin/sofas/{sofa_id}/publication-readiness` returns
   `ready: false` with missing fabric/render coverage reasons.
8. Confirm anonymous and authenticated non-admin requests cannot use these
   endpoints.

## Scope

This plan includes only these logical endpoints:

- `GET /api/admin/sofas`;
- `POST /api/admin/sofas`;
- `GET /api/admin/sofas/{sofa_id}`;
- `PATCH /api/admin/sofas/{sofa_id}`;
- `GET /api/admin/sofas/{sofa_id}/publication-readiness`;
- `GET /api/admin/tags`;
- `POST /api/admin/tags`;
- `PATCH /api/admin/tags/{tag_id}`;
- `DELETE /api/admin/tags/{tag_id}`.

### Sofa Payload

`POST /api/admin/sofas` and `PATCH /api/admin/sofas/{sofa_id}` accept:

- `internal_name`;
- `public_name`;
- `shopify_order_url`;
- `public_description`;
- `length_cm`;
- `depth_cm`;
- `height_cm`;
- `footprint_type`;
- `footprint_measurements`;
- `manual_public_order`;
- `tag_ids`.

Rules:

- `internal_name` is required on create and must be non-blank.
- `tag_ids` replaces the full tag assignment set for this first slice.
- Sofa creation always creates `lifecycle_state: "draft"`.
- No endpoint in this plan generates or mutates `public_slug`.
- Published and archived sofa mutation remains out of scope; if encountered,
  mutation must fail closed with a safe conflict response until the publication
  plan defines the full behavior.
- Requests must reject unsupported admin-only or ecommerce fields such as
  `created_by`, `updated_by`, `published_by`, `admin_notes`,
  `dimension_visibility`, `price`, `stock`, `cart`, and `checkout`.

### Sofa Response

Sofa responses include admin-safe fields needed by `SPEC-0013`:

- `id`;
- `lifecycle_state`;
- `internal_name`;
- `public_name`;
- `public_slug`;
- `shopify_order_url`;
- `public_description`;
- `length_cm`;
- `depth_cm`;
- `height_cm`;
- `footprint_type`;
- `footprint_measurements`;
- `manual_public_order`;
- `tags`;
- `created_at`;
- `updated_at`.

Responses must not expose raw private storage paths, service-role credentials,
provider keys, unrelated visitor personal data, stack traces, or SQL errors.

### Tag Payload

`POST /api/admin/tags` and `PATCH /api/admin/tags/{tag_id}` accept:

- `public_label`.

Rules:

- `public_label` must be non-blank.
- `slug` is generated server-side from `public_label`.
- duplicate slugs or duplicate labels return `409 Conflict`.
- `DELETE /api/admin/tags/{tag_id}` succeeds only when the tag is unused.
- deleting an assigned tag returns `409 Conflict` and does not alter sofa tag
  assignments.

## Out Of Scope

This plan does not include:

- fabric CRUD, because fabric creation requires signed uploads for swatch and
  AI reference assets;
- admin signed upload creation or upload completion;
- sofa fabric assignment and public fabric ordering;
- visual matrix column CRUD;
- source photo upload;
- manual render upload;
- fabric render job creation, retry, cancel, candidate listing, or candidate
  selection;
- public publication, unpublication, archive, slug freeze, or public asset copy
  creation;
- ZIP export request or download;
- admin frontend pages beyond existing auth surfaces;
- public catalog endpoints from `SPEC-0010`;
- new Supabase schema migrations unless implementation proves a small helper
  function is required.

## Architecture

Use the existing `PLAN-0011` first-party Next.js route-handler boundary in
`apps/web`.

Implementation should add a small admin catalog service layer that:

- validates admin authorization before service-role Supabase access;
- uses server-only Supabase credentials only after authorization succeeds;
- keeps route handlers thin and testable;
- centralizes JSON success and error envelopes;
- maps expected database and validation failures to stable API error codes;
- keeps raw Supabase table names and SQL details out of browser-visible errors.

The first implementation may call existing tables directly from server-side
code. Do not add a shared package abstraction unless a later plan needs the
same types across packages.

## File Structure

Expected implementation files:

- Create: `apps/web/src/lib/admin-catalog.ts`
  - Owns admin catalog request validation, response shaping, slug generation,
    and store-facing operations.
- Create: `apps/web/src/lib/admin-catalog.test.ts`
  - Tests validation, forbidden fields, slug generation, conflict mapping, and
    response redaction.
- Create: `apps/web/src/lib/admin-catalog-route-handlers.ts`
  - Owns route-handler orchestration around admin auth and the catalog service.
- Create: `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Tests route envelopes and authorization behavior with fake auth and fake
    catalog stores.
- Create route files under:
  - `apps/web/src/app/api/admin/sofas/route.ts`;
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/route.ts`;
  - `apps/web/src/app/api/admin/sofas/[sofa_id]/publication-readiness/route.ts`;
  - `apps/web/src/app/api/admin/tags/route.ts`;
  - `apps/web/src/app/api/admin/tags/[tag_id]/route.ts`.
- Create: `scripts/spec-0010-admin-catalog-smoke.mjs`
  - Exercises the concrete test path against local Supabase and local web when
    available, and skips clearly when they are not running.
- Create: `scripts/spec-0010-admin-catalog-smoke.test.mjs`
  - Tests smoke-script pass and skip behavior with mocked `fetch`.
- Modify: `package.json`
  - Add the smoke-script test to the root `test` command.
- Modify: `docs/roadmap/api.md`
  - Mark this admin catalog API foundation complete when implementation is
    finished.
- Modify: `docs/roadmap/web.md`
  - Record the first-party admin catalog API routes without claiming UI
    completion.
- Modify: `docs/roadmap/workflow.md`
  - Record the admin catalog smoke script and root test coverage.

## Tasks

- [x] Add failing tests for admin catalog validation and response shaping.
- [x] Add failing route-handler tests proving anonymous users receive `401`
      and authenticated non-admin users receive `403`.
- [x] Add failing route-handler tests for the concrete admin sofa and tag flow.
- [x] Add failing tests proving forbidden fields are rejected and never echoed
      back.
- [x] Add failing tests proving tag deletion is rejected while assigned.
- [x] Add failing tests proving publication readiness returns `ready: false`
      for a newly created draft sofa without fabrics or render coverage.
- [x] Implement the admin catalog validation and response helpers.
- [x] Implement the server-only Supabase catalog store for sofas, tags, sofa
      tag assignments, and publication-readiness reads.
- [x] Implement the Next.js route files listed in this plan.
- [x] Add the local admin catalog smoke script with clear local skip behavior.
- [x] Add the smoke-script unit test and wire it into the root `test` command.
- [x] Update `docs/roadmap/api.md`.
- [x] Run the narrowest relevant tests first, then `pnpm spec:check`,
      `pnpm --filter @mobel-unique/web typecheck`,
      `pnpm --filter @mobel-unique/web test`, and the root `pnpm test`.

## Tests

Add or update tests before implementation:

- admin catalog validation tests for required `internal_name`, blank strings,
  invalid dimensions, invalid `manual_public_order`, malformed `tag_ids`, and
  unsupported fields;
- tag validation tests for blank labels, generated slugs, duplicate conflicts,
  rename conflicts, and assigned-tag delete conflicts;
- route-handler authorization tests for anonymous, non-admin, revoked trusted
  device, and valid admin cases;
- route-handler envelope tests for create/list/get/patch sofa and tag flows;
- route-handler redaction tests proving responses do not include service-role
  credentials, raw private paths, provider keys, SQL details, or stack traces;
- publication-readiness tests proving a draft sofa with no public fabrics and
  no render coverage returns `ready: false`;
- local smoke-script tests for clear skip behavior when local services are not
  reachable;
- optional manual local smoke verification with `pnpm dev:web`.

## Roadmap

Update:

- `docs/roadmap/api.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

The web roadmap update is limited to the first-party API facade routes. This
plan does not deliver admin catalog screens.

## Notes

Keep the first slice boring and narrow. The important proof is that admin-only
catalog state can be safely mutated through the first-party API facade and then
read back through deterministic tests.

Do not add fabrics to this plan. Fabric create/update is not a good first
slice because the accepted contract requires swatch and AI-reference upload
assets, and those belong to the signed-upload plan.

Do not implement publication shortcuts. A newly created sofa should remain a
draft and should fail publication readiness until later plans provide fabrics,
visual matrix columns, render coverage, and publication asset copying.
