# Room Cleaning Prompt — room_prep_v002

This prompt instructs the configured image-edit model to remove movable
furniture from the customer room photograph without inventing any
elements that are not already visible in the input.

The configured primary model for this prompt family is `gpt-image-2`.
Mock provider mode returns the input image unchanged and does not call
this prompt.

## Why v002

`room_prep_v001` used the verb "preserve" in the spirit of "don't
touch what's already there". Real-world testing on 2026-04-29 showed
that `gpt-image-2` reads "preserve radiators" as "ensure radiators are
present in the output" and invents radiators that did not exist on the
input. The fix is to drop "preserve" entirely and use explicit
"DO NOT ADD" formulations with concrete examples.

## Output

The image-edit model must return a single image of the same dimensions
as the input. The output replaces `room_cleaned.png` in the scratch
folder and is uploaded to the job's `room_cleaned_path`.

## Prompt Body

```
You are editing a residential room photograph with two strict rules.

Rule 1 — REMOVE all movable items from the photo: sofas, chairs,
tables, ottomans, shelving, lamps, beds, mattresses, rugs, plants,
screens, decorations, and any other moveable items.

Rule 2 — DO NOT ADD anything that is not already visible in the input.
This is critical:
- If the input has no radiator, the output must have no radiator.
- If the input has no door on a wall, do not add a door.
- If the input has no window on a wall, do not add a window.
- Do not invent furniture, fixtures, decoration, text, or any
  architectural element.

Keep everything that already exists in the photo exactly as-is: the
same walls, floor, ceiling, openings, fixtures, lighting, color cast,
perspective, and focal length.

Return only the edited photograph, with no captions, watermarks, or
annotations.
```
