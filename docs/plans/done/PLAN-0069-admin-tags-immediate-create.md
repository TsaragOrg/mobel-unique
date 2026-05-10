# PLAN-0069 Admin Tags Immediate Create

Plan: PLAN-0069
Spec: SPEC-0013
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Fix the admin Tags page so a newly created tag appears in the tag list
immediately after the administrator clicks Create, without requiring a manual
page refresh.

## Scope

- Keep the existing `/admin/tags` create form and first-party admin API
  dependency.
- Add the tag returned by `createTag` directly to the visible list after the
  create request succeeds.
- Keep tag list ordering by public label.
- Preserve existing tag edit and delete behavior.
- Do not change admin API routes, Supabase storage, public catalog behavior, or
  authentication behavior.

## Tasks

- [x] Add a failing admin page test for a create response that returns the new
      tag while the list reload would still be stale.
- [x] Update the admin tag create handler to keep the submitted form reference
      across the async request and add the returned tag into the local list.
- [x] Add a small merge helper so duplicate tag ids are not shown twice and the
      list remains ordered.
- [x] Update `docs/roadmap/web.md`.
- [x] Run the focused admin UI test, web typecheck, and spec guard.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Roadmap

Update:

- `docs/roadmap/web.md`

## Notes

This is a frontend-only admin fix under `SPEC-0013`. It does not add new
environment variables and does not touch DEV or PROD credentials.
