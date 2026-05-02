# Admin Sofa Edit UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the protected sofa edit page around SPEC-0014 workflow tabs, fabric cards, render coverage decisions, and safe swatch previews while keeping existing worker and publication behavior unchanged.

**Architecture:** Keep the existing first-party admin API and sofa edit actions, but move the page from one long testing workflow into a tabbed workflow matching the local `design admin ui/` reference. Add a small pure helper module for readiness and render-cell status rules, add `swatch_preview_url` at the admin response boundary, and keep all detailed render actions inside a responsive cell drawer or sheet.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase admin facade, Testing Library, Vitest, global CSS in `apps/web/src/app/globals.css`, `pnpm`.

---

Plan: PLAN-0035
Spec: SPEC-0014
Related Specs:

- SPEC-0005
- SPEC-0006
- SPEC-0009
- SPEC-0010
- SPEC-0011
- SPEC-0013

Status: done
Owner area: web
Depends on:

- PLAN-0017
- PLAN-0018
- PLAN-0019
- PLAN-0021
- PLAN-0023
- PLAN-0028
- PLAN-0029
- PLAN-0030
- PLAN-0031

Affected packages:

- `apps/web`
- `docs/roadmap`
- `docs/specs/manifest.json`

## Design Reference

Use the local folder `design admin ui/` as the visual and interaction reference for this plan.

Reference files:

- `design admin ui/Sofa Edit.html`
  - Shows the complete artboard set: desktop tabs, render cell drawer, blocked drawer, Visual matrix, Fabrics, Basics, Publish, mobile tabs, mobile render groups, and mobile bottom sheet.
- `design admin ui/app.jsx`
  - Defines the shell: top bar, compact sofa header, tab list, desktop app, mobile app, and toast behavior.
- `design admin ui/tabs.jsx`
  - Defines tab content for Basics, Fabrics, Visual matrix, Renders, Publish, plus mobile-specific screens.
- `design admin ui/drawers.jsx`
  - Defines render cell primary action selection, candidate review inside the cell sheet, desktop drawer, mobile sheet, and Visual matrix column drawer.
- `design admin ui/atoms.jsx`
  - Defines the expected building blocks: fabric card, swatch, status chip, readiness dot, compact icon buttons.
- `design admin ui/styles.css`
  - Defines the quiet admin visual style: neutral panels, 6px to 8px radii, compact rows, status chips with glyphs, responsive matrix/table behavior, desktop right drawer, mobile bottom sheet.
- `design admin ui/data.js`
  - Defines representative states for all required render statuses: Ready, Missing, Candidate, Blocked, Queued, Processing, Failed.

Production implementation rules:

- Do not import `design-canvas.jsx`, `tweaks-panel.jsx`, or the mock files into `apps/web`.
- Use the design folder as a reference for layout, spacing, states, and responsive behavior.
- Keep repository UI copy in English.
- Keep existing admin behavior unless SPEC-0014 explicitly changes presentation or save timing.

## Current Gap

The current sofa edit page already has most actions required by SPEC-0014, but it exposes them all at once:

- `SofaEditContent` renders basics, fabric assignment, Visual matrix, render coverage, and publication in one long page.
- `SofaFabricAssignmentSection` saves public order on input blur, which conflicts with the explicit save model.
- `VisualMatrixSection` keeps create, edit, source photo upload, and delete controls inline.
- `RenderCoverageSection` puts generation, manual upload, candidate review, and refine controls inside every matrix cell.
- Candidate review is expanded inside the table cell instead of inside a cell sheet.
- Fabric identity is mostly plain text; render and assignment decisions need reusable fabric cards with swatch thumbnails.
- Admin fabric responses expose safe asset metadata but do not expose the `swatch_preview_url` field required by SPEC-0014.

## File Structure

- Modify: `apps/web/src/lib/admin-catalog.ts`
  - Adds safe `swatch_preview_url` shaping for admin fabric responses and embedded sofa fabric records.
  - Keeps `object_path` and private storage paths out of responses.
- Modify: `apps/web/src/lib/admin-catalog.test.ts`
  - Adds safe swatch preview response coverage.
- Modify: `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Adds route-level coverage that list/get/assignment responses include safe swatch preview URLs and still omit storage object paths.
- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Keeps the existing page exports and admin dependency facade.
  - Replaces the long sofa edit workflow with workflow tabs.
  - Adds fabric cards, status chips, render cell drawer/sheet, Visual matrix drawers/dialogs, explicit save controls, and Publish-only publication actions.
  - Updates all required RU/FR `.tsx` comments as behavior changes.
- Create: `apps/web/src/app/admin/admin-sofa-edit-model.ts`
  - Holds pure helper rules for tab readiness, render cell display status, primary cell actions, and publication blocker links.
- Create: `apps/web/src/app/admin/admin-sofa-edit-model.test.ts`
  - Tests helper rules without needing the browser UI.
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Updates sofa edit UI coverage to match SPEC-0014.
- Modify: `apps/web/src/app/globals.css`
  - Adds the admin sofa edit layout, tabs, fabric card, status chip, render matrix, mobile fabric groups, drawer, sheet, and dialog styles.
- Modify: `docs/roadmap/web.md`
  - Tracks active and done web work for PLAN-0035.
- Modify: `docs/roadmap/api.md`
  - Tracks active and done admin API response shaping for PLAN-0035.
- Modify: `docs/plans/active/README.md`
  - Lists PLAN-0035 while active.
- Move when complete: `docs/plans/active/PLAN-0035-admin-sofa-edit-ux-simplification.md` to `docs/plans/done/PLAN-0035-admin-sofa-edit-ux-simplification.md`.

## Tasks

### Task 1: Admin Safe Swatch Preview URL

**Files:**

- Modify: `apps/web/src/lib/admin-catalog.ts`
- Modify: `apps/web/src/lib/admin-catalog.test.ts`
- Modify: `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`

- [ ] **Step 1: Add failing safe response tests**

Add or update the fabric response test in `apps/web/src/lib/admin-catalog.test.ts` so a public swatch asset produces a safe URL:

```ts
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";

try {
  const response = shapeFabricResponse(fabricRecord);

  expect(response).toMatchObject({
    swatch_preview_url:
      "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
  });
  expect(JSON.stringify(response)).not.toContain("object_path");
  expect(JSON.stringify(response)).not.toContain("catalog-private-assets");
} finally {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
}
```

Add a second case where `swatch_asset` is `null` and assert:

```ts
expect(shapeFabricResponse({ ...fabricRecord, swatch_asset: null })).toMatchObject({
  swatch_preview_url: null,
});
```

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
```

Expected before implementation: FAIL because `swatch_preview_url` is missing.

- [ ] **Step 2: Implement safe URL shaping**

In `apps/web/src/lib/admin-catalog.ts`, add a local helper near the response shaping helpers:

```ts
function buildAdminPublicAssetUrl(asset: JsonObject | null) {
  if (
    !asset ||
    asset.bucket_id !== "catalog-public-assets" ||
    asset.visibility !== "public" ||
    typeof asset.object_path !== "string"
  ) {
    return null;
  }

  const publicAssetBaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;

  if (!publicAssetBaseUrl) {
    return null;
  }

  const baseUrl = publicAssetBaseUrl.replace(/\/+$/, "");
  const encodedPath = asset.object_path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${baseUrl}/storage/v1/object/public/catalog-public-assets/${encodedPath}`;
}
```

Update `shapeFabricResponse` to include:

```ts
swatch_preview_url: buildAdminPublicAssetUrl(swatchAsset),
```

Keep `shapeStorageAssetResponse` unchanged so raw storage paths stay hidden.

- [ ] **Step 3: Add route-level coverage**

In `apps/web/src/lib/admin-catalog-route-handlers.test.ts`, extend the list fabric and sofa fabric assignment assertions:

```ts
expect(body.data.fabrics[0]).toMatchObject({
  swatch_preview_url:
    "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
});
expect(JSON.stringify(body)).not.toContain("object_path");
```

For sofa assignments:

```ts
expect(body.data.sofa_fabrics[0].fabric).toMatchObject({
  swatch_preview_url:
    "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
});
```

Set and restore `process.env.NEXT_PUBLIC_SUPABASE_URL` in the test file so the URL is deterministic.

- [ ] **Step 4: Update admin UI types and fixtures**

In `apps/web/src/app/admin/AdminCatalogPages.tsx`, add the new field:

```ts
swatch_preview_url: string | null;
```

to `AdminCatalogFabric`.

Update all fabric fixtures in `apps/web/src/app/admin/AdminCatalogPages.test.tsx` so they include either:

```ts
swatch_preview_url:
  "https://supabase.example/storage/v1/object/public/catalog-public-assets/fabrics/fabric-id/swatches/swatch.png",
```

or:

```ts
swatch_preview_url: null,
```

- [ ] **Step 5: Verify API tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts
```

Expected after implementation: PASS.

### Task 2: Sofa Edit Pure Status Model

**Files:**

- Create: `apps/web/src/app/admin/admin-sofa-edit-model.ts`
- Create: `apps/web/src/app/admin/admin-sofa-edit-model.test.ts`

- [ ] **Step 1: Add failing helper tests**

Create `apps/web/src/app/admin/admin-sofa-edit-model.test.ts` with tests for render cell status priority:

```ts
import {
  buildSofaEditTabReadiness,
  getRenderCellDisplayStatus,
  getRenderCellPrimaryAction,
} from "./admin-sofa-edit-model";

describe("admin sofa edit model", () => {
  it("maps render cells to SPEC-0014 display statuses", () => {
    expect(
      getRenderCellDisplayStatus({
        blockers: ["SOURCE_PHOTO_MISSING"],
        candidate_count: 0,
        has_private_render: false,
        has_public_render: false,
        latest_job: null,
      }),
    ).toBe("blocked");

    expect(
      getRenderCellDisplayStatus({
        blockers: [],
        candidate_count: 0,
        has_private_render: false,
        has_public_render: false,
        latest_job: { status: "queued" },
      }),
    ).toBe("queued");

    expect(
      getRenderCellDisplayStatus({
        blockers: [],
        candidate_count: 2,
        has_private_render: false,
        has_public_render: false,
        latest_job: null,
      }),
    ).toBe("candidate");

    expect(
      getRenderCellDisplayStatus({
        blockers: [],
        candidate_count: 0,
        has_private_render: true,
        has_public_render: false,
        latest_job: { status: "failed" },
      }),
    ).toBe("ready");
  });
});
```

Add primary action expectations:

```ts
expect(getRenderCellPrimaryAction("blocked")).toMatchObject({
  label: "Go to Visual matrix",
  targetTab: "visual_matrix",
});
expect(getRenderCellPrimaryAction("missing")).toMatchObject({
  label: "Generate",
});
expect(getRenderCellPrimaryAction("candidate")).toMatchObject({
  label: "Review candidates",
});
```

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/admin-sofa-edit-model.test.ts
```

Expected before implementation: FAIL because the helper file does not exist.

- [ ] **Step 2: Implement the helper module**

Create `apps/web/src/app/admin/admin-sofa-edit-model.ts` with:

```ts
export type SofaEditTabKey =
  | "basics"
  | "fabrics"
  | "visual_matrix"
  | "renders"
  | "publish";

export type SofaEditReadinessKind =
  | "ready"
  | "missing"
  | "partial"
  | "blocked";

export type RenderCellDisplayStatus =
  | "ready"
  | "missing"
  | "candidate"
  | "blocked"
  | "queued"
  | "processing"
  | "failed";

export function getRenderCellDisplayStatus(cell: {
  blockers: string[];
  candidate_count: number;
  has_private_render: boolean;
  has_public_render: boolean;
  latest_job: { status?: string | null } | null;
}): RenderCellDisplayStatus {
  if (cell.blockers.length > 0) {
    return "blocked";
  }

  if (cell.latest_job?.status === "queued") {
    return "queued";
  }

  if (cell.latest_job?.status === "processing") {
    return "processing";
  }

  if (cell.has_public_render || cell.has_private_render) {
    return "ready";
  }

  if (cell.candidate_count > 0) {
    return "candidate";
  }

  if (cell.latest_job?.status === "failed") {
    return "failed";
  }

  return "missing";
}
```

Add `getRenderCellPrimaryAction(status)` with these labels:

- `blocked`: `Go to Visual matrix`
- `missing`: `Generate`
- `candidate`: `Review candidates`
- `ready`: `View current render`
- `queued`: `View job`
- `processing`: `View job progress`
- `failed`: `Retry generation`

Add `buildSofaEditTabReadiness(input)` with these rules:

- Basics is `ready` when the sofa has `internal_name`; otherwise `missing`.
- Fabrics is `missing` when no fabrics are assigned, `blocked` when any assigned fabric lacks AI reference, otherwise `ready`.
- Visual matrix is `missing` when no columns exist, `partial` when at least one column lacks a source photo, otherwise `ready`.
- Renders is `missing` when coverage cannot be shown, `blocked` when any cell is blocked, `partial` when any cell is not ready, otherwise `ready`.
- Publish is `ready` when publication readiness is ready, otherwise `blocked`.

- [ ] **Step 3: Verify helper tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/admin-sofa-edit-model.test.ts
```

Expected after implementation: PASS.

### Task 3: Workflow Tab Shell And Header

**Files:**

- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add failing tab navigation tests**

In `apps/web/src/app/admin/AdminCatalogPages.test.tsx`, add a test that renders `AdminSofaEditPage` and asserts:

```ts
expect(screen.getByRole("tab", { name: /Basics/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /Fabrics/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /Visual matrix/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /Renders/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /Publish/i })).toBeInTheDocument();
expect(screen.queryByRole("button", { name: "Publish sofa" })).not.toBeInTheDocument();

fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));

expect(screen.getByRole("button", { name: "Publish sofa" })).toBeInTheDocument();
```

Add another assertion that the old section navigation is gone:

```ts
expect(screen.queryByRole("navigation", { name: "Sofa test sections" })).not.toBeInTheDocument();
```

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
```

Expected before implementation: FAIL because the edit page still uses long section navigation.

- [ ] **Step 2: Add tab selection data**

In `SofaEditContent`, add a `useState` value for the active tab. Add the required RU/FR comment immediately before it and avoid the forbidden words listed in the repository instructions.

Use this key list:

```ts
const SOFA_EDIT_TABS = [
  { key: "basics", label: "Basics" },
  { key: "fabrics", label: "Fabrics" },
  { key: "visual_matrix", label: "Visual matrix" },
  { key: "renders", label: "Renders" },
  { key: "publish", label: "Publish" },
] as const;
```

Default active tab: `basics`.

- [ ] **Step 3: Replace the long workflow wrapper**

Remove `SofaTestNavigation` from the sofa edit page and stop rendering all five sections at once.

Render:

- compact header with internal name, lifecycle badge, public name, sofa id, and aggregate readiness;
- tab list with `role="tablist"`;
- one tab panel at a time with `role="tabpanel"`;
- no publish or unpublish action in the header.

Keep the existing section components, but mount them only inside their tab.

- [ ] **Step 4: Add tab shell styles**

In `apps/web/src/app/globals.css`, add classes for:

- `.admin-sofa-edit-header`
- `.admin-sofa-edit-readiness`
- `.admin-sofa-edit-tabs`
- `.admin-sofa-edit-tab`
- `.admin-sofa-edit-panel`
- `.admin-readiness-chip`

Use the design reference styling:

- neutral panel background;
- 6px to 8px border radius;
- compact row heights;
- visible focus ring;
- no nested page cards.

- [ ] **Step 5: Verify tab tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
```

Expected after implementation: PASS for the new tab shell tests.

### Task 4: Fabric Cards And Explicit Fabric Order Save

**Files:**

- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add failing fabric card and save model tests**

Add a test that opens the Fabrics tab and checks:

```ts
fireEvent.click(screen.getByRole("tab", { name: /Fabrics/i }));

expect(screen.getByText("Boucle ivoire")).toBeInTheDocument();
expect(screen.getByText("Internal: Internal fabric")).toBeInTheDocument();
expect(screen.getByText("AI ref: Ready")).toBeInTheDocument();
expect(screen.getByRole("img", { name: "Swatch for Boucle ivoire" })).toBeInTheDocument();
```

Add a fallback case with `swatch_preview_url: null`:

```ts
expect(screen.getByText("No swatch")).toBeInTheDocument();
```

Add an explicit save assertion:

```ts
fireEvent.change(screen.getByLabelText("Public order for Boucle ivoire"), {
  target: { value: "7" },
});

expect(dependencies.updateSofaFabric).not.toHaveBeenCalled();

fireEvent.click(screen.getByRole("button", { name: "Save order" }));

await waitFor(() => {
  expect(dependencies.updateSofaFabric).toHaveBeenCalledWith(
    "admin-token",
    sofaId,
    fabric.id,
    { public_order: 7 },
  );
});
```

Expected before implementation: FAIL because the current UI saves on blur and does not render the full fabric card.

- [ ] **Step 2: Add reusable fabric card UI**

In `AdminCatalogPages.tsx`, add an `AdminFabricCard` helper near other sofa edit UI helpers.

It must show:

- image swatch when `swatch_preview_url` is present;
- `No swatch` fallback when missing;
- public fabric name;
- internal fabric name;
- `AI ref: Ready` or `AI ref: Missing`;
- premium marker when `is_premium` is true.

Add RU/FR comments before the large interface section that lists fabrics.

- [ ] **Step 3: Change fabric order to explicit save**

Replace the current `onBlur` order update with editable local order values and a `Save order` button.

Use this behavior:

- typing in a public order input changes only local values;
- `Save order` calls `updateSofaFabric` for changed assignments;
- `Reset order` restores local values from the latest `sofaFabrics`;
- assigning a new fabric remains an explicit `Assign fabric` submit;
- removing a fabric remains an explicit button click.

Add the required RU/FR comments before new data values and action functions.

- [ ] **Step 4: Add fabric card styles**

In `globals.css`, add:

- `.admin-fabric-card`
- `.admin-fabric-swatch`
- `.admin-fabric-swatch-empty`
- `.admin-fabric-name`
- `.admin-fabric-meta`
- `.admin-fabric-premium`
- `.admin-fabric-order-row`

Use stable dimensions for swatches and rows so text and thumbnails do not shift layout.

- [ ] **Step 5: Verify fabric tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
```

Expected after implementation: PASS for fabric card and explicit save tests.

### Task 5: Visual Matrix List, Drawers, Source Upload, And Delete Confirmation

**Files:**

- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add failing Visual matrix UI tests**

Add tests that open the Visual matrix tab and assert:

```ts
fireEvent.click(screen.getByRole("tab", { name: /Visual matrix/i }));

expect(screen.getByText("Visual matrix columns")).toBeInTheDocument();
expect(screen.getByText("Configures positions. Renders shows coverage.")).toBeInTheDocument();
expect(screen.getByText("Source ready")).toBeInTheDocument();
expect(screen.getByText("Original fabric")).toBeInTheDocument();
```

Add drawer behavior:

```ts
fireEvent.click(screen.getByRole("button", { name: "Add column" }));
expect(screen.getByRole("dialog", { name: "Add column" })).toBeInTheDocument();

fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
expect(screen.queryByRole("dialog", { name: "Add column" })).not.toBeInTheDocument();
```

Add delete confirmation:

```ts
fireEvent.click(screen.getByRole("button", { name: /Delete column 1/i }));
expect(
  screen.getByText("Deleting this column affects all fabrics for this sofa."),
).toBeInTheDocument();
```

Expected before implementation: FAIL because controls are inline and deletion has no visible confirmation copy.

- [ ] **Step 2: Add Visual matrix drawer data**

In `VisualMatrixSection`, add local values for:

- active column drawer mode: `add`, `edit`, or `source_photo`;
- active column id;
- pending delete column id.

Add required RU/FR comments before these data values.

- [ ] **Step 3: Move create and edit forms into a drawer/dialog**

Keep the existing `createVisualMatrixColumn` and `updateVisualMatrixColumn` calls.

Change the UI so:

- `Add column` opens a drawer/dialog with sequence, admin label, and public label fields;
- `Edit` opens the same drawer/dialog with existing values;
- `Cancel` closes the drawer/dialog and discards local edits;
- save buttons are explicit: `Add column` and `Save column`.

- [ ] **Step 4: Move source photo upload into a drawer/dialog**

Keep `handleSourcePhotoUpload`, but open it from `Add source photo` or `Replace source photo`.

The drawer/dialog must show:

- selected visual matrix column;
- original fabric selector using fabric cards in the surrounding UI;
- source photo file field;
- explicit upload button.

- [ ] **Step 5: Add delete confirmation dialog**

Replace direct delete with a confirmation dialog using `role="alertdialog"`.

The dialog must include this exact warning:

```text
Deleting this column affects all fabrics for this sofa.
```

Only call `deleteVisualMatrixColumn` after the admin clicks the confirming button.

- [ ] **Step 6: Add Visual matrix styles**

In `globals.css`, add classes for:

- `.admin-visual-matrix-list`
- `.admin-visual-matrix-row`
- `.admin-drawer`
- `.admin-dialog-scrim`
- `.admin-alert-dialog`

Desktop behavior: right-side drawer for detailed actions.

Mobile behavior: full-screen or bottom sheet style, with action buttons reachable and not covering fields.

- [ ] **Step 7: Verify Visual matrix tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
```

Expected after implementation: PASS for Visual matrix list, drawer, and delete confirmation tests.

### Task 6: Render Coverage Matrix, Mobile Groups, And Cell Sheet

**Files:**

- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add failing Renders tab tests**

Add a test that opens Renders and asserts:

```ts
fireEvent.click(screen.getByRole("tab", { name: /Renders/i }));

expect(screen.getByText("Render coverage")).toBeInTheDocument();
expect(screen.getByText("Legend")).toBeInTheDocument();
expect(screen.getByText("Ready")).toBeInTheDocument();
expect(screen.getByText("Missing")).toBeInTheDocument();
expect(screen.getByText("Candidate")).toBeInTheDocument();
expect(screen.getByText("Blocked")).toBeInTheDocument();
expect(screen.getByText("Queued")).toBeInTheDocument();
expect(screen.getByText("Processing")).toBeInTheDocument();
expect(screen.getByText("Failed")).toBeInTheDocument();
```

Add a cell opening assertion:

```ts
fireEvent.click(
  screen.getByRole("button", {
    name: /Boucle ivoire, Front: Missing/i,
  }),
);

expect(screen.getByRole("dialog", { name: /Render cell/i })).toBeInTheDocument();
expect(screen.getByText("Boucle ivoire")).toBeInTheDocument();
expect(screen.getByText("Front")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
```

Expected before implementation: FAIL because cells expose all actions inline instead of opening a sheet.

- [ ] **Step 2: Add render status chip UI**

Use `getRenderCellDisplayStatus` from `admin-sofa-edit-model.ts`.

Render cells must use text and a non-color marker:

- Ready
- Missing
- Candidate
- Blocked
- Queued
- Processing
- Failed

Add a compact legend under the matrix.

- [ ] **Step 3: Convert desktop cells into openable buttons**

Replace full cell action stacks with compact cell buttons.

Each cell button accessible name must include:

```text
<public fabric name>, <visual matrix public label>: <status label>
```

When clicked, save the active cell id and open the cell drawer/sheet.

- [ ] **Step 4: Add mobile fabric groups**

Add a mobile Renders structure that groups by fabric and lists each visual matrix column row below the fabric card.

Each group must preserve:

- fabric context;
- visual matrix column context;
- status chip;
- button to open the same cell sheet.

Use CSS media queries to show the desktop matrix on wider screens and fabric groups on small screens.

- [ ] **Step 5: Move render actions into the cell sheet**

Inside the cell drawer/sheet, show:

- fabric card;
- visual matrix column label;
- current status;
- blocker list;
- latest job status;
- candidate count;
- primary action from `getRenderCellPrimaryAction`;
- secondary actions.

Reuse existing action functions:

- `handleGenerate`
- `handleRetryJob`
- `handleReviewCandidates`
- `handleUseCandidate`
- `handleRefineCandidate`
- `handleManualRenderUpload`

Change where they are shown, not what backend call they make.

- [ ] **Step 6: Keep candidate review inside the sheet**

Add a test that opens a Candidate cell, clicks `Review candidates`, and asserts candidates are inside the dialog:

```ts
const dialog = screen.getByRole("dialog", { name: /Render cell/i });

fireEvent.click(within(dialog).getByRole("button", { name: "Review candidates" }));

expect(await within(dialog).findByRole("button", { name: "Use candidate" })).toBeInTheDocument();
expect(within(dialog).getByLabelText("Refine prompt")).toBeInTheDocument();
```

The permanent matrix cell must not contain candidate rows.

- [ ] **Step 7: Add cross-link for blocked cells**

For blocked source-photo cells, the primary action must switch the active tab to Visual matrix and close the sheet.

Add this test:

```ts
fireEvent.click(screen.getByRole("button", { name: /Linen Clay, Arm detail: Blocked/i }));
fireEvent.click(screen.getByRole("button", { name: "Go to Visual matrix" }));

expect(screen.getByRole("tabpanel", { name: /Visual matrix/i })).toBeInTheDocument();
```

- [ ] **Step 8: Add drawer and sheet styles**

In `globals.css`, add:

- `.admin-render-matrix`
- `.admin-render-cell-button`
- `.admin-render-mobile-groups`
- `.admin-render-fabric-group`
- `.admin-render-cell-sheet`
- `.admin-render-cell-sheet-body`
- `.admin-render-cell-sheet-footer`
- `.admin-status-chip`
- `.admin-status-legend`

Desktop: right-side drawer.

Mobile: full-screen or bottom sheet, with no narrow side drawer.

- [ ] **Step 9: Verify Renders tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
```

Expected after implementation: PASS for render matrix, mobile group markup, cell sheet, primary actions, and candidate review tests.

### Task 7: Publish Tab Ownership

**Files:**

- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
- Modify: `apps/web/src/app/admin/admin-sofa-edit-model.ts`
- Modify: `apps/web/src/app/admin/admin-sofa-edit-model.test.ts`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add failing Publish ownership tests**

Update the existing publish/unpublish test so:

```ts
expect(screen.queryByRole("button", { name: "Publish sofa" })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: "Unpublish sofa" })).not.toBeInTheDocument();

fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));

expect(screen.getByRole("button", { name: "Publish sofa" })).toBeInTheDocument();
```

For a published sofa:

```ts
fireEvent.click(screen.getByRole("tab", { name: /Publish/i }));
expect(screen.getByRole("button", { name: "Unpublish sofa" })).toBeInTheDocument();
```

Expected before implementation: FAIL if publication actions still appear outside Publish or existing tests rely on the old section layout.

- [ ] **Step 2: Add blocker target helper**

In `admin-sofa-edit-model.ts`, add:

```ts
export function getPublicationBlockerTarget(code: string): SofaEditTabKey {
  if (code.includes("FABRIC") || code.includes("SWATCH") || code.includes("AI_REFERENCE")) {
    return "fabrics";
  }

  if (code.includes("SOURCE_PHOTO") || code.includes("VISUAL_MATRIX")) {
    return "visual_matrix";
  }

  if (code.includes("RENDER")) {
    return "renders";
  }

  return "basics";
}
```

Test this mapping in `admin-sofa-edit-model.test.ts`.

- [ ] **Step 3: Keep publish actions only in the Publish tab**

Move `PublicationReadinessSection` into the Publish tab panel.

Its UI must show:

- current lifecycle state;
- detailed readiness blockers;
- a button/link for each blocker target when possible;
- `Publish sofa` only when not published;
- `Unpublish sofa` only when published;
- no render generation controls.

Add RU/FR comments before the Publish large interface section and action functions if changed.

- [ ] **Step 4: Add Publish tab styles**

In `globals.css`, add:

- `.admin-publish-panel`
- `.admin-publish-blocker`
- `.admin-lifecycle-badge`

Keep buttons reachable on mobile and keep blocker text visible.

- [ ] **Step 5: Verify Publish tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx src/app/admin/admin-sofa-edit-model.test.ts
```

Expected after implementation: PASS.

### Task 8: Focused UI Polish, Accessibility, And Responsive Checks

**Files:**

- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`

- [ ] **Step 1: Audit accessible names**

Ensure the following controls have stable accessible names:

- tab buttons;
- icon-only or compact action buttons;
- drawer close buttons;
- dialog cancel and save buttons;
- render cell buttons;
- file inputs;
- destructive confirm buttons.

Add tests for at least one compact close button:

```ts
expect(screen.getByRole("button", { name: "Close render cell" })).toBeInTheDocument();
```

- [ ] **Step 2: Add focus return behavior**

When a drawer/sheet closes, return focus to the button that opened it.

Use a `useRef` value to remember the opener. Add required RU/FR comments before the value and automatic close behavior.

Add a test:

```ts
const cellButton = screen.getByRole("button", {
  name: /Boucle ivoire, Front: Missing/i,
});
fireEvent.click(cellButton);
fireEvent.click(screen.getByRole("button", { name: "Close render cell" }));

expect(cellButton).toHaveFocus();
```

- [ ] **Step 3: Keep text inside containers**

Review the CSS for:

- fabric card names;
- internal names;
- status chips;
- tab labels;
- mobile fabric group rows;
- drawer and sheet footers.

Use fixed swatch dimensions, `min-width: 0`, and wrapping where needed.

- [ ] **Step 4: Verify focused UI tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx src/app/admin/admin-sofa-edit-model.test.ts
```

Expected after implementation: PASS.

### Task 9: Roadmaps, Plan Closure, And Verification

**Files:**

- Modify: `docs/roadmap/web.md`
- Modify: `docs/roadmap/api.md`
- Modify: `docs/plans/active/README.md`
- Move when complete: `docs/plans/active/PLAN-0035-admin-sofa-edit-ux-simplification.md` to `docs/plans/done/PLAN-0035-admin-sofa-edit-ux-simplification.md`

- [ ] **Step 1: Keep active roadmap rows during implementation**

The active roadmap rows added with this plan must remain while implementation is in progress:

```markdown
| Active | SPEC-0014 | PLAN-0035 | Sofa edit workflow tabs, fabric cards, render coverage matrix, responsive cell sheet, and Publish-only publication actions. |
```

for `docs/roadmap/web.md`, and:

```markdown
| Active | SPEC-0014 | PLAN-0035 | Admin fabric responses expose safe swatch preview URLs without storage object paths. |
```

for `docs/roadmap/api.md`.

- [ ] **Step 2: Run focused verification**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts src/app/admin/admin-sofa-edit-model.test.ts src/app/admin/AdminCatalogPages.test.tsx
pnpm.cmd --filter @mobel-unique/web typecheck
pnpm.cmd spec:check
```

Expected: PASS.

- [ ] **Step 3: Run broader verification before plan closure**

Run:

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Expected: PASS.

- [ ] **Step 4: Mark roadmaps done after verification**

After all required checks pass, change the PLAN-0035 rows in `docs/roadmap/web.md` and `docs/roadmap/api.md` from `Active` to `Done`.

- [ ] **Step 5: Move the plan after implementation is complete**

Move this file to:

```text
docs/plans/done/PLAN-0035-admin-sofa-edit-ux-simplification.md
```

Change:

```text
Status: active
```

to:

```text
Status: done
```

Remove the PLAN-0035 row from `docs/plans/active/README.md`.

## Tests

Required focused checks during implementation:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog-route-handlers.test.ts
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/admin-sofa-edit-model.test.ts
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
pnpm.cmd --filter @mobel-unique/web typecheck
pnpm.cmd spec:check
```

Required broader checks before completion:

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Optional local smoke after implementation:

```powershell
pnpm.cmd supabase:reset
pnpm.cmd dev:web
```

Use the sofa edit page in the browser and compare desktop and mobile layouts against `design admin ui/Sofa Edit.html`.

## Roadmap

Update these roadmap files:

- `docs/roadmap/web.md`
- `docs/roadmap/api.md`

## Notes

- This plan intentionally pauses after plan creation for user review.
- Do not implement this plan until the user approves it.
- Keep all repository-authored plan, roadmap, test, UI copy, and operational notes in English.
- In `.tsx` edits, add or refresh the required RU/FR comments around new data variables, automatic blocks, action functions, and large UI sections.
- Do not use the forbidden words from the repository instructions inside `.tsx` comments.
- Keep generated fabric render candidates private and unselected until the admin explicitly uses one as current.
- Do not change worker behavior, render job creation rules, publication rules, or public customer pages in this plan.
- Do not add drag-and-drop ordering in this plan; use numeric public order inputs and explicit save.
- Do not expose AI reference thumbnails in matrix-heavy views; show only AI reference readiness text.

## Post-Completion Maintenance

- [x] Corrected the candidate comparison dialog so generated render candidates are compared against the source photo for the selected visual position, not against the current render. The admin API now carries a safe signed source photo preview URL for this comparison without exposing storage object paths.
- [x] Tightened the sofa edit render review UX after manual testing: queued and processing cells are informational only, candidate previews and current renders can open in a large image dialog, refine prompt textareas open only on demand and can be canceled, duplicate close actions were removed from popups, and the technical sofa UUID is no longer shown in the edit header.
- [x] Fixed stale publish blockers in the sofa edit workflow by refreshing publication readiness after render coverage and visual matrix changes, including manual render uploads and Realtime render job updates.

## Self-Review

- Spec coverage: SPEC-0014 tab workflow, header behavior, tab responsibilities, fabric cards, safe swatch preview URL, render cell statuses, render cell sheet, candidate review, explicit save model, mobile and desktop rules, error states, accessibility, testing, and roadmap impact are covered.
- Design coverage: the plan maps `design admin ui/` shell, tabs, atoms, drawer, sheet, mobile render groups, and status treatment into production files without importing design-canvas tooling.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: `swatch_preview_url`, `SofaEditTabKey`, `SofaEditReadinessKind`, `RenderCellDisplayStatus`, and render action labels are consistent across tasks.
