# Corners Prompt — room_prep_v002

This prompt instructs `gpt-image-2` to place small bright yellow dots
at the architectural corners of the cleaned room. The number of dots is
4 (back_wall) or 6 (corner), chosen up-front by the scene classifier.

## Why v002

`room_prep_v001/geometry.md` used a JSON contract: GPT-5 vision was
asked to return `{mode, points, confidence}` as machine-readable
coordinates. Real-world testing on 2026-04-29 showed the JSON output
collapsed to a perfect axis-aligned rectangle that ignored real
perspective. Switching to image-edit dot placement (the model marks
the corners directly on the photo, then local code finds the dots) is
the validated approach.

## Output

The image-edit model must return a single annotated PNG with the
yellow dots placed and nothing else added. The output is consumed by
`lib/lines.ts` to detect the dots in pixel space and render the
dimension overlay.

## Prompt — back_wall mode

```
You are looking at a residential room photograph. Place small bright
yellow dots at the architectural corners of the room.

GENERAL RULE — how many dots:
- If the camera points flat at one wall (one main wall is visible in
  front of you), place EXACTLY 4 dots, one at each corner of that wall.
- If the camera points into a corner (you see two walls meeting at a
  vertical edge), place EXACTLY 6 dots.

THIS PHOTO is a flat back wall. You MUST place EXACTLY 4 dots. Not 3.
Not 5. Not 6. EXACTLY 4. Count out loud as you place them: 1, 2, 3, 4.
Stop. If you ever consider placing a 5th dot, do not. If you finish
with more than 4 dots, erase the extras until only 4 remain.

The 4 corners are the corners OF THE BACK WALL itself — the flat
surface the camera is facing. The back wall ENDS where it meets a side
wall. Place the dots EXACTLY on that meeting seam — the vertical line
where the back wall transitions into the side wall. Do NOT place a dot
further along the side wall. If you can still see the side wall
extending beyond your dot, the dot is too far — pull it back to the
seam.

- top-left: the seam where the back wall meets the LEFT side wall, at
  the CEILING.
- top-right: the seam where the back wall meets the RIGHT side wall,
  at the CEILING.
- bottom-left: the seam where the back wall meets the LEFT side wall,
  at the FLOOR.
- bottom-right: the seam where the back wall meets the RIGHT side
  wall, at the FLOOR.

A door, window, air conditioner, socket, switch, vent, or any other
object set into the wall does NOT end the wall. The back wall
continues past these objects until it physically meets the adjacent
perpendicular wall. The corner dot goes on that true architectural
meeting point, not on a door frame, not on a window frame, not on any
object.

Do not draw lines, arrows, shapes, numbers, labels, text, or any
other markings. Only the yellow dots.

Do not modify the photograph in any other way. Preserve the original
colors, lighting, and content.

Return only the annotated image.
```

## Prompt — corner mode

```
You are looking at a residential room photograph. Place small bright
yellow dots at the architectural corners of the room.

GENERAL RULE — how many dots:
- If the camera points flat at one wall (one main wall is visible in
  front of you), place EXACTLY 4 dots.
- If the camera points into a corner (you see two walls meeting at a
  vertical edge), place EXACTLY 6 dots.

THIS PHOTO is a corner — the camera points at where two walls meet.
You MUST place EXACTLY 6 dots. Not 5. Not 7. EXACTLY 6. Count out
loud as you place them: 1, 2, 3, 4, 5, 6. Stop. If you finish with
more than 6 dots, erase the extras until only 6 remain.

The 6 corners are:
- top of the inner vertical edge: where the LEFT wall, the RIGHT wall,
  and the CEILING all meet.
- bottom of the inner vertical edge: where the LEFT wall, the RIGHT
  wall, and the FLOOR all meet.
- left wall, top: at the EXTREME FAR END of the LEFT wall along the
  ceiling. Trace outward from the inner vertical edge toward the left
  side of the photo. Place the dot at the very LAST point where you
  can still see the left wall — either at a perpendicular wall meeting
  or at the photo edge, whichever happens FIRST.
- left wall, bottom: at the EXTREME FAR END of the LEFT wall along the
  floor (same procedure).
- right wall, top: at the EXTREME FAR END of the RIGHT wall along the
  ceiling (same procedure).
- right wall, bottom: at the EXTREME FAR END of the RIGHT wall along
  the floor (same procedure).

VERY IMPORTANT — common mistake to avoid: do NOT place the four outer
dots in the middle of a wall. They must be at the most extreme visible
end of each wall.

A door, window, air conditioner, socket, switch, vent, or any other
object set into a wall does NOT end the wall. The wall continues past
these objects until it physically meets an adjacent perpendicular
wall. The corner dot goes on that true architectural meeting point,
not on a door frame, not on a window frame, not on any object.

Do not draw lines, arrows, shapes, numbers, labels, text, or any
other markings. Only the yellow dots.

Do not modify the photograph in any other way. Preserve the original
colors, lighting, and content.

Return only the annotated image.
```
