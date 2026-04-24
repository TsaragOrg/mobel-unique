# Render Generation Notes Extracted From Original SPEC-0003 Draft

Reference Source: original detailed `SPEC-0003 Business Context - AI Sofa Visualization` draft
Status: reference draft

Source: client-approved MÖBEL UNIQUE project brief, dated March 18, 2026, plus follow-up product clarifications recorded during specification drafting.

## Purpose Of This Reference Draft

This file preserves the detailed sofa render-generation, fabric, source-photo, and matrix-publication notes that were originally drafted inside `SPEC-0003`.

These details are intentionally kept out of the parent business-context spec. They should be reviewed and reused when drafting the dedicated follow-up specification for render preparation, coverage, validation, and publication.

## Goal

Build an AI visualization tool that is separate from the existing MÖBEL UNIQUE Shopify site.

The tool must let customers:

- open a specific sofa from Shopify or from the internal catalog;
- switch fabrics for that sofa;
- review the sofa across its available views;
- choose the exact sofa view they want to simulate at home;
- launch an in-home simulation from an uploaded room photo.

The business goal is to help customers picture the product before purchase, without replacing the existing Shopify site, which remains the main commercial channel.

## Business Context

MÖBEL UNIQUE already sells its products through Shopify.

The project is not a rebuild of the e-commerce site and does not replace Shopify. The project creates an external visualization experience that is reachable from a dedicated subdomain.

The Shopify site remains responsible for sales, commercial product pages, cart, payment, orders, and e-commerce management.

The visualization tool is responsible for the simulation-first product experience, AI generation, in-home simulation, and the private back office needed to prepare sofas, fabrics, and renders.

## Product Concept

Customers can use the tool in two ways:

1. From a Shopify product page, by clicking a manually added link that opens the simulation detail page for that exact sofa.
2. By direct access, by opening the tool first, browsing the internal catalog, and then opening the simulation detail page for a sofa.

The simulation detail page is not a standard e-commerce product page. It exists primarily to help the customer choose a fabric and sofa view before launching an in-home simulation.

On the simulation detail page, the customer can:

- stay on one sofa;
- switch between the available fabrics for that sofa;
- switch between the available images or views of that sofa;
- select the current sofa view as the basis for the in-home simulation;
- upload a room photo and launch the in-home simulation;
- return to Shopify to place an order.

The page must remain simple to understand, with limited options and a clear path toward the simulation action.

## Scope

The product scope includes:

- a home page that presents the concept;
- an internal sofa catalog;
- a simulation-first sofa detail page;
- a sofa and fabric configurator on that page;
- a visible fabric swatch selector for customers;
- an in-home simulation from an uploaded customer photo;
- a clear secondary path back to the Shopify product page;
- a private administration back office;
- a draft area in the back office for sofas that are not yet publishable;
- sofa management;
- fabric management;
- manual render upload, AI render generation, and render validation;
- in-home simulation job tracking for operational purposes;
- anti-abuse protection for simulation requests;
- an admin operational view of recent simulation activity and job outcomes;
- an admin coverage view that shows whether each assigned fabric has a complete set of renders for a sofa;
- the ability to complete public sofa renders through manual uploads instead of AI generation when the administrator already has the required images;
- a public visualization link for each sofa that can be copied into Shopify;
- an "Order" action that redirects to the product's Shopify URL.

## Out Of Scope

Shopify is an existing external system and is outside the development scope.

The project does not include:

- Shopify development;
- automatic synchronization with Shopify;
- automatic import from the Shopify catalog;
- cart;
- payment;
- order processing;
- Shopify stock management;
- e-commerce customer accounts;
- checkout funnel;
- editing Shopify product pages from the tool.

The MVP also does not include:

- mandatory public user accounts;
- mandatory customer email collection;
- a public customer profile area;
- a default long-term gallery of customer room photos or private in-home simulations inside the admin.

Links between Shopify and the tool are manual:

- the administrator copies a generated tool link into Shopify;
- the tool stores one Shopify URL per sofa;
- the "Order" action redirects to that URL.

## Users And Permissions

### Visitor

Unauthenticated public user.

The visitor can:

- view the home page;
- browse the public catalog;
- open a sofa simulation detail page;
- choose a fabric for the current sofa;
- choose an image or view of the current sofa;
- start an in-home simulation from the currently selected sofa view;
- upload a living room photo for a simulation;
- click "Order" to return to Shopify.

The visitor cannot:

- access the back office;
- edit sofas;
- edit fabrics;
- validate or publish renders.

### Administrator

Private MÖBEL UNIQUE back-office user.

The administrator can:

- add and edit sofas;
- define the ordered image slots or views for a sofa;
- manage source photos and dimensions;
- define the original fabric represented by each uploaded source photo;
- add and edit fabrics as separate reusable entities;
- upload the required public swatch image for a fabric;
- upload the required AI reference sofa image for a fabric;
- mark a fabric as premium or non-premium;
- assign existing fabrics to a sofa;
- upload manual public renders for specific sofa slot-fabric cells;
- generate AI renders for the assigned sofa and fabric combinations;
- validate renders before publication;
- review operational simulation history, job status, and aggregate usage metrics;
- view per-sofa render coverage by fabric and image slot;
- view draft sofas and continue preparing them later;
- download generated images as a ZIP file;
- enter the Shopify order URL;
- retrieve the public visualization link to copy into Shopify.

### Potential Future Roles

This spec does not approve multiple administration levels yet.

A "super admin" role or more granular permissions can be defined in a dedicated spec if the need is confirmed.

## Core User Flows

### Flow 1 - From Shopify To The Tool

1. The customer is on a Shopify sofa product page.
2. The customer clicks a link or button that the administrator manually added in Shopify.
3. The customer lands directly on the simulation detail page for that exact sofa.
4. The customer sees the sofa's default public landing state, defined by its first published image.
5. No Shopify parameter preselects a fabric or a view.
6. The customer switches between the sofa's available views.
7. The customer keeps the current sofa view and launches the in-home simulation.
8. The customer uploads a room photo.
9. The tool generates or displays a simulation of the sofa inside the customer's home.
10. The customer can click "Order".
11. The tool redirects to the stored Shopify product page URL without passing visualization parameters.

### Flow 2 - Direct Access To The Tool

1. The customer opens the visualization subdomain directly.
2. The customer sees a home page that explains the concept.
3. The customer browses the public catalog of published sofas only.
4. The customer selects a sofa.
5. The customer lands on that sofa's simulation detail page.
6. The customer chooses a fabric.
7. The customer chooses a sofa view.
8. The customer starts the in-home simulation.
9. The customer can return to Shopify to order.

### Flow 3 - Admin Fabric Setup

1. The administrator signs in to the back office.
2. The administrator creates a fabric.
3. The administrator enters the fabric name and business metadata.
4. The administrator uploads the public swatch image that customers will see in the fabric selector.
5. The administrator uploads a separate AI reference sofa image that shows a real sofa already produced in that fabric.
6. The administrator marks the fabric as premium or non-premium.
7. The fabric becomes available for assignment to sofas.

### Flow 4 - Admin Sofa Preparation With AI

1. The administrator creates or edits a sofa.
2. The administrator enters product information: name, source photos, dimensions, and Shopify URL.
3. The administrator defines the sofa's ordered image slots or views.
4. The administrator assigns the sofa's fabrics before uploading source photos.
5. For each uploaded source photo, the administrator identifies the original fabric shown in that photo from the sofa's already assigned fabrics.
6. The administrator starts or confirms generation of the full sofa render matrix across the assigned fabrics and required image slots.
7. The system keeps the uploaded source photo as the canonical render for its original fabric and matching slot, and generates the equivalent slot renders for the other assigned fabrics.
8. The administrator reviews the generated renders.
9. The administrator validates the renders that can be published.
10. The administrator reviews the coverage view to confirm that each assigned fabric has a complete published render set for that sofa, or removes incomplete fabric assignments before publication.
11. The sofa becomes available in the public catalog with its validated fabrics and renders.

### Flow 5 - Manual Render Completion Without AI Generation

1. The administrator creates or edits a sofa.
2. The administrator defines the sofa's ordered image slots or views.
3. The administrator assigns one or more fabrics to the sofa.
4. For each fabric that should be public on that sofa, the administrator either uploads a manual public render for every required slot or uses AI generation to create the missing slot-fabric renders.
5. If every required slot-fabric cell for a fabric is covered by approved manual uploads, that fabric can be published without AI generation.
6. If any required slot-fabric cell is missing, the system must require either a manual upload or AI generation before that fabric can be shown publicly for the sofa.
7. The sofa can be published only with fabrics that have complete approved render coverage across the sofa's required slots.

### Flow 6 - Simulation Tracking

1. A customer chooses a sofa, a fabric, and a sofa view.
2. The customer uploads a room photo and starts an in-home simulation.
3. The system creates a simulation job record for operational tracking.
4. The system processes the simulation request and returns the result to the customer.
5. The administrator can later review operational simulation history, success and failure status, and aggregate usage information in the back office.

## Business Rules

### Sofa And Fabric Are Separate Entities

Sofas and fabrics are separate back-office entities.

A fabric is created once and can later be assigned to multiple sofas.

A sofa does not define new fabric records. Instead, it selects from the existing fabric records that the administrator has already created.

### Fabric Record Requirements

Each fabric record must include:

- a customer-facing swatch image used in the public fabric selector;
- an AI reference sofa image used by the image-generation workflow;
- a premium or non-premium category.

The premium category is a business label only. It does not drive pricing inside the visualization tool.

### Sofa Source Photos

Each uploaded sofa source photo must belong to one defined sofa image slot and must identify the original fabric shown in that photo.

The original fabric of a source photo must be one of the fabrics already assigned to that sofa.

If a slot-fabric pair has one original uploaded sofa source photo, that original photo is the canonical public render for that slot-fabric pair once it is approved for publication.

A slot-fabric pair may have at most one original uploaded sofa source photo.

Each sofa image slot also has one master source image for generation purposes.

The master source image for a slot is the first original uploaded sofa source photo for that slot across all fabrics.

Additional original uploaded photos for the same slot do not replace the slot's master source image by default.

### Commercial Pricing

The visualization tool does not display sofa prices or fabric price adjustments.

Shopify remains the source of truth for commercial pricing.

Customers who need pricing information must return to Shopify.

### Simulation Data And Privacy

Customer room photos and generated in-home simulations are personal data and must be handled with data minimisation and limited retention.

The business context for the MVP is privacy by default:

- the system records simulation jobs and operational metadata;
- the system does not require public customer accounts;
- the system does not require customer email collection;
- customer room photos and generated in-home simulation outputs are processed for the simulation purpose and should not be retained longer than necessary by default;
- the admin back office exposes operational simulation history rather than a default gallery of private customer interiors.

Any future decision to retain customer room photos or generated in-home simulations for longer-term reuse, customer history, marketing, or quality review requires a dedicated specification.

### Simulation Detail Page

The sofa detail page is a simulation-first page, not a standard e-commerce product page.

Its primary goal is to help the customer:

- understand that they are preparing an in-home simulation;
- choose a fabric;
- choose a sofa view;
- launch the simulation.

Its secondary goal is to let the customer return to Shopify to place an order.

### Mobile-First Constraint

The simulation detail page must be designed mobile first.

The mobile experience is a product requirement, not just a visual preference. The page must remain simple, clear, and easy to use on mobile devices before expanding to larger breakpoints.

### Image Slots And View Matching

Each sofa must define one ordered set of image slots or view groups.

The slot order must remain stable across all published fabrics for that sofa so that the customer can switch fabrics without losing the meaning of the current view.

When the customer changes fabric:

- the tool must keep the same selected image slot;
- the equivalent published render for that slot must always exist for every publicly available fabric on that sofa.

### Complete Render Coverage Per Fabric

For a given sofa, public fabrics must follow the sofa's full ordered image-slot set.

There are no fabric-only extra public slots and no partial public slot sets for a published fabric.

If a fabric is available for a sofa, all required sofa image slots must have approved public renders for that fabric.

If the sofa gains a new required image slot later, the render set for every assigned public fabric must be completed or extended through manual upload or AI generation so that the sofa's slot coverage remains complete across fabrics.

### Manual Render Uploads Instead Of AI Generation

Manual uploads and AI-generated renders are two ways to fill the same sofa render matrix.

There is no separate product type that bypasses the render coverage rules.

A manual render upload means that the administrator uploads a public image for one specific sofa, one specific image slot, and one specific assigned fabric.

For each required slot-fabric cell, the public render may come from:

- an approved manual upload provided by the administrator; or
- an approved AI-generated render created from the sofa source image and fabric reference.

A fabric can be public for a sofa only when every required slot for that fabric has an approved public render, regardless of whether those renders were uploaded manually or generated by AI.

If the administrator already has complete real photos for a fabric across all required slots, the administrator can publish that fabric without running AI generation for that fabric.

If the administrator has only some of the required photos for a fabric, the missing slot-fabric cells must be completed through additional manual uploads or AI generation before that fabric can be shown publicly.

AI generation should fill only the missing slot-fabric cells that do not already have an approved manual public render or an approved original uploaded source photo.

### Render Matrix Generation

For each sofa, the public visualization set must behave as a complete matrix:

- rows are the sofa's ordered image slots;
- columns are the fabrics assigned to that sofa.

Each slot-fabric cell in that matrix must exist before the fabric is shown publicly for the sofa.

When a source photo is uploaded for a sofa:

- the uploaded photo defines one slot in one original fabric;
- if that slot does not already have a master source image, that uploaded photo becomes the slot's master source image;
- if that slot-fabric pair does not already have an original uploaded source photo, that uploaded photo becomes the canonical render for that slot in that original fabric after approval;
- if that slot-fabric pair already has an original uploaded source photo, the system must reject the new duplicate original upload for that slot-fabric pair;
- the system must complete the equivalent slot for every other assigned fabric that does not already have a canonical original image, either through an approved manual upload or AI generation, so the matrix stays complete.

If the administrator later adds another source photo in a different original fabric, that new photo becomes the canonical render for its own slot-fabric pair only if that pair did not already have an original uploaded source photo, but it does not replace the slot's master source image by default.

The system must still complete the remaining missing slot renders for the other assigned fabrics through approved manual uploads or AI generation so the matrix stays complete.

If the administrator adds a new source photo or a new required slot after fabrics have already been assigned, the system must extend the full matrix through approved manual uploads or AI generation so that every assigned public fabric receives that new slot as well.

### AI Reference Image Selection

The generation workflow must select the AI reference input according to the target fabric and the available source photo.

For a slot-fabric pair that already has an original uploaded sofa source photo:

- that original uploaded photo is the canonical image for that pair;
- the system must use that canonical original image directly for that slot-fabric pair and must not regenerate it;
- that canonical original image does not change the slot's master source image unless it was also the first original uploaded photo for the slot.

For a slot-fabric pair that does not already have an original uploaded sofa source photo:

- the system must use the slot's master source image as the slot-specific source image;
- the system must use the target fabric's global AI reference sofa image as the fabric reference.

### Public Fabric Availability

A fabric must not be shown publicly for a sofa unless that sofa has a complete published render set for that fabric.

This prevents customers from seeing a fabric choice that does not yet exist as a complete sofa visualization.

At publication time, the administrator must either:

- keep only the sofa's fully prepared fabric assignments; or
- remove any incomplete fabric assignments before publishing the sofa.

The system must not rely on partial public filtering rules to hide incomplete assigned fabrics for an otherwise published sofa.

### Render Publication

Manual uploads and AI-generated renders must be validated by the administrator before they are publicly visible.

A generated or uploaded but unvalidated render must not be used as a public render.

### Catalog Visibility

The public catalog must contain published sofas only.

Sofas that are not ready for publication remain in a private draft area of the back office until the administrator completes the required work.

### Simulation Tracking And Anti-Abuse

The system must keep operational records of simulation activity so administrators can monitor usage and job outcomes.

The tracked information should focus on operational needs such as:

- requested sofa;
- requested fabric;
- requested slot;
- job status;
- timestamps;
- aggregate usage volume.

The MVP should protect the simulation flow against abuse and automated misuse with proportionate anti-abuse controls.

The business context does not require a fixed implementation detail such as mandatory CAPTCHA on every request.

### Shopify

Shopify remains the commercial destination.

The tool must only:

- expose one public link per sofa;
- store one Shopify URL per sofa;
- redirect to that URL when the customer wants to order;
- open with a default public state and no inbound fabric or slot parameters from Shopify;
- return to Shopify without outbound visualization parameters.

## External Systems

### Shopify

Existing external system, outside the development scope.

Planned usage:

- the administrator manually pastes the public visualization link from the tool into Shopify;
- the tool redirects to a Shopify URL entered in the back office;
- the link exchange does not depend on passing visualization state parameters.

### AI Generation Service

The brief approves the use of artificial intelligence to generate renders, but does not approve the technical provider yet.

The AI provider, usage limits, costs, formats, and retry rules will be defined in a dedicated technical spec.

## Initial Domain Objects

The domain objects identified at this stage are:

- sofa;
- sofa source photo;
- sofa source photo original fabric;
- sofa image slot or view group;
- sofa image-slot order;
- slot master source image;
- fabric;
- fabric swatch image;
- fabric AI reference sofa image;
- fabric premium flag;
- sofa-to-fabric assignment;
- AI render;
- manual public render;
- render source type;
- render publication status;
- render coverage status by sofa, fabric, and slot;
- customer living room photo;
- in-home simulation;
- simulation job;
- simulation job status;
- simulation usage metrics;
- Shopify order URL;
- public visualization link;
- administrator.

This list is a starting point. The final data model will be defined in a dedicated spec.

## Data Model

This spec does not define the database schema yet.

It establishes the main domain boundaries that must be reflected in a future data-model spec:

- sofas and fabrics are separate entities;
- fabrics are reusable across sofas;
- sofas define ordered image slots;
- sofa source photos carry an original-fabric identity;
- each slot has one stable master source image for generation;
- each slot-fabric pair allows at most one original uploaded source photo;
- public renders are tracked per sofa, fabric, and slot;
- public renders must track whether they came from manual upload, original source photo, or AI generation;
- fabric visibility depends on complete published slot coverage for the sofa;
- public renders form a complete slot-by-fabric matrix per sofa;
- simulation jobs and operational simulation metrics are tracked separately from product render assets;
- customer room photos and in-home simulation outputs follow limited-retention handling by default.

## API

This spec does not define API routes yet.

API contracts will be defined after the flows, roles, domain objects, and publication rules are approved.

## Worker Jobs

This spec confirms that AI generation and image processing will be needed.

The following details will be defined in a dedicated spec:

- generation for a sofa and assigned fabric;
- generation by sofa image slot;
- full render-set generation for all required slots of a sofa and fabric;
- manual public render upload and validation;
- source-photo original-fabric handling;
- slot master-source selection;
- matrix extension when new source photos are uploaded;
- regeneration when a sofa gains new required image slots;
- admin validation;
- simulation job lifecycle;
- simulation retention rules;
- anti-abuse controls;
- ZIP export;
- storage for originals and renders;
- retries;
- errors;
- observability.

## Environment Variables

This spec does not define new environment variables yet.

Variables related to the public domain, storage, authentication, and AI provider will be defined in the relevant technical specs.

## MVP Boundaries

The MVP must demonstrate the full flow:

- a customer arrives from Shopify or from the internal catalog;
- the customer lands on a simulation-first sofa detail page;
- the customer chooses a fabric;
- the customer chooses a sofa view;
- the customer starts an in-home simulation;
- the customer can return to Shopify;
- the administrator can create reusable fabrics with the required two images and premium labeling;
- the administrator can assign fabrics to sofas and generate complete render coverage by slot;
- the administrator can upload source photos in different original fabrics and the system extends the full render matrix accordingly;
- the administrator can complete any slot-fabric cell with an approved manual upload instead of AI generation;
- the public catalog shows published sofas only while unfinished sofas remain in drafts;
- the system records simulation jobs for operational follow-up without requiring public customer accounts or email collection by default.

The MVP must not include internal e-commerce functionality.

## Acceptance Criteria

- The project scope is clearly separated from Shopify.
- The two customer entry flows are described.
- The sofa detail page is explicitly defined as simulation first rather than e-commerce first.
- The mobile-first requirement is explicit.
- Sofas and fabrics are defined as separate entities.
- Fabric creation requires a public swatch image, an AI reference sofa image, and a premium flag.
- The no-pricing-in-tool rule is documented.
- The image-slot matching rule is documented.
- Public fabrics require complete render coverage for the sofa.
- Manual uploads and AI generation are documented as two ways to complete the same required slot-fabric render matrix.
- The spec explicitly rejects a separate product type that bypasses render coverage rules.
- A fabric can be published without AI generation only when approved manual uploads cover every required slot for that fabric.
- The render matrix generation rule is documented.
- The AI reference image selection rule is documented.
- The slot master-source selection rule is documented.
- The one-original-per-slot-fabric rule is documented.
- The publication rule for assigned fabrics is documented.
- The render validation rule applies to both manual uploads and AI-generated renders.
- The published-catalog versus admin-draft rule is documented.
- The privacy-by-default rule for customer simulations is documented.
- The operational simulation tracking rule is documented.
- The anti-abuse requirement is documented.
- The main administration capabilities are identified.
- The first domain objects are listed.
- The MVP boundaries are explicit.
- Open questions are listed for the following specs.

## Open Questions

- What is the final subdomain: `visualiser.mobelunique.fr` or another domain?
- Will the internal catalog be entered entirely in the tool or imported manually at launch?
- Which public identifier should open a sofa: slug, internal id, or another identifier?
- How many required image slots should each sofa have at launch?
- How long should customer living room photos be retained?
- Should customer simulations be stored or deleted after display?
- Which AI provider will be used for sofa and fabric renders?
- Which AI provider will be used for the in-home customer simulation?
- Is there only one administrator at launch, or should multiple accounts be supported?
- Is moderation or validation needed for in-home simulations?
- Do generated images need specific formats for Shopify?
