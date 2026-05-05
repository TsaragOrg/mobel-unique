# CR-SPEC-0012 Home Transformation Hero

Target spec id: SPEC-0012

## Reason For Change

The public home page needs a new visual direction based on a reference layout:
a minimal editorial simulation page where the first viewport focuses on one
sofa, a room-photo upload cue, and a fabric transformation video that starts on
green fabric and ends on white fabric.

## Proposed Change

Keep the existing SPEC-0012 home-page requirements, including French public
copy, the catalog CTA path, Shopify separation, and concise AI limitation
messaging. Update the home-page visual treatment to:

- use the newly provided green-to-white sofa transformation video as the primary
  hero asset;
- show a product-first desktop layout with copy, process steps, and a floating
  upload cue;
- show the sofa transformation before the copy on mobile;
- keep the simulation benefit strip visible below the first hero flow;
- avoid cart, checkout, account, price, stock, or admin surfaces.

## Impact

- Plans: add a web implementation plan for the home redesign.
- Tests: update the home-page rendering test for the new copy, video asset, and
  upload cue.
- Roadmaps: update the web roadmap with the completed home redesign.
- API, database, worker: no change.
- UI: replace the existing landscape phone-frame home page with the new
  transformation hero design.

## Approval Note

Requested by product design during implementation on 2026-05-02.
