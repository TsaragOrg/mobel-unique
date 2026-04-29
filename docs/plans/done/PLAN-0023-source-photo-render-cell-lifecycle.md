# PLAN-0023 Source Photo Render Cell Lifecycle

Plan: PLAN-0023
Spec: SPEC-0013
Status: done
Owner area: web
Depends on: PLAN-0019, PLAN-0021, PLAN-0022, SPEC-0005, SPEC-0006, SPEC-0009, SPEC-0010, SPEC-0012
Change request: CR-SPEC-0005-SPEC-0013-source-photo-render-cell-lifecycle
Affected packages:

- `apps/web`
- `scripts`
- `docs/plans`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Implement the accepted source-photo render-cell lifecycle clarification: when an
administrator completes a source photo upload for a sofa visual matrix column,
the matching sofa, visual column, and original fabric render cell becomes the
current private render from that source photo.

The admin API must not queue an initial AI generation job for that same
source-photo-satisfied cell, and the admin UI must show the cell as complete
instead of directing the administrator to generate it.

This plan stops at private render coverage. It does not publish public render
assets and does not change worker execution.

## Concrete Test Path

After implementation, a local seeded admin should be able to:

1. Sign in at `/admin/login`.
2. Open a draft sofa at `/admin/sofas/[sofa_id]`.
3. Assign at least two active fabrics to the sofa.
4. Ensure the non-source target fabric has a private AI reference image.
5. Create one visual matrix column.
6. Upload a source photo for that column and choose one assigned fabric as the
   original fabric.
7. Refresh render coverage.
8. Confirm the source photo's original fabric cell is complete with
   `source_type = 'source_photo'`.
9. Confirm the source photo's original fabric cell does not expose the normal
   `Generate initial render` action.
10. Confirm manual upload remains available as an explicit replacement action
    for that cell.
11. Confirm another assigned fabric in the same column can still expose
    generation when it has the required AI reference image.
12. Try to create an initial render job for the source photo's original fabric
    through the API and confirm it is rejected with a stable validation error.
13. Create an initial render job for the other eligible fabric and confirm it is
    still queued normally.

## Scope

### Source Photo Completion

Update the admin upload completion path for `sofa_source_photo`.

Rules:

- completion must still create or update the `storage_assets` row;
- completion must still create or update the `sofa_source_photos` relationship;
- completion must still set the visual matrix column's current source photo;
- completion must create or update the matching `sofa_render_cells` row for the
  same sofa, visual matrix column, and original fabric;
- the matching render cell must set:
  - `current_private_asset_id` to the source photo asset;
  - `source_photo_id` to the source photo row;
  - `source_type` to `source_photo`;
  - `accepted_fabric_render_candidate_id` to null;
  - `updated_at` to the mutation time;
- completion must not set or refresh `current_public_asset_id`.

If the matching render cell already exists from an older manual or AI-generated
state, source photo completion replaces that private current render for the
exact source fabric cell.

### Render Coverage

Update render coverage shaping so the source-photo-satisfied cell is explicit.

Rules:

- the cell must report private completion when the current private asset comes
  from the matching source photo;
- the cell must expose `source_type = 'source_photo'`;
- the cell must not report `can_generate_initial = true`;
- the cell may include a stable blocker or state code such as
  `SOURCE_PHOTO_RENDER_COMPLETE` if the existing response shape supports it;
- other fabric cells in the same column must preserve their existing generation
  eligibility behavior.

### Fabric Render Job Creation

Update `POST /api/admin/fabric-render-jobs`.

Rules:

- `generation_mode = 'initial'` must reject the source photo's own original
  fabric cell when that source photo already satisfies the current private
  render;
- the rejection must use a stable validation error, preferably
  `FABRIC_RENDER_JOB_CONFLICT`;
- the browser-visible message must explain that the source photo already
  satisfies the original fabric render cell;
- generation for other eligible fabric cells must continue to queue durable jobs
  exactly as before.

### Admin UI

Update the sofa edit render coverage section.

Rules:

- a source-photo-complete cell must be shown as complete;
- the cell must make `Source photo` understandable as the current render source;
- the normal generate action must not be shown as the next action for that cell;
- manual render upload may remain available as an explicit replacement action;
- candidate review behavior must remain unchanged for cells with candidates;
- render coverage must refresh after source photo upload or replacement.

### Local Smoke Coverage

Update the admin render preparation smoke path so it proves the lifecycle:

- source photo upload completes the source fabric render cell;
- source fabric render cell is not initially generatable;
- creating an initial job for the source fabric cell is rejected;
- creating an initial job for a different eligible fabric still works.

## Out Of Scope

This plan does not include:

- fabric render worker execution changes;
- Gemini provider changes;
- prompt changes;
- candidate ranking or candidate acceptance behavior;
- publication, unpublication, or public asset copy creation;
- public storefront pages;
- ZIP export;
- final admin visual design;
- schema changes unless tests prove existing constraints cannot represent the
  accepted lifecycle.

## Tasks

- [x] Add failing route-handler tests for source photo completion
      synchronizing the matching render cell.
- [x] Add failing route-handler coverage for replacing an existing private
      manual render state on the exact source fabric cell.
- [x] Add failing route-handler tests for render coverage returning the
      source-photo-complete cell with generation disabled.
- [x] Add failing route-handler tests for initial job rejection on the
      source-photo-satisfied cell and successful queueing on another eligible
      fabric cell.
- [x] Add failing UI tests for the render coverage cell state and hidden
      generate action.
- [x] Update the source photo upload completion implementation.
- [x] Update render coverage shaping and generation eligibility logic.
- [x] Update initial fabric render job validation.
- [x] Update the admin render coverage UI.
- [x] Update the local admin render prep smoke script and its tests.
- [x] Update relevant roadmaps.
- [x] Run targeted web tests, typecheck, spec guard, smoke tests, and broader
      checks as appropriate.
- [x] Move this plan to `docs/plans/done` when verified.

## Tests

Add or update:

- `apps/web/src/lib/admin-catalog-route-handlers.test.ts`;
- `apps/web/src/app/admin/AdminCatalogPages.test.tsx`;
- `scripts/spec-0010-admin-render-prep-smoke.mjs`;
- `scripts/spec-0010-admin-render-prep-smoke.test.mjs`.

Expected checks:

- `pnpm --filter @mobel-unique/web test`;
- `pnpm --filter @mobel-unique/web typecheck`;
- `pnpm spec:check`;
- `pnpm test`;
- `pnpm typecheck`;
- `pnpm build`;
- `pnpm supabase:reset`;
- `pnpm test:admin:render-prep:local` with local Supabase and web running.

The local Supabase smoke remains a manual verification command because the full
candidate-review continuation requires a running local web app, local Supabase,
and worker-produced candidate output.

## Manual Verification

Manual verification should focus on the exact case that triggered the spec
change:

1. Start local Supabase and the web app.
2. Reset local Supabase.
3. Sign in as the seeded admin.
4. Create or open a draft sofa.
5. Assign two fabrics.
6. Add an AI reference image for the non-source fabric.
7. Create one visual matrix column.
8. Upload a source photo for the source fabric.
9. Confirm the source fabric cell is complete from `source_photo`.
10. Confirm there is no normal initial generation action for that source fabric
    cell.
11. Confirm manual upload is still available as an explicit replacement.
12. Confirm another fabric cell in the same column can still generate when
    eligible.

## Roadmap

Update:

- `docs/roadmap/api.md`;
- `docs/roadmap/supabase.md`;
- `docs/roadmap/web.md`;
- `docs/roadmap/workflow.md`.

## Notes

The existing database model already has `sofa_render_cells.source_photo_id`,
`source_type = 'source_photo'`, `current_private_asset_id`, and
`current_public_asset_id`. The expected implementation should first try to use
those fields through the existing first-party admin API boundary before adding
any migration.

Publication remains a later transaction. This plan must not create public asset
copies when a source photo upload completes.
