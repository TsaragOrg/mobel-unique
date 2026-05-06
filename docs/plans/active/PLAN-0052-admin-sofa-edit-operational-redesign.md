# PLAN-0052 Admin Sofa Edit Operational Redesign

Plan: PLAN-0052
Spec: SPEC-0014
Status: active
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Redesign `/admin/sofas/[sofa_id]` into a sober, ergonomic, professional admin workspace that satisfies `CR-SPEC-0014 Admin Sofa Edit Operational Redesign` while preserving existing admin behavior, API boundaries, storage privacy, and worker behavior.

## Scope

- Rework the sofa edit page information architecture and tab-level hierarchy.
- Replace prototype-style nested panels, numbered section badges, aggressive black button clusters, default checkboxes, and poorly fitted form controls.
- Redesign Basics, Fabrics, Visual Matrix, Renders, render cell detail, Publish, and ZIP export placement.
- Refresh the `/admin/sofas` list so catalog records are identifiable from
  available source imagery and remain organized on mobile.
- Keep the accepted `SPEC-0014` workflow tabs unless the change request is accepted with a different route.
- Add or update focused tests for behavior affected by markup and interaction changes.
- Run browser visual QA on desktop and mobile against the existing local site when available.

## Out Of Scope

- Worker behavior changes.
- New storage or database schema.
- Public customer page redesign.
- Admin auth changes.
- Shopify API integration.
- A reusable component library outside the admin page needs.

## Work Packages

## Audit Findings

Manual review covered desktop `1440x900` and mobile `375x812` on the local
admin sofa edit page. Screenshots were captured for Basics, Fabrics, Visual
Matrix, Renders, Publish, and one render cell detail state.

### Global Page Structure

- The production sofa edit page still depends on the `admin-test-workflow`
  visual layer, which creates a prototype feel.
- The page uses workflow tabs and then repeats numbered step headings inside
  each tab. The numbered badges imply a linear wizard even though `SPEC-0014`
  requires freely navigable tabs.
- Active tabs invert to a black pill and contain a readiness chip. This makes
  the navigation visually heavy and creates "badge inside button" noise.
- Most unclassified buttons inherit the global black button style. The result
  is too many equal primary actions.

### Basics

- Fields are shown as one undifferentiated form stack.
- Dimension inputs use native `type="number"` spinbuttons. These expose browser
  arrows and do not read as designed admin controls.
- Tags use default checkbox styling, which does not match the admin visual
  system.
- The form lacks clear grouping for identity, public content, dimensions, and
  tags.

### Fabrics

- Assign, Save order, Reset order, and every Unassign action compete visually.
- Assigned fabrics use large cards even when the task is ordering and checking
  readiness.
- Public order inputs are too wide and repeat long labels.
- Internal fabric names are shown in full in repeated rows, which increases
  height and reduces scan speed.

### Visual Matrix

- Each row exposes Edit, Replace source photo, and Delete as three equal visible
  actions.
- The row itself does not behave like the primary object to inspect or edit.
- On mobile, the action cluster dominates the row and makes spacing feel
  uncontrolled.

### Renders

- The tab starts with two global buttons even when both are disabled.
- There is no summary of how many cells are ready, missing, blocked, candidate,
  queued, or processing.
- Desktop matrix cells contain only a status chip, even when a current render,
  candidate count, job state, or blocker hint would help the admin decide what
  to do.
- Fabric identity takes too much row height because the full fabric card is
  repeated in every matrix row.
- The status legend is always visible and shows every status badge at once,
  creating visual noise after the matrix.
- Mobile uses grouped fabric cards, but repeats the same verbose fabric
  metadata before every group.

### Render Cell Detail

- Desktop uses a narrow right-side drawer while the cell detail contains image
  review, status, blockers, job details, manual upload, candidate review,
  refinement, and comparison flows.
- The drawer is not proportionate to the workflow. A wider workbench pattern is
  better suited for desktop.
- Mobile currently inherits too much of the drawer structure and needs a true
  full-screen sheet treatment.

### Publish And Export

- Publish correctly owns lifecycle and readiness.
- ZIP render export is misplaced in Publish because it operates on render
  assets, not public lifecycle. It should move into the Renders/export context.

## First Implementation Slice

The first implementation slice should reduce the biggest UX damage without
changing data or worker behavior:

- remove numbered tab section headings and the `admin-test-workflow` styling;
- replace workflow tab pills with a sober segmented/underline pattern;
- normalize sofa edit buttons so black is reserved for one primary action per
  context;
- redesign Basics form grouping, dimension unit inputs, and tag checkboxes;
- make Fabrics and Visual Matrix row actions quieter;
- add a Renders summary, richer render cells, compact fabric labels, and a
  progressive status key;
- move ZIP export from Publish to Renders;
- replace the desktop render cell drawer with a wider workbench sheet while
  keeping mobile full-screen.

The deeper candidate review redesign can follow after this slice if the
workbench structure proves correct in browser QA.

## Work Packages

### 1. UX Inventory And Target Structure

- [x] Inventory all current sofa edit fields, actions, statuses, dialogs, and mobile states.
- [x] Map the administrator's goal in each tab: Basics, Fabrics, Visual Matrix, Renders, Publish.
- [x] Decide visible actions, secondary actions, overflow actions, and detail-only actions.
- [x] Decide the desktop render cell detail pattern: wide modal, wide sheet, or redesigned drawer.
- [x] Decide the ZIP export destination: Renders export area or future Assets/Exports area.

### 2. Sofa Edit Control System

- [x] Introduce or normalize sofa edit button variants: primary, secondary, quiet, danger, inline, overflow.
- [x] Introduce designed field, unit-field, checkbox, status, compact action menu, dialog, and sheet patterns.
- [x] Remove `admin-test-workflow` visual dependency from the production sofa edit page.
- [x] Format admin-facing errors and blockers so technical codes are not shown as customer-visible UI copy.
- [ ] Add visual states for loading, disabled, failed, blocked, ready, current, and selected.

### 3. Basics

- [x] Restructure Basics into Identity, Public content, Dimensions, and Tags.
- [x] Replace dimension number inputs with unit-aware controls that do not depend on native spinner arrows.
- [x] Redesign tag and checkbox controls to match the admin visual system.
- [x] Keep `Save sofa` as the only primary action in Basics.
- [x] Update Basics tests for changed markup and controls.

### 4. Fabrics

- [ ] Replace the current assign/order/button-heavy area with a compact assigned-fabric workspace.
- [ ] Show fabric swatch, short public name, short internal reference, AI-reference state, premium state, and public order.
- [x] Move add-fabric into a calm add flow with one primary action.
- [x] Make ordering compact and clear without full-width inputs.
- [x] Make unassign destructive but visually secondary.
- [x] Update fabric assignment tests.

### 5. Visual Matrix

- [x] Redesign visual position rows with source-photo state and original fabric context.
- [x] Replace row button clusters with row-open/detail behavior plus secondary or overflow actions.
- [x] Align mobile Visual Matrix row actions into one compact action bar so Edit, source, and Delete stay visually ordered.
- [x] Improve source-photo drawer or sheet layout by opening Visual Matrix add, edit, and source-photo flows in the same centered workbench pattern as Renders, with the same top-right Close action instead of form-level Cancel buttons and desktop action buttons aligned with the input row.
- [x] Fix mobile spacing around add position and row actions.
- [x] Show newly selected source image and source fabric previews immediately in the View Columns edit workbench before the admin saves.
- [x] Update Visual Matrix tests.

### 6. Renders

- [x] Add a compact render coverage summary.
- [x] Reposition global generation and queue recovery actions based on state.
- [x] Redesign desktop matrix with compact fabric labels and richer cells.
- [x] Redesign mobile fabric groups without horizontal table reliance.
- [x] Replace the always-visible status badge salad with a quiet or progressive status key.
- [x] Update render matrix tests.

### 7. Render Cell Detail

- [x] Implement the chosen desktop detail pattern with enough workspace for real cell operations.
- [x] Preserve full-screen or large sheet behavior on mobile.
- [x] Show context, preview, blockers, job state, candidate count, and one primary next action.
- [x] Group secondary actions and keep refinement prompt hidden until chosen.
- [ ] Redesign candidate review around image comparison and current/candidate selection.
- [x] Update render cell and candidate tests.

### 8. Publish And Export

- [x] Keep Publish limited to lifecycle, readiness blockers, and publish/unpublish.
- [x] Move ZIP render export out of Publish.
- [x] Show export state, included render count, and download action in the chosen render/export context.
- [x] Update Publish and export tests.

### 9. Verification

- [x] Run the narrow web tests for admin sofa edit.
- [x] Run `pnpm --filter @mobel-unique/web typecheck`.
- [x] Run `pnpm spec:check`.
- [x] Browser-verify all tabs at desktop and mobile widths.
- [x] Capture final screenshots for Basics, Fabrics, Visual Matrix, Renders, render cell detail, and Publish.

## Implementation Notes

- Keep repo-authored UI copy in English until a localization spec says otherwise.
- Prefer existing admin data dependencies and route handlers.
- Do not expose private storage paths while moving export UI.
- Keep the page operational, dense, and restrained; avoid decorative card layouts.
- Keep cards at 8px radius or less and avoid cards inside cards.
- Checkpoint commit `6792164` captures the sofa edit UX refinement slice:
  workflow tab wording, View Columns rows and edit workbench, tag-row
  simplification, transparent action buttons, and no-upload source fabric
  reassignment in the UI.
- `PLAN-0059` owns the follow-up consistency hardening for source fabric
  reassignment so the checkpoint behavior is backed by a transaction-safe data
  mutation before merge.
- Follow-up fix: the View Columns edit workbench now keeps local preview state
  for an unsaved source image upload and for the selected source fabric line, so
  admins can confirm both choices before pressing Save.
- Follow-up fix: admin catalog pages now format API error codes, local validation
  codes, publication blockers, and render-cell blockers into plain English UI
  copy instead of exposing technical strings such as `TAG_CONFLICT`,
  `TAG_IN_USE`, or `INCOMPLETE_PUBLIC_RENDER_COVERAGE`.
- Follow-up fix: Basics tag assignment now uses a local search picker with
  pinned selected tag chips and remove actions instead of showing every tag as
  a persistent checkbox, keeping the form usable when the tag list grows.
- Follow-up fix: View Columns source-photo thumbnails now keep the visible
  row-level Edit action while replacing the image overlay text with a subtle
  square edit icon attached to the top-right image corner.
- Follow-up fix: Admin dashboard catalog cards and compact destructive actions
  now use quiet SVG icons while preserving accessible button and link names.
- Follow-up fix: Admin modal close actions now use compact close icons, and
  render candidate previous/next controls now use arrow icons while preserving
  accessible button names.
- Follow-up fix: Sofa edit render status chips now show only status text,
  removing the previous one-letter markers from render cells, the status key,
  and the render cell sheet.

## Acceptance Criteria

- `CR-SPEC-0014 Admin Sofa Edit Operational Redesign` has been satisfied or explicitly narrowed before implementation completion.
- The page no longer visually reads as nested prototype panels.
- Buttons, checkboxes, fields, statuses, dialogs, and sheets are coherent with the admin visual system.
- Mobile and desktop both support the real sofa edit workflow.
- Existing admin behavior remains intact.
- Focused tests, typecheck, spec guard, and browser visual QA pass.
