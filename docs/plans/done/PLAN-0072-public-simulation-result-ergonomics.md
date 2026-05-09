# PLAN-0072 Public Simulation Result Ergonomics

Plan: PLAN-0072
Spec: SPEC-0015
Related change requests:

- CR-SPEC-0015-public-simulation-result-ergonomics

Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/specs`
- `docs/roadmap`

## Goal

Improve the final public in-home simulation result screen so visitors can
inspect the generated room image while keeping the available actions visible and
clear.

## Current State

The result screen rendered a heading, the signed result image, actions below the
image, and the retention notice. It was functionally correct but visually
linear, and on larger screens it did not use horizontal space to keep actions
near the result.

## Target Behavior

- Pair the signed result image and action area inside one responsive workspace.
- Keep the result image large and inspectable.
- Place a compact action panel beside the image on desktop.
- Stack image and actions cleanly on mobile.
- Show the generation count against the public three-result cap.
- Show a submitting label while a regeneration request is in progress.
- When regeneration is unavailable, keep the button absent and show the limit
  state.
- Keep existing signed URL refresh, regeneration request, inline failure notice,
  and retention behavior intact.

## Workstreams

### 1. Spec And Planning

- [x] Add the accepted change request for result-screen ergonomics.
- [x] Update `SPEC-0015` Screen 5 requirements.
- [x] Update the web roadmap.

### 2. Test Coverage

- [x] Add component coverage for the compact action panel metadata.
- [x] Add component coverage for the regeneration submitting label.
- [x] Keep existing result image, regeneration, limit, failure, and retention
      tests passing.

### 3. Implementation

- [x] Pass the generated output count from the continuation status payload into
      Screen 5.
- [x] Restructure Screen 5 around a result image plus compact action panel.
- [x] Add the generation count and regeneration-limit notice.
- [x] Add responsive CSS for desktop and mobile result layouts.

### 4. Verification

- [x] Run focused Screen 5 tests.
- [x] Run web typecheck.
- [x] Run `pnpm spec:check`.

## Regression Risks

- Passing the generated count through the continuation page could break existing
  Screen 5 rendering if a status payload is incomplete.
- Moving actions into a side panel could make mobile actions less discoverable
  if the result image is too tall.
- Changing the regeneration button label during submission must not break the
  existing request behavior.

## Closure Notes

Screen 5 now renders the signed result image and compact action panel inside one
responsive workspace. Desktop keeps actions beside the result image, mobile
stacks the same content with bounded image height, and the panel shows the
generation count, regeneration limit state, retention notice, and inline
failure notice without changing the underlying job behavior.
