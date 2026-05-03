# CR-SPEC-0013 Admin Render Preview Proxy

Spec: SPEC-0013
Status: draft
Layer: domain
Parent Spec: SPEC-0013
Depends On: SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0014
Areas: web, api
Implementation Plans: PLAN-0054

## Traceability

`SPEC-0013` currently allows private render review images to use short-lived
signed URLs. Manual admin testing found that signed URLs can expire while the
sofa edit page remains open, leaving render thumbnails, current render previews,
candidate previews, and source comparison images broken until the admin refreshes
data.

This change request keeps the private storage boundary from `SPEC-0009` and the
first-party admin API boundary from `SPEC-0011`, but changes how the protected
admin UI displays private render images.

## Goal

Keep all private images shown inside the sofa edit Renders workflow visible for
the life of the open browser tab without exposing the private storage bucket or
using durable public URLs.

## Scope

- Add a protected first-party admin preview endpoint for private image assets.
- Let the admin frontend fetch render-related private images with the existing
  admin bearer token and trusted-device cookie.
- Display fetched images through browser-local object URLs.
- Apply the pattern to the Renders workflow:
  - current render thumbnails;
  - current render large preview;
  - render candidates;
  - source photo comparison images used from the Renders workflow.

## Out Of Scope

- Making `catalog-private-assets` public.
- Changing public catalog image URLs.
- Changing publication, unpublication, or public asset copy behavior.
- Changing signed upload URLs for admin uploads.
- Changing ZIP export signed download URLs.
- Adding a long-lived private CDN URL strategy.

## API

Add:

```text
GET /api/admin/storage-assets/{asset_id}/preview
```

Rules:

- The endpoint must require the existing admin authorization and trusted-device
  checks.
- The endpoint must only serve active private image assets from
  `catalog-private-assets`.
- The response must use `Cache-Control: no-store`.
- The response must not expose service-role keys, raw private object paths, or
  signed storage URLs.
- Missing, inactive, public, non-image, or unsupported assets should return a
  safe not-found response.

## Frontend Behavior

The Renders workflow should no longer use signed storage URLs for private image
display. It should:

1. collect private asset ids needed by visible render cells and candidate review;
2. fetch each asset through the protected preview endpoint;
3. create a browser-local object URL for each fetched image;
4. use that object URL in image elements;
5. revoke object URLs when they are no longer needed or when the page closes.

## Acceptance Criteria

- Leaving the Renders tab open longer than the former signed URL TTL does not
  break already loaded render images.
- Private render images are never fetched from direct Supabase signed URLs by the
  Renders UI.
- The private storage bucket remains private.
- Public catalog images remain unchanged.
- Tests cover the preview endpoint and the Renders UI object URL flow.
