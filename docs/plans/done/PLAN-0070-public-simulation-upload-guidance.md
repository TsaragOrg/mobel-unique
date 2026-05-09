# PLAN-0070 Public Simulation Upload Guidance

Plan: PLAN-0070
Spec: SPEC-0015
Related change requests:

- CR-SPEC-0015-public-simulation-upload-guidance

Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/specs`
- `docs/roadmap`

## Goal

Improve the first public in-home simulation step so visitors understand which
selected sofa will be placed into their uploaded room photo and how the chosen
visual position constrains the room-photo angle.

## Current State

The upload screen displayed text context for the sofa, fabric, and visual
position, then asked for a room photo. It did not show the selected sofa render
inside the upload experience, so the relationship between the chosen sofa and
the requested room photo was weak.

## Target Behavior

- Show the selected sofa render for the stored fabric and visual position before
  the visitor uploads a room photo.
- Show a large room-photo target beside the sofa render and replace that target
  with the prepared room-photo preview after selection.
- Use the room-photo target as the only visible upload trigger.
- Show preparation and upload loading feedback inside the room-photo target.
- Add concise orientation guidance that names the selected visual position and
  asks the visitor to photograph the room from a compatible direction.
- Keep existing upload, HEIC fallback, retry, and geometry disclaimer behavior
  intact.

## Workstreams

### 1. Spec And Planning

- [x] Add the accepted change request for upload guidance.
- [x] Update `SPEC-0015` Screen 1 requirements and acceptance criteria.
- [x] Register this plan in the active plans index and web roadmap.

### 2. Test Coverage

- [x] Add a component test proving Screen 1 renders the selected sofa render,
      room-photo target, and orientation copy before upload.
- [x] Add a route-entry test proving the matching selected render is passed from
      the public sofa detail payload into Screen 1.
- [x] Keep existing upload and HEIC tests passing.

### 3. Implementation

- [x] Resolve the selected render from stored fabric and visual-position
      selection in the simulation entry component.
- [x] Pass public render preview metadata into Screen 1.
- [x] Replace the disconnected upload preview layout with a responsive guidance
      area that can show the sofa preview and the prepared room photo together.
- [x] Make the room-photo target the visible upload trigger and remove separate
      visible upload buttons.
- [x] Show an inline loading state in the room-photo target during local
      preparation and upload.
- [x] Add restrained CSS motion for the sofa-to-room relationship while
      respecting reduced-motion preferences.

### 4. Verification

- [x] Run focused web simulation tests.
- [x] Run web typecheck.
- [x] Run `pnpm spec:check`.
- [x] Run the full web test suite.

## Regression Risks

- Choosing the wrong render could show a different fabric or visual position
  than the one submitted to the job creation endpoint.
- Moving the room-photo preview could break HEIC fallback or the disabled state
  for the Continue button if the prepared-photo state is disturbed.
- The new visual area could make the upload step too tall on mobile, so the CSS
  must keep the action buttons reachable and avoid text overflow.

## Closure Notes

Implemented in `apps/web` by resolving the selected public catalog render in the
simulation entry component and rendering it in Screen 1 beside the room-photo
target. The upload preview now appears in that target area after preparation,
and the selected visual position drives the orientation guidance. The room-photo
target is the only visible upload trigger; the native camera and file inputs
remain hidden. The target also shows inline loading feedback during local
preparation and upload. Existing upload, HEIC, retry, and geometry behavior
remained covered by tests.
