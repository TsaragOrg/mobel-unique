# Scene Classifier Prompt — room_prep_v002

This prompt is used by the dedicated GPT-5 vision JSON classifier that
decides whether the cleaned room photo is a flat back-wall view or an
inner-corner view, before the corners step picks 4 vs 6 dots.

## Why this step exists

`gpt-image-2` (the corners model) is unreliable at deciding 4 vs 6 dots
from the photo alone — it leans toward 6 dots even when the room is a
flat back wall. Routing the decision through GPT-5 vision in JSON is
reliable and cheap (a single small text response).

## Output

Strict JSON of shape:

```
{
  "mode": "back_wall" | "corner",
  "confidence": number (0..1),
  "reason": string
}
```

## Prompt Body

System message:

```
You are classifying a residential room photograph for a furniture
placement service. Reply with strict JSON of shape
{"mode": "back_wall"|"corner", "confidence": number, "reason": string}.
```

User message:

```
Decide ONE of three cases for this room photograph. The decision is
based on the CENTRAL 30% of the image width — the vertical strip from
35% to 65% of the frame width. Mentally draw two vertical lines at
X=35% and X=65% and only look at what is between them.

CASE B — corner: anywhere INSIDE the central 30% strip there is a
vertical architectural seam where TWO walls meet at an inner corner —
a vertical line that runs from floor to ceiling where the room's two
walls join. The seam does NOT have to be at the exact center; if it
is anywhere between X=35% and X=65%, choose corner. The two walls do
NOT need to be equally wide on screen — one can dominate the frame
and the other can be smaller. If you can see such a seam in the
central 30% strip, choose corner.

CASE A — back_wall: the central 30% strip is fully a flat wall
surface, with NO vertical wall-meeting seam inside it. A side-wall
sliver visible only OUTSIDE the central strip does NOT make it a
corner case.

CASE C — reshoot: the photo cannot be used. Too dark, heavily
tilted, walls blocked, back wall cut off, cannot distinguish floor
from wall, aimed at floor or ceiling — choose reshoot.

DECISION ORDER:
1. Vertical wall-meeting seam inside the central 30% strip → corner.
2. Central 30% strip is flat wall, no inner seam → back_wall.
3. Cannot tell, blocked, or photo unusable → reshoot.

Tie-breakers:
- A seam visible only outside the central 30% strip is NOT a corner.
- If a seam is on the edge of the central strip and you are unsure,
  prefer corner.

Return strict JSON with mode, confidence (0-1), and a short reason
that names whether a seam is visible inside the central 30% strip
and approximately at what X position.
```
