# PLAN-0054 Admin Render Preview Proxy

Plan: PLAN-0054
Spec: SPEC-0013
Change request: CR-SPEC-0013-admin-render-preview-proxy
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Replace short-lived signed storage URLs in the sofa edit Renders workflow with a
protected admin preview endpoint and browser-local object URLs.

## Scope

- Add a server-side admin storage asset preview contract.
- Add a first-party route under `/api/admin/storage-assets/{asset_id}/preview`.
- Keep private image reads behind admin authorization and trusted-device checks.
- Update the Renders workflow to load current render, candidate, and source
  comparison images from asset ids.
- Keep public catalog, upload, and ZIP export URL behavior unchanged.

## Tasks

- [x] Add failing route-handler tests for the protected preview endpoint.
- [x] Add failing Renders UI tests for object URL previews instead of signed
      preview URLs.
- [x] Implement the catalog store preview reader and route handler.
- [x] Implement the Next.js route file.
- [x] Update default admin page dependencies with a preview URL creator and
      revoker.
- [x] Update the Renders workflow to collect private asset ids, load local
      preview URLs, and revoke them.
- [x] Stop attaching signed private preview URLs to render coverage and render
      candidate responses.
- [x] Update `docs/roadmap/web.md`.
- [x] Move this plan to `docs/plans/done`.
- [x] Run focused route-handler, admin UI, and web typecheck checks.

## Tests

- The preview endpoint returns `image/png` bytes with `Cache-Control: no-store`
  for an authorized admin.
- The preview endpoint returns a safe not-found response for unsupported assets.
- The Renders UI requests preview URLs by private asset id.
- Current render, source comparison, and candidate images use local object URLs
  instead of signed storage URLs.
- Default admin dependencies call only first-party `/api/admin/*` preview routes.

## Roadmap

- Update `docs/roadmap/web.md` with the completed admin render preview proxy
  work.
