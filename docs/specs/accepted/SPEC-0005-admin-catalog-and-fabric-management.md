# SPEC-0005 Admin Catalog and Fabric Management

Spec: SPEC-0005
Status: accepted
Layer: domain
Parent Spec: SPEC-0003
Depends On: SPEC-0003, SPEC-0004
Areas: web, api
Implementation Plans: none yet

## Traceability

This spec is a follow-up domain spec created from `SPEC-0003 Business Context - AI Sofa Visualization`.

It defines the administrator-facing catalog and fabric management behavior needed to power the public customer experience defined in `SPEC-0004 Public Customer Experience`.

This spec must preserve the `SPEC-0003` business decisions:

- the visualization tool is separate from Shopify;
- the public experience is simulation first, not e-commerce first;
- Shopify remains the commercial destination;
- public sofas are manually prepared by administrators;
- public fabrics require complete public-usable render coverage before they can be exposed to visitors;
- Shopify links are manually maintained and do not receive visualization parameters in the MVP;
- generated customer simulation results are handled by the simulation, privacy, and worker specs, not by the catalog admin itself.

This spec feeds later specs for render generation, in-home simulation, data model and storage, API contracts, permissions, audit logs, and implementation plans.

## Goal

Give administrators a clear back office to prepare the public sofa catalog used by the visualization tool.

Administrators must be able to create sofas, assign public tags, manage fabrics, connect sofas to fabrics and visual matrix columns, control publication state, and ensure that only complete customer-ready content appears in the public experience.

The admin experience must make public readiness explicit so that incomplete sofas, incomplete fabrics, or missing render coverage do not accidentally appear to visitors.

## Scope

This spec covers:

- admin catalog purpose and information architecture;
- sofa creation and editing at a domain level;
- sofa lifecycle states;
- sofa source photo preparation at a domain level;
- public slug behavior at a domain level;
- public visualization link behavior at a domain level;
- public sofa metadata managed by administrators;
- public sofa tags used as dynamic catalog filters;
- fabric creation and editing at a domain level;
- fabric AI reference image requirements at a domain level;
- premium fabric flag behavior;
- sofa-to-fabric assignment;
- public fabric ordering per sofa;
- visual matrix columns at a domain level;
- manual render upload, AI render generation, and coverage review at a domain level;
- Shopify order URL storage;
- public catalog manual ordering;
- publication readiness and validation rules;
- unavailable and archived public content behavior from the admin side;
- conceptual data model needs;
- admin error and empty states;
- acceptance criteria for the admin catalog and fabric domain.

## Out Of Scope

This spec does not define:

- public home, catalog, or sofa detail UI behavior already defined in `SPEC-0004`;
- exact simulation wizard steps;
- customer room photo upload behavior;
- customer result display behavior;
- result email delivery implementation;
- direct image-generation prompts;
- render matrix storage details;
- exact render-generation workflow internals;
- AI provider selection;
- image processing pipeline details;
- background worker queue behavior;
- exact database schema;
- exact API endpoint contracts;
- authentication implementation details;
- full role-based access control matrix;
- Shopify API synchronization;
- Shopify theme implementation;
- pricing, stock, cart, or checkout behavior;
- exact admin visual design.

Those topics must be covered by dedicated follow-up specs.

## Users And Permissions

### Administrator

An administrator is an authenticated back-office user who prepares catalog content for public use.

The administrator can:

- create and edit sofas;
- create and edit fabrics;
- create and reuse public sofa tags;
- assign tags to sofas;
- assign fabrics to sofas;
- define public fabric order per sofa;
- manage visual matrix columns for a sofa;
- prepare sofa source photos and identify their original fabrics;
- upload manual public renders for sofa, fabric, and visual column combinations;
- generate or regenerate renders for sofa, fabric, and visual column combinations;
- review render coverage by sofa, fabric, and visual column;
- export sofa render sets as ZIP files for Shopify-side reuse;
- retrieve the public visualization link to copy into Shopify;
- provide public sofa information;
- provide or update the Shopify order URL;
- publish sofas that pass readiness checks;
- unpublish or archive sofas;
- control manual public catalog order when needed.

The administrator cannot:

- bypass publication readiness checks;
- expose fabrics without complete public-usable render coverage;
- make draft or archived sofas visible in the public catalog;
- edit a published sofa slug in the MVP;
- use the visualization tool as a replacement for Shopify checkout.

### Visitor

A visitor is not an admin user.

Visitors can only see the public outputs of admin decisions through the public experience defined in `SPEC-0004`.

Visitors cannot access back-office screens, draft sofas, archived sofas, incomplete fabrics, render readiness diagnostics, internal notes, or private admin metadata.

## Admin Information Architecture

The MVP back office should expose four primary admin areas for this domain:

- Sofas: list, create, edit, publish, unpublish, archive, and order public sofas.
- Fabrics: list, create, edit, archive, and mark fabrics as premium when relevant.
- Tags: create, reuse, edit, delete when unused, and assign public tags used by the public catalog filters.
- Render coverage: review sofa readiness by fabric and visual column, upload manual renders, generate or regenerate renders, export ZIP files, and understand which matrix cells block publication.

These areas can be separate screens or grouped inside a practical admin workflow, but the domain behavior must remain clear.

The admin interface should make the publication state and public readiness of each sofa visible from the sofa list.

The admin interface should make fabric readiness visible enough for administrators to understand why a fabric can or cannot be exposed on a public sofa.

The render coverage area does not own the background worker implementation, provider selection, storage layout, retry policy, or exact image processing internals. Those details belong to the render generation spec. This spec defines the administrator-facing domain behavior needed to prepare, inspect, and publish public catalog content.

## Sofa Lifecycle

A sofa must have a lifecycle state.

The MVP lifecycle states are:

- Draft: editable, private, not visible publicly.
- Published: visible publicly if all readiness checks pass.
- Archived: hidden from public catalog and treated as unavailable from old public links.

Draft sofas are used while content is incomplete or still being prepared.

Draft sofas must save the administrator's valid edits, uploaded images, generated images, manual renders, matrix changes, and preparation progress so the administrator can continue later.

Published sofas appear in the public catalog and are accessible through their public slug.

Archived sofas do not appear in the public catalog. If a visitor opens an old public URL for an archived sofa, the public experience must show the unavailable-sofa behavior defined in `SPEC-0004`.

The MVP does not require a separate scheduled publication system.

The MVP does not require soft-launch, preview sharing, or approval workflows beyond administrator readiness checks.

## Sofa Creation And Editing

Administrators must be able to create a sofa as a draft before all public data is ready.

Administrators should be able to save partial progress and return later.

The admin interface must distinguish between:

- internal fields used only by administrators;
- public fields shown to visitors;
- readiness fields that control whether the sofa can be published.

Sofa editing must not accidentally publish changes. Saving a draft or editing content is separate from publishing the sofa.

When a sofa is already published, submitted edits must pass the same relevant validation rules before they replace the currently published data.

If submitted edits to a published sofa are invalid, the system must reject the update, keep the currently published sofa unchanged, and show actionable errors to the administrator.

Invalid edits to a published sofa must not invalidate or unpublish the existing public sofa.

If an administrator leaves the edit screen without a successful save, unsaved edits to a published sofa are discarded.

The MVP does not require a separate draft-revision workflow for published sofas.

## Sofa Fields

The admin catalog must support the following sofa information at a domain level:

- internal admin name;
- public sofa name;
- stable public slug;
- publication state;
- Shopify order URL;
- public visualization link;
- public description;
- public dimensions in centimeters when available;
- source photos assigned to visual matrix columns and original fabrics;
- assigned public tags;
- assigned fabrics;
- public fabric order;
- visual matrix columns;
- render coverage summary;
- manual public catalog order when explicitly defined;
- internal notes or admin-only metadata if useful;
- created and updated timestamps.

The public sofa name is shown to visitors.

The internal admin name may be the same as the public sofa name, but the domain should allow the admin to keep internal wording separate if needed.

The public description should be concise and customer-facing.

Dimensions must be entered and displayed in centimeters when they are public.

The MVP sofa dimension model must focus on helping customers estimate whether the sofa can fit in their room and helping the in-home simulation respect the sofa's approximate scale.

The required base dimensions are:

- length;
- width or depth;
- height.

For sofas whose footprint is not a simple rectangle, administrators must provide the additional footprint dimensions needed to describe the shape at a practical room-fit level. For example, a corner, angled, or triangular footprint must capture the relevant side lengths, return length, or diagonal measurement needed to estimate whether that shape fits.

The MVP does not require detailed component dimensions such as armrest height, armrest width, cushion thickness, leg height, or internal construction measurements.

The admin catalog must not manage product prices, fabric price adjustments, stock, cart behavior, or checkout behavior in the MVP.

## Public Slugs

The public sofa slug must be generated automatically by the system.

The slug should be generated from the public sofa name when possible.

If a generated slug collides with an existing slug before first publication, the system should create a unique variant, such as appending a numeric suffix.

Once a sofa is published, its public slug must be frozen.

The MVP must not allow administrators to manually edit a published slug.

The MVP must not support slug history or automatic redirects from old sofa slugs.

If a published sofa is later unpublished or archived, the existing public URL must show an unavailable-sofa state rather than redirecting to another sofa.

Administrators are responsible for updating any manually pasted Shopify links when a sofa is no longer available publicly.

## Public Visualization Link

Each sofa must have a public visualization link that administrators can copy into Shopify manually.

The public visualization link opens the sofa's public simulation detail page when the sofa is published and ready.

The public visualization link is derived from the sofa's stable public slug.

The admin interface should make the public visualization link easy to retrieve after the sofa is publishable.

If a sofa is draft, unpublished, or archived, the admin interface may still show the future or existing public visualization link, but it must clearly indicate that the link is not currently visitor-usable.

The MVP does not send selected fabric, selected view, customer room photo, or simulation parameters through the public visualization link.

The MVP does not support separate public links per fabric, per view, or per generated render.

## Shopify Order URL

Each published sofa should have one stored Shopify order URL.

The Shopify URL is used by the public sofa detail page for the secondary order action.

The MVP does not synchronize products from Shopify.

The MVP does not send selected fabric, selected view, or simulation parameters to Shopify.

The admin interface should validate that the Shopify URL is present before publication.

The admin interface may perform basic URL format validation, but it does not need to verify Shopify product availability through the Shopify API in the MVP.

If a Shopify URL becomes unavailable after publication, the public experience must fail gracefully as defined in `SPEC-0004`.

## Public Tags

Public tags are reusable labels created by administrators and assigned to sofas.

Public tags power the simple dynamic filters on the public catalog.

The public frontend must not hard-code filter values such as seat count, corner configuration, or any other catalog filter.

Administrators can create tags such as:

- `2 seats`;
- `3 seats`;
- `4 seats`;
- `corner`;
- `non-corner`;
- any other simple customer-facing tag needed by the catalog.

These examples are not fixed values. They are examples of administrator-created tags.

A tag can be assigned to multiple sofas.

A sofa can have multiple tags.

The public catalog shows filter controls only for tags used by published sofas.

If no published sofa has public tags, the public catalog hides the filter area.

The MVP does not require tag categories, tag hierarchy, semantic search, or advanced faceted search.

The MVP does not require manual public tag ordering. Tags can appear in the available system order unless a later spec adds ordering.

Administrators may delete a tag only when that tag is not assigned to any sofa.

Administrators must not delete a tag while any sofa uses that tag.

If a tag must be removed, administrators must first remove that tag from every sofa that uses it.

Public tag labels shown to visitors should be written in French for the MVP.

Repository-authored specs and code remain in English, but administrator-entered public labels can be French customer-facing content.

## Public Catalog Ordering

The default public catalog order is newest created published sofas first.

Administrators may explicitly define a manual public order.

When a manual public order exists, it overrides the default newest-first order.

The exact ordering UI is deferred to implementation planning, but the domain must support simple manual ordering without requiring collections or complex merchandising rules.

The MVP does not require collection pages, campaign pages, personalized sorting, popularity sorting, or algorithmic ordering.

## Fabrics

Fabrics are reusable catalog entities managed by administrators.

A fabric can be assigned to one or more sofas.

The admin fabric domain must support the following information at a domain level:

- internal fabric name;
- public fabric name;
- fabric swatch image;
- fabric AI reference sofa image;
- premium flag;
- internal notes or admin-only metadata if useful;
- created and updated timestamps.

The public fabric name is shown to visitors.

The swatch image helps visitors compare fabrics in selectors and catalog previews.

The fabric AI reference sofa image is an admin-managed asset used by the render generation workflow to understand the target fabric. It should show a real sofa or equivalent suitable furniture reference already produced in that fabric.

The fabric AI reference sofa image is not required to be shown publicly.

The premium flag controls whether the public experience can show a visually secondary premium label for that fabric.

The premium flag does not imply a price change inside the visualization tool.

The MVP does not show prices or fabric price adjustments.

## Fabric Lifecycle

A fabric is created only when its required information is valid and complete.

A fabric must include:

- an internal fabric name;
- a public fabric name;
- a public swatch image;
- a fabric AI reference sofa image;
- a premium or non-premium value.

The MVP fabric lifecycle states are:

- Active: available for assignment when administrators prepare sofas.
- Archived: retained for historical references, hidden from new sofa assignment, and not selectable when administrators prepare new sofa fabric coverage.

The MVP does not require draft fabrics.

Administrators must not delete fabrics from the back office.

Archiving a fabric preserves historical references, including references from in-home simulation metadata that recorded which sofa, fabric, and visual position were used.

If an administrator archives a fabric that is assigned to existing sofas, those existing references are retained. The admin interface must make clear that the archived fabric cannot be newly assigned and may require sofa updates if the fabric should no longer appear publicly.

## Sofa-Fabric Assignment

Administrators must be able to assign existing fabrics to a sofa.

Assignment alone is not enough to expose a fabric publicly.

A fabric can be public for a sofa only when:

- the sofa is eligible for publication;
- the fabric is active;
- the fabric is assigned to that sofa;
- the required public renders for that sofa and fabric are complete and public-usable;
- the fabric is included in the sofa's public fabric order.

The detailed definition of complete render coverage belongs to the render generation spec.

Administrators must be able to order public fabrics per sofa.

The first public fabric in the sofa's admin-defined fabric order becomes the default public fabric on the public sofa detail page.

If an assigned fabric lacks required public-usable renders, the admin interface should show it as incomplete and must prevent it from becoming publicly selectable.

Removing or archiving a public fabric from a published sofa must re-run readiness checks.

If the removed fabric was the default public fabric, the system must select the next available public fabric according to the admin-defined order, or make the sofa unavailable if no public fabric remains.

## Visual Matrix Columns

Administrators must prepare sofa visuals through a matrix.

A visual matrix column represents one customer-visible sofa image position, such as a front image, side image, angle image, or another sofa presentation chosen by the administrator.

The same concept is exposed publicly as a visual position or image option. The public UI must not expose the internal term `visual matrix column` to visitors.

The administrator controls the customer-visible image sequence by the matrix column sequence.

Column 1 is the first public image, column 2 is the second public image, and so on.

The administrator is responsible for keeping this sequence meaningful for the sofa.

The MVP does not require a separate customer-facing visual slot entity, visual slot label, or dedicated ordering workflow beyond the matrix column sequence.

The first matrix column becomes the default public image on the public sofa detail page.

The admin catalog must expose enough readiness information for administrators to understand whether a sofa has at least one visual matrix column and whether each public fabric has complete public-usable render coverage for the required columns.

## Sofa Source Photos

Administrators must be able to prepare sofa source photos for render coverage.

Each sofa source photo must be associated with:

- one sofa;
- one visual matrix column for that sofa;
- one original fabric represented in the uploaded photo.

The original fabric of a source photo must be one of the fabrics already assigned to that sofa.

If a source photo is valid, it can serve as the canonical public render for its own sofa, visual column, and original fabric combination.

A sofa must not allow multiple original source photos for the same sofa, visual column, and original fabric combination in the MVP.

Each visual matrix column has one current source image for generation purposes.

When a source image is replaced in a visual column, existing generated images in the same column are not regenerated automatically.

If the administrator wants the other fabrics in that column to align with the replacement source image, the administrator must explicitly regenerate those fabric cells.

New generations for that visual column use the latest valid source image for that column.

The admin interface must make it clear when a source photo is missing a column assignment, missing an original fabric, or conflicts with an existing source photo for the same column and fabric.

Deleting any source image, manual render, or generated render in a visual matrix column is a column-level destructive action.

Before deleting, the admin interface must warn that deleting a visual from the column deletes the entire column for all fabrics on that sofa.

If the administrator confirms, the system deletes the whole visual matrix column, not only the individual image.

## Manual And Generated Renders

Manual public render uploads and AI-generated renders are two ways to complete the same sofa, fabric, and visual column render coverage.

Administrators must be able to upload a manual public render for one specific sofa, one assigned fabric, and one visual column.

Administrators must be able to generate or regenerate a render for one specific sofa, one assigned fabric, and one visual column.

The MVP does not require a separate render validation state.

If an administrator uploads or generates a visual while a sofa is a draft, that visual is saved as part of the draft preparation work.

If a generated render is not good enough, the administrator can regenerate that cell explicitly or replace it with a manual upload before publishing.

Publishing a sofa is the administrator's acceptance that the sofa's current visual matrix is customer-ready.

Manual uploads and generated renders are treated the same for publication readiness once they exist in the current visual matrix.

Generation failures should be shown as operation errors to the administrator, but the MVP does not require persistent failed-render records as part of the domain model.

The exact retry behavior, provider errors, asset transformations, and storage paths belong to the render generation spec.

## Render Coverage Review

The admin interface must provide a per-sofa render coverage view.

The coverage view must help administrators understand the sofa's complete public render matrix:

- columns are the sofa's visual matrix columns;
- rows are the fabrics assigned to that sofa;
- each cell represents the public render for one sofa, fabric, and visual column combination.

Each cell should make clear whether it has a public-usable image or still needs a manual upload or generation before publication.

A fabric can be public for a sofa only when every visual matrix column has a public-usable image for that fabric.

Manual uploads must not create a separate product type or bypass the render coverage rules.

If a sofa gains a new visual matrix column after fabrics have already been assigned, the admin interface must show that all public fabrics need public-usable images for the new column before those fabrics remain publicly selectable.

At publication time, administrators must either keep only the fully prepared public fabrics or complete the missing render coverage before publication.

The system must not rely on partial public filtering rules to hide incomplete assigned fabrics for an otherwise published sofa.

## Publication Readiness

The admin interface must prevent publication when required public data is missing or incomplete.

A sofa can be published only when:

- it has a public sofa name;
- it has a stable generated slug;
- it has a valid publication state transition;
- it has a Shopify order URL;
- it has at least one visual matrix column;
- it has at least one public fabric;
- every public fabric has complete public-usable render coverage for every visual matrix column;
- required public images are available;
- required fabric swatch images are available;
- required fabric AI reference images are available when AI generation is needed for missing render coverage;
- public metadata required by the public page is present.

The admin interface should present readiness failures as actionable messages.

Readiness messages should explain what the administrator must fix, such as missing Shopify URL, no public fabric, incomplete render coverage, missing public name, missing visual column, missing source photo assignment, missing fabric swatch, or missing fabric AI reference image.

The admin interface must not expose low-level provider errors, storage internals, or stack traces as readiness messages.

## Publishing, Unpublishing, And Archiving

Publishing makes a sofa available to the public experience only after readiness checks pass.

Unpublishing a sofa removes it from the public catalog and makes its public URL unavailable.

Archiving a sofa also removes it from the public catalog and treats old public URLs as unavailable.

The MVP can treat unpublished and archived public URLs with the same visitor-facing unavailable-sofa behavior unless a later product decision requires different copy.

Administrators must not delete sofas from the back office.

Sofas can only be archived from the back office. Any permanent sofa deletion is outside the MVP admin behavior and would require direct database intervention or a dedicated future maintenance workflow.

Administrators should receive clear warnings before unpublishing or archiving a sofa that may already be linked from Shopify.

The warning should explain that Shopify links are maintained manually and may need to be updated by the administrator.

The MVP does not require automatic Shopify link updates.

## Admin Lists And Search

The admin sofa list should help administrators find and maintain catalog items.

The MVP should support basic admin list behavior:

- show sofa publication state;
- show whether required publication data is complete;
- show render coverage summary;
- show public name or internal name;
- show created and updated timestamps;
- filter or group by lifecycle state when practical.

The admin fabric list should support similar basic maintenance behavior:

- show premium status;
- show whether the fabric has a swatch image and AI reference image;
- show whether the fabric is assigned to sofas;
- show created and updated timestamps.

The MVP does not require advanced admin search, bulk editing, import, export, or complex reporting.

## Admin Error And Empty States

The admin experience must define clear states for:

- no sofas created yet;
- no fabrics created yet;
- no tags created yet;
- failed save;
- failed publish;
- missing required public metadata;
- missing Shopify order URL;
- missing public fabric;
- missing visual matrix column;
- missing or conflicting source photo setup;
- missing fabric swatch image;
- missing fabric AI reference image;
- incomplete render coverage;
- generation operation failed;
- concurrent edit conflict;
- fabric cannot be deleted from the back office;
- tag assigned to a sofa cannot be deleted.

Admin errors must be actionable and safe.

The admin interface must not silently publish incomplete content.

## Data Model

This spec does not define database schema.

The data model and storage spec must define tables, fields, constraints, indexes, and storage paths for:

- sofas;
- sofa lifecycle state;
- sofa public slug;
- public visualization link;
- sofa public metadata;
- sofa dimensions;
- sofa source photos;
- sofa source photo original fabric references;
- visual matrix columns;
- visual matrix column source image references;
- Shopify order URL;
- public catalog order;
- public tags;
- sofa-tag assignments;
- fabrics;
- fabric lifecycle state;
- fabric swatch assets;
- fabric AI reference sofa assets;
- premium flag;
- sofa-fabric assignments;
- public fabric ordering per sofa;
- visual matrix column sequence per sofa;
- render readiness references;
- manual public render references;
- render source type references;
- created and updated timestamps;
- audit-friendly publication changes if required.

The data model must preserve the public/private boundary between admin-only metadata and visitor-facing content.

## API

This spec does not define exact API endpoint contracts.

The API contracts spec must define authenticated admin endpoints for:

- listing sofas;
- creating sofas;
- updating sofas;
- publishing sofas;
- unpublishing sofas;
- archiving sofas;
- listing fabrics;
- creating fabrics;
- updating fabrics;
- archiving fabrics;
- listing tags;
- creating tags;
- updating tags;
- deleting unused tags;
- assigning tags to sofas;
- assigning fabrics to sofas;
- updating public fabric order;
- updating visual matrix columns;
- updating manual public catalog order;
- retrieving publication readiness information;
- retrieving public visualization link information;
- uploading sofa source photos;
- updating source photo visual column and original fabric assignments;
- uploading manual public renders;
- generating or regenerating render cells;
- listing render coverage by sofa;
- deleting visual matrix columns;
- exporting sofa render sets as ZIP files.

Public read endpoints used by `SPEC-0004` must expose only published, visitor-safe data.

## Worker Jobs

This spec does not define worker jobs.

The image worker and render generation specs must define any background processing needed to create or prepare render coverage for sofa and fabric combinations.

The admin catalog may display worker-derived operation results and expose manual upload, render generation, regeneration, and ZIP export entry points, but it does not own the worker pipeline.

## Environment Variables

This spec does not define environment variables.

The environment and deployment spec must define admin web URLs, API base URLs, asset URLs, authentication configuration, and any environment-specific storage settings.

## Acceptance Criteria

- Administrators can create sofa drafts without exposing them publicly.
- Sofas have draft, published, and archived lifecycle states.
- Draft and archived sofas are not visible in the public catalog.
- Published sofas are visible publicly only when readiness checks pass.
- Public sofa slugs are generated automatically.
- Generated slug collisions before first publication are resolved by creating a unique variant.
- Public sofa slugs are frozen after publication.
- The MVP does not support published slug editing, slug history, or automatic slug redirects.
- Old public URLs for unpublished or archived sofas show unavailable-sofa behavior rather than redirecting to another sofa.
- Sofas cannot be deleted from the back office and can only be archived.
- Sofa dimensions include length, width or depth, and height.
- Sofas with non-rectangular footprints require additional practical footprint dimensions needed to estimate room fit, such as relevant side lengths, return length, or diagonal measurement.
- The MVP does not require detailed component dimensions such as armrest, cushion, leg, or internal construction measurements.
- Administrators can retrieve a public visualization link for a sofa to copy into Shopify.
- Public visualization links are derived from stable public slugs and do not carry fabric, view, room photo, or simulation parameters in the MVP.
- Administrators can maintain the Shopify order URL for each sofa.
- A Shopify order URL is required before publication.
- The MVP does not synchronize Shopify products or pass visualization parameters to Shopify.
- Administrators can create and reuse public sofa tags.
- Public catalog filters are generated from administrator-created tags assigned to published sofas.
- Public tags are dynamic and not hard-coded in the frontend.
- Public tag labels shown to visitors can be French customer-facing content.
- Tags can be deleted only when they are not assigned to any sofa.
- The default public catalog order is newest created published sofas first.
- Administrators can define a manual public catalog order.
- Administrators can create and edit fabrics.
- Fabric records include a public swatch image and an admin-managed AI reference sofa image.
- Fabrics are created only when required fabric information is valid and complete.
- Fabrics have active and archived lifecycle states.
- Active fabrics are available for assignment when administrators prepare sofas.
- Archived fabrics are retained for historical references and hidden from new sofa assignment.
- Fabrics cannot be deleted from the back office.
- Administrators can mark a fabric as premium.
- Premium status controls a secondary public label and does not imply pricing behavior.
- Administrators can assign existing fabrics to sofas.
- Fabric assignment alone does not make a fabric public.
- A fabric can be public for a sofa only with complete public-usable render coverage across all visual matrix columns.
- Administrators can define public fabric order per sofa.
- The first available public fabric in admin order is the default public fabric.
- Administrators manage visual matrix columns for each sofa.
- The first visual matrix column is the default public image.
- Administrators can upload sofa source photos and assign each source photo to one visual matrix column and one original fabric already assigned to the sofa.
- The MVP prevents duplicate original source photos for the same sofa, visual matrix column, and original fabric combination.
- Replacing a source image in one matrix column does not automatically regenerate other fabric cells in that column.
- Regenerating other fabric cells after a source image replacement requires explicit administrator action per cell.
- Deleting any image in a visual matrix column requires warning the administrator that the whole column will be deleted for all fabrics.
- Administrators can upload manual public renders for specific sofa, fabric, and visual matrix column combinations.
- Administrators can generate or regenerate renders for specific sofa, fabric, and visual matrix column combinations.
- The MVP does not require per-render validation state.
- Publishing a sofa is the administrator's acceptance that the current visual matrix is customer-ready.
- If a generated render is not good enough, administrators regenerate the cell or replace it with a manual upload before publishing.
- Administrators can review render coverage as a per-sofa matrix across visual matrix columns and assigned fabrics.
- Manual uploads do not create a separate product type or bypass render coverage rules.
- Adding a new visual matrix column to a sofa makes all public fabrics incomplete until that column has public-usable images for each public fabric.
- Publication readiness checks prevent incomplete sofas, fabrics, visual columns, or render coverage from appearing publicly.
- Invalid edits to a published sofa are rejected without changing or unpublishing the currently published sofa.
- Unsaved edits to a published sofa are discarded if the administrator leaves without a successful save.
- Readiness failures are shown as actionable admin messages.
- Admin errors do not expose storage internals, provider errors, stack traces, or private implementation details.
- The admin catalog does not manage pricing, stock, cart, checkout, or Shopify API synchronization in the MVP.
- Database schema, exact API contracts, low-level render storage details, worker jobs, AI provider behavior, and environment variables are deferred to dedicated specs.

## Delegated Details

The following UI pattern details are intentionally delegated to design and
implementation planning:

- Exact admin UI pattern for manual public catalog ordering.
- Exact admin UI pattern for fabric ordering and visual matrix column
  management.
- Exact admin UI pattern for source photo assignment, manual render uploads, and
  render generation.

## Open Questions

- None for this spec.

The delegated details above must preserve the domain behavior accepted by this
spec.
