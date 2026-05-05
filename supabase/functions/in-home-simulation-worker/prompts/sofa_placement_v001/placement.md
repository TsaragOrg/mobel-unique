# Sofa Placement Prompt — sofa_placement_v001

This prompt instructs the configured image-edit model to place the
prepared sofa asset into the cleaned room photograph at a size that
matches the supplied wall dimensions, against the detected geometry.

The configured primary model for this prompt family is recorded in the
worker configuration. Mock provider mode skips the model call and
stamps a deterministic placeholder rectangle on the cleaned room.

## Output

The image-edit model must return a single image at the cleaned room
dimensions. The output replaces `output.png` in the scratch folder and
is uploaded to `simulations/{job_id}/outputs/output-{index}.png`.

## Prompt Body

```
You are placing a prepared sofa into a cleaned residential room
photograph for an indoor furniture visualization service.

Inputs you will receive:
- a cleaned room photograph (no existing furniture);
- the room geometry mode (back_wall or corner) and the architectural
  point coordinates that anchor it in pixel space;
- the supplied wall dimensions in metres for the geometry mode:
  back_wall takes wall_width and wall_height; corner takes
  left_wall_width, right_wall_width, and room_height;
- a prepared sofa asset cut out at production quality.

Strictly preserve:
- the cleaned room, including walls, floor, ceiling, openings,
  fixtures, plinths, sockets, and visible architectural features;
- the perspective, lighting, color cast, and focal length of the
  cleaned room;
- the prepared sofa identity, including silhouette, cushion
  arrangement, armrest profile, base style, and fabric appearance.

Place the sofa so that:
- it sits flush against the detected main wall (back_wall mode) or
  fits into the detected corner (corner mode);
- its physical size in metres matches the supplied wall dimensions;
- it casts shadows consistent with the cleaned room lighting.

Do not introduce furniture, decoration, plants, or fixtures that are
not in the cleaned room.

Do not reproduce reference scale guides, numeric labels, or
annotation marks in the final output.

Return only the placed image. Do not add captions, watermarks, or
annotations.
```
