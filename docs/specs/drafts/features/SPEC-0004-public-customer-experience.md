# SPEC-0004 Public Customer Experience

Spec: SPEC-0004
Status: draft
Layer: domain
Parent Spec: SPEC-0003
Depends On: SPEC-0003
Areas: web, api
Implementation Plans: none yet

## Traceability

This spec is a follow-up domain spec created from `SPEC-0003 Business Context - AI Sofa Visualization`.

It defines the public customer experience for the visualization tool: public home page, public catalog, simulation-first sofa detail page, fabric and visual position selection, Shopify return path, and public access to a generated simulation result.

This spec must preserve the `SPEC-0003` business decisions:

- the tool is separate from Shopify;
- the public experience is simulation first, not e-commerce first;
- the public experience is mobile first;
- Shopify remains the commercial destination;
- public sofas must be published;
- public fabrics must have complete public-usable render coverage for all required visual positions;
- Shopify links do not preselect fabric or visual position in the MVP;
- customer simulation results can be delivered only while still retained.

This spec refines the original `SPEC-0003` result-download decision through `CR-SPEC-0003-result-email-delivery`: the MVP should not provide a direct browser download button for the private generated simulation image. Instead, visitors can request the result by email while it is still retained.

This spec feeds later specs for in-home simulation flow, privacy and retention, data model and storage, API contracts, and environment configuration.

## Goal

Give visitors a simple public experience that helps them understand the visualization tool, choose a sofa, choose a fabric and visual position, start an in-home simulation, request the generated result by email while available, and return to Shopify to order.

The public experience must be clear enough for direct visitors and focused enough for visitors arriving from a Shopify product page.

## Scope

This spec covers:

- public home page content and purpose;
- public catalog behavior;
- public sofa detail page behavior;
- public visual and interaction intent for the three main public surfaces;
- default fabric and visual position selection;
- fabric selector behavior;
- simple catalog filtering behavior;
- visual position selector behavior;
- simulation launch entry point;
- public simulation result access at a domain level;
- result email delivery at a domain level;
- Shopify order redirect behavior;
- public privacy, AI limitation, and consent messaging before simulation;
- basic analytics expectations;
- public empty, loading, unavailable, and error states;
- mobile-first public experience requirements;
- public accessibility expectations.

## Out Of Scope

This spec does not define:

- admin screens;
- sofa or fabric CRUD;
- render-generation implementation;
- render matrix implementation details;
- exact simulation wizard steps;
- room reference placement;
- dimension collection details;
- image validation details;
- simulation job lifecycle details;
- database schema;
- API endpoint contracts;
- storage buckets;
- authentication implementation;
- AI provider behavior;
- exact retention deletion jobs;
- Shopify theme changes.

Those topics must be covered in dedicated follow-up specs.

## Users And Permissions

### Visitor

A visitor is an unauthenticated public user.

The visitor can:

- open the public home page;
- browse the public catalog;
- open a published sofa detail page;
- choose a public fabric for the selected sofa;
- choose a public visual position for the selected sofa;
- start an in-home simulation from the selected sofa, fabric, and visual position;
- view the generated simulation result after a successful simulation;
- request the generated simulation result by email while it is still available;
- return to Shopify through the stored Shopify order URL.

The visitor cannot:

- access draft, archived, or unpublished sofas;
- see incomplete fabric coverage;
- see generated or uploaded renders that are not part of a published sofa's public-usable visual matrix;
- access the back office;
- edit sofas or fabrics;
- prepare or publish renders;
- view another visitor's private room photo or simulation result;
- create a public account or customer profile in the MVP.

## Public Language

The public customer-facing interface must be in French for the MVP.

Repository-authored specs and code remain in English, but public UI copy shown to visitors should be French unless a later localization spec adds multiple languages.

## Public Information Architecture

The MVP public experience should expose three primary public surfaces:

- Home page: a modern landing page that creates desire to simulate a MÖBEL UNIQUE sofa at home and directs visitors to choose a sofa.
- Catalog page: a visual sofa selection page that makes choosing and starting a simulation feel simple.
- Sofa detail page: a simulation-first product visualization page that lets the visitor choose fabric and visual position, inspect useful sofa information, start simulation, and return to Shopify.

The recommended MVP URL shape is:

- `/`: public home page.
- `/catalog`: public sofa catalog.
- `/sofas/:slug`: public sofa detail page and public visualization link target.

The public sofa identifier must be a stable slug generated automatically by the system.

Slug collision handling must be defined in the admin catalog and data model specs.

Once a sofa is published, its public slug must be frozen.

The MVP must not support editing a published sofa slug, keeping old slug history, or creating automatic slug redirects.

If a published sofa is later unpublished or archived, the existing public URL must show a clear unavailable state instead of redirecting to another sofa. The administrator is responsible for updating any manually pasted Shopify links when a product is no longer available.

The final deployment domain belongs in the environment and deployment spec. The URL shape can be refined during technical specification if needed, but the public product behavior must remain the same.

The public experience should include a minimal header, a footer, and a clear way to return from a sofa detail page to the catalog.

## Entry Paths

### Entry From Shopify

1. The customer views a sofa on Shopify.
2. The customer clicks a manually added visualization link.
3. The link opens the public sofa detail page for that sofa.
4. The page loads with the default public fabric and default public visual position.
5. The customer can change fabric or visual position before starting the simulation.

Shopify links must not preselect fabric or visual position in the MVP.

### Direct Entry

1. The visitor opens the visualization tool directly.
2. The visitor lands on the public home page.
3. The visitor opens the catalog.
4. The visitor selects a published sofa.
5. The visitor reaches the sofa detail page.
6. The visitor can choose a fabric and visual position before starting the simulation.

## Home Page

The public home page is a landing page for the visualization tool.

Its only business goal is to make visitors want to run a simulation and guide them toward choosing a sofa.

The page must communicate both simplicity and technology:

- simplicity: the visitor should understand that simulating a sofa at home is easy;
- technology: the page should clearly mention that the tool uses artificial intelligence to create the visualization.

The visual direction must feel modern, polished, and desirable. The page should use strong imagery and concise messaging rather than dense product information.

The home page should include:

- a clear hero message about simulating MÖBEL UNIQUE sofas at home;
- attractive visuals that show sofas, interiors, or the idea of before and after visualization;
- a short explanation of how the AI-assisted simulation works;
- one or more clear CTAs that invite the visitor to choose a sofa and start the simulation path;
- reassurance that the experience is for visualization and that ordering happens on Shopify;
- a mobile-first layout.

The home page should explain the process in a small number of steps:

- choose a sofa;
- choose a fabric and visual position;
- upload a room photo;
- get an AI-generated visualization.

Home page visual content should be static curated content for the MVP. It does not need to be managed from the back office at launch.

The home page must not include:

- cart behavior;
- checkout behavior;
- product pricing;
- fabric price adjustments;
- customer account creation.

## Catalog Page

The catalog page is a visual sofa selection page.

Its goal is to make choosing a sofa easy and to keep reminding the visitor that each sofa can be simulated at home.

The page must use available space to show sofas attractively, especially on mobile. It should avoid heavy text, dense controls, or e-commerce complexity.

The catalog must list published sofas only.

Draft and archived sofas must not appear in the public catalog.

Each catalog item should show enough information to help the visitor choose a sofa:

- sofa name;
- default public render;
- compact key metadata if available;
- visible simulation-oriented action or reminder;
- action to open the sofa detail page.

Each catalog item should make simulation feel immediately available. This can be done through a visible CTA, badge, icon, or short label such as "Simulate at home".

The catalog card should keep the visual focus on the sofa image and simulation CTA.

When a card becomes the main visible card after scrolling pauses, the UI may show a subtle minimal simulation cue, such as a lightweight 3D-like or AI-visualization animation. This cue must support the simulation concept without distracting from browsing, hurting performance, or creating accessibility problems.

The catalog should let visitors preview fabric changes directly from the catalog item when the sofa has multiple public fabrics.

Catalog fabric preview must:

- show public fabric options only;
- swap the sofa card image directly to the equivalent default public visual position for the selected fabric;
- remain simple and touch-friendly on mobile;
- not expose incomplete fabrics;
- not replace the full detail page fabric and visual position selection.

The catalog may include simple filters based only on public sofa tags assigned by the administrator when creating or editing sofas.

Administrators can reuse existing public sofa tags or create new tags when preparing a sofa.

Examples of possible tags include:

- `2 seats`;
- `3 seats`;
- `4 seats`;
- `corner`;
- `non-corner`;
- any other simple public tag created by the administrator.

These are not search-engine features. They are simple visual filter chips or controls that help visitors reduce the sofa list.

The MVP must not hard-code catalog filter values in the public frontend. Public filters must be generated dynamically from the public sofa tags that exist on published sofas.

If no published sofa uses a tag, that tag should not appear as a public catalog filter.

Catalog filters must be simple and optional. The MVP must not include:

- semantic search;
- full-text search;
- complex faceted search;
- price filters;
- stock filters;
- advanced sorting;
- collection management unless a later product decision adds it.

If no filter is selected, the catalog must show all published sofas in the default public order.

The default catalog order must show the most recently created published sofas first, unless the administrator has explicitly defined a manual public order.

If filters produce no matching sofas, the catalog must show a clear no-results state. The customer-facing message should communicate: no sofa matches the current search or filter selection.

The no-results state must include a clear action to clear filters and return to the full catalog.

When multiple public tag filters are selected, the catalog must use `AND` behavior: a sofa must have all selected tags to remain visible.

If no public tags exist on published sofas, the catalog must hide the filter area entirely.

The MVP does not require a specific filter display order. Filters can be displayed in the available system order unless a later admin or data model spec defines ordering.

If there are no published sofas, the catalog must show a clear empty state that explains that no visualizations are available yet.

Clicking a sofa card image should open the sofa detail page, except when the visitor is interacting with fabric preview controls on that card.

If the visitor previews a fabric on a catalog card and then opens the detail page from that card, the detail page should preserve the selected fabric and show the equivalent sofa detail state for that fabric.

This catalog-to-detail fabric preservation applies only to internal navigation inside the visualization tool. Shopify links must still open the sofa detail page with the default public fabric and default public visual position.

## Sofa Detail Page

The sofa detail page is the core public page of this spec.

It must be simulation first:

- the primary flow is fabric selection, visual position selection, and simulation launch;
- the secondary flow is returning to Shopify to order.

The first screen on mobile must make the simulation path obvious. The current render, fabric selection or access to fabric selection, visual position selection or access to visual position selection, and simulation CTA must be easy to reach without forcing the visitor through dense product information first.

The sofa detail page must show:

- sofa name;
- current selected public render;
- fabric selector;
- visual position selector;
- primary simulation action;
- secondary Shopify order action;
- useful sofa information provided by the administrator;
- clear messaging that final ordering happens on Shopify.

Useful sofa information may include:

- dimensions;
- public description;
- public sofa tags assigned by the administrator, such as seat-count or configuration tags;
- other public attributes prepared by the administrator.

Dimensions must be displayed in centimeters when they are public.

The detail page should present this information in a minimal, well-organized layout below or around the simulation-first area. It must not distract from the primary simulation CTA.

The sofa detail page must not show:

- cart;
- checkout;
- product price;
- fabric price adjustment;
- stock management;
- customer account requirements.

## Public Defaults

When the sofa detail page loads, the default state must be:

- first public fabric according to the administrator-defined public fabric order;
- first public visual position according to the administrator-defined visual matrix column sequence.

If no public fabric or no public visual position is available, the sofa must not be reachable as a published public sofa.

The same default behavior applies whether the visitor arrives from Shopify or from the catalog.

## Public Sofa Attributes

Administrators can provide public sofa attributes that help customers choose a sofa.

This spec expects the public experience to support simple, structured attributes such as:

- public sofa tags, such as seat-count or corner-configuration tags created by the administrator;
- dimensions;
- short public description;
- other simple public attributes prepared in the back office.

Public attributes may be used in two ways:

- display on catalog cards or sofa detail pages;
- simple catalog filtering.

Public attributes must not become a complex product search system in MVP.

The admin catalog and data model specs must define how attributes are created, typed, ordered, and marked as public.

Sofa dimensions should be displayed publicly when dimensions are available and marked public by the administrator.

## Fabric Selector

The fabric selector must show only fabrics that are public for the current sofa.

A fabric can be public only when it has complete public-usable render coverage across all required visual positions for the sofa.

Each fabric option should show:

- fabric name;
- fabric swatch image;
- premium label when the fabric is marked premium;
- selected state;
- unavailable state only if needed for transient loading or error handling.

The premium label must stay visually secondary. The selector should keep the focus on the fabric image or swatch, the sofa render, and the simulation action.

The public selector must not expose incomplete fabrics.

When the visitor changes fabric:

- the selected visual position must remain the same position in the sofa's visual matrix;
- the displayed render must update to the equivalent public-usable render for the selected fabric and current visual position;
- the simulation action must use the currently selected sofa, fabric, and visual position.

Fabric selection must be especially easy on mobile. The UI should avoid small targets, hidden horizontal scrolling traps, or interactions that make it hard to compare fabrics quickly.

## Visual Position Selector

The visual position selector must show the public image positions defined for the selected sofa.

A public visual position is the visitor-facing representation of an admin-managed visual matrix column.

The public UI must not expose the internal term `visual matrix column` to visitors.

Each visual position option should show:

- stable ordering defined by the administrator's visual matrix column sequence;
- selected state;
- an understandable visual cue, thumbnail, or text label when available.

When the visitor changes visual position:

- the selected fabric must remain selected;
- the displayed render must update to the public-usable render for the selected visual position and current fabric;
- the simulation action must use the currently selected sofa, fabric, and visual position.

## Simulation Launch

The simulation launch action must start from the current selected sofa, fabric, and visual position.

The action must hand off the selected context to the in-home simulation flow.

The public in-home simulation flow should guide the visitor through these visible steps:

1. Confirm the selected sofa, fabric, and visual position to simulate.
2. Upload or capture a photo of the room area where the sofa should be placed.
3. Show a preparation screen with both the selected sofa image and the uploaded room photo.
4. Let the visitor start the room preparation step through a clear action such as `Simuler` or `Générer`.
5. Let the system prepare the room photo by removing large furniture and any existing sofa when possible.
6. Show the prepared room photo, cleaned or emptied where possible, with visual dimension guides drawn directly on the image.
7. Ask the visitor to provide the room dimensions needed for scale estimation in fields that correspond clearly to the visual guides:
   - room length;
   - room width or depth;
   - room height.
8. Ask for the camera-depth or camera-position distance when needed, so the generated placement can respect the photographed perspective.
9. Let the visitor continue once the required guide dimensions are provided.
10. Process the final sofa placement simulation through the backend.
11. Show the generated in-home simulation result with the selected sofa placed in the prepared room image.
12. Let the visitor regenerate the result if the output is not satisfactory, subject to the MVP generation limit.
13. Let the visitor request the result by email while it is still retained.
14. Let the visitor return to Shopify through the sofa's stored order URL.
15. Let the visitor return to the public catalog.

The MVP generation limit is three total generated results for one simulation attempt, including the initial result and up to two regenerations.

The public UI does not need to display a numeric remaining-generation counter in the MVP.

If regeneration is no longer available, the public experience should remove or disable the regeneration action and keep the latest generated result available while retained.

The public experience must keep the AI limitation message visible or easily discoverable around simulation preparation and result display. The message must explain that the visualization is AI-generated, can be inaccurate, and does not replace real measurements, in-store advice, or final verification before purchase.

This spec does not define the detailed simulation wizard implementation. The in-home simulation spec must define:

- room photo upload steps;
- room-photo preparation and furniture-removal behavior;
- room references;
- dimension collection;
- visual dimension guide behavior;
- camera-depth or camera-position distance behavior;
- image validation;
- simulation processing;
- regeneration counting and limits;
- retry behavior;
- failure states;
- result display details.

The public experience must make it clear that the visitor is preparing an in-home simulation, not placing an order.

Before the customer starts the in-home simulation flow, the public experience must clearly communicate:

- the customer will upload a private room photo;
- the uploaded room photo and generated simulation result are used for the simulation purpose;
- the private simulation images are retained temporarily and deleted no later than 24 hours after creation;
- the AI-generated visualization is an estimate and can be inaccurate;
- the simulation does not replace professional measurement, in-store advice, or final verification before purchase.

The simulation CTA should remain visually dominant over the Shopify order action.

On the sofa detail page, the simulation CTA should be available from the first mobile screen whenever practical. If the exact layout requires scrolling, the page must still keep the next simulation step obvious and easy to reach.

On mobile, the sofa detail page must use a sticky simulation CTA pattern after the visitor scrolls past the first simulation action.

The sticky CTA must be implemented carefully:

- it must respect safe-area insets on mobile devices;
- it must not hide required fabric or visual position controls;
- it must not cover form fields or the keyboard during input;
- it must not conflict with cookie or consent banners;
- it must remain accessible by keyboard and screen readers;
- it must avoid excessive height and visual noise;
- it must preserve enough space for the visitor to inspect sofa details.

## Simulation Result Access And Email Delivery

After a successful in-home simulation, the visitor must be able to view the generated simulation result.

The generated result should be displayed directly in the simulation result experience.

The result experience should provide these customer actions:

- regenerate the result when regeneration is still available and the visitor is not satisfied;
- request the generated result by email while it is still retained;
- return to Shopify through a clear action such as `Commander ce canapé`;
- return to the public catalog.

The MVP must not expose direct browser download of the generated private simulation result.

Instead, the visitor can request the generated result by email while it is still retained by the system.

The email request form belongs to the in-home simulation flow, not to the sofa detail page.

To request the result by email, the visitor must provide an email address inside the simulation flow and complete the required consent step.

The required consent step must explain that the private room photo and generated result are retained temporarily for result delivery and deleted no later than 24 hours after creation.

The email form may also include a separate optional marketing or contact consent checkbox for visitors who want to be contacted, receive sofa information, or receive offers. This optional consent must be separate from the required result-delivery consent.

The result display should use reasonable deterrents against direct image download, such as not exposing a visible download button and avoiding obvious direct asset links in the public UI. This is a deterrence requirement, not a guarantee: the product must not claim that screenshots or browser-level extraction are impossible.

If a visitor opens an expired result after the 24-hour maximum retention window, the public experience must show a clear expired-result message and redirect or guide the visitor back to the catalog. The MVP must not offer a restart action from the expired-result state.

The MVP does not require:

- public sharing links;
- long-term customer galleries;
- customer profiles;
- saving results after the retention window.

The in-home simulation and privacy specs must define the exact result state, email delivery behavior, consent storage, retention behavior, and deletion implementation.

## Shopify Order Redirect

The sofa detail page must provide a secondary order action that redirects to the stored Shopify order URL for the sofa.

The redirect must not pass visualization parameters to Shopify in the MVP.

The public experience must not depend on Shopify synchronization.

A published public sofa should have a valid stored Shopify order URL. If a stored URL is unavailable because of an operational issue, the public page must fail gracefully by hiding or disabling the order action and explaining that ordering is temporarily unavailable.

## Public Availability Rules

A sofa can be publicly accessible only when:

- the sofa is published;
- the sofa has at least one public fabric;
- each public fabric has complete public-usable render coverage across all required visual positions;
- the sofa has at least one public visual position;
- the sofa has a stable public slug;
- the sofa has the minimum public metadata needed for the page.

Archived sofas must be hidden from the catalog.

If a visitor opens a URL for a draft, archived, missing, or unavailable sofa, the public experience must show a clear unavailable or not-found state without leaking private admin details.

## Mobile-First Requirements

The public experience must be designed mobile first.

The mobile sofa detail page must keep the core flow visible and understandable:

- current render;
- fabric selector;
- visual position selector;
- simulation action;
- Shopify order action.

The design must avoid burying the simulation action below excessive commercial content.

The page must remain usable with touch input and small screens before being expanded for desktop.

Animations used to suggest simulation or 3D visualization must remain subtle, lightweight, and respectful of reduced-motion preferences. If a GIF or animation is used on catalog cards, it must not block scrolling, steal focus, or create a misleading representation of the final simulation quality.

## Public Images And Fallbacks

Published sofas are expected to have public-usable public images. Missing public images should be rare.

If a public image becomes unavailable because of an operational issue, the public UI must show a clear image-unavailable state rather than broken media.

The exact image ratios, crops, and responsive format rules are deferred to design and implementation planning.

## SEO And Analytics

Public home, catalog, and published sofa detail pages should be indexable by search engines in the MVP unless a later environment or legal decision changes this.

Private, transient, or unavailable pages must not be indexed. This includes:

- simulation result pages;
- expired result states;
- unavailable sofa states;
- error pages;
- private uploaded room photos;
- private generated simulation outputs.

The MVP should include Google Analytics tracking for basic public funnel understanding.

The MVP analytics scope must stay minimal. Recommended public analytics events are:

- home CTA click;
- catalog sofa card open;
- catalog filter use;
- catalog fabric preview;
- sofa detail fabric selection;
- sofa detail visual position selection;
- simulation CTA click;
- Shopify order click;
- result email request.

The MVP must not send personal data, email addresses, uploaded room photo data, generated room photo URLs, or private simulation result URLs to Google Analytics.

The recommended consent behavior for MVP is conservative:

- Google Analytics must be disabled by default until the visitor grants analytics consent;
- advertising storage, ad user data, and ad personalization must remain disabled by default;
- analytics consent must be separate from required result-delivery consent;
- analytics consent must be separate from optional marketing or contact consent;
- rejecting analytics must not block browsing, simulation, result viewing, result email request, or Shopify redirect.

The privacy, retention, and abuse protection spec must define the final consent banner, storage, wording, and Google Consent Mode behavior. The implementation should follow the conservative "basic consent mode" approach unless a later privacy/legal decision approves another configuration.

## Accessibility Requirements

The public experience must support basic accessibility expectations:

- meaningful text labels for controls;
- visible selected states for fabric and visual position selectors;
- keyboard-accessible interactive controls;
- non-color-only selected and error states;
- alternative text for meaningful product images where practical;
- clear error and empty-state messages.

Detailed implementation checks can be refined in implementation plans and tests.

## Error And Empty States

The public experience must define clear states for:

- loading catalog data;
- empty catalog;
- missing sofa;
- unpublished or archived sofa URL;
- missing public renders;
- failed public data load;
- unavailable Shopify order URL;
- simulation launch temporarily unavailable;
- expired simulation result;
- image unavailable;
- stale sofa, fabric, or visual position selection during the current session.

Error states must avoid exposing private IDs, storage paths, provider errors, stack traces, or admin-only details.

If a sofa, fabric, or visual position becomes unavailable while the visitor is browsing or before simulation launch, the public experience must prevent simulation launch and show a clear message that the selected option is no longer available. The page should guide the visitor back to the catalog or to another available selection when possible.

If a visitor opens an unavailable sofa from an old Shopify link, the page must show a clear sofa-unavailable message and offer a path back to the catalog. It must not automatically redirect to a different sofa.

## Grey Areas To Resolve Before Acceptance

The following areas need explicit product decisions before this spec can be accepted:

- Exact slug collision behavior before first publication.
- Exact result-screen implementation inside the in-home simulation flow.

## Data Model

This spec does not define database schema.

The public experience requires later data-model support for:

- published sofa summary;
- public sofa detail;
- public sofa slug;
- public sofa attributes;
- public sofa tags;
- public fabric ordering;
- public visual position ordering;
- public-usable render selection;
- Shopify order URL;
- simulation result availability and expiry;
- simulation regeneration count;
- result email request data;
- consent state for result delivery and optional marketing contact.

The database schema, tables, indexes, and storage fields must be defined in the data model and storage spec.

## API

This spec does not define API endpoint contracts.

The API contracts spec must define how the public frontend loads:

- catalog data;
- sofa detail data;
- public render data;
- simulation launch context;
- room photo upload and prepared-room state;
- simulation dimension input state;
- simulation result access;
- simulation regeneration request;
- result email request;
- Shopify order URL data.

## Worker Jobs

This spec does not define worker jobs.

The worker jobs and AI providers spec must define simulation processing and any background work needed to produce customer simulation results.

## Environment Variables

This spec does not define environment variables.

The environment and deployment spec must define public domain, API base URL, asset URL, and any environment-specific settings needed by the public frontend.

## Acceptance Criteria

- The public experience is defined as simulation first, not e-commerce first.
- The public customer-facing interface is in French for the MVP.
- The public catalog route is `/catalog`.
- Public sofa detail routes use automatically generated slugs.
- Public sofa slugs are frozen after publication.
- The MVP does not support slug history or automatic slug redirects.
- The public home page purpose is defined.
- The public home page is defined as a modern landing page whose goal is to create desire to simulate a sofa at home.
- The home page explains the AI-assisted simulation process and directs visitors toward choosing a sofa.
- The public catalog lists published sofas only.
- The public catalog is defined as a visual sofa selection page with simple admin-prepared filters.
- Catalog filters are generated dynamically from public sofa tags assigned by administrators.
- The default catalog order is newest published sofas first unless the administrator defines a manual order.
- The catalog shows a clear no-results state when filters match no sofas.
- The catalog no-results state includes a clear filters button.
- Multiple selected catalog tag filters use `AND` behavior.
- The catalog hides the filter area when no public tags exist on published sofas.
- The catalog reminds visitors that each sofa can be simulated at home.
- The catalog supports sofa card image swaps for fabric preview without exposing incomplete fabrics.
- Opening a detail page from a fabric-previewed catalog card preserves the selected fabric.
- Catalog-to-detail fabric preservation applies only to internal navigation and not to Shopify entry links.
- The catalog can display subtle simulation cues on visible cards when this improves desire to simulate without hurting usability.
- The public sofa detail page behavior is defined.
- The sofa detail page displays useful administrator-provided sofa information without weakening the simulation-first flow.
- The mobile sofa detail page keeps the simulation CTA obvious and easy to reach.
- Public dimensions are displayed in centimeters when available and marked public.
- The default public fabric and visual position use administrator-defined order.
- Shopify links do not preselect fabric or visual position in the MVP.
- The fabric selector shows only public fabrics with complete public-usable render coverage.
- Premium fabrics show a visually secondary premium label when premium status is provided.
- Changing fabric preserves the current visual position.
- Changing visual position preserves the current fabric.
- The simulation launch uses the currently selected sofa, fabric, and visual position.
- The public in-home simulation flow includes room photo upload or capture, a preparation screen showing the selected sofa image and uploaded room photo, prepared-room review, dimension guide input, backend processing, result display, optional regeneration, result email request, Shopify return, and catalog return.
- The required room dimensions are room length, room width or depth, and room height.
- The prepared room image displays visual guides directly on the image so the visitor understands which dimension belongs in each field.
- The flow can request camera-depth or camera-position distance when needed to scale the photographed perspective.
- The MVP allows three total generated results for one simulation attempt, including the initial result and up to two regenerations.
- The public UI does not need to show a numeric remaining-generation counter.
- The result experience lets visitors regenerate when available, request the image by email, return to Shopify, or return to the catalog.
- Mobile sofa detail pages use a carefully implemented sticky simulation CTA after the first simulation action scrolls away.
- The public experience explains privacy handling and AI limitations before simulation.
- The public experience states that AI visualization is an estimate and does not replace professional measurement or final verification.
- The visitor can view a generated simulation result while it is retained.
- The visitor can request the generated result by email while it is retained.
- Result email capture belongs inside the in-home simulation flow.
- Result email delivery requires email and required temporary-retention consent.
- Optional marketing or contact consent is separate from required result-delivery consent.
- Expired simulation results show an expired state and direct the visitor back to the catalog.
- The Shopify order action redirects to the stored Shopify order URL without visualization parameters.
- Public pages do not show pricing, fabric price adjustments, cart, checkout, or account requirements.
- Draft and archived sofas are not publicly listed.
- Missing or unavailable public URLs fail without leaking private admin details.
- Unavailable sofas opened from old links show a sofa-unavailable state with a path back to the catalog.
- Stale sofa, fabric, or visual position selections prevent simulation launch and show a clear unavailable-selection message.
- Missing public images show an image-unavailable state instead of broken media.
- Public pages are expected to be indexable in MVP.
- Private simulation result pages and unavailable or error states must not be indexed.
- Google Analytics is expected for basic public funnel tracking.
- Google Analytics uses conservative consent behavior and must not collect personal data or private image URLs.
- The public experience is explicitly mobile first.
- Accessibility expectations are documented.
- API, data model, worker, and environment details are deferred to dedicated specs.

## Open Questions

- None for this spec.

Exact French copy, consent banner wording, and consent-management implementation should be finalized during design, privacy specification, or implementation planning as long as they preserve the product principles defined here.
