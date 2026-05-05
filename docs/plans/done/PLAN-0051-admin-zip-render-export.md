# PLAN-0051 Admin ZIP Render Export

Plan: PLAN-0051
Spec: SPEC-0010
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Implement the authenticated admin ZIP render export flow required by
`SPEC-0010` and surfaced from the sofa edit Publish tab.

The MVP implementation creates the ZIP synchronously inside the first-party
Next.js admin API. It stores the ZIP in the private catalog bucket, records the
request in `sofa_render_exports`, and returns a short-lived signed download URL
through the authenticated status endpoint.

## Scope

- Add admin catalog store methods for creating and reading sofa render exports.
- Add `POST /api/admin/sofas/{sofa_id}/render-exports`.
- Add `GET /api/admin/render-exports/{export_id}`.
- Add sofa edit UI controls to request and download the latest export.
- Keep ZIP artifacts private and return only signed URLs to authenticated admins.
- Include current private render assets available for the sofa at request time.

## Out Of Scope

- Async background ZIP worker orchestration.
- Export actor attribution.
- Long-lived browser persistence of signed ZIP URLs.
- Public access to ZIP artifacts.

## Tasks

- [x] Add failing store and route tests for create/status ZIP export behavior.
- [x] Add failing sofa edit UI test for requesting and downloading an export.
- [x] Implement ZIP generation, private storage upload, export row shaping, and signed URL retrieval.
- [x] Add admin route handlers and Next.js route files.
- [x] Wire admin dependencies and Publish tab UI.
- [x] Update web/API roadmaps.
- [x] Run focused web tests and typecheck.
