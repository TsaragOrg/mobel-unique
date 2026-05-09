# PLAN-0073 Public Simulation Result Download

Plan: PLAN-0073
Spec: SPEC-0015
Related change requests:

- CR-SPEC-0015-public-simulation-result-download

Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/specs`
- `docs/roadmap`

## Goal

Add a controlled download action to the public in-home simulation result screen
without exposing signed result URLs as visible links or adding sharing behavior.

## Current State

The result screen showed the generated image, regeneration action, return link,
limit state, and retention notice. Visitors could inspect the image but could
not download it directly from the UI.

## Target Behavior

- Show a "Download image" button on Screen 5.
- Fetch the signed latest result image and create a temporary object URL for the
  download.
- Avoid rendering a persistent anchor whose `href` is the signed result URL.
- Show a submitting label while the download is being prepared.
- Show a small inline error if the download fails.
- Keep regeneration, limit, result refresh, and retention behavior unchanged.

## Workstreams

### 1. Spec And Planning

- [x] Add the accepted change request for result download.
- [x] Update `SPEC-0015` Screen 5 requirements and forbidden behavior.
- [x] Update the web roadmap.

### 2. Test Coverage

- [x] Add component coverage proving the download action is a button rather
      than a signed-URL link.
- [x] Add component coverage for the download submitting state and failure
      notice.
- [x] Keep existing result, regeneration, limit, and retention tests passing.

### 3. Implementation

- [x] Add result-download copy.
- [x] Add a Screen 5 download button and client-side blob download helper.
- [x] Add neutral action-panel styling for the new button.

### 4. Verification

- [x] Run focused Screen 5 tests.
- [x] Run web typecheck.
- [x] Run `pnpm spec:check`.

## Regression Risks

- Fetching a signed result URL for download depends on storage CORS behavior.
  Failures must surface as an inline error without breaking result viewing.
- The download control must not accidentally render the signed URL in a link
  attribute.
- The new download state must not interfere with regeneration submission.

## Closure Notes

Screen 5 now includes a controlled download button that fetches the signed
latest result image, creates a temporary object URL, and triggers a local file
download. The signed URL is not rendered as a download link, and failures show a
small inline error while the current result remains visible.
