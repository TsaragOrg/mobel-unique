# SPEC-0003 Business Context - AI Sofa Visualization

Spec: SPEC-0003
Status: accepted
Layer: business-context
Parent Spec: none
Depends On: none
Areas: web, api, image-worker, supabase
Implementation Plans: none yet

Source: client-approved MÖBEL UNIQUE project brief, dated March 18, 2026, plus follow-up product clarifications recorded during specification drafting.

## Traceability

This spec is the root product-business spec for the MÖBEL UNIQUE AI sofa visualization project.

It creates the product frame for the domain, technical, and cross-cutting specs that will describe the project from end to end before implementation starts.

Follow-up specs must preserve the business decisions and product invariants defined here. If a follow-up spec needs to change one of those decisions after this spec is accepted, it must use a change request.

Expected follow-up specification areas:

- public customer experience;
- admin catalog and fabric management;
- render preparation, coverage, generation, and publication;
- in-home simulation flow;
- privacy, retention, and abuse protection;
- data model and storage;
- API contracts;
- worker jobs and AI providers;
- admin authentication and operations;
- environment and deployment.

The final spec ids, titles, boundaries, and dependencies will be confirmed when each follow-up spec is drafted.

## Purpose Of This Spec

This document is the parent business-context specification for the MÖBEL UNIQUE AI sofa visualization product.

Its role is to define the product intent, business boundaries, main users, end-to-end product shape, MVP scope, and product invariants that all follow-up specifications must respect.

This document intentionally does not define detailed screens, database schema, API routes, worker implementation, AI provider rules, storage buckets, queue behavior, or exact UI step-by-step flows. Those details must be defined in dedicated follow-up specs.

## Goal

Build an AI visualization tool that helps customers picture a MÖBEL UNIQUE sofa in their own home before purchase.

The tool must remain separate from the existing Shopify store. Shopify remains the commercial system for product pages, pricing, cart, checkout, payment, orders, stock, and e-commerce management.

The visualization tool is responsible for:

- presenting the concept to customers;
- letting customers browse published sofas;
- letting customers open a specific sofa from Shopify or from the internal catalog;
- letting customers choose a fabric and visual position;
- letting customers launch an in-home simulation from their selected sofa, fabric, and visual position;
- redirecting customers back to Shopify when they want to order;
- giving administrators a private back office to prepare sofas, fabrics, renders, publication, and operational follow-up.

## Product Concept

The product is a simulation-first experience, not an e-commerce replacement.

Customers can enter the experience in two ways:

- from Shopify, by clicking a manually added link on a Shopify product page;
- directly, by opening the visualization tool and browsing the internal public catalog.

In both cases, the customer eventually reaches a sofa detail page whose main purpose is to prepare an in-home simulation.

The customer chooses:

- one sofa;
- one available fabric for that sofa;
- one available visual position;
- one uploaded room photo for the in-home simulation.

The customer can then run the simulation and return to Shopify to order.

## Scope

The product scope includes:

- a public home page that explains the visualization concept;
- a public catalog of published sofas;
- a simulation-first sofa detail page;
- fabric and visual position selection for a selected sofa;
- in-home simulation from an uploaded customer room photo;
- customer email delivery of the generated simulation result while the result is still retained;
- a clear secondary path back to the related Shopify product page;
- a private administration back office;
- sofa preparation and publication management;
- reusable fabric management;
- public render preparation through manual uploads, AI generation, or both;
- administrator ZIP export of sofa render sets for Shopify-side reuse;
- draft handling for unfinished sofas;
- a lightweight operational overview of simulation jobs and usage;
- proportionate anti-abuse protection for public simulation requests;
- manual linking between Shopify and the visualization tool.

## Out Of Scope

Shopify is an existing external system and is outside the development scope.

The project does not include:

- rebuilding the Shopify site;
- automatic Shopify synchronization;
- automatic Shopify catalog import;
- cart;
- payment;
- order processing;
- Shopify stock management;
- e-commerce customer accounts;
- checkout funnel;
- editing Shopify product pages from the visualization tool.

The MVP also does not include:

- mandatory public customer accounts;
- mandatory customer email collection before browsing, choosing a sofa, or viewing a simulation result;
- a public customer profile area;
- a default customer gallery of past simulations;
- a default long-term admin gallery of private customer interiors;
- pricing or fabric price adjustments inside the visualization tool.

## Users And Permissions

### Visitor

A visitor is an unauthenticated public user.

The visitor can:

- view the public home page;
- browse the public catalog;
- open a published sofa detail page;
- choose a public fabric for the selected sofa;
- choose a public visual position for the selected sofa;
- start an in-home simulation from the selected sofa, fabric, and visual position;
- upload a room photo for that simulation;
- view the simulation result;
- request the generated simulation result by email while it is still available;
- return to Shopify through the stored order URL.

The visitor cannot:

- access the back office;
- edit sofas;
- edit fabrics;
- publish content;
- prepare or publish renders;
- view other customers' private room photos or simulations.

### Administrator

An administrator is a private MÖBEL UNIQUE back-office user.

The administrator can:

- prepare sofas;
- manage reusable fabrics;
- define which fabrics are available for each sofa;
- define which visual positions are required for each sofa;
- provide or generate public renders for sofa, fabric, and visual position combinations;
- publish complete sofas;
- keep unfinished sofas private as drafts;
- archive public sofas when needed;
- enter the Shopify order URL for a sofa;
- retrieve the public visualization link to copy into Shopify;
- download sofa render sets as ZIP files for Shopify-side reuse;
- review operational simulation job history and outcomes.

This parent spec does not approve multiple administration levels. More granular roles can be defined in a dedicated admin-auth spec if needed.

## End-To-End Product Narrative

### Customer From Shopify

1. The customer views a sofa on Shopify.
2. The customer clicks a manually added visualization link.
3. The customer lands on the visualization page for that sofa.
4. The customer sees the default public fabric and default public visual position for the sofa.
5. The customer can switch fabric and visual position within the public options available for that sofa.
6. The customer starts an in-home simulation from the selected sofa, fabric, and visual position.
7. The customer uploads a room photo and follows a guided simulation preparation flow if required.
8. The tool displays the generated simulation result.
9. The customer can request the generated simulation result by email while it is still available.
10. The customer can return to Shopify to order.

### Customer From Direct Access

1. The customer opens the visualization subdomain directly.
2. The customer sees a public home page explaining the concept.
3. The customer browses the public catalog of published sofas.
4. The customer opens a sofa detail page.
5. The customer chooses a public fabric and public visual position.
6. The customer starts the in-home simulation.
7. The customer can request the generated simulation result by email while it is still available.
8. The customer can return to Shopify to order.

### Administrator Preparation

1. The administrator signs in to the back office.
2. The administrator prepares reusable fabrics.
3. The administrator prepares sofas and their required visual matrix columns, exposed publicly as visual positions.
4. The administrator assigns fabrics to sofas.
5. The administrator completes the required public render coverage for the sofa through manual uploads, AI generation, or both.
6. The administrator publishes only sofas and fabric options whose current visual matrix is complete enough for a consistent public experience.
7. The administrator downloads sofa render sets as ZIP files when those images are needed for Shopify-side reuse.
8. The administrator copies the public visualization link into Shopify.

### Operational Follow-Up

1. A visitor launches an in-home simulation.
2. The system creates an operational simulation job record.
3. The simulation is processed and the result is returned to the visitor.
4. The administrator can review a lightweight global view of recent simulation activity, job status, failure status, and aggregate usage indicators.

## Product Invariants

### Shopify Separation

Shopify remains the commercial destination and source of truth for pricing, cart, payment, orders, stock, and e-commerce management.

The visualization tool must only store the Shopify URL needed to redirect a customer back to the relevant Shopify product page.

The link from Shopify to the visualization tool is manual. The tool must not require Shopify synchronization for the MVP.

### Simulation-First Detail Page

The sofa detail page is not a standard e-commerce product page.

Its primary purpose is to help the customer choose a fabric and visual position before launching an in-home simulation.

Its secondary purpose is to let the customer return to Shopify to order.

### Mobile-First Public Experience

The public visualization experience must be designed mobile first.

The page must remain simple, clear, and usable on mobile before expanding to larger breakpoints.

### Sofas, Fabrics, And Visual Positions

Sofas and fabrics are separate product concepts.

A fabric is reusable and can be assigned to multiple sofas.

Each sofa has an ordered set of admin-managed visual matrix columns. Publicly, those columns are exposed as selectable visual positions or image options.

The public UI must not expose the internal term `visual matrix column` to visitors.

When a customer changes fabric, the selected visual position must remain the same matrix position.

### Complete Public Render Coverage

A fabric can be public for a sofa only when that fabric has public-usable renders for every required public visual position of that sofa.

The public experience must not expose partial fabric coverage where some visual positions exist and others are missing.

Public renders may be completed through:

- manual uploads provided by the administrator;
- AI-generated renders;
- a combination of manual uploads and AI-generated renders.

There is no separate product type that bypasses this coverage rule.

The detailed render matrix, source-photo handling, AI reference selection, generation, regeneration, and publication rules belong in a dedicated render specification.

### Draft, Published, And Archived Sofas

A sofa can be public only when it is explicitly published.

Unfinished sofas remain private in the back office.

The accepted business-level visibility states are:

- `draft`: private and still being prepared;
- `published`: visible in the public catalog and available through its public visualization link;
- `archived`: hidden from the public catalog and no longer promoted, while retained for administrative history.

Detailed readiness checks should be derived from render coverage and required metadata instead of being managed as independent manual status fields.

### Public Defaults

When a customer opens a sofa from Shopify or from the public catalog, the page must load with a deterministic public default state:

- the first public fabric according to the administrator-defined order;
- the first public visual position according to the administrator-defined visual matrix column sequence.

Shopify links do not preselect fabric or visual position in the MVP.

### In-Home Simulation

An in-home simulation always starts from a selected sofa, selected fabric, and selected visual position.

The customer must provide a room photo.

The simulation may require a guided multi-step preparation flow where the customer uploads a room photo, confirms or adjusts room references, provides relevant room dimensions, and then receives a generated visualization.

The customer must be able to view the generated simulation result while the result is still retained by the system.

The MVP must not require direct browser download of the private generated simulation result.

Instead, the customer can request the generated simulation result by email while the result is still retained.

Email is required only for result delivery, not for browsing, choosing a sofa, starting a simulation, or viewing the result.

Result email delivery requires a consent step explaining that the private room photo and generated simulation output are retained temporarily and deleted no later than 24 hours after creation.

Optional marketing or contact consent must be separate from required result-delivery consent.

The MVP does not require public sharing links, customer galleries, or long-term customer simulation history.

The detailed simulation wizard, validation rules, image preparation steps, dimension requirements, failure states, and retry behavior belong in a dedicated in-home simulation specification.

### Privacy By Default

Customer room photos and generated in-home simulation outputs are personal data.

The MVP must minimize retention by default:

- public customer accounts are not required;
- customer email collection is required only when the customer requests result delivery by email;
- customer room photos and simulation outputs must be retained only as long as needed for the simulation purpose;
- customer room photos and simulation outputs must not be retained for more than 24 hours in the MVP;
- the back office must expose operational job history rather than a default gallery of private customer interiors.

Any longer-term retention for customer history, marketing reuse, quality review, or admin galleries requires an explicit future specification.

### Operational Tracking And Anti-Abuse

The system must record operational simulation metadata so administrators can understand usage and job outcomes.

The MVP operational view must remain lightweight. It should focus on selected sofa, selected fabric, selected visual position, job status, timestamps, failure status, and simple aggregate usage indicators.

Advanced analytics, complex filtering, and full reporting dashboards are not required for MVP.

The MVP must include proportionate anti-abuse protection for simulation requests. This parent spec does not mandate a specific mechanism such as CAPTCHA on every request.

## MVP Boundaries

The MVP must support the complete business loop:

- a customer enters from Shopify or direct access;
- the customer browses or opens a published sofa;
- the customer selects a public fabric and visual position;
- the customer launches an in-home simulation from that selection;
- the customer receives a simulation result;
- the customer can request the simulation result by email while it is still retained;
- the customer can return to Shopify to order;
- an administrator can prepare sofas, fabrics, visual matrix columns, and public renders;
- an administrator can publish only complete public sofa experiences;
- an administrator can retrieve the public visualization link for Shopify;
- an administrator can download sofa render sets as ZIP files for Shopify-side reuse;
- the system records operational simulation activity and exposes a lightweight operational overview.

The MVP must not include internal e-commerce functionality.

## Deliberately Deferred Detail

The following topics must not be fully specified in this parent business-context spec:

- exact public page layouts and interaction states;
- exact simulation wizard steps;
- room reference placement and room dimension collection;
- image validation rules;
- source-photo and master-source rules;
- render matrix implementation details;
- AI provider selection;
- AI prompt strategy;
- generation costs, limits, retries, and formats;
- API contracts;
- database schema;
- storage buckets;
- background queue implementation;
- authentication implementation;
- retention deletion implementation;
- deployment environment variables.

## Specification-Driven Development Requirement

The project must be specified before it is implemented.

This means the team must create and review the complete set of business, domain, technical, and cross-cutting specs needed to describe the MVP from end to end before starting feature implementation.

Implementation plans must come after accepted specs. Code changes must come after implementation plans.

The expected traceability chain is:

```text
SPEC-0003 business context -> follow-up specs -> accepted specs -> implementation plans -> tests -> code -> roadmap updates
```

## Follow-Up Specification Areas

The following areas are expected to become dedicated specs before implementation. The final spec ids, titles, boundaries, and dependencies will be confirmed when each follow-up spec is drafted.

- Public Customer Experience: a `domain` area covering the public home page, public catalog, sofa detail page, fabric selection, visual position selection, default states, mobile-first behavior, simulation result access, result email delivery, and Shopify order redirect.
- Admin Catalog And Fabric Management: a `domain` area covering admin sofa preparation, reusable fabric management, sofa metadata, fabric assignment, visual matrix column management, Shopify URL entry, draft behavior, publication, and archive behavior.
- Render Preparation, Coverage, Generation, And Publication: a `domain` and `technical` area covering manual uploads, AI-generated renders, render source types, complete coverage rules, publication readiness, regeneration, and required admin ZIP export.
- In-Home Simulation Flow: a `domain` and `technical` area covering room photo upload, guided simulation wizard, room references, dimensions, simulation job lifecycle, result display, result email delivery, retry, and failure states.
- Privacy, Retention, And Abuse Protection: a `cross-cutting` area covering customer photo retention, simulation output retention with a 24-hour MVP maximum, deletion rules, operational metadata, rate limiting, abuse prevention, and admin visibility boundaries.
- Data Model And Storage: a `technical` area covering database tables, relationships, statuses, indexes, file ownership, storage buckets, public/private asset boundaries, and retention fields.
- API Contracts: a `technical` area covering public routes, admin routes, upload flows, request and response payloads, auth requirements, errors, pagination, and idempotency expectations.
- Worker Jobs And AI Providers: a `technical` area covering render generation jobs, in-home simulation jobs, provider selection, provider limits, formats, retries, failures, idempotency, and cost-sensitive controls.
- Admin Auth And Operations: a `cross-cutting` area covering administrator access, MVP role model, operational overview, simulation monitoring, audit expectations, and basic admin security boundaries.
- Environment And Deployment: a `technical` area covering DEV and PROD separation, required environment variables, Vercel settings, Railway settings, Supabase settings, domains, and deployment-facing checks.

Shopify linking does not need to be a standalone follow-up spec by default. It should be covered inside the public customer experience, admin catalog, API contracts, and environment specs unless URL behavior becomes complex enough to justify a dedicated spec.

## Acceptance Criteria

- The product is clearly defined as a visualization tool, not a Shopify replacement.
- Shopify remains the commercial source of truth.
- The two customer entry paths are described.
- The simulation-first sofa detail concept is described.
- The public experience is explicitly mobile first.
- The main visitor and administrator capabilities are described at business level.
- Sofas, fabrics, and visual positions are identified as core product concepts.
- Complete public render coverage is defined as a product invariant.
- Manual uploads and AI-generated renders are both allowed ways to complete public render coverage.
- The spec rejects a separate product type that bypasses render coverage.
- Draft, published, and archived sofa visibility are defined at business level.
- The in-home simulation is described without locking the detailed wizard design.
- Customer result email delivery is included while the result is retained.
- Privacy-by-default is defined as an MVP principle.
- Customer room photos and simulation outputs have a 24-hour maximum MVP retention rule.
- Operational simulation tracking and anti-abuse are included.
- The operational view is scoped as lightweight for MVP.
- Admin ZIP export of sofa render sets is included in MVP.
- Detailed implementation topics are explicitly deferred to follow-up specs.
- The follow-up specification areas provide a clear path for detailed product and technical specifications.

## Review Decisions

The following review decisions are accepted for this parent spec:

- `draft`, `published`, and `archived` are enough as business-level sofa visibility states.
- Default public fabric and default public visual position must use the administrator-defined order.
- The customer must be able to request the generated simulation result by email while it is still retained.
- Email collection is required only for result delivery.
- Required result-delivery consent and optional marketing or contact consent must be separate.
- Customer room photos and simulation outputs must not be retained for more than 24 hours in the MVP.
- Admin ZIP export of sofa render sets is required in MVP because those images may be reused on Shopify.
- The MVP must include a global operational view, but it should stay lightweight and avoid advanced analytics or excessive controls.
