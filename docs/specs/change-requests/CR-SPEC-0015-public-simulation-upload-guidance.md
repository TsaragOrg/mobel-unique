# CR-SPEC-0015 Public Simulation Upload Guidance

Target spec ids: SPEC-0015
Related spec ids: SPEC-0012
Status: accepted
Implementation Plans: PLAN-0070

## Reason For Change

The public in-home simulation upload step currently tells the visitor to upload
a room photo, but it does not make the chosen sofa visually present in the
experience. Visitors can enter the flow without seeing the exact sofa, fabric,
and visual position that will be placed into their room. That weakens the mental
model for the simulation and makes orientation mistakes more likely.

The upload step needs to show the selected sofa render before the room photo is
submitted and must explicitly guide the visitor to photograph the room from an
angle compatible with the selected visual position.

## Proposed Change

Screen 1 must include a prominent guidance area before upload submission. The
area shows:

- the selected public sofa render for the stored fabric and visual position
  when a render URL is available;
- a room-photo target area that becomes the selected room-photo preview after
  file preparation;
- the room-photo target as the only visible upload trigger, opening camera
  capture on touch devices and a regular file picker on desktop;
- an inline loading state inside the room-photo target while the selected photo
  is prepared locally or uploaded;
- a visual relationship between the sofa render and the room-photo target;
- a short orientation instruction that names the selected visual position and
  tells the visitor to photograph the room from a compatible direction;
- the existing geometry-specific guidance for back-wall and corner sofas.

The guidance area must use public catalog render URLs only. It must not expose
private storage paths or signed in-home simulation artifact URLs.

## Acceptance Criteria

- Screen 1 displays the selected sofa render, fabric, and visual position before
  the visitor chooses a room photo.
- Screen 1 displays a room-photo target next to the selected sofa render and
  replaces that target with the prepared room-photo preview after selection.
- Screen 1 uses the room-photo target itself as the visible upload trigger and
  does not need separate visible upload buttons below the guidance area.
- Screen 1 displays a loading state inside the room-photo target while the
  browser prepares or uploads the selected image.
- Screen 1 includes visitor-facing orientation guidance tied to the selected
  visual position.
- The simulation entry route chooses the render matching the stored fabric and
  visual-position selection.
- Existing upload, HEIC fallback, retry, and geometry disclaimer behavior remain
  unchanged.
