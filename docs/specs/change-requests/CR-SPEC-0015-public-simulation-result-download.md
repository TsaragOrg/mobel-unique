# CR-SPEC-0015 Public Simulation Result Download

Target spec ids: SPEC-0015
Related spec ids: SPEC-0007
Status: accepted
Implementation Plans: PLAN-0073

## Reason For Change

The public in-home simulation result screen needs a direct way for visitors to
keep the generated image locally during the 24-hour retention window. The
original spec forbade download actions to avoid exposing signed artifact URLs or
turning the MVP into a sharing workflow. The product direction now allows a
controlled download of the latest result image only.

## Proposed Change

Screen 5 may include a "Download image" action for the signed latest result.
The action must be implemented as a button that downloads the already authorized
image through browser-side blob/object URL handling. It must not render a
visible download link whose `href` is the signed result URL, and it must not add
share or long-term save behavior.

## Acceptance Criteria

- Screen 5 shows a download button for the latest result image.
- The download action uses the signed latest result URL only to fetch the image
  bytes for the current visitor session.
- The DOM does not render a download link pointing at the signed URL.
- The button shows a submitting state while the browser prepares the download.
- A failed download shows a small inline error without hiding the previous
  result.
- Share controls, long-term save actions, and visible signed URLs remain
  forbidden.
