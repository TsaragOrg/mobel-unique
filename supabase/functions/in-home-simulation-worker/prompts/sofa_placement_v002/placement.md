# Sofa Placement Prompt — sofa_placement_v002

This prompt instructs `gpt-image-2` to place the customer-selected
sofa into the cleaned room photograph at the correct real-world scale,
either centered on the back wall (back_wall mode) or in the inner
corner (corner mode).

## Why v002

`sofa_placement_v001/placement.md` only supported back_wall mode and
used a short, ambiguous prompt. Live testing on 2026-04-29 with an
L-shaped corner sofa showed v001 ignored corner geometry. v002 adds
corner mode with explicit anchoring rules and uses the long, scale-
locked prompt template that the live-harness validated.

## Inputs

- INPUT IMAGE 1: cleaned room photograph (no movable furniture).
- INPUT IMAGE 2: prepared sofa photo (raw photo from catalog or
  customer upload; backgrounds are removed by the model).
- Real-world dimensions in metres:
  - back_wall: room_width, room_height, room_depth (optional);
    sofa_width, sofa_height. Sofa depth is NOT used.
  - corner: wall_left, wall_right, wall_height, room_depth (optional);
    sofa_left, sofa_right, sofa_height. Sofa depth is NOT used.

## Output

A single photorealistic PNG at the cleaned-room dimensions. Replaces
`output.png` in the scratch folder and is uploaded to
`simulations/{job_id}/outputs/output-{index}.png`.

## back_wall mode

```
You are creating a photorealistic interior image edit from two
reference images.

INPUT IMAGE 1 = ROOM BASE PHOTO. Use this image as the locked scene
to edit in place. Preserve the same camera position, lens feel,
perspective, crop, room architecture, floor, walls, ceiling, lighting
direction, color temperature, visible objects, and shadows except
where the sofa must naturally occlude the scene.

INPUT IMAGE 2 = SOFA REFERENCE. Use this image only as the sofa to
insert into the room. Preserve the sofa design, proportions,
upholstery, color, visible legs/base, arms, cushions, backrest, seams,
softness, and material feel. Remove the sofa's original background,
floor, room, lighting setup, camera angle, and any unrelated objects
from input image 2.

REAL-WORLD DIMENSIONS:
- Room width: {{ROOM_WIDTH}} {{UNIT}}
- Room height: {{ROOM_HEIGHT}} {{UNIT}}
- Room depth: {{ROOM_DEPTH}} {{UNIT}}
- Sofa real width: {{SOFA_WIDTH}} {{UNIT}}
- Sofa real height: {{SOFA_HEIGHT}} {{UNIT}}
- Sofa / room-width ratio: {{SOFA_TO_ROOM_WIDTH_PERCENT}}%
- Sofa / room-height ratio: {{SOFA_TO_ROOM_HEIGHT_PERCENT}}%

PLACEMENT INTENT: Place the sofa centered against the back wall.

Place the sofa at a physically plausible size using the real sofa
width and height compared with the room width, height, and depth.
Visible width should occupy approximately
{{SOFA_TO_ROOM_WIDTH_PERCENT}}% of the real room width, adjusted only
for perspective. Visible height should be consistent with
{{SOFA_TO_ROOM_HEIGHT_PERCENT}}% of the real room height, adjusted
for perspective and floor position.

Keep the sofa fully supported by the floor with all visible legs/base
touching the floor in correct perspective. Maintain realistic
clearance from walls and existing room elements.

Match the room perspective, vanishing points, lighting direction,
shadow softness, and color temperature. Add natural contact shadows
under and behind the sofa. Apply correct occlusion where the sofa
sits in front of room elements.

Do not redesign the room. Do not change the room dimensions, camera,
crop, wall/floor perspective, or architectural layout. Do not change
the sofa design, color, material, cushion count, arms, legs,
silhouette, or proportions from input image 2. Do not copy the sofa
reference background into the room. Do not add text, labels, logos,
watermarks, extra furniture, or decorative objects not required by
the placement.

Return one final photorealistic image: the same room from input
image 1, with the sofa from input image 2 realistically placed in
the room at the correct real-world scale.
```

## corner mode

```
You are creating a photorealistic interior image edit from two
reference images. (Same INPUT IMAGE 1 / INPUT IMAGE 2 rules as
back_wall mode.)

REAL-WORLD DIMENSIONS for an L-shaped corner sofa:
- Left wall length: {{WALL_LEFT}} {{UNIT}}
- Right wall length: {{WALL_RIGHT}} {{UNIT}}
- Wall height: {{WALL_HEIGHT}} {{UNIT}}
- Room depth: {{ROOM_DEPTH}} {{UNIT}}
- Sofa LEFT side length: {{SOFA_LEFT}} {{UNIT}} (along the left wall,
  fills {{SOFA_TO_LEFT_PERCENT}}% of it)
- Sofa RIGHT side length: {{SOFA_RIGHT}} {{UNIT}} (along the right
  wall, fills {{SOFA_TO_RIGHT_PERCENT}}% of it)
- Sofa height: {{SOFA_HEIGHT}} {{UNIT}}

PLACEMENT INTENT: This is an L-shaped CORNER SOFA. Place it inside
the inner architectural corner of the room where the LEFT and RIGHT
walls meet. The LEFT side of the sofa ({{SOFA_LEFT}} {{UNIT}}) must
run flush against the LEFT wall. The RIGHT side of the sofa
({{SOFA_RIGHT}} {{UNIT}}) must run flush against the RIGHT wall. The
inner corner of the sofa must sit exactly at the inner architectural
corner of the room (where the two walls join the floor). Both
straight sides of the sofa must touch their walls along their entire
length. Visible base/legs/feet of the sofa rest on the floor with
correct perspective.

Do NOT center the sofa against a single wall and do NOT place it
floating away from the corner.

Match the room perspective, vanishing points, lighting direction,
shadow softness, and color temperature. Add natural contact shadows
under and behind the sofa. Apply correct occlusion where the sofa
sits in front of room elements.

Do not redesign the room or change camera, crop, or architectural
layout. Do not change the sofa design, color, material, cushion
count, arms, legs, silhouette, or proportions from input image 2.
Do not copy the sofa reference background into the room. Do not add
text, labels, logos, watermarks, extra furniture, or decorative
objects not required by the placement.

Return one final photorealistic image: the same room from input
image 1, with the L-shaped sofa from input image 2 realistically
placed in the room corner at the correct real-world scale.
```
