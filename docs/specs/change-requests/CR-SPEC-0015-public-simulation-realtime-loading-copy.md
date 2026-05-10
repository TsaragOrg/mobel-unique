# CR-SPEC-0015 Public Simulation Realtime Loading Copy

Target spec ids: SPEC-0015
Related spec ids: SPEC-0007
Status: accepted
Implementation Plans: PLAN-0068

## Reason For Change

The public continuation page already observes visitor-safe Realtime progress,
but it previously used those events only to refresh the signed HTTP status
payload. The loading screens therefore stayed generic during room preparation
and placement even when safe step metadata was available.

Using the Realtime progress step key and ordinal for copy makes the waiting
state clearer without exposing worker internals or signed URLs.

## Proposed Change

When the continuation page receives a `simulation_public_progress` Realtime
payload for the current job, it may keep the latest payload in local state and
derive visitor-safe loading copy from:

- `progress_step_key`;
- `progress_step_ordinal`;
- `progress_total_steps`;
- the public job `status`.

The UI must still use the signed HTTP status endpoint for guide and result URLs.
Realtime is only the progress observation layer.

## Acceptance Criteria

- Room preparation loading copy can change for `room_validation`,
  `room_cleaning`, `room_corners`, and `awaiting_dimensions` progress keys.
- Placement loading copy can change for the `placement_generation` progress key.
- Step ordinal text is shown only when both ordinal and total are available.
- Fallback loading copy remains available when Realtime is unavailable or has
  not emitted progress yet.
- The continuation page still refreshes the signed status payload when Realtime
  progress arrives.
