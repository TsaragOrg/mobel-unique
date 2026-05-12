# CR-SPEC-0010 Public Catalog CDN Cache

Target spec id: SPEC-0010
Related spec ids: SPEC-0012, SPEC-0004
Status: accepted
Implementation Plans: PLAN-0085

## Reason For Change

The 2026-05-12 performance audit priority list found that the public catalog
API responses are not cacheable. The public catalog route files use
`force-dynamic`, and the shared public catalog response helper sends
`Cache-Control: no-store` for every response.

Production traces already showed visible public catalog API cost:

- `GET /api/public/catalog?limit=12` took about 544 ms on desktop.
- `GET /api/public/catalog/tags` took about 1,100 ms on desktop.

The list and tag responses contain only published visitor-safe catalog data.
They can tolerate a short publication-delay window if the business accepts that
new catalog edits may not be visible immediately to public visitors.

## Proposed Change

Make successful public catalog list and tag responses cacheable by shared CDN
caches for one hour:

```http
Cache-Control: public, s-maxage=3600, stale-while-revalidate=300
```

This means:

- shared caches may serve a fresh catalog list or tag response for 3,600
  seconds;
- shared caches may briefly serve stale data for up to 300 seconds while they
  refresh in the background;
- browser-private long-term caching is not required;
- validation errors, unavailable errors, and unexpected server errors remain
  `Cache-Control: no-store`.

Keep `GET /api/public/sofas/{slug}` on `no-store` in this plan. Sofa detail
currently carries public price and availability behavior that may need immediate
visibility after admin edits. Detail caching can be revisited only after a
separate business decision accepts the same stale-data window for detail pages.

The implementation should keep the current dynamic Next.js route handlers and
set explicit response headers. It should not move catalog reads to static route
generation, because the public catalog still comes from Supabase-backed runtime
data.

## Impact

- API: successful `GET /api/public/catalog` and
  `GET /api/public/catalog/tags` responses become CDN-cacheable.
- API: public sofa detail, 4xx responses, and 5xx responses stay uncacheable.
- Web UI: no UI change is required.
- Database: no schema migration is required.
- Security: cached responses must still expose only published visitor-safe data
  and must not expose private paths, signed private URLs, internal names, stack
  traces, or service-role data.
- Tests: route-handler coverage must assert the cache policy for list/tags and
  `no-store` for errors/detail.
- Roadmaps: update `docs/roadmap/web.md` and `docs/roadmap/workflow.md` after
  implementation.

## Acceptance Criteria

- `GET /api/public/catalog?limit=12` returns
  `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300` on a
  successful response.
- `GET /api/public/catalog/tags` returns
  `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300` on a
  successful response.
- `GET /api/public/sofas/{slug}` keeps `Cache-Control: no-store`.
- Public catalog validation errors keep `Cache-Control: no-store`.
- Unknown errors keep `Cache-Control: no-store`.
- Public catalog responses still do not expose private paths, signed private
  URLs, internal names, stack traces, or service-role data.
- The plan documents that catalog list/tag updates may be delayed by up to one
  hour, plus a short stale-while-revalidate refresh window.
- Focused route-handler tests fail before implementation and pass after the
  change.

## Approval Note

Accepted from the 2026-05-12 performance-audit priority 4 decision. This is a
narrow public API cache-policy change for catalog list and tag reads, not a data
model change and not a UI workflow change.
