# SPEC-0014 Admin Sofa Edit UX Simplification

Spec: SPEC-0014
Status: accepted
Layer: feature
Parent Spec: SPEC-0013
Depends On: SPEC-0005, SPEC-0006, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013
Areas: web, api
Implementation Plans: none yet

## Goal

Simplify the protected sofa edit workflow so an administrator can understand
what is complete, what is missing, and what action to take next without reading
all render preparation controls at once.

The redesign keeps the existing admin behavior and worker boundaries. It
changes how the sofa edit UI is organized, how fabric identity is shown, and
how visual matrix and render actions are exposed.

## Scope

This spec covers:

- the sofa edit page layout for catalog preparation;
- workflow tabs for the main editing areas;
- a clearer Visual matrix section;
- a clearer Renders section for render coverage;
- mobile and desktop layout rules for matrix-heavy work;
- fabric display with swatch thumbnails and AI reference readiness;
- drawer, sheet, and dialog behavior for detailed actions;
- render cell status hierarchy;
- the explicit save model for forms and drawers;
- the minimum admin API response addition needed for swatch thumbnails.

## Out Of Scope

This spec does not include:

- changing fabric render worker behavior;
- changing render job creation rules;
- changing publication rules;
- changing private candidate selection rules;
- bulk regenerate actions;
- bulk candidate deletion;
- drag-and-drop ordering;
- exposing AI reference thumbnails across the render matrix;
- changing public customer pages;
- adding new provider settings.

## Existing Problem

The current sofa edit page exposes many unrelated controls at the same time:

- sofa metadata;
- fabric assignment;
- visual matrix column creation and editing;
- source photo upload;
- render status;
- prompt notes;
- generation;
- manual render upload;
- candidate review;
- candidate refinement;
- publication readiness.

This makes the page hard to use even for a developer. The administrator needs
to see the current state first, then open detailed controls only when a specific
action is needed.

## Core Design Decision

The sofa edit page must use workflow tabs, not a strict wizard.

The tabs are:

1. Basics
2. Fabrics
3. Visual matrix
4. Renders
5. Publish

The administrator may move freely between tabs. The UI must not force a linear
1-to-5 completion path, because sofa editing often requires jumping between
fabrics, visual matrix setup, renders, and publication checks.

Each tab should show a compact readiness signal, such as `Ready`, `Missing`, or
`Blocked`. These signals guide the administrator without preventing navigation.

## Header Behavior

The sofa edit header should show:

- sofa internal name;
- lifecycle status as a read-only badge, such as `Draft` or `Published`;
- a compact aggregate readiness summary.

The header must not expose publish or unpublish actions. Publication actions
belong only in the Publish tab.

The header readiness summary is an overview. The Publish tab owns the detailed
readiness blocker list and related actions.

## Tab Responsibilities

### Basics

The Basics tab owns core sofa fields only.

It may show:

- internal name;
- public name;
- Shopify order URL;
- public description;
- dimensions;
- tags.

It must not show render generation actions.

### Fabrics

The Fabrics tab owns fabric assignment and public fabric ordering for this sofa.

Assigned fabrics must be displayed as fabric cards, not plain text. A fabric
card should show:

- swatch thumbnail when available;
- public fabric name;
- internal fabric name;
- `AI ref: Ready` or `AI ref: Missing`;
- premium marker when relevant;
- public order input.

The first implementation should keep numeric public order inputs with an
explicit save action. Drag-and-drop ordering is intentionally deferred.

### Visual Matrix

The visible section name remains `Visual matrix`.

This tab owns configuration:

- which visual matrix columns exist;
- their sequence;
- their admin and public labels;
- which current source photo belongs to each column;
- which original fabric is represented by each source photo.

This tab does not own generated render candidates or final render selection.
Those belong in Renders.

The Visual matrix tab should show columns as a readable list. Each row should
show:

- sequence;
- admin label;
- public label;
- source photo status;
- original fabric as a fabric card when known;
- compact actions.

Detailed actions should open drawers or dialogs:

- Add column;
- Edit column;
- Add source photo;
- Replace source photo;
- Delete column.

Deleting a visual matrix column must require confirmation. The confirmation
must say that deleting the column affects all fabrics for the sofa.

### Renders

The Renders tab owns render coverage.

It shows the actual output state for each assigned fabric and visual matrix
column pair. This is different from Visual matrix:

- Visual matrix configures what visual positions exist.
- Renders shows whether each fabric has a usable image for each position.

Renders should provide cross-links to Visual matrix when the next fix belongs
there. For example, a cell blocked by missing source photo should offer a
`Go to Visual matrix` action.

On desktop, Renders may use a matrix table:

```text
Fabric                  Front       Side        Detail
[swatch] Boucle ivoire  Ready       Missing     Candidate
[swatch] Velvet green   Generate    Ready       Missing
```

On mobile, Renders must not rely on horizontal table scrolling as the primary
experience. It should use fabric groups:

```text
Boucle ivoire
  Front    Ready
  Side     Missing
  Detail   Candidate

Velvet green
  Front    Generate
  Side     Ready
  Detail   Missing
```

Each fabric group must preserve both dimensions of the matrix: fabric and visual
matrix column.

### Publish

The Publish tab owns publication readiness and publish or unpublish actions.

It should show:

- current lifecycle state;
- detailed readiness blockers;
- publish action when eligible;
- unpublish action when published;
- links to the tab where each blocker can be fixed when possible.

The Publish tab must not duplicate render generation controls.

## Fabric Display

Wherever a user makes a render or assignment decision, fabric must be shown as a
fabric card rather than plain text.

Use fabric cards in:

- fabric list rows where practical;
- fabric assignment rows;
- Visual matrix source photo selection;
- Renders mobile fabric groups;
- Renders desktop first column;
- render cell sheet header.

The fabric card should prefer:

```text
[swatch] Public fabric name
         Internal: internal fabric name
         AI ref: Ready
```

If swatch preview is not available, show a stable fallback such as
`No swatch`.

If AI reference is missing, show `AI ref: Missing`. Missing AI reference should
also appear as a render blocker where it prevents generation.

## Swatch Preview API

The admin API should add a safe swatch preview field to fabric responses:

```text
swatch_preview_url: string | null
```

Rules:

- the API must not expose storage `object_path`;
- the API must not expose private storage paths;
- the field may point to the public swatch object through a safe public URL or
  admin-safe URL helper;
- the field belongs to fabric responses and assigned fabric records where
  fabric data is embedded;
- the UI must handle `null` by showing `No swatch`.

AI reference preview URLs are not part of this redesign. The UI should show AI
reference readiness as text. A later fabric detail improvement may expose an
admin-authorized AI reference preview if needed.

## Render Cell Statuses

Render cells should use clear text, icon, and color. The UI must not rely on
color alone.

Required display statuses:

- Ready;
- Missing;
- Candidate;
- Blocked;
- Queued;
- Processing;
- Failed.

The Renders tab should include a small legend that explains these statuses.

Status meaning:

- Ready: a current private or public render exists for the cell.
- Missing: no current render exists and generation may be possible.
- Candidate: generated candidates exist but none is selected as current.
- Blocked: the cell needs another setup step before normal generation.
- Queued: a render job is waiting.
- Processing: a render job is running.
- Failed: the latest render job failed.

## Render Cell Sheet

Opening a render cell should show a detailed sheet.

Desktop behavior:

- use a right-side drawer.

Mobile behavior:

- use a full-screen sheet or bottom sheet;
- do not use a narrow side drawer;
- keep the cell context visible at the top of the sheet;
- keep action buttons reachable without covering fields or confirmations.

The sheet should show:

- fabric card;
- visual matrix column label;
- current status;
- blocker list when blocked;
- latest job status;
- candidate count;
- primary action;
- secondary actions.

The primary action depends on cell status:

- Blocked: show the blocker and the best fix link.
- Missing with generation allowed: Generate.
- Candidate: Review candidates.
- Ready: view current state and keep replacement actions secondary.
- Queued or Processing: show job progress state.
- Failed: show error details and recovery action only when supported.

Secondary actions may include:

- manual render upload;
- generate another candidate;
- Review candidates;
- refine selected candidate;
- use candidate.

The sheet must not show every possible action with equal visual weight.

## Candidate Review

Keep the action label `Review candidates`.

Candidate review should appear inside the render cell sheet, not as a permanent
expanded area inside the matrix cell.

A candidate row should show:

- preview image;
- generation mode;
- prompt version;
- current or candidate label;
- `Use candidate`;
- `Refine` with a prompt field when selected.

Generated candidates remain private until the administrator explicitly uses one
as current. Worker success must not automatically select a candidate.

## Save Model

The sofa edit page must not use implicit autosave for the redesigned flows.

Rules:

- Basics saves with `Save sofa`.
- Fabric assignment saves through explicit assign and save order actions.
- Visual matrix create and edit drawers save with explicit buttons.
- Source photo upload saves only when the admin starts upload.
- Render cell actions run only after explicit button clicks.
- Cancel in a drawer or sheet discards local unsaved edits in that drawer.
- The UI should avoid nested drawers; candidate review should remain within the
  render cell sheet.

If a future implementation adds autosave, it requires a separate accepted spec
or change request because it changes failure and discard behavior.

## Mobile And Desktop Rules

The admin UI is mobile-capable rather than desktop-only.

Mobile rules:

- one active workflow tab is visible at a time;
- Visual matrix uses a list;
- Renders uses fabric groups with column rows;
- detailed actions use full-screen or bottom sheets;
- destructive warnings remain visible;
- touch targets must remain comfortable;
- sticky controls must not cover input fields.

Desktop rules:

- the same workflow tabs are used;
- Visual matrix may use wider rows;
- Renders may use a matrix table;
- detailed actions use a right-side drawer;
- the desktop matrix is an enhanced overview, not a separate workflow.

## Error And Empty States

The redesigned UI must keep safe states for:

- no assigned fabrics;
- no visual matrix columns;
- missing source photo;
- missing fabric swatch;
- missing fabric AI reference;
- active queued or processing job;
- failed job;
- no candidates;
- expired or unavailable candidate preview;
- failed upload;
- failed candidate selection;
- blocked publication.

Errors must be shown near the affected tab, sheet, or action.

## Accessibility Requirements

The redesign must preserve:

- keyboard access to tabs, drawers, dialogs, and actions;
- visible focus states;
- text labels for statuses;
- non-color status indicators;
- accessible names for icon-only or compact controls;
- focus return to the trigger after closing dialogs or sheets.

## Testing Requirements

Implementation plans should add or update tests for:

- workflow tab navigation;
- tab readiness summaries;
- fabric card display with swatch preview and fallback;
- swatch preview URL shaping without exposing storage object paths;
- Visual matrix list and drawer actions;
- mobile Renders grouped by fabric;
- desktop Renders matrix cell opening behavior;
- render cell sheet primary action selection by status;
- candidate review staying inside the render cell sheet;
- explicit save and cancel behavior;
- publication actions remaining only in Publish.

## Roadmap Impact

The implementation roadmap should update:

- `docs/roadmap/web.md` for the sofa edit UX redesign;
- `docs/roadmap/api.md` if swatch preview response shaping changes;
- relevant active plan records during implementation.

## Acceptance Criteria

- The sofa edit page uses freely navigable workflow tabs, not a forced wizard.
- `Visual matrix` remains the visible name for the configuration tab.
- Visual matrix and Renders have distinct purposes and cross-link when a fix
  belongs in the other tab.
- Fabrics are shown with swatch thumbnails where render or assignment decisions
  are made.
- AI reference readiness is visible without exposing AI reference thumbnails in
  matrix-heavy views.
- The admin API can provide `swatch_preview_url` without exposing storage object
  paths.
- Mobile Renders preserves both fabric and visual matrix column context without
  relying on horizontal scrolling as the primary interaction.
- Desktop Renders can use a matrix table with a right-side render cell drawer.
- Mobile render cell details use a full-screen or bottom sheet pattern.
- Render cell actions are prioritized by current status.
- `Review candidates` remains the visible label.
- Publish and unpublish actions live only in the Publish tab.
- The redesign does not change worker behavior, publication rules, or automatic
  candidate selection boundaries.
