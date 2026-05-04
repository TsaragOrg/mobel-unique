# CR-SPEC-0014 Admin Sofa Source Fabric Reassignment Safety

Target spec ids: SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0013, SPEC-0014
Status: accepted

## Reason For Change

`SPEC-0014` and `CR-SPEC-0014 Admin Sofa Edit Operational Redesign` make the
Visual Matrix workflow simpler by letting the administrator edit a view column
from one focused workbench.

The latest sofa edit UX now lets an administrator change the source fabric line
for an existing source image without uploading the image again. That is the
right operational behavior: if the image already exists, the fabric identity can
be corrected without forcing a redundant upload.

This creates a data consistency requirement that is not explicit enough in the
current specs:

- the visual matrix column metadata can change in the same save action;
- the current source photo's `original_fabric_id` can change;
- the old source-fabric render cell may need to stop pointing at that source
  photo;
- the new source-fabric render cell must become complete from that same source
  photo;
- a failed save must not leave the admin with a partially changed sofa.

The current checkpoint implementation performs those updates through several
application-level Supabase calls. That is acceptable as a temporary checkpoint,
but it is not strong enough as the final behavior for catalog preparation.

## Proposed Change

### Domain Behavior

A current source photo for a visual matrix column may be reassigned to a
different original fabric line without uploading a new image when all of these
conditions are true:

- the visual matrix column belongs to the target sofa;
- the visual matrix column has a current source photo;
- the target fabric line is assigned to the same sofa;
- the source photo asset remains the same;
- the operation is requested by an authenticated administrator through the
  first-party admin facade.

Reassigning the source fabric line moves source-photo render coverage from the
old fabric-and-column cell to the new fabric-and-column cell. It does not copy
or mutate storage bytes.

### Atomicity Requirement

Changing a visual matrix column and reassigning its current source photo's
original fabric must be treated as one logical mutation.

The implementation should prefer a database transaction boundary, such as a
service-role-only Supabase RPC, so that these updates succeed or fail together:

- visual matrix column metadata updates;
- source photo `original_fabric_id` update;
- old source-photo render cell cleanup;
- new source-photo render cell synchronization.

If an implementation splits storage upload from metadata updates, the no-upload
reassignment path still needs an atomic metadata and render-cell mutation. A
source image upload may remain a separate storage operation because object
storage cannot participate in the same Postgres transaction.

### Render Cell Rules

When the source fabric line changes from old fabric `A` to new fabric `B`:

- the old render cell for `(sofa, visual matrix column, fabric A)` must only be
  cleared if it still points to the same source photo;
- manual uploads and accepted AI-generated renders that do not point to the
  moving source photo must not be overwritten;
- the old render cell must not clear or refresh public asset fields;
- the new render cell for `(sofa, visual matrix column, fabric B)` must point to
  the source photo asset as its current private asset;
- the new render cell must set `source_type = 'source_photo'`;
- the new render cell must set `accepted_fabric_render_candidate_id = null`;
- publication remains the only owner of public asset creation or refresh.

### API Contract

The admin visual matrix column update endpoint may accept
`source_original_fabric_id` on patch/update payloads only.

The visual matrix column create endpoint must reject
`source_original_fabric_id` as an unsupported field instead of accepting and
ignoring it.

The update path should return stable validation or conflict errors for:

- no current source photo exists;
- target fabric line is not assigned to the sofa;
- target visual matrix column does not belong to the sofa;
- concurrent state changed before the mutation could be applied;
- render-cell synchronization fails.

### Admin UI

The View Columns edit workbench should keep the no-upload correction behavior:

- if a current source image exists, changing the source fabric line must not
  require a new upload;
- if no source image exists, choosing a source fabric line still requires a
  source image upload;
- save controls must show loading, disable repeated submit, and close only
  after the mutation is complete;
- errors must stay visible inside the active workbench and must not be hidden
  behind another dialog or a closing modal.

## Impact

- Specs: clarifies the source-photo lifecycle from
  `CR-SPEC-0005-SPEC-0013-source-photo-render-cell-lifecycle` for the special
  case where an existing source photo changes original fabric line.
- Database: likely requires one service-role-only RPC to provide the transaction
  boundary for column metadata, source photo, and render cell updates.
- API: admin visual matrix column patch validation and store implementation
  need to route source-fabric reassignment through the transaction boundary.
- UI: the existing View Columns edit workbench behavior is preserved, but its
  save path must surface stronger loading and failure semantics.
- Worker: no worker behavior changes.
- Public frontend: no public behavior changes.
- Roadmaps: update web and Supabase roadmaps because this crosses the admin UI
  facade and database transaction boundary.
- Tests: add unit and route-handler coverage for payload validation,
  no-upload reassignment, old/new render cell synchronization, and failure
  handling.

## Approval Note

Accepted for `PLAN-0059` after review found that the no-upload source fabric
correction path must not leave visual matrix column metadata, source photos, and
render cells out of sync.
