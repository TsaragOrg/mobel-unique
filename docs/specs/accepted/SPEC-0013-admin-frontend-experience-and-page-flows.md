# SPEC-0013 Admin Frontend Experience And Page Flows

Spec: SPEC-0013
Status: accepted
Layer: domain
Parent Spec: SPEC-0005
Depends On: SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0006, SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0012
Areas: web, api, supabase
Implementation Plans: none yet

## Traceability

This spec turns the accepted admin domain, worker, data, API, auth, and public route contracts into concrete administrator frontend page flows.

It follows:

- `SPEC-0001 Repo Foundation`, which defines `apps/web` as the Next.js frontend and separates `dev` and `main` environments;
- `SPEC-0003 Business Context - AI Sofa Visualization`, which requires a private back office for catalog preparation, render preparation, publication, ZIP reuse, and lightweight operational follow-up;
- `SPEC-0005 Admin Catalog and Fabric Management`, which defines sofa, fabric, tag, visual matrix, render coverage, publication, archive, and ZIP export domain behavior;
- `SPEC-0006 Fabric Render Worker`, which defines generated render jobs, private render candidates, retries, failures, and the explicit admin selection boundary;
- `SPEC-0007 In-Home Simulation Worker`, which defines the operational simulation statuses and metadata that future admin operational views may expose safely;
- `SPEC-0009 Data Model And Storage`, which defines public/private storage boundaries, RLS expectations, publication read models, render cells, candidates, source photos, ZIP artifacts, and lightweight operational metadata;
- `SPEC-0010 API Contracts And Edge Functions`, which defines `/api/admin/*`, upload, render coverage, publication, ZIP export, worker, cleanup, and public route contracts;
- `SPEC-0011 Admin Authentication And Authorization`, which defines Supabase Auth, trusted admin device sessions, the first-party Next.js admin API facade, and admin authorization boundaries;
- `SPEC-0012 Public Frontend Experience And Page Flows`, which defines public route behavior that admin copy/open-link flows must target.

This spec is expected to feed admin web implementation plans, route structure, component planning, frontend tests, and QA scenarios.

## Goal

Define the MVP admin frontend route map and page-by-page workflow so that the single MVP administrator can:

- sign in once and remain signed in on a trusted mobile device when valid;
- create, edit, publish, unpublish, and archive sofas;
- create, edit, archive, and assign fabrics;
- create, edit, delete unused, and assign public tags;
- manage visual matrix columns and source photos;
- review render coverage per sofa;
- upload manual renders;
- create and monitor fabric render jobs;
- review private render candidates and select the current render for a cell;
- publish only complete public sofa experiences;
- copy the public visualization link for Shopify;
- request and download ZIP exports for draft or published sofas;
- see lightweight operational state without exposing visitor private image content.

The admin frontend must be task-focused, mobile-capable, secure by default, and strict about public/private boundaries.

## Scope

This spec includes:

- admin route map;
- admin page objectives;
- admin page-level data and controls;
- admin login and trusted-device UX;
- first-party admin API facade usage from the frontend point of view;
- sofa list, create, edit, lifecycle, readiness, and public link flows;
- fabric list, create, edit, archive, and upload flows;
- tag management and assignment flows;
- sofa fabric assignment and public fabric ordering flows;
- visual matrix column, source photo, and source image replacement flows;
- render coverage matrix, manual render, generation job, candidate review, and current-render selection flows;
- publication, unpublication, archive, and destructive confirmation flows;
- ZIP export request, status, and download flows;
- mobile admin behavior;
- loading, empty, validation, error, stale data, and conflict states;
- frontend testing requirements.

## Out Of Scope

This spec does not define:

- public frontend pages, already covered by `SPEC-0012`;
- final visual design system tokens;
- exact admin page layouts or pixel-level component placement;
- multi-admin roles or per-action permissions;
- persistent admin audit tables;
- final privacy wording, consent copy, retention legal basis, or abuse thresholds;
- exact environment variable names or platform deployment settings;
- AI provider prompts, model parameters, or provider billing behavior;
- direct Shopify API synchronization, product import, stock, pricing, cart, checkout, or orders;
- customer accounts, saved galleries, or long-term customer simulation history.

The lightweight simulation operational overview remains partially dependent on a future privacy, retention, abuse, or operations spec because `SPEC-0010` does not yet define dedicated `/api/admin/*` endpoints for listing simulation operational metadata.

## Users And Permissions

### MVP Administrator

The MVP administrator is the only intended back-office user.

The administrator can use the admin frontend only after:

- Supabase Auth session validation succeeds;
- the server-controlled admin claim is verified;
- trusted device state is valid for steady-state admin access.

The administrator can manage all MVP catalog and render preparation workflows defined in accepted specs.

### Authenticated Non-Admin User

An authenticated non-admin user must not access admin pages or admin data.

If a non-admin user reaches an admin route, the frontend must show a safe authorization failure or redirect to login according to `SPEC-0011` behavior. It must not retry with stronger credentials or expose service details.

### Public Visitor

Public visitors cannot access admin routes. Admin routes must not be linked from public navigation.

## Admin Language

Repository-authored admin UI copy must be in English unless a later localization spec requires a French admin interface.

Administrator-entered public labels, such as public sofa names, public descriptions, public tag labels, and public fabric names, can be French customer-facing content because they are displayed to public visitors.

## Route Map

The MVP admin frontend must expose these protected routes:

| Route                        | Purpose                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `/admin/login`               | Admin sign-in, session recovery, and auth error handling.                            |
| `/admin`                     | Admin dashboard with catalog readiness and operational entry points.                 |
| `/admin/sofas`               | Sofa list, lifecycle status, readiness summary, create entry point.                  |
| `/admin/sofas/new`           | Create a sofa draft.                                                                 |
| `/admin/sofas/[sofa_id]`     | Edit one sofa and manage its preparation workflow.                                   |
| `/admin/fabrics`             | Fabric list, lifecycle status, create entry point.                                   |
| `/admin/fabrics/new`         | Create a fabric.                                                                     |
| `/admin/fabrics/[fabric_id]` | Edit or archive one fabric.                                                          |
| `/admin/tags`                | Manage reusable public tags.                                                         |
| `/admin/operations`          | Lightweight operational overview placeholder and future simulation metadata surface. |

The sofa edit route owns the main per-sofa workflow and must expose sections for:

- overview and public metadata;
- assigned tags;
- assigned fabrics and public fabric order;
- visual matrix columns and source photos;
- render coverage and candidates;
- publication readiness and lifecycle actions;
- ZIP exports;
- public visualization link.

Rules:

- all `/admin/*` routes except `/admin/login` require admin authorization;
- all admin routes must emit `noindex, nofollow` metadata;
- admin pages must never expose service-role keys, provider keys, raw private bucket paths, or worker-only function names;
- admin browser workflows must call the first-party Next.js `/api/admin/*` facade, not direct Supabase Edge Function URLs;
- admin routes must not be implemented as public static pages containing private data.

## Admin App Shell

The protected admin shell must include:

- current authenticated admin state or a compact account indicator;
- logout action;
- primary navigation to dashboard, sofas, fabrics, tags, and operations;
- safe loading state while session validation runs;
- safe unauthorized state;
- mobile navigation that does not block core edit actions.

Rules:

- the shell must refresh or validate the session when the admin app opens, resumes, regains network connectivity, or starts a protected action;
- the shell must not force periodic password re-entry while the Supabase session and trusted device remain valid;
- if session refresh fails, the shell must fail closed and require login;
- if the admin claim is removed or the trusted device is revoked, protected pages must become inaccessible.

## Page: Login `/admin/login`

### Objective

Let the provisioned MVP administrator sign in securely and establish a trusted admin device session.

### Required UI

The login page must show:

- email input;
- password input;
- submit action;
- generic invalid-login error;
- safe session-expired message when redirected from a protected route;
- no public signup link.

### Behavior

On successful login:

1. The browser obtains a Supabase Auth session through browser-safe credentials.
2. The first-party admin API facade verifies the session and server-controlled admin claim.
3. The server registers or refreshes trusted device state.
4. The admin is routed to `/admin` or the originally requested protected admin route.

Rules:

- login errors must not reveal whether an email is allowlisted or has an account;
- non-admin authenticated users must receive `403` behavior;
- logout must clear the browser session and trusted-device browser state according to `SPEC-0011`;
- the page must not expose service-role credentials or admin provisioning controls.

## Page: Dashboard `/admin`

### Objective

Give the administrator a compact operational starting point for catalog work.

### Required UI

The dashboard must show:

- sofa count by lifecycle state;
- sofas blocked from publication with top readiness reasons;
- recently updated sofas;
- render jobs needing attention when available from sofa render coverage data;
- quick actions to create a sofa, create a fabric, open tags, and open the sofa list;
- entry point to the lightweight operations page.

Rules:

- dashboard summaries may be approximate or assembled from existing admin list endpoints in the MVP;
- dashboard must not show visitor room photos, generated customer simulation images, private storage paths, or signed URLs;
- dashboard failures must not block direct access to sofa, fabric, or tag management pages.

## Page: Sofas List `/admin/sofas`

### Objective

Let the administrator find sofas, understand publication readiness, and start common lifecycle actions.

### API Usage

The page uses:

- `GET /api/admin/sofas`.

### Required UI

The sofa list must show for each sofa:

- internal name or public name;
- lifecycle state;
- public slug when available;
- public readiness summary;
- render coverage summary when available;
- Shopify URL presence;
- created and updated timestamps;
- manual public order when present;
- actions to open edit, copy public visualization link when available, unpublish, archive, or create a new sofa.

### Behavior

- Draft, published, and archived sofas must be visible to the administrator.
- Draft and archived sofas must be visually distinguishable from published sofas.
- Archived sofas must not expose a delete action.
- The list may filter or group by lifecycle state.
- Advanced search, bulk editing, import, and export are not required for MVP.

## Page: Sofa Create `/admin/sofas/new`

### Objective

Create a private sofa draft without exposing it publicly.

### API Usage

The page uses:

- `POST /api/admin/sofas`.

### Required Fields

The create flow must support:

- internal name;
- public name;
- Shopify order URL;
- public description;
- length in centimeters;
- depth in centimeters;
- height in centimeters;
- footprint type;
- footprint measurements;
- manual public order;
- public tag assignments.

The create flow must not include:

- generic admin notes;
- `created_by`;
- `updated_by`;
- dimension visibility flags;
- pricing;
- stock;
- cart or checkout fields.

### Behavior

- Creating a sofa always creates a draft.
- Saving a draft does not publish it.
- Required publication data may remain incomplete at creation time.
- Source photos must be uploaded after draft creation from `/admin/sofas/[sofa_id]`, because upload requests require a persisted sofa context.
- Validation errors must be actionable and must not expose database or storage internals.
- After successful creation, the admin is routed to `/admin/sofas/[sofa_id]`.

## Page: Sofa Edit `/admin/sofas/[sofa_id]`

### Objective

Provide the complete per-sofa preparation workflow while keeping save, render preparation, and publication as distinct admin decisions.

### API Usage

The page uses:

- `GET /api/admin/sofas/{sofa_id}`;
- `PATCH /api/admin/sofas/{sofa_id}`;
- `GET /api/admin/sofas/{sofa_id}/publication-readiness`;
- per-section endpoints listed below.

### Required Sections

The sofa edit page must include these sections:

- overview and public metadata;
- tags;
- assigned fabrics;
- visual matrix and source photos;
- render coverage;
- publication;
- ZIP exports;
- public visualization link.

The page may implement these as tabs, grouped panels, or a guided workflow. The behavior and data boundaries must remain the same.

### Overview And Public Metadata

The overview section must allow editing:

- internal name;
- public name;
- Shopify order URL;
- public description;
- dimensions in centimeters;
- footprint type and footprint measurements;
- manual public order.

Rules:

- saving metadata must not publish changes by itself;
- invalid edits to a published sofa must be rejected without changing the current public read model;
- public slug is generated automatically and frozen after first publication;
- published slug must not be manually editable.

### Public Visualization Link

The page must show the public visualization link derived from the frozen or generated public slug.

Rules:

- the link target is the public sofa detail route defined by accepted public specs;
- the link must not include fabric, visual position, room photo, or simulation parameters;
- if the sofa is not visitor-usable, the UI must clearly label the link as not currently usable by visitors;
- copying the link must not imply the sofa is published or ready.

## Sofa Tags Section

### Objective

Assign reusable public tags to the sofa and support public catalog filters.

### API Usage

The section uses:

- `GET /api/admin/tags`;
- `PATCH /api/admin/sofas/{sofa_id}` or the implementation-approved sofa tag assignment contract.

### Behavior

- admins can assign existing public tags to the sofa;
- admins can remove assigned tags from the sofa;
- tags shown to public visitors can be French customer-facing content;
- tag assignment alone does not publish the sofa;
- frontend must not hard-code public filter values.

## Page: Tags `/admin/tags`

### Objective

Manage reusable public tags used by public catalog filtering.

### API Usage

The page uses:

- `GET /api/admin/tags`;
- `POST /api/admin/tags`;
- `PATCH /api/admin/tags/{tag_id}`;
- `DELETE /api/admin/tags/{tag_id}`.

### Required UI

The page must show:

- tag public label;
- generated slug when available;
- usage state when provided by the API;
- create action;
- edit action;
- delete action only when deletion is allowed.

### Behavior

- tag delete must be blocked or fail safely when the tag is assigned to any sofa;
- delete is destructive and must require explicit confirmation;
- tag categories, hierarchy, manual public tag ordering, semantic search, and advanced facets are not required for MVP.

## Page: Fabrics List `/admin/fabrics`

### Objective

Let the administrator maintain reusable fabric records.

### API Usage

The page uses:

- `GET /api/admin/fabrics`.

### Required UI

The fabrics list must show:

- internal fabric name;
- public fabric name;
- active or archived state;
- premium flag;
- swatch availability;
- AI reference image availability;
- assignment or usage summary when available;
- created and updated timestamps;
- create and edit actions.

Rules:

- archived fabrics must remain visible to administrators;
- archived fabrics must be visually distinguishable from active fabrics;
- fabric delete must not be offered in the MVP.

## Page: Fabric Create `/admin/fabrics/new`

### Objective

Create a reusable active fabric record with the assets needed for public display and AI render generation.

### API Usage

The page uses:

- `POST /api/admin/uploads`;
- `POST /api/admin/uploads/{upload_id}/complete`;
- `POST /api/admin/fabrics`.

### Required Fields

The create flow must support:

- internal fabric name;
- public fabric name;
- swatch upload;
- AI reference image upload;
- premium flag.

Rules:

- fabric swatch and AI reference upload must use signed upload capabilities created by the admin API;
- AI reference images remain private;
- unsupported content types and oversized render-generation inputs must be rejected through server-side validation;
- the page must not include fabric price adjustment fields.

## Page: Fabric Edit `/admin/fabrics/[fabric_id]`

### Objective

Edit a reusable fabric while preserving historical references.

### API Usage

The page uses:

- `GET /api/admin/fabrics/{fabric_id}`;
- `PATCH /api/admin/fabrics/{fabric_id}`;
- `POST /api/admin/fabrics/{fabric_id}/archive`;
- admin upload endpoints when replacing swatch or AI reference assets.

### Behavior

- active fabrics can be edited and assigned to sofas;
- archived fabrics cannot be newly assigned to sofas;
- archiving a fabric must require confirmation;
- the UI must explain that archiving retains historical references and may require sofa updates if the fabric should no longer appear publicly;
- fabric delete must not be offered.

## Sofa Fabric Assignment Section

### Objective

Assign active fabrics to a sofa, decide which assigned fabrics are intended to be publicly selectable, and control public fabric order.

### API Usage

The section uses:

- `GET /api/admin/sofas/{sofa_id}/fabrics`;
- `PUT /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`;
- `PATCH /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`;
- `DELETE /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`.

### Behavior

- assignment alone does not expose a fabric publicly;
- non-null `public_order` means the admin intends the fabric to be publicly selectable;
- public fabric order controls the default public fabric;
- if a fabric lacks complete render coverage, the UI must show it as incomplete for publication;
- removing a fabric from a published sofa must re-run readiness checks;
- if removing the default fabric would leave no public fabric, publication readiness must fail or the public state must remain unchanged according to API validation.

## Visual Matrix And Source Photos Section

### Objective

Manage the sofa's customer-visible image positions and the source photos used for render generation.

### API Usage

The section uses:

- `GET /api/admin/sofas/{sofa_id}/visual-matrix-columns`;
- `POST /api/admin/sofas/{sofa_id}/visual-matrix-columns`;
- `PATCH /api/admin/visual-matrix-columns/{column_id}`;
- `DELETE /api/admin/visual-matrix-columns/{column_id}`;
- admin upload endpoints for `sofa_source_photo`.

### Required UI

The section must show:

- active visual matrix columns in sequence order;
- public-facing visual position label or cue when available;
- source image state for each column;
- original fabric assignment for each source photo;
- missing or conflicting source photo state;
- create, edit, reorder, source upload, and soft-delete actions.

### Behavior

- admin UI may use the term `visual matrix column`;
- public UI must use `visual position`;
- adding a column to a published sofa must not break the current public read model;
- deleting a column is a soft delete through the API and requires explicit confirmation;
- confirmation must warn that deleting a column affects all fabrics for that sofa;
- replacing a source image does not automatically regenerate other fabric cells in that column;
- replacing a source image must refresh render coverage so the source photo's own original fabric cell is shown as complete from `source_photo`;
- the UI must require explicit regeneration per affected non-source fabric cell when the admin wants alignment with a replacement source image.

## Render Coverage Section

### Objective

Help the administrator complete and review the render matrix required for publication.

### API Usage

The section uses:

- `GET /api/admin/sofas/{sofa_id}/render-coverage`;
- `POST /api/admin/uploads`;
- `POST /api/admin/uploads/{upload_id}/complete`;
- `POST /api/admin/render-cells/{render_cell_id}/manual-render`;
- `POST /api/admin/fabric-render-jobs`;
- `GET /api/admin/fabric-render-jobs/{job_id}`;
- `POST /api/admin/fabric-render-jobs/{job_id}/retry`;
- `POST /api/admin/fabric-render-jobs/{job_id}/cancel`;
- `GET /api/admin/render-cells/{render_cell_id}/candidates`;
- `POST /api/admin/render-candidates/{candidate_id}/use-as-current`.

### Required UI

The render coverage section must show a matrix:

- rows are assigned fabrics;
- columns are active visual matrix columns;
- cells represent the current render state for one sofa, fabric, and visual matrix column.

Each cell must show:

- whether it is complete for publication;
- current source type when available;
- source-photo completion when the cell represents the source photo's original fabric;
- manual render availability;
- active or recent fabric render job state;
- private candidate availability;
- actionable blocker when incomplete.

### Cell Actions

A cell may expose:

- upload manual render;
- generate initial render when the API reports that the cell is eligible;
- regenerate render;
- refine from selected candidate when supported by API;
- open private candidate review;
- use candidate as current render;
- retry failed job;
- cancel queued or processing job when supported.

Rules:

- manual upload sets a private render as current for the cell but does not publish it;
- a cell completed by the current source photo for its original fabric must be shown as complete and must not present initial generation as the normal next action;
- manual upload for a source-photo-complete cell may remain available as an explicit replacement action;
- generated candidates remain private until the admin explicitly selects one as current and publication creates public copies;
- worker success must never automatically select a candidate as current;
- job failures are operational and must not become public render states;
- provider secrets, service credentials, raw private paths, and stack traces must not be displayed;
- private review images must use short-lived signed URLs returned by the admin API.

## Publication Section

### Objective

Make readiness explicit and separate content editing from publication.

### API Usage

The section uses:

- `GET /api/admin/sofas/{sofa_id}/publication-readiness`;
- `POST /api/admin/sofas/{sofa_id}/publish`;
- `POST /api/admin/sofas/{sofa_id}/unpublish`;
- `POST /api/admin/sofas/{sofa_id}/archive`.

### Required UI

The publication section must show:

- current lifecycle state;
- readiness result;
- readiness errors;
- public slug;
- public visualization link;
- publish action when ready;
- unpublish action when published;
- archive action when allowed.

### Behavior

- publish must be unavailable when readiness fails;
- readiness failures must be actionable and safe;
- publish must be a separate explicit action from save;
- publish success must show public slug and public visualization link;
- unpublish and archive require explicit confirmation;
- warnings must mention that Shopify links are maintained manually and may need admin updates;
- invalid publish attempts must not mutate the current public read model;
- archive must not delete the sofa.

## ZIP Exports Section

### Objective

Let the administrator request and download render ZIP exports for Shopify-side reuse.

### API Usage

The section uses:

- `POST /api/admin/sofas/{sofa_id}/render-exports`;
- `GET /api/admin/render-exports/{export_id}`.

### Behavior

- admins can request exports for draft or published sofas whenever render assets exist;
- export availability must not depend on public catalog publication;
- ZIP artifacts are private;
- generated ZIP download URLs must be short-lived and admin-only;
- `expires_at`, when shown, applies only to the generated ZIP artifact cache, not to the admin's ability to request a new export later;
- export errors must be safe and actionable.

## Page: Operations `/admin/operations`

### Objective

Provide a future lightweight operational overview of simulation jobs and usage without exposing private visitor image content.

### Current MVP Contract Status

Accepted product and worker specs require a lightweight operational overview, but `SPEC-0010` does not yet define dedicated admin API endpoints for simulation operational listing.

Until a future privacy, retention, abuse, operations, or API change request defines those endpoints, this page must not display private simulation operational data.

### Allowed Future Data Scope

When the required API contract exists, the page may show:

- selected sofa;
- selected fabric;
- selected visual position;
- job status;
- timestamps;
- attempt counts;
- failure category or safe readable operational message;
- generated output count;
- retention and purge timestamps;
- simple aggregate usage indicators.

The page must not show:

- customer room photos;
- generated customer room outputs;
- private signed URLs;
- private storage paths;
- plaintext emails;
- verification codes;
- customer galleries;
- marketing reuse tools.

## Admin Upload Pattern

Admin uploads must use the signed upload flow from `SPEC-0010`.

Frontend flow:

1. The admin selects a file for a supported purpose.
2. The frontend calls `POST /api/admin/uploads`.
3. The frontend uploads directly with the returned signed upload capability.
4. The frontend calls `POST /api/admin/uploads/{upload_id}/complete`.
5. The frontend uses the returned asset id in the relevant admin workflow.

Rules:

- direct browser writes to arbitrary storage paths are forbidden;
- frontend code must not choose private bucket paths;
- incomplete uploads must not become usable assets;
- file upload completion errors must be shown near the affected field or action;
- upload retry must not create duplicate usable assets unless the API intentionally returns a new upload request.

## Mobile Admin Behavior

The admin frontend must be usable on mobile for core maintenance tasks:

- sign in and remain signed in on a trusted mobile device;
- review dashboard readiness;
- open sofa list;
- edit core sofa fields;
- assign tags and fabrics;
- review publication readiness;
- copy public visualization links;
- request ZIP exports;
- inspect render coverage at a high level.

Complex matrix-heavy tasks, such as detailed render coverage review, visual column management, and candidate comparison, must remain possible on mobile but may be more efficient on desktop.

Rules:

- mobile UI must not hide destructive warnings;
- mobile sticky or persistent actions must not cover form fields or confirmations;
- long forms must preserve entered data across validation failures;
- admin session refresh must not discard unsaved form edits without warning;
- touch targets must be large enough for reliable mobile use.

## Data Fetching And Cache Requirements

Admin pages must prioritize correctness over caching.

Rules:

- admin data responses must not be cached as public static content;
- admin pages that show private or mutable data must use no-store or equivalent behavior;
- after successful mutation, the affected admin data must be refreshed or invalidated;
- stale readiness information must not be used to enable publication;
- stale signed URLs must be refreshed through admin APIs rather than reused indefinitely.

## Error, Empty, And Conflict States

The admin frontend must define safe states for:

- unauthenticated admin access;
- authenticated non-admin access;
- trusted device revoked;
- session refresh failure;
- no sofas;
- no fabrics;
- no tags;
- failed sofa save;
- failed fabric save;
- failed upload request;
- failed upload completion;
- invalid image type or oversized image;
- missing Shopify URL;
- missing public name;
- missing public fabric;
- missing visual matrix column;
- missing or conflicting source photo setup;
- missing fabric swatch;
- missing fabric AI reference image;
- incomplete render coverage;
- render job queued;
- render job processing;
- render job failed;
- render job canceled;
- no candidates for a cell;
- candidate signed URL expired;
- failed candidate selection;
- failed publish;
- failed unpublish;
- failed archive;
- failed ZIP export request;
- failed ZIP export download URL;
- concurrent edit conflict;
- tag cannot be deleted because it is assigned;
- fabric cannot be deleted because fabric deletion is not an MVP operation.

Errors must be actionable and safe. They must not expose service-role credentials, provider keys, raw private bucket paths, SQL details, stack traces, or unrelated visitor personal data.

## Frontend API Boundary

The admin frontend must use the first-party Next.js `/api/admin/*` facade from `SPEC-0011`.

Rules:

- browser code must not call Supabase Edge Functions directly for admin workflows;
- browser code must not call `/api/internal/*`;
- browser code must not call worker-only functions;
- browser code must not read or write Supabase application tables directly;
- browser code must not receive service-role credentials or provider credentials;
- admin endpoints must be called only after session and trusted device validation;
- all state-changing admin actions must use endpoint-specific UI validation and server-side validation.

## Frontend Testing Requirements

Implementation plans for this spec must add tests for:

- anonymous users cannot access protected admin pages;
- authenticated non-admin users cannot access protected admin pages;
- valid admin trusted-device sessions can open `/admin` without repeated login;
- logout clears admin access;
- admin pages call the first-party `/api/admin/*` facade, not direct Edge Function URLs;
- sofa list shows draft, published, and archived states;
- sofa creation creates a draft and does not publish;
- sofa edit does not expose admin notes, actor fields, dimension visibility flags, pricing, stock, cart, or checkout fields;
- invalid edits to a published sofa do not mutate the current public state;
- public visualization link copying does not add fabric, visual position, room photo, or simulation parameters;
- tag deletion is blocked when assigned;
- fabric deletion is not offered;
- fabric archive requires confirmation;
- signed upload flow is used for swatches, AI references, sofa source photos, and manual renders;
- incomplete uploads do not become usable assets;
- assigning a fabric does not make it public without public order and render coverage;
- render coverage matrix maps rows to fabrics and columns to visual matrix columns;
- render job success does not automatically select a candidate as current;
- candidate selection updates current render only through the admin endpoint;
- manual render upload does not publish the render by itself;
- publish is disabled or rejected when readiness fails;
- publish success shows public slug and visualization link;
- unpublish and archive require confirmation;
- ZIP export can be requested for draft and published sofas;
- ZIP signed download URLs are not persisted as durable browser state;
- admin pages never display raw private storage paths, service-role keys, provider keys, or stack traces;
- operations page does not display private simulation data until a future accepted API/privacy spec defines allowed fields.

## Acceptance Criteria

- The admin frontend route map is defined.
- Admin routes are protected and noindexed.
- `/admin/login` supports Supabase Auth login without public signup.
- Trusted-device admin session behavior from `SPEC-0011` is reflected in the admin frontend.
- Admin browser workflows use the first-party Next.js `/api/admin/*` facade.
- The dashboard provides catalog readiness entry points without exposing private visitor data.
- Sofa list, create, and edit flows are defined.
- Sofa creation creates drafts and does not publish content.
- Sofa edit keeps save, render preparation, and publication as separate decisions.
- Admin sofa forms exclude admin notes, actor fields, dimension visibility flags, pricing, stock, cart, and checkout fields.
- Public visualization links are copied from stable public sofa routes and contain no simulation parameters.
- Tags can be created, edited, deleted only when unused, and assigned to sofas.
- Fabrics can be created, edited, archived, assigned to sofas, and cannot be deleted from the back office.
- Fabric swatch and AI reference uploads use admin signed upload flow.
- Sofa fabric assignment and public fabric ordering are defined.
- Visual matrix column and source photo management flows are defined.
- Deleting a visual matrix column is a confirmed soft-delete action.
- Render coverage matrix flows are defined.
- Manual render upload, AI generation, job retry, job cancellation, candidate review, and current-render selection flows are defined.
- Worker outputs remain private until admin selection and publication logic create public copies.
- Publication readiness, publish, unpublish, and archive flows are defined.
- ZIP export request, status, and download flows are defined for draft and published sofas.
- Lightweight simulation operations are identified as a required future API/privacy-dependent surface and must not expose private simulation content before that contract exists.
- Mobile admin behavior is defined for core maintenance tasks.
- Admin frontend error, empty, and conflict states are documented.

## Review Checklist For Next Pass

- Confirm whether the sofa edit route should use tabs, grouped sections, or a guided workflow during implementation planning.
- Confirm the exact manual public catalog ordering UI during implementation planning.
- Confirm the exact public fabric ordering UI during implementation planning.
- Confirm the exact render matrix responsive behavior before implementation.
- Confirm whether `/admin/operations` is implemented as a placeholder or deferred until the future privacy and operations API contract exists.
- Confirm that all admin API needs are covered by `SPEC-0010` or explicitly deferred.
- Confirm that the future frontend technical architecture spec owns caching, server/client boundaries, and route-handler implementation details.

## Open Questions

- None.
