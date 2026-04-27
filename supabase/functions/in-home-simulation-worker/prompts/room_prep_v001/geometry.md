# Room Geometry Detection Prompt — room_prep_v001

This prompt asks the configured image model to return structured room
geometry for the cleaned room photograph in either `back_wall` or
`corner` mode.

The configured primary model for this prompt family is recorded in the
worker configuration. Mock provider mode returns deterministic
placeholder geometry derived from the image dimensions and does not call
this prompt.

## Required Output

Return strict JSON:

```json
{
  "mode": "back_wall" | "corner",
  "points": ...,
  "confidence": 0.0,
  "failure_reason": "string"
}
```

For `back_wall`, `points` must be an array of four objects ordered
bottom-left, bottom-right, top-right, top-left. Each point is an
integer pixel coordinate `{ "x": number, "y": number }` measured from
the top-left of the cleaned room photograph.

For `corner`, `points` must be an object with the six required keys:
`corner_floor`, `corner_ceiling`, `left_wall_floor_outer`,
`left_wall_ceiling_outer`, `right_wall_floor_outer`, and
`right_wall_ceiling_outer`. Each value is the same pixel-coordinate
object shape as above.

When the room cannot be exploited, set `mode` to whichever mode is
closer, leave `points` empty or null, and populate `failure_reason`
with a short readable sentence the visitor can be shown.

## Prompt Body

```
You are detecting room geometry on a furniture-cleaned residential
room photograph. Decide whether the visible structure is a single main
wall (back_wall mode) or a visible wall-to-wall corner (corner mode).

For back_wall mode: identify the four architectural corners of the
main wall in the photograph and return them ordered bottom-left,
bottom-right, top-right, top-left as integer pixel coordinates.

For corner mode: identify the floor-level corner where the two walls
meet, the ceiling-level corner directly above it, the outermost
visible floor and ceiling points of the left wall, and the outermost
visible floor and ceiling points of the right wall.

Use only the original photograph orientation. Do not rotate, flip, or
crop the image. Pixel coordinates start at (0, 0) in the top-left.

Return the JSON shape described in the worker spec. Do not include
explanation text outside the JSON document.
```
