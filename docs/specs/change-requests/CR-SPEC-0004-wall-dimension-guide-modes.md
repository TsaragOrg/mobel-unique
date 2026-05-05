# CR-SPEC-0004 Wall Dimension Guide Modes

Target spec ids: SPEC-0004
Related draft specs: SPEC-0007
Status: accepted

## Reason For Change

The previous public in-home simulation flow asked for room depth and optionally
camera-position distance. The current product decision simplifies dimension
collection: the MVP asks only for dimensions drawn on the uploaded room photo.

The worker distinguishes a main-wall photo from a room-corner photo and
generates a dimension-guide image with deterministic arrows.

## Proposed Change

Update `SPEC-0004` so that:

- `back_wall` mode asks for wall width and wall height only;
- `corner` mode asks for left wall width, right wall width, and room height;
- the MVP does not ask for room depth or camera-position distance;
- the dimension-guide image tells the visitor exactly which dimensions to
  provide.

## Impact

- Public UI: dimension fields depend on the guide image produced by the
  in-home simulation worker.
- Worker: `SPEC-0007` defines the four-point `back_wall` mode, six-point
  `corner` mode, and deterministic guide rendering.
- API: API contracts must validate the dimension payload against the geometry
  mode returned by the worker.

## Approval Note

Accepted during in-home simulation specification review to keep measurement
collection practical for visitors and avoid requiring room depth in the MVP.
