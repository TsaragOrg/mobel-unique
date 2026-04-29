# CR-SPEC-0005-SPEC-0013 Source Photo Render Cell Lifecycle

Target spec ids: SPEC-0005, SPEC-0006, SPEC-0009, SPEC-0010, SPEC-0013
Related spec ids: SPEC-0012
Status: accepted

## Reason For Change

Accepted specs already state that a valid sofa source photo can serve as the
canonical render for its own sofa, visual matrix column, and original fabric
combination. They also state that manual uploads, source photos, and accepted
AI-generated candidates can satisfy render coverage.

During admin flow testing, one lifecycle gap became visible:

- if a render cell is created after the source photo exists, the implementation
  can initialize that source fabric cell as `source_photo`;
- if the administrator uploads or replaces the source photo after render cells
  already exist, the source fabric render cell is not necessarily synchronized
  to `source_photo`;
- the fabric render job API can still queue an `initial` generation job for the
  source photo's own original fabric and visual column, even though that cell is
  already conceptually complete from the source photo.

The accepted specs should make this lifecycle explicit across domain behavior,
database state, API contracts, worker inputs, admin UI behavior, publication,
and public-read boundaries.

## Proposed Change

### Domain Behavior

Update `SPEC-0005` so that source photos have a first-class render coverage
lifecycle:

- a valid source photo for `sofa_id`, `visual_matrix_column_id`, and
  `original_fabric_id` is the canonical private render for that exact render
  cell;
- that source fabric cell is complete for private render coverage as soon as
  the source photo upload is completed and attached;
- the administrator does not need to generate an AI render for the source
  photo's own original fabric;
- AI generation is for fabric cells that need material transfer from the
  current column source photo to another assigned fabric;
- manual render upload remains an explicit replacement path for any render
  cell, including a cell currently satisfied by a source photo;
- replacing the current source photo for a visual matrix column updates the
  canonical source-photo render cell for the new source photo's original
  fabric, but does not automatically regenerate AI-derived render cells for
  other fabrics.

### Data Model And Storage

Update `SPEC-0009` to require this render cell synchronization:

- completing a `sofa_source_photo` upload must create or update the matching
  `sofa_render_cells` row for the same sofa, visual matrix column, and original
  fabric;
- that matching render cell must set:
  - `current_private_asset_id = sofa_source_photos.asset_id`;
  - `source_photo_id = sofa_source_photos.id`;
  - `source_type = 'source_photo'`;
  - `accepted_fabric_render_candidate_id = null`;
  - `updated_at` to the mutation time;
- the mutation must not update `current_public_asset_id`; publication logic
  remains the only owner of public asset copy creation or refresh;
- if the matching render cell previously pointed to an AI candidate or manual
  render, the completed source photo becomes the current private render for the
  source fabric cell unless a later accepted spec defines a separate conflict
  resolution flow;
- existing AI-derived cells for other fabrics must remain unchanged when the
  source photo changes, although the admin UI may show that regeneration is
  available or recommended.

### API Contracts

Update `SPEC-0010` so the admin API enforces the lifecycle:

- completing a `sofa_source_photo` upload must atomically attach the source
  photo to the visual matrix column and synchronize the corresponding
  source-photo render cell;
- `GET /api/admin/sofas/{sofa_id}/render-coverage` must report the source
  fabric cell as private-complete with `source_type = 'source_photo'`;
- the render coverage response must not expose `can_generate_initial = true`
  for a cell whose current private render is the matching source photo;
- `POST /api/admin/fabric-render-jobs` with `generation_mode = 'initial'` must
  reject requests for the source photo's own original fabric and visual column
  when that source photo is already the current render for the cell;
- the rejection should use a stable validation error such as
  `FABRIC_RENDER_JOB_CONFLICT` with a message explaining that the source photo
  already satisfies the original fabric render cell;
- manual render attachment can still replace the source-photo render through
  `POST /api/admin/render-cells/{render_cell_id}/manual-render`;
- worker success must still create candidates only and must not overwrite the
  source-photo current render unless the administrator explicitly selects a
  candidate as current.

### Worker Contract

Update `SPEC-0006` to clarify initial render job eligibility:

- `initial` mode uses the visual matrix column's current source photo as the
  target sofa image;
- `initial` mode is intended for generating a render for a target fabric that
  is not already satisfied by the current source photo's original fabric cell;
- the worker does not decide whether the source fabric cell should be
  regenerated; the admin API must prevent ineligible source-photo-cell jobs
  before queueing.

### Admin Frontend

Update `SPEC-0013` so the admin UI reflects the source-photo lifecycle:

- the render coverage cell for the source photo's original fabric must show
  private completion through `source_type = 'source_photo'`;
- that cell must not present `Generate initial render` as the normal next
  action while the source photo is current;
- the UI may show a read-only state such as `Source photo used as current
render`;
- manual render upload for that cell may remain available as an explicit
  replacement action, but it should be visually secondary to the completed
  source-photo state;
- other fabric cells in the same visual column may still expose generation
  actions when they have the required source photo and fabric AI reference;
- replacing the visual column source photo must refresh render coverage so the
  checklist and matrix reflect the new source-photo current cell.

### Public Frontend And Publication Boundary

No public visitor flow should expose source-photo internals.

`SPEC-0012` should remain aligned with this rule:

- public frontend and public APIs consume published public render assets only;
- whether a private render originated from `source_photo`, `manual_upload`, or
  `ai_generated` is admin-only operational metadata;
- publication logic must create or refresh public copies from the current
  private render cell state, including cells whose private render is a source
  photo.

## Impact

- Specs: accepted specs `SPEC-0005`, `SPEC-0006`, `SPEC-0009`, `SPEC-0010`,
  and `SPEC-0013` need targeted clarifications after this change request is
  accepted.
- Database: existing tables can represent the intended state, but source photo
  completion must synchronize the matching render cell in application logic or
  a database helper.
- API: upload completion and render job creation need additional lifecycle
  checks.
- Worker: no worker-side publication or current-render behavior changes are
  needed; the API owns job eligibility.
- Admin UI: render coverage should suppress or disable generation for
  source-photo-satisfied cells and show them as complete.
- Public UI: no direct behavior change, as public pages should only see
  published public render assets.
- Tests: add or update tests for source photo completion, render coverage
  response shape, render job rejection, admin UI affordances, and publication
  boundary assumptions.
- Plans: the follow-up implementation plan should reference this change request
  before changing API or UI behavior.

## Approval Note

Accepted after manual admin testing exposed that source-photo render cells were
not explicit enough across the specs. Uploading the source photo for a fabric
and visual position should satisfy that exact fabric-and-position render cell,
while AI generation remains available for the other fabric cells that need
material transfer from the source photo.
