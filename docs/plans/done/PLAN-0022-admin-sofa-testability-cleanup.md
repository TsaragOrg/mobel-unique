# PLAN-0022 Admin Sofa Testability Cleanup

Plan: PLAN-0022
Spec: SPEC-0013
Status: done
Owner area: web
Depends on: PLAN-0021
Affected packages:

- `apps/web`
- `docs/plans`
- `docs/roadmap/web.md`

## Goal

Make the admin sofa edit page easier to use during manual functional testing
without introducing final visual design work. The page should clearly show what
has already been configured, what is still missing, and which action should be
tested next.

This is a temporary testability cleanup. It should preserve existing admin API
contracts, data mutations, permissions, and render workflow behavior.

## Concrete Test Path

After implementation, a local seeded admin should be able to:

1. Sign in at `/admin/login`.
2. Open an existing draft sofa at `/admin/sofas/[sofa_id]`.
3. Use the top in-page navigation to jump to metadata, fabrics, visual matrix,
   render coverage, or publication readiness.
4. Read a compact test checklist showing whether the sofa has assigned fabrics,
   visual matrix columns, source photos, generated candidates, a private render,
   and publication readiness.
5. Assign a fabric from the fabric section without losing track of the next
   section to test.
6. Add or edit visual matrix columns and upload a source photo from a clearly
   separated visual matrix section.
7. Review render coverage cells where status, blockers, candidates, generation,
   candidate review, and manual upload controls are visually grouped.
8. Select a candidate or upload a manual render and confirm the checklist and
   render coverage refresh.
9. Review publication readiness blockers from a clearly labeled section.

## Scope

### Sofa Test Navigation

Add a simple in-page navigation to the sofa edit page with links to:

- `Sofa basics`;
- `Fabric assignments`;
- `Visual matrix`;
- `Render coverage`;
- `Publication readiness`.

The navigation is for manual testing only and does not need to become the final
admin information architecture.

### Test Checklist

Add a compact checklist near the top of the sofa edit page that summarizes the
current functional test state:

- fabric assignment exists;
- visual matrix column exists;
- source photo exists;
- generated candidate exists;
- private render exists;
- publication readiness.

The checklist must derive from already-loaded page data. It must not call new
APIs.

### Section Cleanup

Clarify the existing sections by:

- using test-oriented section titles;
- separating primary action forms from existing lists;
- keeping error messages scoped to the section that produced them;
- avoiding dense nested controls where a simpler grouped layout is enough.

### Render Coverage Cleanup

Make each render coverage cell easier to scan by grouping:

- render status;
- source/job details;
- blockers;
- candidate count;
- actions: `Generate`, `Review candidates`, `Upload manual render`;
- candidate review results.

The behavior of these actions must remain unchanged.

## Out Of Scope

This plan does not include:

- final admin visual design;
- design system work;
- API changes;
- Supabase migrations;
- publication behavior;
- worker behavior;
- public storefront behavior;
- changing copy outside the admin sofa edit testing flow.

## Implementation Steps

1. Add focused UI tests for the sofa edit test navigation, checklist, and render
   coverage grouping.
2. Add small derived helpers for checklist state from existing sofa page data.
3. Update the sofa edit layout to use in-page sections instead of one dense
   grid.
4. Update the fabric assignment, visual matrix, render coverage, and readiness
   section wrappers for clearer scanning.
5. Add minimal CSS utilities for the temporary test layout.
6. Run targeted web tests and typecheck.
7. Move this plan to `docs/plans/done` when verified and update the roadmap.

## Acceptance Criteria

- The sofa edit page exposes clear anchors for all major testing sections.
- The test checklist reflects already-loaded data and updates after render
  preparation refreshes.
- Existing sofa metadata save, fabric assignment, visual matrix, source upload,
  render job queueing, candidate review, and manual render upload tests still
  pass.
- No API, migration, or permission changes are introduced.
