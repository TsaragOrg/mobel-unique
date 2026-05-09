# Admin French Localization

Spec: SPEC-0017
Status: accepted
Layer: feature
Parent Spec: SPEC-0013
Depends On: SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0014, SPEC-0016
Areas: web, api
Implementation Plans: PLAN-0076

## Traceability

`SPEC-0013 Admin Frontend Experience And Page Flows` currently requires repository-authored admin UI copy to remain in English unless a later localization spec requires a French admin interface.

This spec is that later localization spec. It keeps the existing admin routes, security boundaries, catalog behavior, publication behavior, upload behavior, render preparation behavior, and API contracts intact while changing the administrator-facing language.

It follows:

- `SPEC-0001 Repo Foundation`, which places the admin UI in `apps/web` and keeps environment separation strict;
- `SPEC-0003 Business Context - AI Sofa Visualization`, which defines the private back office as an MVP capability;
- `SPEC-0005 Admin Catalog and Fabric Management`, which defines admin catalog and fabric workflows;
- `SPEC-0009 Data Model And Storage`, which defines the database and storage boundaries that must not leak into UI copy;
- `SPEC-0010 API Contracts And Edge Functions`, which defines `/api/admin/*` response envelopes and error code conventions;
- `SPEC-0011 Admin Authentication And Authorization`, which defines protected admin access;
- `SPEC-0013 Admin Frontend Experience And Page Flows`, which defines admin page flows and the existing language override point;
- `SPEC-0014 Admin Sofa Edit UX Simplification`, which defines the simplified sofa edit experience;
- `SPEC-0016 Admin Fabric Swatch Cropper`, which defines the admin cropper flow.

This spec feeds one web implementation plan, PLAN-0076, frontend tests, admin API error message checks, and the web roadmap update.

## Goal

Make the private admin experience usable for a French-speaking administrator by showing all administrator-facing text in French across the admin UI and expected admin action errors.

The goal is not to translate the repository, technical identifiers, database fields, route names, or test names. The goal is to translate the back-office experience seen by the administrator.

## Scope

This spec includes French copy for:

- protected admin navigation and shell text;
- `/admin/login`;
- `/admin`;
- `/admin/sofas`;
- `/admin/sofas/new`;
- `/admin/sofas/[sofa_id]`;
- `/admin/fabrics`;
- `/admin/fabrics/new`;
- `/admin/fabrics/[fabric_id]`;
- `/admin/tags`;
- any implemented admin operations placeholder or entry point;
- admin form labels, helper text, placeholders, and validation feedback;
- admin buttons, links, tabs, segmented controls, filters, badges, status labels, and empty states;
- admin destructive confirmations and cancellation text;
- admin upload, crop, preview, render coverage, candidate review, generation, retry, resume, manual upload, publication, archive, restore, and ZIP export copy;
- admin loading, success, failure, unauthorized, forbidden, stale, conflict, and empty states;
- admin screen-reader labels and other accessibility copy, including `aria-label`, visually hidden text, image alt text when present, figure captions, status text, and alert text;
- expected `/api/admin/*` action errors that are displayed to the administrator;
- frontend mappings for admin error codes, publication blocker labels, render cell blocker labels, job status labels, source type labels, lifecycle labels, and readiness labels.

## Out Of Scope

This spec does not require:

- translating repository documentation outside admin-facing product copy;
- translating specs, plans, roadmaps, comments, test names, branch names, commit messages, or operational docs;
- translating route paths such as `/admin/sofas`;
- translating API field names, database table names, storage bucket names, enum values, stable uppercase error codes, or internal identifiers;
- translating worker-only logs, local smoke test terminal output, script output, or developer-only error messages that never appear in the admin UI;
- translating public visitor pages;
- adding multi-language switching, language detection, or a locale preference setting;
- adding a full i18n framework unless the implementation plan proves it is needed;
- translating administrator-entered catalog content automatically;
- changing catalog, render, publication, upload, auth, or worker behavior.

## Users And Permissions

The MVP administrator remains the only intended back-office user.

The language change must not weaken admin access rules. Anonymous users and authenticated non-admin users must remain blocked according to `SPEC-0011`.

French copy must not expose private data, service-role credentials, provider keys, raw private storage paths, SQL details, stack traces, unrelated visitor personal data, or worker-only function names.

## User Flow

When the administrator opens any admin route, the visible interface uses French for the complete task flow:

1. The administrator signs in, sees access checks, and receives auth failures in French.
2. The administrator uses French navigation to move between dashboard, sofas, fabrics, tags, and operations entry points.
3. The administrator creates or edits sofas, fabrics, tags, assignments, source images, render cells, candidates, publication state, archive state, and ZIP exports with French labels and messages.
4. When an admin action succeeds, fails validation, conflicts with current state, or receives a safe server error, the displayed message is French.
5. If the server returns a stable error code, the frontend maps that code to a French message before display.
6. If the server returns a safe expected admin `message`, that message must be French when it is intentionally browser-facing.
7. If an unexpected technical message reaches the browser, the admin UI must replace it with a generic French failure message.

## Copy Ownership

Implementation should prefer a small explicit admin copy layer over scattered text literals.

Rules:

- all static admin UI copy should be easy to audit in code;
- error code mappings must use stable codes, not fragile English matching;
- expected admin API error messages must be French when they are deliberately returned to the browser;
- stable uppercase error codes remain English technical identifiers;
- brand names and product names may remain unchanged;
- common technical product names may remain unchanged when translating them would make the admin workflow less clear;
- public catalog labels entered by the administrator are content, not application copy, and are not translated by code.

## Data Model

No database schema changes are required.

The existing catalog, auth, render, storage, upload, and publication models remain unchanged.

## API

The existing `/api/admin/*` routes remain the admin API boundary.

Required API-facing behavior:

- `/api/admin/*` response shapes remain unchanged;
- `error.code` values remain stable English uppercase technical identifiers;
- expected browser-facing admin `error.message` values must be French where the API intentionally returns a readable message;
- frontend code must prefer `error.code` based French mappings over displaying raw English messages;
- raw unexpected technical messages must not be shown in the admin UI;
- safe generic failures must be displayed in French.

Implementation must translate known expected admin API `message` values at the source or through a shared admin error catalog before the response reaches the browser. English server messages may remain only for developer-only paths or unexpected technical failures that are replaced by generic French copy before display.

## Worker Jobs

No worker behavior changes are required.

Worker job statuses and durable internal values remain unchanged. Any status shown in the admin UI must be translated by the frontend display layer.

Worker `last_error_message` values may remain technical if they are not directly shown. If a worker failure is shown in admin, it must be replaced or mapped to safe French copy.

## Environment Variables

No new environment variables are required.

The admin interface default locale for this feature is `fr-FR`.

## Testing Requirements

The implementation plan must add or update focused tests for:

- admin shell navigation labels are French;
- login page labels, button text, and auth failures are French;
- dashboard entry points are French;
- sofa list, create, edit, workflow tabs, filters, lifecycle labels, readiness labels, and form labels are French;
- fabric list, create, edit, archive, swatch cropper, and upload labels are French;
- tag management labels, empty states, create, edit, and delete confirmation text are French;
- render coverage labels, status labels, source type labels, generation actions, retry, resume, candidate review, refinement, manual render upload, and comparison dialogs are French;
- publication readiness, publish, unpublish, archive, restore, and ZIP export copy is French;
- known admin error codes map to French messages;
- expected admin API action errors that reach the UI are displayed in French;
- raw uppercase technical error codes do not appear as user-facing admin messages;
- unexpected technical errors display a generic French message;
- protected admin access behavior remains unchanged.

Tests may keep English test names and fixture identifiers because repository-authored non-UI content remains English.

## Acceptance Criteria

- The accepted admin language rule from `SPEC-0013` is overridden for the admin interface by this localization spec.
- All visible administrator-facing copy in implemented admin routes is French.
- Admin accessibility copy is French.
- Admin empty, loading, success, validation, error, conflict, and confirmation states are French.
- Admin action errors returned from `/api/admin/*` are displayed in French.
- Known admin error codes and blocker codes map to safe French messages.
- Technical identifiers, route paths, API fields, enum values, database names, and stable error codes remain unchanged.
- Public visitor pages are not changed by this feature.
- No secrets, private paths, SQL details, stack traces, provider internals, or unrelated visitor data are exposed through translated messages.
- Existing admin authorization, catalog, upload, render, publication, archive, and ZIP export behavior remains unchanged.
- Focused admin tests are updated to assert French copy where user-facing text is checked.

## Open Questions

- None.
