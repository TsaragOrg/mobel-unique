# CR-SPEC-0012 Public Sofa Detail Medium Image Delivery

Target spec id: SPEC-0012
Status: accepted
Implementation Plans: PLAN-0082

## Reason For Change

Production performance audit priority 1 found that the public sofa detail page
loads the selected sofa render from `render_original_url` directly in the normal
page layout. A mobile detail trace observed a 1.9 MB PNG render asset being
loaded for ordinary browsing.

The existing catalog image variant contract already exposes both medium and
original public render URLs. The page should use those fields by visual purpose:
medium for the normal detail image, original only when the visitor explicitly
opens the large image viewer.

## Proposed Change

Update the SPEC-0012 public sofa detail behavior for render delivery size:

- the selected render shown inside `/sofas/{slug}` must use
  `render_medium_url`;
- the full-screen sofa image viewer must continue to use
  `render_original_url`;
- changing fabric or visual position must update both URLs for the new selected
  render;
- the page must not fall back to the original image for the normal inline detail
  image when a medium URL is available;
- unavailable or failed inline images must still show the existing safe public
  unavailable state instead of a broken image;
- the API response shape does not need to change because `render_medium_url` and
  `render_original_url` are already present.

## Impact

- Plans: add a focused web implementation plan for public sofa detail image
  delivery.
- Tests: update public sofa detail page tests so the inline page image uses
  `render_medium_url` and the large image viewer uses `render_original_url`.
- Roadmaps: update the web roadmap after implementation.
- API, database, worker, Supabase storage, environment variables: no change.
- UI: no visible layout change is intended; this only changes which image bytes
  the browser loads before the visitor opens the large viewer.

## Acceptance Criteria

- The normal selected image in `/sofas/{slug}` requests the medium render URL.
- Opening the large image viewer requests the original render URL.
- Fabric and visual position changes keep the normal page image on medium
  delivery and the viewer image on original delivery.
- Public sofa detail tests fail before the implementation and pass after it.
- The implementation keeps private paths, service credentials, and internal
  render details out of browser-visible output.

## Approval Note

Accepted from the 2026-05-12 production performance audit priority list.
