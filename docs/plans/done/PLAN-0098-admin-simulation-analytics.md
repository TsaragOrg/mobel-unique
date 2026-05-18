# PLAN-0098 Admin Simulation Analytics

Plan: PLAN-0098
Spec: SPEC-0021
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/specs`
- `docs/plans`
- `docs/roadmap/web.md`

## Objective

Add a protected admin analytics dashboard that lets administrators review
simulation interest by sofa, fabric, and sofa-fabric combination without
reintroducing retained leads, visitor identity, room photos, generated customer
outputs, storage paths, signed URLs, or technical identifiers.

## Scope

- Promote and register `SPEC-0021` as the accepted replacement direction for
  the removed simulation leads surface.
- Add a server-side admin analytics store derived from
  `in_home_simulation_jobs`.
- Add a first-party protected `GET /api/admin/simulation-analytics` endpoint.
- Add `/admin/analytics` with admin shell navigation and a dashboard card.
- Add period controls for `7d`, `30d`, and `all`.
- Add a shared sort control for `most` and `least`.
- Show summary metrics, sofa rankings, fabric rankings, and combination
  rankings.
- Keep browser responses limited to display labels and aggregate counts.

## Out Of Scope

- Lead rows, lead deletion, CRM workflow, or contact management.
- Customer room photos, generated customer room results, previews, storage
  paths, or signed URLs.
- Custom date ranges, charts, CSV export, per-user drilldown, or worker changes.
- Database migrations unless query plans later show a need for a dedicated
  `created_at` index.

## Tasks

- [x] Register `SPEC-0021` and make it the accepted analytics replacement for
      the removed lead dashboard direction.
- [x] Add aggregation tests for period filtering, status inclusion, summary
      counts, rankings, sorting, fallback labels, and response privacy.
- [x] Add a server-side analytics store and protected route handler.
- [x] Add API route-handler tests for authorization, validation, safe failures,
      and aggregate-only responses.
- [x] Add the protected `/admin/analytics` page, dashboard card, shell
      navigation item, and responsive admin styles.
- [x] Add admin page tests for access checks, default query loading, filter
      changes, empty states, safe errors, and dashboard entry.
- [x] Update `docs/roadmap/web.md`.

## Tests

- `corepack pnpm --filter @mobel-unique/web test -- src/app/admin/AdminSimulationAnalyticsPage.test.tsx src/app/admin/AdminDashboard.test.tsx src/lib/admin-simulation-analytics.test.ts src/lib/admin-simulation-analytics-route-handlers.test.ts`
- `corepack pnpm --filter @mobel-unique/web typecheck`
- Browser verification of `/admin` and `/admin/analytics` at
  `http://localhost:3001` with mocked admin facade responses.

## Roadmap

Updated:

- `docs/roadmap/web.md`

## Completion Notes

- The admin simulation surface is analytics-only and does not restore retained
  lead, email, private image, signed URL, storage path, job id, session id, or
  catalog id exposure.
- No database migration was added; the initial implementation derives counts
  from retained `in_home_simulation_jobs` rows and current catalog labels.
