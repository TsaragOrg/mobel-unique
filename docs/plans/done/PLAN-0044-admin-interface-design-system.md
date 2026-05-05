# PLAN-0044 Admin Interface Design System

Plan: PLAN-0044
Spec: SPEC-0013
Status: done
Owner area: web
Affected packages:

- `apps/web`

Related change request:

- `docs/specs/change-requests/CR-SPEC-0013-admin-interface-design-system.md`

Related decision:

- `docs/decisions/0001-admin-interface-visual-system.md`

## Goal

Prepare and implement the protected admin interface visual system so every existing admin page shares the same shell, navigation, typography, controls, form styling, status styling, and responsive behavior without changing admin catalog behavior or API contracts.

The implementation must start with shared admin foundations, validate them on the simplest admin screens, and only then apply them to dense catalog and sofa edit workflows.

## Current Admin Surface

Routes in scope:

- `/admin/login`
- `/admin`
- `/admin/sofas`
- `/admin/sofas/new`
- `/admin/sofas/[sofa_id]`
- `/admin/fabrics`
- `/admin/fabrics/new`
- `/admin/fabrics/[fabric_id]`
- `/admin/tags`

Primary source files:

- `apps/web/src/app/admin/AdminDashboard.tsx`
- `apps/web/src/app/admin/AdminCatalogPages.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/admin/login/AdminLoginForm.tsx`
- `apps/web/src/app/globals.css`
- route wrappers under `apps/web/src/app/admin/**/page.tsx`

Existing tests to preserve and extend:

- `apps/web/src/app/admin/AdminDashboard.test.tsx`
- `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
- `apps/web/src/app/admin/login/page.test.tsx`
- relevant shared admin catalog tests when markup changes affect behavior.

## Implementation Sequence

### Phase 0: Audit And Baseline

- [x] Capture the current admin route map, shared components, and major states.
- [x] Identify all admin class names currently defined in `globals.css`.
- [x] Identify markup that can become shared shell/header/action/list/form patterns.
- [x] Confirm which copy remains intentionally English per `SPEC-0013`.
- [x] Confirm upload controls remain functional where they already exist, and avoid enabling homepage upload work from this plan.

### Phase 1: Admin Tokens And Shared Shell

- [x] Add admin-scoped CSS tokens for color, spacing, radius, shadow, typography, and focus.
- [x] Create or consolidate shared admin shell structure for protected admin pages.
- [x] Standardize admin navigation across dashboard and catalog pages.
- [x] Define page header pattern with title, description/context, and primary action area.
- [x] Standardize base action variants: primary, secondary, quiet, danger, and inline link.
- [x] Add tests for dashboard shell/navigation and protected state preservation.

### Phase 2: Login And Dashboard

- [x] Update `/admin/login` to use the shared admin visual system.
- [x] Update login form field, error, and submit states.
- [x] Update `/admin` dashboard layout and action hierarchy.
- [x] Preserve existing auth validation, logout, loading, and forbidden behavior.
- [x] Add or update tests for login form visibility and dashboard actions.
- [x] Browser-verify desktop and mobile login/dashboard views.

### Phase 3: List Pages

- [x] Harmonize `/admin/sofas` list layout, row/card hierarchy, statuses, metadata, and actions.
- [x] Harmonize `/admin/fabrics` list layout, fabric asset readiness, archive state, and actions.
- [x] Harmonize `/admin/tags` create/list/delete-confirm patterns.
- [x] Standardize loading, empty, error, and unauthorized states for list pages.
- [x] Add or update tests for list page headings, action availability, and empty/error states.
- [x] Browser-verify desktop and mobile list views.

### Phase 4: Form Pages

- [x] Harmonize `/admin/sofas/new` form layout and action footer.
- [x] Harmonize `/admin/fabrics/new` upload + form layout.
- [x] Harmonize `/admin/fabrics/[fabric_id]` edit/archive layout.
- [x] Standardize field labels, helper text, validation errors, file input states, and disabled/loading controls.
- [x] Preserve existing signed upload behavior and client-side resize behavior.
- [x] Add or update tests for form submission, validation errors, and upload call paths when markup changes.
- [x] Browser-verify desktop and mobile form flows.

### Phase 5: Sofa Edit Shared Workflow

- [x] Apply shared shell, header, navigation, and action hierarchy to `/admin/sofas/[sofa_id]`.
- [x] Preserve `SPEC-0014` workflow tabs: Basics, Fabrics, Visual matrix, Renders, Publish.
- [x] Standardize tab status signals and section headers.
- [x] Harmonize Basics, Fabrics, Visual matrix, Renders, and Publish panels without changing data behavior.
- [x] Keep publish/unpublish actions only in the Publish tab.
- [x] Keep render generation and candidate selection inside Renders.
- [x] Update tests that assert tab structure, readiness, and action boundaries.

### Phase 6: Drawers, Modals, Previews, And Matrix

- [x] Harmonize drawer and sheet presentation.
- [x] Harmonize confirmation dialogs and destructive actions.
- [x] Harmonize image preview buttons, lightbox, and compare dialogs.
- [x] Harmonize render matrix desktop table.
- [x] Harmonize mobile render fabric groups and render cell sheet.
- [x] Preserve source-photo lifecycle behavior, candidate review, manual upload, refine prompts, Realtime job status, and manual resume.
- [x] Add or update tests for key modal/drawer open/close flows and render cell actions.
- [x] Browser-verify matrix-heavy pages at desktop, tablet, and mobile widths.

### Phase 7: Final QA And Cleanup

- [x] Remove stale admin CSS selectors after pages are migrated.
- [x] Ensure public homepage styles and admin styles do not collide.
- [x] Verify focus states and keyboard reachability for navigation, forms, drawers, dialogs, and matrix actions.
- [x] Verify that admin routes still emit `noindex, nofollow`.
- [x] Run the quality gate listed below.
- [x] Update `docs/roadmap/web.md`.

## Tests

Start by updating tests before implementation in each phase.

Required narrow checks:

- `pnpm --filter @mobel-unique/web test -- src/app/admin/login/page.test.tsx`
- `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminDashboard.test.tsx`
- `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`
- `pnpm --filter @mobel-unique/web typecheck`

Required broader checks before PR:

- `pnpm spec:check`
- `pnpm --filter @mobel-unique/web build`

Browser verification should cover:

- desktop admin dashboard and list pages;
- mobile admin login and list pages;
- desktop sofa edit Renders tab;
- mobile sofa edit render cell sheet;
- at least one drawer/dialog flow;
- at least one destructive confirmation flow.

## Roadmap

Update:

- `docs/roadmap/web.md`

Roadmap should track the plan as active while work is in progress, then move it to Done after implementation and verification.

## Notes

- Do not enable or redesign the public homepage upload behavior in this plan.
- Do not change API contracts unless a later spec or change request explicitly requires it.
- Do not introduce a reusable Codex skill until the visual system is implemented and proven in this repo.
- Local visual QA on May 2, 2026 covered the public home page and admin login at desktop and mobile widths with no console errors.
- Authenticated local visual QA on May 2, 2026 used the seeded admin fixtures and covered sofa, fabric, and tag lists; sofa and fabric create/edit forms; sofa edit Visual matrix, Renders, and Publish panels; render cell drawer/sheet behavior; and desktop, tablet, and mobile widths for matrix-heavy views.
- The authenticated QA pass found and fixed mobile Visual matrix text compression, mobile Publish blocker code wrapping, and render cell sheet focus entry/return behavior. Upload controls remain visually verified only for their existing admin behavior; this plan does not enable public homepage upload behavior.
- A transient Next.js dev chunk 404 appeared after Fast Refresh and cleared after restarting the local dev server. The final authenticated browser pass had no runtime console errors; only the expected Fast Refresh reload warning remained during development.
- Prefer incremental PRs if the full plan becomes too large:
  - PR 1: shell, tokens, login, dashboard;
  - PR 2: list pages and form pages;
  - PR 3: sofa edit tabs, drawers, previews, matrix, final cleanup.
- Keep all repository-authored admin copy in English unless a later localization spec changes that rule.
