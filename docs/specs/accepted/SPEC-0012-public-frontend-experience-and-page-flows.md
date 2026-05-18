# SPEC-0012 Public Frontend Experience And Page Flows

Spec: SPEC-0012
Status: accepted
Layer: domain
Parent Spec: SPEC-0004
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0010
Areas: web, api
Implementation Plans: none yet

## Traceability

This spec turns the accepted public product, worker, data, and API contracts into concrete public frontend page flows.

It follows:

- `SPEC-0001 Repo Foundation`, which defines `apps/web` as the Next.js hehe frontend and Vercel as the web hosting target;
- `SPEC-0003 Business Context - AI Sofa Visualization`, which defines the simulation-first MVP, Shopify separation, privacy-by-default posture, and 24-hour maximum retention for customer room photos and generated in-home simulation outputs;
- `SPEC-0004 Public Customer Experience`, which defines public home, catalog, sofa detail, fabric and visual position selection, email verification before generation, result display, regeneration, Shopify return, public language, SEO, analytics, and mobile-first requirements;
- `SPEC-0007 In-Home Simulation Worker`, which defines the two-stage simulation job lifecycle, statuses, dimension guide checkpoint, regeneration behavior, and result retention behavior that the frontend must present;
- `SPEC-0009 Data Model And Storage`, which defines published public read models, stable public catalog asset URLs, private simulation artifacts, and public/private storage boundaries;
- `SPEC-0010 API Contracts And Edge Functions`, which defines the logical public API endpoints, request and response shapes, signed URL rules, and error semantics used by the public frontend.

This spec is expected to feed public web implementation plans, route structure, component planning, frontend tests, and QA scenarios.

This spec also incorporates
`CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015 In-Home Checkpoint Pump
And Realtime Progress`, which makes Realtime the preferred simulation progress
observation path and keeps HTTP status polling as a fallback.

It also incorporates
`CR-SPEC-0015-SPEC-0020-remove-simulation-email-retention`, which removes the
public simulation marketing/contact consent UI. The public email gate still
collects an email address to send and verify the code, but the email address is
not retained as a lead or commercial contact.

## Goal

Define the MVP public frontend route map and page-by-page user flow so that a visitor can:

- understand the AI sofa visualization offer;
- choose a published sofa;
- choose a public fabric and visual position;
- verify an email address before generation;
- upload or capture a private room photo;
- review the selected sofa and room photo before generation;
- wait through room preparation and final placement processing;
- provide only the dimensions requested by the generated guide;
- view the generated result while retained;
- regenerate when available;
- return to Shopify or the catalog.

The public frontend must be mobile first, French customer-facing, simulation first, SEO-safe for public pages, and privacy-safe for private simulation pages.

## Scope

This spec includes:

- public route map;
- page objectives;
- page-level content and controls;
- public shell behavior;
- catalog filtering and card behavior;
- sofa detail selection behavior;
- exact public simulation wizard steps;
- frontend state transitions for simulation statuses;
- page-level API usage;
- public loading, empty, error, unavailable, expired, and stale-selection states;
- mobile, accessibility, SEO, analytics, and privacy-safe frontend requirements;
- frontend testing requirements.

## Out Of Scope

This spec does not define:

- admin frontend pages;
- admin authentication UI;
- final visual design system tokens;
- exact final French marketing copy;
- exact consent wording, privacy policy wording, retention legal basis, or abuse thresholds;
- exact email provider behavior or email template content;
- AI provider prompts or model parameters;
- Supabase database migrations;
- Supabase Edge Function implementation;
- Shopify theme changes, product synchronization, pricing, cart, checkout, payment, or order state;
- customer accounts, saved galleries, public sharing links, or long-term result storage.

Those topics belong to accepted technical specs, future privacy and operations specs, or implementation plans.

## Users And Permissions

### Public Visitor

A public visitor is unauthenticated for browsing.

The visitor can:

- open public routes;
- browse published catalog data;
- select public fabrics and visual positions;
- verify an email address before simulation generation;
- create and poll only their own simulation job through an opaque access token or equivalent implementation-approved session mechanism;
- view private simulation guide and result artifacts only through short-lived signed URLs returned by the API for their own job;
- return to Shopify through the sofa's stored Shopify order URL.

The visitor cannot:

- access draft, archived, unpublished, or incomplete sofas;
- see admin-only names, private paths, worker internals, provider metadata, stack traces, or private render candidates;
- access another visitor's job, room photo, guide, or result;
- call admin or internal endpoints;
- download private simulation results through a visible MVP download action;
- create a customer account or saved gallery in the MVP.

## Public Language

All public customer-facing UI copy must be in French for the MVP.

Repository-authored implementation identifiers, test names, code comments, and specs remain in English.

The frontend may use English-only internal route names, component names, and analytics event identifiers, but visible labels, helper text, empty states, error states, and CTAs must be French.

## Route Map

The MVP public frontend must expose these routes:

| Route                              | Route Type                           | Indexing                      | Purpose                                                                                                                                                           |
| ---------------------------------- | ------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                | Public marketing page                | Indexable                     | Explain the AI visualization offer and direct visitors to the catalog.                                                                                            |
| `/catalog`                         | Public catalog page                  | Indexable                     | Let visitors browse and filter published sofas.                                                                                                                   |
| `/sofas/[slug]`                    | Public sofa detail page              | Indexable only when published | Let visitors choose fabric and visual position, inspect public description, dimensions, tags, start simulation, or return to Shopify.                             |
| `/sofas/[slug]/simulate`           | Private simulation wizard page       | Noindex                       | Guide email verification, room photo upload, room preparation, dimensions, final placement, result, and regeneration for one selected sofa context.               |
| `/simulations/[simulation_job_id]` | Private simulation continuation page | Noindex                       | Resume polling, dimension entry, processing, result, regeneration, expired, and failure states for an existing job when the browser still has valid access state. |

Rules:

- public sofa slugs are generated and frozen according to accepted specs;
- Shopify manually pasted visualization links must target `/sofas/[slug]`;
- Shopify links must not preselect fabric or visual position in the MVP;
- internal catalog-to-detail navigation may preserve selected fabric state when a visitor previews a fabric on a catalog card;
- simulation access tokens must not be placed in URLs;
- private simulation routes must emit `noindex, nofollow` metadata;
- private simulation routes must not expose private storage paths in route params, query params, metadata, analytics, or visible UI.

## Global Public Shell

The public shell applies to `/`, `/catalog`, and `/sofas/[slug]`.

The shell must include:

- minimal brand/header presence;
- a path back to the catalog from detail and simulation contexts;
- footer links needed for the public site, with final legal links deferred to privacy and operations specs;
- responsive layout that works first on mobile and expands cleanly on desktop.

The shell must not include:

- cart UI;
- checkout UI;
- account login UI;
- public admin links;
- price filtering or stock state;
- dense ecommerce navigation that competes with simulation.

## Page: Home `/`

### Objective

Create desire to simulate a MÖBEL UNIQUE sofa at home and move the visitor toward choosing a sofa.

### Required Content

The home page must include:

- a strong first-viewport message about simulating MÖBEL UNIQUE sofas at home;
- visual material that shows sofas, interiors, or before-and-after visualization intent;
- a concise explanation of the process:
  - choose a sofa;
  - choose a fabric and visual position;
  - upload a room photo;
  - get an AI-generated visualization;
- a primary CTA to open `/catalog`;
- reassurance that ordering happens on Shopify;
- a concise AI limitation message or link to it.

### Behavior

- The primary CTA opens `/catalog`.
- The page must not require public authentication.
- The page must not depend on admin-managed content in the MVP.
- Static curated visuals are acceptable for the MVP.
- The page must keep the simulation explanation and catalog CTA visible even if the catalog later has no published sofas.

### Empty Or Operational States

If catalog status is surfaced on the home page and no published sofas exist, the home page should keep the marketing explanation visible and route visitors to a friendly catalog empty state rather than showing a broken experience.

## Page: Catalog `/catalog`

### Objective

Let visitors visually browse published sofas and understand that each listed sofa can be simulated at home.

### API Usage

The page uses:

- `GET /api/public/catalog`;
- `GET /api/public/catalog/tags`.

### Required UI

The catalog page must show:

- page heading and short simulation-oriented context;
- optional tag filter controls generated from public tags returned by the API;
- published sofa cards;
- loading state;
- empty catalog state;
- no-results state when filters match no sofas;
- clear action to clear filters;
- mobile-friendly incremental pagination when the API returns more results.

Each sofa card must show:

- public sofa name;
- default public render;
- compact public metadata when available;
- up to three public tags returned by the API, in API order;
- visible simulation-oriented cue or CTA;
- action to open `/sofas/[slug]`.

The frontend must not evaluate, reorder, or filter public tags beyond the explicit card display limit. If the API returns more than three tags for one sofa card, the card displays the first three and may indicate that more tags exist without listing them all.

### Filter Behavior

- Filters must be generated dynamically from `GET /api/public/catalog/tags`.
- If no public tags exist, the filter area must be hidden.
- Multiple selected tag filters use `AND` behavior.
- Filter state may be reflected in the URL query string for shareability and back-button behavior.
- Invalid, stale, or unknown filter slugs must not break the page; they may be ignored or removed with a safe visible state.
- Filters must not include price, stock, full-text search, semantic search, advanced sorting, or collection management in the MVP.

### Catalog Pagination Behavior

The catalog must use cursor-based API pagination from `GET /api/public/catalog`.

The default MVP frontend pattern is incremental loading with a visible `Charger plus` action.

Rules:

- the first catalog load must request the first page of published sofas;
- when the API returns `next_cursor`, the UI must show a clear load-more control;
- activating load-more must append the next page without replacing already visible sofa cards;
- the load-more control must show loading, success, empty, and retry states;
- if loading the next page fails, already loaded sofa cards must remain visible;
- changing filters must reset pagination and load the first page for the new filter set;
- clearing filters must reset pagination and load the first unfiltered page;
- duplicate sofa cards must not appear if the API or network retries return overlapping data;
- the browser back button must preserve filter state and should preserve the visitor's approximate catalog position when practical;
- infinite scroll may be added only as progressive enhancement if the explicit load-more control remains available and functional;
- the MVP must not rely on fragile scroll-only pagination on mobile.

The catalog should avoid classic numbered pagination unless implementation plans show that it is more usable for the final content volume.

### Fabric Preview Behavior

Catalog cards must support simple fabric preview when a sofa has multiple public fabrics.

Fabric preview must:

- show only public fabrics;
- use explicit visitor actions for a limited number of public fabrics;
- choose the visible preview limit during implementation based on the final responsive card design;
- apply a stable visible preview limit per breakpoint so cards remain visually consistent across sofas with different fabric counts;
- show a remaining-count indicator such as `+N` when more public fabrics exist than the card preview displays;
- make the full public fabric list available on the sofa detail page;
- update only that sofa card's image to the selected fabric's render for the default visual position;
- keep the selected preview state local to that sofa card;
- keep other sofa cards unchanged;
- make the selected preview state clear to the visitor;
- keep touch targets large enough for mobile;
- not expose incomplete fabrics;
- not trigger navigation to the sofa detail page when the visitor is only changing fabric preview;
- not replace full detail page selection;
- preserve the selected fabric when opening detail only for internal navigation;
- reset to the current valid default fabric if the previewed fabric becomes unavailable after data refresh.

### Empty And Error States

The catalog must show:

- a loading skeleton or progress state while fetching;
- an empty state when no published sofas exist;
- a no-results state when filters match no sofa;
- a data-load failure state with a retry action;
- image-unavailable placeholders instead of broken media.

No state may expose private IDs, internal names, storage paths, provider errors, stack traces, or admin-only details.

## Page: Sofa Detail `/sofas/[slug]`

### Objective

Let a visitor choose fabric and visual position for one published sofa, then start simulation. Shopify ordering remains secondary.

### API Usage

The page uses:

- `GET /api/public/sofas/{public_slug}`.

### Required UI

The detail page must show:

- public sofa name;
- selected public render;
- fabric selector;
- visual position selector;
- primary simulation CTA;
- secondary Shopify order action when a valid Shopify URL exists;
- public sofa description when present;
- public dimensions in centimeters when present;
- all public tags returned by the API for the sofa;
- AI limitation and simulation expectation messaging;
- path back to catalog.

The detail page must not show:

- price;
- cart;
- checkout;
- fabric price adjustment;
- stock state;
- customer account requirement;
- admin-only fields;
- internal render or storage information.
- whether a published render originated from a source photo, manual upload, or AI-generated candidate.

### Default Selection

On first load, the page must select:

- first public fabric according to administrator-defined public fabric order;
- first public visual position according to administrator-defined visual matrix sequence.

When entering from Shopify or a direct URL, the page must use defaults.

When entering from an internal catalog card that had a fabric preview selected, the page may preserve that selected fabric if it remains valid. The visual position still defaults unless implementation explicitly preserves it from an internal-only state.

### Selection Behavior

When the visitor changes fabric:

- the selected visual position stays selected;
- the displayed render changes to the matching fabric and visual position render;
- the displayed render must come from published public assets regardless of the private render source type used by the admin workflow;
- the simulation CTA uses the current selected sofa, fabric, and visual position.

When the visitor changes visual position:

- the selected fabric stays selected;
- the displayed render changes to the matching render;
- the simulation CTA uses the current selected sofa, fabric, and visual position.

If the selected fabric or visual position becomes stale:

- the page must prevent simulation launch;
- the page must show a clear safe message in French;
- the page should offer a valid available selection or a path back to catalog.

### Simulation CTA

The primary CTA opens `/sofas/[slug]/simulate` with the current selected sofa, fabric, and visual position preserved through implementation-approved state.

The selected context may be passed through internal URL query parameters or client state, but private tokens and private storage paths must never be included in URLs.

On mobile, the simulation CTA must be visible on the first screen whenever practical and must become sticky after the initial CTA scrolls away.

The sticky CTA must:

- respect safe-area insets;
- avoid covering fabric and visual position controls;
- avoid covering form fields and mobile keyboards;
- avoid conflicting with consent banners;
- remain keyboard and screen-reader accessible;
- stay visually compact.

### Unavailable Sofa States

If the API returns `404 SOFA_NOT_FOUND`, the page must show a not-found state with a path to `/catalog`.

If the API returns `410 SOFA_UNAVAILABLE`, the page must show a sofa-unavailable state with a path to `/catalog`.

Unavailable states must not reveal whether the sofa is draft, archived, unpublished, incomplete, or otherwise private.

## Page: Simulation Wizard `/sofas/[slug]/simulate`

### Objective

Guide the visitor from selected sofa context to a created in-home simulation job without losing the simulation-first flow.

### Entry Requirements

The wizard requires:

- sofa slug;
- selected public fabric id;
- selected public visual position id.

If selected fabric or visual position state is missing, the wizard may load the sofa detail state and use the current public defaults.

If the selected context is invalid or stale, the wizard must block job creation and guide the visitor back to the sofa detail page or catalog.

### Wizard Steps

The MVP wizard must present these steps in this order:

1. Confirm selected sofa context.
2. Request email verification.
3. Verify email code.
4. Upload or capture room photo.
5. Review selected sofa image and uploaded room photo.
6. Start room preparation.
7. Wait for room preparation.
8. Enter dimensions from the generated guide.
9. Wait for final placement.
10. View result.
11. Regenerate when available.
12. Return to Shopify or catalog.

The UI may combine adjacent steps on one screen when it improves mobile usability, but it must preserve the user decision points and validation boundaries.

### Step 1: Confirm Selected Sofa Context

The screen must show:

- selected sofa name;
- selected fabric name and swatch;
- selected visual position label or cue;
- selected render;
- primary action to continue to email verification;
- secondary action to return to sofa detail and change selection.

The screen must explain that the visitor is preparing a visualization, not placing an order.

### Step 2: Request Email Verification

The screen must collect:

- email address;
- required email-use consent;
- optional commercial contact consent.

Rules:

- required email-use consent must be granted before the request can be submitted;
- optional commercial contact consent must be visibly separate and cannot block simulation when declined;
- the UI must not reveal whether an email has existing history;
- validation messages must be safe and in French.

API:

- `POST /api/public/simulation/email-verifications`.

### Step 3: Verify Email Code

The screen must show:

- safe instructions to check inbox and spam folder;
- verification code input;
- submit action;
- resend state when allowed by the API response;
- safe error state for invalid or expired code.

API:

- `POST /api/public/simulation/email-verifications/{verification_request_id}/verify`.

On success:

- store the returned simulation access token in implementation-approved browser state;
- do not put the token in a URL;
- continue to room photo upload.

### Step 4: Upload Or Capture Room Photo

The screen must let the visitor:

- choose an existing image file;
- capture a photo when the browser and device support it;
- review the selected file before job creation;
- replace the selected file before upload.

The UI must communicate:

- the photo should show the room area where the sofa should be placed;
- the photo is private and used for the simulation purpose;
- private images are retained temporarily and deleted no later than 24 hours after creation;
- AI output can be inaccurate.

The frontend must perform basic client-side checks for file presence and supported image type, while the server remains authoritative for validation.

### Step 5: Review And Create Job

Before job creation, the screen must show:

- selected sofa render;
- selected fabric;
- selected visual position;
- uploaded room photo preview;
- primary action to start simulation.

API:

- `POST /api/public/simulations` using `multipart/form-data`.

Required submitted context:

- `sofa_slug`;
- `fabric_id`;
- `visual_position_id`;
- `room_photo`;
- optional `idempotency_key`.

On success:

- store or retain the simulation access state;
- navigate to `/simulations/[simulation_job_id]`;
- begin Realtime progress observation, with status polling as fallback.

If the upload or job creation fails:

- no fake job should be shown;
- the visitor must be allowed to retry safely;
- errors must not expose storage paths, SQL details, provider errors, or private IDs.

### Step 6: Room Preparation Processing

The page observes progress through the job-scoped Realtime progress surface
when available. It uses `GET /api/public/simulations/{simulation_job_id}` as
the fallback and as the authoritative refresh path for signed URLs.

For `queued` and `room_prep_processing`:

- show a processing state;
- keep selected sofa context visible enough to reassure the visitor;
- avoid implying the order is being placed;
- avoid progress percentages unless backed by real state.

When Realtime or the API reports `awaiting_dimensions`, the page must stop
stage-1 waiting, refetch the status endpoint for a fresh signed guide URL, and
show the dimension guide.

### Step 7: Dimension Guide And Dimension Entry

The screen must show:

- the signed dimension guide image returned by the API;
- only the inputs required by `required_dimensions`;
- unit labels in metres;
- helper text that ties each input to the guide arrows;
- primary action to continue.

For `back_wall`, the only required inputs are:

- wall width;
- wall height.

For `corner`, the only required inputs are:

- left wall width;
- right wall width;
- room height.

The MVP must not ask for:

- room depth;
- camera distance;
- extra free-form room measurements.

API:

- `POST /api/public/simulations/{simulation_job_id}/dimensions`.

### Step 8: Final Placement Processing

For `placement_queued` and `placement_processing`:

- show a final generation processing state;
- keep the latest successful result visible when this is a regeneration and one exists;
- avoid destructive full-screen loading that hides a retained previous result.

The page continues Realtime progress observation and falls back to bounded HTTP
polling when Realtime is unavailable. The status endpoint remains the only
source for signed result URLs.

### Step 9: Result

When the API returns `succeeded`, the page must show:

- latest generated simulation result;
- selected sofa context;
- AI limitation message;
- retention or temporary-availability message;
- regeneration action when `regeneration_available` is true;
- Shopify return action when the sofa has a valid `shopify_order_url`;
- catalog return action.

The result page must not show:

- direct download button;
- public sharing action;
- long-term save action;
- generated image URL in visible text;
- private storage path.

### Step 10: Regeneration

When regeneration is available, the visitor may request another generated output.

API:

- `POST /api/public/simulations/{simulation_job_id}/regenerations`.

Rules:

- the UI must not require re-uploading the room photo;
- the UI must not require re-entering dimensions while retained;
- the UI does not need to show a numeric remaining-generation counter;
- if regeneration fails and a previous result exists, the previous result remains visible with a readable error;
- failed regenerations must not visually consume one of the three successful outputs.

## Page: Simulation Continuation `/simulations/[simulation_job_id]`

### Objective

Let the visitor continue or view an already-created simulation job within the retention window when the browser still has valid simulation access state.

### Behavior

The page must:

- require the implementation-approved simulation access token or session state;
- subscribe to job-scoped Realtime progress when available;
- use `GET /api/public/simulations/{simulation_job_id}` for initial state,
  fallback polling, action-state refresh, and signed URL refresh;
- render the correct state for `awaiting_dimensions`, `placement_queued`, `placement_processing`, `succeeded`, `failed`, `canceled`, or `expired`;
- show a safe unavailable or expired state when access state is missing or invalid;
- provide a path to `/catalog`.

The page must not:

- expose the simulation access token in the URL;
- expose signed URLs in metadata or analytics;
- invite the visitor to restart from an expired result state in the MVP;
- let one visitor access another visitor's job.

## Simulation Status UI Mapping

The frontend must map API status values as follows:

| API Status             | Frontend State                                                             |
| ---------------------- | -------------------------------------------------------------------------- |
| `queued`               | Room preparation waiting or progress state.                                |
| `room_prep_processing` | Room preparation progress state.                                           |
| `awaiting_dimensions`  | Dimension guide and input state.                                           |
| `placement_queued`     | Final placement waiting or progress state.                                 |
| `placement_processing` | Final placement progress state.                                            |
| `succeeded`            | Result state.                                                              |
| `failed`               | Safe failure state with retry guidance only when allowed by current state. |
| `canceled`             | Safe canceled state with catalog return.                                   |
| `expired`              | Expired state with catalog return and no restart action in the MVP.        |

Observation rules:

- Realtime is the preferred progress channel after a simulation job exists;
- HTTP polling is the fallback when Realtime is unavailable, disconnected, or
  unsupported;
- polling must stop when the job reaches `awaiting_dimensions`, `succeeded`,
  `failed`, `canceled`, or `expired`;
- polling may resume after dimension submission or regeneration request;
- polling must avoid aggressive intervals and use bounded backoff;
- if the browser goes offline, the UI should pause or soften observation and
  retry when connectivity returns;
- when the page becomes visible again, the UI should refresh status once;
- signed guide and result URLs must be treated as short-lived and refreshed
  through the status endpoint when needed;
- Realtime payloads must not contain signed URLs, private storage paths,
  provider details, raw worker errors, or simulation access tokens.

## Frontend API Boundary

The public frontend must use the logical public API contracts from `SPEC-0010`.

Rules:

- public frontend code must not read Supabase tables directly;
- public frontend code must not know private bucket paths;
- public frontend code must not call worker functions directly;
- public frontend code must not call admin or internal endpoints;
- public catalog images use stable public URLs returned by public APIs;
- private simulation guide and result artifacts use short-lived signed URLs returned only by authorized simulation status calls;
- service-role credentials and provider keys must never be available to browser code.

## SEO And Metadata

Indexable routes:

- `/`;
- `/catalog`;
- `/sofas/[slug]` only when the sofa is published and available.

Noindex routes and states:

- `/sofas/[slug]/simulate`;
- `/simulations/[simulation_job_id]`;
- unavailable sofa state;
- not-found state;
- expired result state;
- failed private simulation state;
- any page rendering private room photos, private guide images, or private generated outputs.

Public metadata must not include:

- private signed URLs;
- private result previews;
- uploaded room photos;
- email addresses;
- simulation access tokens;
- internal IDs that are not already part of public API responses.

## Analytics

The public frontend may emit minimal analytics events only when analytics consent allows it.

Recommended event concepts:

- home CTA click;
- catalog filter use;
- catalog sofa open;
- catalog fabric preview;
- sofa detail fabric selection;
- sofa detail visual position selection;
- simulation CTA click;
- email verification request;
- email verification success;
- room photo upload selected;
- simulation job created;
- dimension submission;
- result view;
- regeneration request;
- Shopify order click.

Analytics must not include:

- email addresses;
- uploaded room photo data;
- generated image URLs;
- signed URLs;
- private storage paths;
- simulation access tokens;
- free-form room photo metadata;
- provider errors.

Analytics consent behavior remains delegated to the future privacy, retention, and abuse protection spec.

## Accessibility And Mobile Requirements

The public frontend must be mobile first.

Requirements:

- touch targets must be comfortable on mobile;
- forms must remain usable with the mobile keyboard open;
- sticky CTAs must not hide fields, selectors, or error messages;
- selection states must not rely on color alone;
- all interactive controls must have accessible names;
- product images and simulation images must have meaningful alternative text where practical;
- loading states must communicate progress without trapping focus;
- errors must be associated with their relevant fields;
- reduced-motion preferences must be respected for decorative animation;
- keyboard navigation must work for catalog filters, fabric selectors, visual position selectors, forms, and CTAs.

## Error And Empty States

The frontend must define safe states for:

- home page operational content load failure, if any dynamic content is added;
- catalog loading;
- catalog empty;
- catalog no-results;
- catalog data load failure;
- sofa not found;
- sofa unavailable;
- missing public render;
- stale selected fabric;
- stale selected visual position;
- Shopify order URL unavailable;
- email verification request failure;
- invalid or expired verification code;
- unsupported or missing room photo;
- simulation job creation failure;
- room preparation failure;
- dimension submission validation failure;
- placement failure;
- regeneration failure with previous result;
- regeneration failure without previous result;
- expired simulation result;
- missing simulation access state.

All error states must be in French, actionable when possible, and safe to show publicly.

## Frontend Testing Requirements

Implementation plans for this spec must add tests for:

- home CTA opens catalog;
- catalog renders published sofas from the public API;
- catalog hides filter controls when no public tags exist;
- catalog uses `AND` behavior for multiple tag filters;
- catalog no-results state includes a clear filter reset action;
- catalog shows a load-more control when `next_cursor` is present;
- catalog load-more appends results without replacing existing cards;
- catalog load-more failure keeps already loaded cards visible and offers retry;
- changing or clearing filters resets catalog pagination;
- catalog pagination prevents duplicate cards across retries or overlapping pages;
- catalog fabric preview never exposes incomplete fabrics;
- catalog fabric preview uses a stable visible limit per breakpoint and shows a remaining-count indicator when hidden public fabrics exist;
- catalog-to-detail navigation preserves previewed fabric only for internal navigation;
- direct sofa detail entry uses default fabric and visual position;
- sofa detail fabric change preserves visual position;
- sofa detail visual position change preserves fabric;
- sofa detail blocks simulation for stale selection;
- unavailable sofa state does not reveal private status;
- simulation wizard starts with selected sofa context;
- email verification request requires required consent and keeps optional consent separate;
- verification success stores no token in the URL;
- room photo upload screen validates file presence and supported type client-side;
- simulation job creation submits the selected sofa, fabric, visual position, and room photo;
- polling maps `queued`, `room_prep_processing`, `awaiting_dimensions`, `placement_queued`, `placement_processing`, `succeeded`, `failed`, `canceled`, and `expired` to the correct visible states;
- dimension form shows only the fields returned by `required_dimensions`;
- result view has no visible download action;
- regeneration failure keeps the previous result visible when present;
- private simulation routes are noindex;
- private URLs, signed URLs, access tokens, email addresses, and storage paths are not sent to analytics;
- mobile sticky CTA does not cover form fields or selector controls.

## Acceptance Criteria

- The public frontend route map is defined.
- Public pages and private simulation pages have explicit indexing rules.
- Page objectives are defined for home, catalog, sofa detail, simulation wizard, and simulation continuation.
- Public customer-facing UI is French.
- The home page directs visitors to choose a sofa and start the simulation path.
- The catalog page lists only public API data for published sofas.
- Catalog filters come only from public tags assigned to published sofas.
- Catalog pagination is cursor-based and mobile-friendly.
- Catalog load-more behavior keeps already loaded content stable during next-page loading and failure.
- Catalog fabric preview has a responsive visible limit, a remaining-count indicator, and full fabric selection on the sofa detail page.
- The sofa detail page is simulation first and Shopify ordering remains secondary.
- Sofa detail default fabric and visual position follow accepted public ordering rules.
- The simulation CTA launches the wizard with the current selected sofa, fabric, and visual position.
- The simulation wizard includes email verification before generation.
- Required email-use consent and optional commercial contact consent are separate in the UI.
- The room photo upload and review steps are explicit before job creation.
- The frontend maps simulation API statuses to clear visible states.
- Dimension entry uses only the guide-provided fields for `back_wall` and `corner`.
- The result state displays the generated result while retained and does not expose a direct download action.
- Regeneration is available only when the API says it is available.
- Failed regeneration keeps the previous successful result visible when present.
- Expired private simulation states guide the visitor back to catalog and do not offer a restart action in the MVP.
- Public frontend code does not read database tables, private buckets, admin endpoints, internal endpoints, or worker functions directly.
- Public catalog assets use stable public URLs.
- Private simulation artifacts use short-lived signed URLs only through authorized status responses.
- Analytics does not receive personal data, private image URLs, signed URLs, or access tokens.
- Mobile-first and accessibility requirements are documented.

## Review Checklist For Next Pass

- Confirm route names before implementation.
- Confirm `/simulations/[simulation_job_id]` history and refresh behavior before implementation.
- Confirm selected fabric preservation from catalog to detail does not affect Shopify entry links.
- Confirm private simulation access token storage is compatible with the future privacy and abuse spec.
- Confirm exact French UI copy during implementation or design pass.
- Confirm no public page metadata can accidentally include signed URLs.

## Open Questions

- None.
