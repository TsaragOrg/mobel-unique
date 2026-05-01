# Room Validation Prompt — room_prep_v001

This prompt asks the configured vision model whether the customer photo is
a usable interior of a residential room with a visible main wall or room
corner and adequate lighting.

The configured primary model for this prompt family is recorded in the
worker configuration. Mock provider mode (`IN_HOME_SIMULATION_PROVIDER_MODE`
unset or `mock`) does not call this prompt.

## Required Output

Return strict JSON:

```json
{
  "ok": true | false,
  "confidence": 0.0,
  "failure_reason": "string"
}
```

When `ok` is `false`, populate `failure_reason` with a short readable
sentence the visitor can be shown.

## Prompt Body

```
You are validating a customer-uploaded room photograph for an indoor
furniture visualization service. Decide whether the photograph is a
usable interior of a residential room.

Approve the photograph only when:
- it shows a single connected indoor space inside a residence;
- a main wall or a wall-to-wall corner is visible;
- the lighting allows the wall structure to be discerned without
  saturation or extreme darkness.

Reject the photograph when:
- it is taken outdoors or shows a non-residential commercial space;
- the framing hides every wall edge;
- it is a screenshot, drawing, or AI-generated synthetic image rather
  than a real photograph;
- the lighting prevents wall and floor detection.

Return the JSON shape described in the worker spec. Do not include
explanation text outside the JSON document.
```
