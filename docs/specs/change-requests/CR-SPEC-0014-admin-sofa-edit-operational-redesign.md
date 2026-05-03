# CR-SPEC-0014 Admin Sofa Edit Operational Redesign

Spec: SPEC-0014
Status: draft
Layer: feature
Parent Spec: SPEC-0014
Depends On: SPEC-0003, SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0014
Areas: web
Implementation Plans: PLAN-0052

## Traceability

`SPEC-0014 Admin Sofa Edit UX Simplification` created the first tabbed sofa edit workflow. It correctly separated Basics, Fabrics, Visual matrix, Renders, and Publish, but the current implementation still reads as an early operational prototype rather than a fully resolved Mobel Unique admin tool.

The existing `CR-SPEC-0013 Admin Interface Design System And Harmonization` and `docs/decisions/0001-admin-interface-visual-system.md` require a restrained, dense, work-focused admin visual system. Manual review of `/admin/sofas/[sofa_id]` found that the sofa edit page does not yet meet that bar.

This change request turns the sofa edit page into a dedicated operational redesign effort. It keeps the accepted workflow model, permissions, storage boundaries, and API behavior unless a later accepted spec explicitly changes them.

## Goal

Make the sofa edit workspace feel like a professional catalog preparation tool:

- calm, sober, and aligned with the Mobel Unique visual direction;
- ergonomic for repeated catalog work on desktop;
- clear and touch-friendly for mobile checks and corrections;
- focused on the administrator's next useful action instead of exposing every possible action at equal weight;
- visually mature enough to avoid nested panels, aggressive black buttons, noisy status badges, and prototype-style form controls.

## Scope

This change request covers the protected sofa edit page only:

- sofa edit header and workflow navigation;
- Basics tab form layout, dimension inputs, tag controls, and save model presentation;
- Fabrics tab assignment, ordering, fabric identity display, and action hierarchy;
- Visual matrix tab list rows, source-photo state, mobile spacing, and row actions;
- Renders tab command bar, matrix density, fabric labels, render cell content, status legend, and mobile grouped layout;
- render cell detail experience, including whether desktop uses a side drawer, centered workbench dialog, or larger sheet;
- candidate review layout inside the render cell detail experience;
- placement of ZIP render export controls;
- shared admin control variants used inside this page: buttons, fields, checkboxes, status indicators, compact action menus, dialogs, and sheets;
- desktop, tablet, and mobile visual QA for this route.

## Out Of Scope

This change request does not include:

- changing fabric render worker behavior;
- changing candidate selection or publication rules;
- changing admin authentication or authorization;
- changing storage visibility or exposing private paths;
- changing public customer pages;
- replacing the whole admin route map;
- introducing a full reusable component library outside the admin page needs;
- adding drag-and-drop ordering unless a later plan proves it is necessary.

## Users And Permissions

The user is the authenticated MVP administrator from `SPEC-0011` and `SPEC-0013`.

The page must continue to:

- require the existing admin session boundary;
- avoid exposing service-role keys, provider keys, raw private bucket paths, or worker-only internals;
- keep admin pages `noindex, nofollow`;
- use the existing first-party `/api/admin/*` facade.

## Design Principles

### One Surface Level

The page must not present panels inside panels inside numbered panels. Each tab should use one main workspace surface, then rows, field groups, tables, dialogs, or sheets only when they serve a real task.

Numbered step badges are not appropriate for freely navigable tabs. The tabs already provide workflow structure.

### One Primary Action Per Context

Black filled buttons are reserved for the single primary action in the current context. Secondary, quiet, inline, destructive, and overflow actions must use distinct treatments.

Rows must not show three equal black buttons side by side. Repeated row actions should be compact, secondary, or grouped behind a menu when the primary action is simply opening the row.

### Status Should Guide, Not Decorate

Readiness and render statuses must be compact, textual, and consistent. They should not create a noisy badge salad.

The Renders legend should be progressive: a compact status key, help affordance, popover, or collapsible explanation. It should not dominate the matrix.

### Forms Should Feel Designed

Fields must use visible labels, predictable helper text, clear validation, restrained borders, and consistent spacing. Native number input spinner arrows should not be the primary dimension editing experience.

Dimension fields should use a unit-aware pattern such as text input with `inputMode="numeric"`, validation, and a visible `cm` suffix, or a custom compact number field without browser spinner controls.

Checkboxes should use the admin visual system rather than browser-default styling. They need visible labels, focus states, disabled states, and enough touch area.

### Mobile Is A Real Workflow

Mobile must not be a squeezed desktop table. Actions should avoid stacked button clusters, horizontal overflow as the primary pattern, and cramped drawers. Touch targets should remain at least 44px high.

## Target Experience

### Header And Workflow Navigation

The sofa edit header should show:

- sofa internal name;
- lifecycle state;
- concise public identity;
- aggregate readiness;
- the next recommended task when one is obvious.

Workflow tabs should become a restrained segmented or underline navigation pattern. Active state should not invert the whole tab to black. Readiness should appear as a small textual indicator or dot with accessible text, not as a chip inside a chip.

### Basics

Basics should feel like a clean editorial form, not a test page:

- group fields into Identity, Public content, Dimensions, and Tags;
- avoid full-width fields when a narrower field improves scanning;
- show dimensions in a compact row with unit suffixes;
- remove native number spinner dependency;
- replace default checkboxes and tag selectors with designed selection controls;
- keep `Save sofa` as the only primary action.

### Fabrics

Fabrics should answer two questions immediately:

1. Which fabrics are assigned to this sofa?
2. What still needs attention before renders/publication?

The target layout should:

- show assigned fabrics as compact rows with swatch, public name, short internal reference, AI-reference state, premium state, and public order;
- avoid repeating full fabric names where the swatch and short label are enough;
- move assignment into a calm add-fabric flow, such as a searchable select plus a single primary action or an add-fabric drawer;
- make ordering controls compact and predictable;
- keep destructive unassign actions quiet or behind confirmation;
- avoid a toolbar of black buttons.

### Visual Matrix

Visual Matrix is configuration, not render production.

The target layout should:

- show visual positions as dense rows with sequence, public label, admin label, source-photo state, original fabric, and last updated context when useful;
- make the row itself the main entry point for detail;
- reserve the primary button for `Add position`;
- move edit, source photo, and delete into secondary row actions or an overflow menu;
- keep source-photo upload in a focused drawer or sheet with enough context;
- fix mobile spacing so `Add position` and row actions do not collide.

### Renders

Renders is the most important operational surface. It should help the admin understand coverage and fix the next blocked or incomplete cells.

The target layout should:

- start with a compact coverage summary: ready cells, candidates, missing cells, blocked cells, active jobs;
- show global actions only when useful:
  - `Generate missing` as the primary action when generation is available;
  - `Resume queued jobs` as a status recovery action inside a queue banner, not as a permanent peer button;
- use a desktop matrix for comparison, but with compact fabric labels:
  - swatch;
  - short public name;
  - optional truncated internal reference only when needed;
  - AI-reference state as a compact indicator, not full repeated text;
- make cells richer:
  - current render thumbnail when available;
  - status;
  - candidate count;
  - latest job state;
  - blocker hint when blocked;
  - clear affordance that the cell opens detail;
- avoid large fabric cards inside every matrix row;
- replace the bottom badge salad with a quiet status key or collapsible explanation;
- keep mobile grouped by fabric, but make each cell row compact and touch-safe.

### Render Cell Detail

Opening a render cell is a high-value workflow, not a small aside.

The implementation must explicitly evaluate and choose one desktop detail pattern:

- larger centered workbench dialog;
- wide sheet occupying a meaningful portion of the viewport;
- side drawer only if the content is reduced and still ergonomic.

The target detail view should show:

- fabric and visual position context;
- current render preview and source photo context when useful;
- status, blockers, latest job, and candidate count;
- one primary next action based on status;
- secondary actions grouped below or in a menu;
- candidate review as a gallery/list with image-first comparison;
- refinement prompt only after the admin chooses to refine;
- manual upload as a secondary recovery path.

Mobile should use a full-screen sheet with sticky context and reachable primary action.

### Publish And ZIP Export

Publish should only own public visibility:

- lifecycle state;
- publication blockers;
- publish and unpublish actions;
- links back to the tab where each blocker is fixed.

ZIP render export does not belong in Publish. It should move to either:

- a Renders export area, because the ZIP contains render assets; or
- a future Assets/Exports panel if export workflows grow.

The export UI should show what will be included before or after export, the latest export status, and a download action when the signed URL is available.

## Data Model

No data model changes are required for the visual redesign.

## API

No API contract changes are required for the visual redesign.

The existing render export endpoints may be reused after the ZIP export UI is relocated.

## Worker Jobs

No worker job changes.

## Environment Variables

No environment variable changes.

## Implementation Workstreams

### Workstream 1: UX Inventory And Information Architecture

- Define the administrator's primary tasks for each tab.
- Inventory current actions, fields, statuses, and dialogs.
- Decide which actions stay visible, move into details, move into overflow, or move to another tab.
- Produce the final page structure for desktop and mobile before CSS work starts.

### Workstream 2: Admin Control System For Sofa Edit

- Normalize button variants: primary, secondary, quiet, danger, inline link, icon/overflow.
- Normalize fields, unit fields, validation, checkboxes, status indicators, action menus, dialogs, and sheets.
- Remove prototype-specific `admin-test-workflow` visual patterns from the production sofa edit page.

### Workstream 3: Basics And Fabrics

- Redesign Basics into focused field groups with designed dimension inputs and tag controls.
- Redesign Fabrics into an assigned-fabric workspace with compact rows, calm assignment, quiet ordering, and clear missing-state indicators.

### Workstream 4: Visual Matrix

- Redesign position rows and source-photo actions.
- Replace visible multi-button clusters with row open/detail behavior and secondary actions.
- Verify mobile spacing and action placement.

### Workstream 5: Renders Matrix

- Redesign the command bar, summary, desktop matrix, mobile fabric groups, cell content, and status key.
- Add richer cell information without increasing visual noise.
- Ensure fabric labels are compact and aligned.

### Workstream 6: Render Cell Detail And Candidate Review

- Replace the too-small desktop drawer if analysis shows the cell workflow needs more space.
- Redesign candidate review, current render preview, source comparison, refinement, generation, retry, and manual upload hierarchy.

### Workstream 7: Publish And Export Placement

- Keep Publish focused on publication readiness and lifecycle.
- Move ZIP render export into the render/export context.
- Keep signed URL and private asset behavior unchanged.

### Workstream 8: Responsive, Accessibility, And Visual QA

- Verify desktop, tablet, and mobile viewports.
- Verify keyboard access, focus return, dialog semantics, and non-color status meaning.
- Capture before/after screenshots for all tabs and key detail states.

## Testing Requirements

Implementation plans must add or update tests for:

- workflow navigation and readiness labels after visual changes;
- Basics form submission with dimension unit fields;
- checkbox/tag selection behavior;
- fabric assignment, ordering, and unassignment actions after layout changes;
- Visual Matrix row actions and source-photo drawer/sheet behavior;
- Renders global action visibility;
- render cell status content and opening behavior;
- candidate review and refinement action hierarchy;
- ZIP export relocation;
- Publish remaining publication-only;
- mobile grouped render layout where testable.

## Acceptance Criteria

- The sofa edit page no longer uses nested numbered panels as the main visual structure.
- Active workflow tabs are sober and do not rely on large black pill states.
- Each tab has one clear primary task and at most one filled primary button in the active context.
- Basics fields, dimension controls, tags, and checkboxes match the admin visual system.
- Fabrics avoids black button clusters and presents assigned fabrics as compact operational rows.
- Visual Matrix rows do not show three equal primary actions.
- Renders cells expose useful operational information beyond a status badge.
- Fabric identity in Renders is compact and does not waste row height on repeated full metadata.
- The Renders legend is quiet or progressive, not a permanent badge salad.
- Desktop render cell details provide enough space for the real workflow.
- Mobile render cell details use a full-screen or appropriately large sheet.
- ZIP export is no longer placed in Publish unless a later decision explicitly justifies it.
- Publish is limited to readiness, blockers, and publish or unpublish actions.
- The redesign preserves admin auth, API boundaries, storage privacy, and existing worker behavior.
- Browser verification covers all sofa edit tabs on desktop and mobile.

## Open Questions

- Should the final desktop render cell detail be a wide modal, a wide sheet, or a redesigned drawer?
- Should the workflow navigation include an explicit next recommended task, or should that live only in each tab summary?
- Should the export area become part of Renders immediately, or should a dedicated Assets/Exports tab be introduced only after more export workflows exist?
- Should fabric ordering remain numeric for this phase, or should the UI introduce a compact reorder control while keeping the same persisted order field?
