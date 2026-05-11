# SPEC-0021 Admin Simulation Analytics

Spec: SPEC-0021
Status: draft
Layer: feature
Parent Spec: SPEC-0013
Depends On: SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0012, SPEC-0013, SPEC-0015, SPEC-0018, SPEC-0020
Areas: web, supabase
Implementation Plans: none yet

## Traceability

This spec defines a protected admin analytics dashboard for public in-home
simulation choices.

It follows:

- `SPEC-0015`, which creates public simulation jobs from a selected sofa,
  selected fabric, and selected visual position;
- `SPEC-0009`, which defines `in_home_simulation_jobs` and the selected
  catalog fields used for aggregation;
- `SPEC-0013`, which defines the protected admin shell and admin route
  patterns;
- `SPEC-0018`, which defines privacy boundaries for public simulation data;
- `SPEC-0020`, which defines the separate consent-backed lead dashboard.

This dashboard is intentionally separate from `/admin/leads`. Leads answer
which opted-in customers can be contacted. Analytics answers which sofas and
fabrics are most often chosen for simulations.

## Goal

Give administrators a simple production analytics view that helps decide:

- which sofas deserve more visual preparation, promotion, or business focus;
- which fabrics visitors most often choose;
- which sofa and fabric combinations are strongest.

The dashboard must stay focused and must not expose emails, visitor identity,
room photos, generated customer room results, storage paths, signed URLs, or
technical identifiers.

## Scope

This spec includes:

- a new protected admin analytics route, recommended as `/admin/analytics`;
- a dashboard entry point from `/admin`;
- an admin shell navigation item when it fits the current navigation layout;
- summary counts for the selected period;
- a sofa analytics table;
- a fabric analytics table;
- a sofa and fabric combination analytics table;
- period choices for last 7 days, last 30 days, and all time;
- default period of last 30 days;
- sort order for most simulations and least simulations;
- admin API endpoints under the first-party `/api/admin/*` facade;
- Supabase service-role-only read access through an RPC or equivalent
  server-side store.

## Out Of Scope

This spec does not include:

- email addresses;
- lead rows or lead deletion behavior;
- visitor names, phone numbers, notes, CRM stages, assignments, or contact
  workflow;
- private room photos;
- generated customer room result images;
- raw storage paths, signed URLs, internal job ids, session ids, consent ids,
  verification request ids, or Auth user ids in the admin UI;
- custom date range filters;
- charts;
- CSV export;
- per-user drilldown;
- worker behavior changes;
- new long-term retention of private simulation artifacts.

## Users And Permissions

Only an authorized administrator can access the analytics route and API.

Rules:

- public visitors cannot access the route or API endpoints;
- authenticated non-admin users must receive the same safe admin rejection
  behavior defined by `SPEC-0011`;
- admin browser code must call only first-party `/api/admin/*` endpoints;
- browser code must not call Supabase tables, Supabase Edge Functions, or
  worker-only functions directly;
- service-role credentials and storage paths must never be exposed to the
  browser.

## User Flow

1. A visitor starts a public in-home simulation.
2. The system creates an `in_home_simulation_jobs` row.
3. The job is counted for analytics immediately after creation.
4. The administrator opens `/admin`.
5. The administrator clicks the Analytics dashboard card.
6. The administrator lands on `/admin/analytics`.
7. The dashboard loads last 30 days by default.
8. The administrator can switch between last 7 days, last 30 days, and all
   time.
9. The administrator can sort each ranking by most simulations or least
   simulations.
10. The administrator reads the summary, sofa ranking, fabric ranking, and sofa
    plus fabric combination ranking.

## Analytics Rules

Analytics counts simulation interest at job creation time.

Rules:

- source rows are `in_home_simulation_jobs`;
- one `in_home_simulation_jobs` row counts as one simulation;
- a job counts as soon as it is created;
- all job statuses count, including queued, processing, awaiting dimensions,
  failed, expired, and succeeded;
- all simulation jobs count, whether the visitor accepted only the required
  simulation email consent or both the required consent and optional commercial
  contact consent;
- the dashboard must not require or read lead consent to count a job;
- all time means all retained `in_home_simulation_jobs` rows available to the
  admin analytics query;
- date periods use `in_home_simulation_jobs.created_at`;
- last 7 days and last 30 days are rolling periods ending at request time;
- sorting by most simulations orders larger counts first;
- sorting by least simulations orders smaller non-zero counts first;
- tied rows should use a stable secondary order by public display name.

## Admin UI

### Route

Recommended route:

- `/admin/analytics`

The route must use the protected admin shell, noindex metadata, and the
existing admin visual system.

### Dashboard Entry

The `/admin` dashboard should include a separate Analytics card.

The existing `/admin/leads` card remains unchanged and continues to be used for
consent-backed follow-up.

### Summary

The summary section shows:

- total simulations in the selected period;
- unique sofas simulated in the selected period;
- unique fabrics selected in the selected period.

The summary must not show private visitor data or technical ids.

### Period Controls

The dashboard supports exactly:

- last 7 days;
- last 30 days;
- all time.

Default:

- last 30 days.

Custom date ranges are intentionally excluded to keep the dashboard simple.

### Sorting

The dashboard supports:

- most simulations;
- least simulations.

The same selected sort order applies to the sofa table, fabric table, and
combination table.

### Sofa Table

The sofa table shows:

- sofa public name;
- simulation count;
- most selected fabric for that sofa in the selected period.

If a historical sofa label cannot be resolved from the current catalog, the UI
must show a safe fallback label such as `Archived sofa`.

### Fabric Table

The fabric table shows:

- fabric public name;
- simulation count.

If a historical fabric label cannot be resolved from the current catalog, the
UI must show a safe fallback label such as `Archived fabric`.

### Sofa And Fabric Combination Table

The combination table shows:

- sofa public name;
- fabric public name;
- simulation count.

This table is required because it directly answers which sofa and fabric
pairings visitors most often want to see.

### Empty And Error States

The dashboard must handle:

- no simulations in the selected period;
- no retained simulation rows at all;
- analytics API load failure;
- missing current catalog label for an archived sofa or fabric.

Errors must be safe and must not expose SQL errors, stack traces, provider
details, storage paths, service credentials, encryption details, internal ids,
or private visitor artifacts.

## Data Model

No new analytics event table is required for the initial design.

The source of truth is `in_home_simulation_jobs`:

- `id`;
- `selected_sofa_id`;
- `selected_fabric_id`;
- `selected_visual_matrix_column_id`;
- `created_at`;
- `status`.

The analytics query may join catalog tables only to return safe display labels:

- `sofas`;
- `fabrics`;
- optionally `visual_matrix_columns` if future analytics needs visual position
  ranking.

The implementation may add a read-optimization index on
`in_home_simulation_jobs.created_at` if query plans show that the existing
indexes are not enough for the period filters.

The implementation must not store or return:

- email values;
- email hashes;
- session access tokens;
- consent ids;
- verification request ids;
- room artifact paths;
- generated output paths.

## API

All endpoints are under the first-party admin facade and require admin
authorization.

Recommended endpoint:

- `GET /api/admin/simulation-analytics`

Query parameters:

- `period`: `7d`, `30d`, or `all`, default `30d`;
- `sort`: `most` or `least`, default `most`;
- `limit`: optional page size for each ranking, default determined by the
  implementation plan.

Recommended response shape:

```json
{
  "data": {
    "period": "30d",
    "sort": "most",
    "summary": {
      "total_simulations": 42,
      "unique_sofas": 8,
      "unique_fabrics": 12
    },
    "sofas": [
      {
        "sofa_name": "Canape Oslo",
        "simulation_count": 14,
        "top_fabric_name": "Tissu beige"
      }
    ],
    "fabrics": [
      {
        "fabric_name": "Tissu beige",
        "simulation_count": 19
      }
    ],
    "combinations": [
      {
        "sofa_name": "Canape Oslo",
        "fabric_name": "Tissu beige",
        "simulation_count": 9
      }
    ]
  },
  "meta": {}
}
```

The response must not include job ids, sofa ids, fabric ids, visual column ids,
session ids, consent ids, verification request ids, email values, email hashes,
storage paths, signed URLs, private room photos, or generated customer room
outputs.

## Worker Jobs

No worker behavior changes are required.

The worker must not write analytics rows. Analytics is derived from durable
simulation job rows created by the public simulation API path.

## Environment Variables

No new environment variables are required.

The admin analytics API may use the existing server-side Supabase service-role
environment variables already used by admin-only server code. No browser-exposed
environment variables are allowed for analytics access.

## Privacy And Retention

The dashboard shows aggregate business analytics only.

Rules:

- analytics counts must not depend on optional commercial contact consent;
- the dashboard must not show email or visitor identity data;
- the dashboard must not show customer room photos, generated customer room
  outputs, private storage paths, or signed URLs;
- existing 24-hour private artifact purge behavior remains unchanged;
- all time analytics can only count retained simulation job rows that still
  exist in the database;
- deleting a lead through `SPEC-0020` must not be required for analytics
  correctness, because analytics does not show lead identity.

## Testing Requirements

Implementation plans must add tests for:

- unauthorized visitors cannot access the analytics route or API;
- authenticated non-admin users cannot access the analytics route or API;
- default period is last 30 days;
- period `7d` uses job `created_at` in the last 7 days;
- period `30d` uses job `created_at` in the last 30 days;
- period `all` includes all retained simulation job rows;
- one created job counts as one simulation regardless of status;
- jobs count even when optional commercial contact consent was not granted;
- summary returns total simulations, unique sofas, and unique fabrics;
- sofa ranking groups by selected sofa and returns the most selected fabric for
  each sofa;
- fabric ranking groups by selected fabric;
- combination ranking groups by selected sofa plus selected fabric;
- most simulations sorting places larger counts first;
- least simulations sorting places smaller non-zero counts first;
- safe fallback labels appear for missing or archived catalog rows;
- responses do not expose job ids, catalog ids, session ids, consent ids,
  verification request ids, emails, email hashes, private room photos,
  generated outputs, storage paths, or signed URLs;
- API failures return safe admin error messages.

## Acceptance Criteria

- The admin dashboard links to a protected analytics dashboard.
- The analytics dashboard is separate from the simulation leads dashboard.
- The analytics dashboard loads last 30 days by default.
- The administrator can switch between last 7 days, last 30 days, and all time.
- The administrator can sort rankings by most simulations or least simulations.
- The summary shows total simulations, unique sofas, and unique fabrics for the
  selected period.
- The sofa table shows sofa name, simulation count, and the most selected
  fabric for that sofa.
- The fabric table shows fabric name and simulation count.
- The combination table shows sofa name, fabric name, and simulation count.
- All created simulation jobs count, regardless of optional commercial contact
  consent and regardless of job status.
- The UI and API never expose emails, visitor identity, private room photos,
  generated customer room outputs, storage paths, signed URLs, or technical ids.
- Existing lead deletion and private artifact purge behavior remain unchanged.

## Open Questions

- None.
