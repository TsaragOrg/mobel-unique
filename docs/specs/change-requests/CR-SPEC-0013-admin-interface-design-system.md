# CR-SPEC-0013 Admin Interface Design System And Harmonization

Spec: SPEC-0013
Status: draft
Layer: domain
Parent Spec: SPEC-0013
Depends On: SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0014
Areas: web
Implementation Plans: PLAN-0044

## Traceability

`SPEC-0013 Admin Frontend Experience And Page Flows` defines the protected admin route map, workflows, data boundaries, and required page behavior. It explicitly leaves final visual design tokens and exact admin page layouts out of scope.

This change request adds a lightweight admin interface design system and implementation sequence so the existing admin pages can be harmonized without changing catalog behavior, admin permissions, storage boundaries, or API contracts.

It follows:

- `SPEC-0001 Repo Foundation`, which defines `apps/web` as the Next.js frontend;
- `SPEC-0003 Business Context`, which requires a private back office for catalog preparation;
- `SPEC-0005 Admin Catalog and Fabric Management`, which defines the admin domain behavior;
- `SPEC-0009 Data Model And Storage`, which defines private/public asset boundaries;
- `SPEC-0010 API Contracts And Edge Functions`, which defines the first-party admin API facade;
- `SPEC-0011 Admin Authentication And Authorization`, which defines admin access requirements;
- `SPEC-0014 Admin Sofa Edit UX Simplification`, which defines the most complex admin workflow structure.

## Goal

Create a coherent, reusable admin visual language that makes the back office feel like a focused operational tool:

- calm, dense, and readable;
- consistent with the refined public homepage direction without becoming a marketing page;
- efficient for repeated catalog work;
- usable on mobile for quick checks and corrections;
- stable across loading, empty, error, disabled, destructive, drawer, modal, and matrix-heavy states.

## Scope

This change request covers:

- admin shell structure and navigation presentation;
- admin typography, color, spacing, and elevation tokens;
- shared button, link, form, field, list, table, chip, status, panel, drawer, modal, and alert patterns;
- responsive rules for protected admin pages;
- page sequencing for implementation;
- visual consistency requirements for:
  - `/admin/login`;
  - `/admin`;
  - `/admin/sofas`;
  - `/admin/sofas/new`;
  - `/admin/sofas/[sofa_id]`;
  - `/admin/fabrics`;
  - `/admin/fabrics/new`;
  - `/admin/fabrics/[fabric_id]`;
  - `/admin/tags`.

## Out Of Scope

This change request does not include:

- new admin product behavior;
- new API endpoints;
- database or storage changes;
- worker behavior changes;
- public customer page redesign beyond avoiding visual conflicts;
- enabling the public upload/simulation flow from the homepage;
- direct Shopify API integration;
- multi-admin role design;
- new audit tables;
- replacing the existing admin route map;
- a reusable Codex skill.

The reusable skill can be reconsidered only after the admin visual system is implemented and stable enough to reuse across future projects.

## Users And Permissions

The only user is the authenticated MVP administrator described by `SPEC-0011` and `SPEC-0013`.

The visual system must not weaken admin access boundaries:

- protected admin routes remain protected;
- admin pages must not expose service-role keys, provider keys, raw private bucket paths, worker-only internals, or private customer simulation assets;
- public navigation must not link to admin routes;
- admin route metadata remains `noindex, nofollow`.

## Design Principles

The admin UI must prioritize work over presentation.

1. Dense but not cramped: information should be scannable without decorative page sections.
2. Clear hierarchy: each page needs one primary task, secondary actions, and quiet metadata.
3. Predictable controls: actions, forms, statuses, and destructive choices must look consistent.
4. Explicit state: loading, empty, disabled, stale, failed, blocked, ready, and published states must be visible.
5. Mobile-capable: mobile should preserve task completion, not only shrink desktop tables.
6. Private by default: internal and public-facing content must be visually distinguishable where both appear.

## Design System Requirements

### Tokens

The admin implementation must define reusable admin tokens for:

- page background;
- surface background;
- raised surface background;
- text primary, secondary, muted, and inverse;
- border/subtle divider;
- focus ring;
- success, warning, danger, info, and neutral status;
- spacing scale;
- radius scale;
- shadow/elevation scale.

Tokens may live in `apps/web/src/app/globals.css` initially. They should be named for admin usage and must not override public homepage tokens accidentally.

### Layout

Admin pages must use a shared protected admin shell pattern:

- consistent page width;
- consistent top navigation;
- consistent page header with title, description, and primary action area;
- consistent content stack;
- responsive navigation that remains usable on mobile.

### Components

The visual pass must standardize these existing patterns before adding new ones:

- primary, secondary, quiet, danger, and icon-like actions;
- text links and navigation links;
- fields, labels, helper text, validation errors, and disabled fields;
- form groups and fieldsets;
- list rows and compact cards;
- admin panels and subsections;
- status chips and readiness indicators;
- empty states and loading states;
- modal, drawer, sheet, and confirmation patterns;
- image preview buttons and large image previews;
- render matrix table and mobile render groups.

### Page Priority

Implementation must begin with shared shell and simple pages, then move to heavier catalog workflows:

1. admin shell, tokens, navigation, and base controls;
2. login and dashboard;
3. list pages: sofas, fabrics, tags;
4. create and edit form pages: sofa create, fabric create, fabric edit;
5. sofa edit workflow tabs;
6. drawers, modals, image previews, render matrix, and responsive matrix states;
7. final accessibility, responsive, and visual QA sweep.

## User Flow

### Routine Catalog Maintenance

1. Admin signs in at `/admin/login`.
2. Admin lands on `/admin`.
3. Admin scans dashboard entry points.
4. Admin opens sofas, fabrics, or tags.
5. Admin edits catalog data through consistent forms and action patterns.
6. Admin opens a sofa edit workflow when visual preparation is needed.
7. Admin uses tab-specific actions without losing orientation.

### Sofa Preparation

1. Admin opens `/admin/sofas/[sofa_id]`.
2. Admin sees a clear sofa header, lifecycle status, and workflow navigation.
3. Admin moves between Basics, Fabrics, Visual matrix, Renders, and Publish.
4. Admin opens drawers or modals only for detailed actions.
5. Admin can understand what is ready, missing, blocked, or pending without scanning all controls at once.

## Data Model

No data model changes.

## API

No API contract changes.

The implementation must continue using the existing first-party `/api/admin/*` facade.

## Worker Jobs

No worker job changes.

## Environment Variables

No environment variable changes.

## Acceptance Criteria

- A short admin visual system decision record exists and defines the intended admin look and reusable patterns.
- Admin shell, navigation, buttons, fields, panels, lists, chips, drawers, and modal patterns are implemented consistently.
- `/admin/login` and `/admin` use the new admin visual system without changing authentication behavior.
- `/admin/sofas`, `/admin/fabrics`, and `/admin/tags` use the same list, action, empty, loading, and error patterns.
- Sofa and fabric create/edit forms use the same field, validation, upload, and action patterns.
- `/admin/sofas/[sofa_id]` preserves `SPEC-0014` workflow tabs while adopting the shared admin visual system.
- Render matrix desktop and mobile views remain usable after visual changes.
- Admin pages remain `noindex, nofollow`.
- Public/private boundaries remain unchanged.
- Existing admin tests pass after the visual harmonization.
- New or updated tests cover shared shell/navigation, important visible states, and any behavior affected by markup changes.
- Browser verification covers desktop, tablet, and mobile admin viewports.

## Open Questions

- Should admin labels remain entirely English for this phase, matching `SPEC-0013`, or should a later localization spec introduce French admin copy?
- Should the admin shell include an account indicator immediately, or defer it until operational views are expanded?
- Should the render matrix redesign be completed in the same PR as sofa edit visual harmonization, or split into a follow-up PR after shared patterns stabilize?
