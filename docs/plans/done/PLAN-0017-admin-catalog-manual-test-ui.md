# PLAN-0017 Admin Catalog Manual Test UI

Plan: PLAN-0017
Spec: SPEC-0013
Status: done
Owner area: web
Depends on: PLAN-0011, PLAN-0016
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Deliver the smallest real admin catalog UI needed for a human administrator to
manually exercise the `PLAN-0016` admin catalog API through the authenticated
`/admin` experience.

This is a product UI slice, not a debug page. It must use the route map from
`SPEC-0013`, the existing Supabase Auth and trusted-device admin boundary, and
the first-party `/api/admin/*` facade only.

## Scope

This plan includes:

- dashboard entry points from `/admin` to sofa and tag management;
- protected `/admin/sofas` list page;
- protected `/admin/sofas/new` draft creation page;
- protected `/admin/sofas/[sofa_id]` draft metadata edit page with tag
  assignment and publication-readiness display;
- protected `/admin/tags` tag list, create, edit, and delete page;
- safe loading, empty, validation, conflict, and auth failure states needed for
  this slice;
- noindex metadata for the new admin routes;
- frontend tests proving the manual create/list/edit/readiness flow uses
  first-party `/api/admin/*` calls.

## Out Of Scope

This plan does not include:

- fabric CRUD;
- signed uploads;
- source photos;
- visual matrix column management;
- render coverage matrix;
- manual render upload;
- fabric render job creation or candidate review;
- publication, unpublication, archive, or ZIP export;
- public storefront pages.

## Manual Test Path

After implementation, a human tester should be able to:

1. Sign in at `/admin/login`.
2. Open `/admin`.
3. Navigate to `/admin/tags` and create a public tag.
4. Navigate to `/admin/sofas/new` and create a draft sofa with that tag.
5. Land on `/admin/sofas/[sofa_id]`.
6. Edit public metadata and tag assignments.
7. See publication readiness remain blocked because fabrics, visual positions,
   and render coverage are not implemented yet.
8. Return to `/admin/sofas` and see the draft in the list.

## Tasks

- [x] Add failing tests for the protected admin catalog UI flow.
- [x] Add failing tests proving the UI calls `/api/admin/*`, not Supabase
      tables or Edge Function URLs directly.
- [x] Implement shared admin-page session handling or reuse the existing admin
      auth boundary without weakening it.
- [x] Add dashboard links for sofa and tag management.
- [x] Implement `/admin/tags`.
- [x] Implement `/admin/sofas`.
- [x] Implement `/admin/sofas/new`.
- [x] Implement `/admin/sofas/[sofa_id]`.
- [x] Add noindex metadata to new admin routes.
- [x] Update `docs/roadmap/web.md`.
- [x] Run focused web tests, typecheck, spec check, root tests, and build.

## Tests

Add or update tests before implementation:

- dashboard exposes catalog entry points only after admin session validation;
- anonymous users are redirected away from catalog admin pages;
- `/admin/tags` loads tags, creates a tag, edits a tag, and shows assigned-tag
  delete conflicts safely;
- `/admin/sofas` loads draft sofas and shows empty state;
- `/admin/sofas/new` creates a draft sofa and routes to the edit page;
- `/admin/sofas/[sofa_id]` loads sofa metadata, tags, and publication
  readiness;
- sofa edit saves metadata and tag assignments through `/api/admin/sofas`;
- UI responses do not display service-role keys, raw private storage paths,
  provider keys, SQL details, or stack traces.

## Roadmap

Update:

- `docs/roadmap/web.md`

## Notes

Keep the UI operational and compact. It should be sufficient for manual API
testing and early admin workflow validation, while clearly leaving later
catalog preparation sections disabled or absent until their own plans implement
the required backend contracts.
