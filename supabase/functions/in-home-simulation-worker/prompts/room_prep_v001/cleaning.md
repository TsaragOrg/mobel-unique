# Room Cleaning Prompt — room_prep_v001

This prompt instructs the configured image-edit model to remove the
existing furniture from the customer room photograph while preserving
geometry, openings, fixtures, and lighting.

The configured primary model for this prompt family is recorded in the
worker configuration. Mock provider mode returns the input image
unchanged and does not call this prompt.

## Output

The image-edit model must return a single image of the same dimensions
as the input. The output replaces `room_cleaned.png` in the scratch
folder and is uploaded to the job's `room_cleaned_path`.

## Prompt Body

```
You are editing a residential room photograph for an indoor furniture
visualization service. Remove every visible piece of moveable furniture
from the room: sofas, chairs, tables, ottomans, shelving, lamps, beds,
mattresses, rugs, plants, screens, decorations, and removable items.

Strictly preserve:
- the exact wall, floor, and ceiling layout;
- doors, windows, radiators, plinths, electrical sockets, vents, and
  any other architectural fixtures attached to the structure;
- the original lighting, color cast, perspective, and focal length;
- any hard-mounted built-ins such as kitchens, fitted wardrobes, or
  fireplaces.

Do not introduce new furniture, decoration, fixtures, or text.

Return only the edited photograph. Do not add captions, watermarks, or
annotations.
```
