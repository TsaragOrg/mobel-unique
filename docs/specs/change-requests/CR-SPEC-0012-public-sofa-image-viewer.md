# CR-SPEC-0012 Public Sofa Image Viewer

Target spec id: SPEC-0012

## Reason For Change

The public sofa detail page currently shows the selected sofa render inside the
page layout. On mobile, visitors who want to inspect the sofa closely must zoom
the whole browser page, which also enlarges price, dimensions, controls, and
navigation. This creates friction on the mobile-first public catalog flow.

## Proposed Change

Keep the existing public sofa detail requirements from SPEC-0012 and add a
mobile-first image viewer for the selected sofa render:

- clicking or tapping the selected sofa image opens a full-screen viewer;
- the viewer uses a dark backdrop so the sofa is easy to inspect;
- the selected render is shown as large as possible without cropping;
- the viewer can be closed with a visible close control, backdrop click, or the
  Escape key;
- the viewer contains no plus/minus zoom controls;
- changing fabric or visual position closes the viewer and keeps the page on the
  newly selected render;
- unavailable or failed images do not open the viewer.

## Impact

- Plans: add a focused web implementation plan for the public sofa detail image
  viewer.
- Tests: update the public sofa detail page test for opening and closing the
  viewer.
- Roadmaps: update the web roadmap after implementation.
- API, database, worker, Supabase storage, environment variables: no change.
- UI: add a public detail image viewer while preserving the existing catalog,
  simulation, Shopify, price, dimensions, and selector behavior.

## Approval Note

Requested during public catalog UX refinement on 2026-05-06.
