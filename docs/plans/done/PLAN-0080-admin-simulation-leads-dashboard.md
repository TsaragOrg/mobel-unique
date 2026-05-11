# PLAN-0080 Admin Simulation Leads Dashboard Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox syntax for tracking.

Plan: PLAN-0080
Spec: SPEC-0020
Status: done
Owner area: web
Depends on: SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0012, SPEC-0013, SPEC-0015, SPEC-0018
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `docs/specs/manifest.json`
- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Build the protected `/admin/leads` dashboard for simulation leads who granted
both required simulation email consent and optional commercial contact consent.
The dashboard must group retained lead jobs by readable email address, expose
safe catalog-render job previews, support date filters, exact email search,
newest/oldest sorting, and permanently delete the email identity from
app-owned records without showing private visitor artifacts or technical
identifiers in the UI.

## Architecture

Keep all browser behavior behind first-party `/api/admin/*` route handlers in
`apps/web`. The browser receives readable lead emails only after the existing
admin authorization check succeeds, and it never talks directly to Supabase
tables, Edge Functions, or worker-only functions.

Add `simulation_leads` and `simulation_lead_jobs` as service-role-only tables.
The public simulation create-job SQL wrapper records lead rows in the same
database transaction that creates the simulation job, but only when both
consents are granted and the encrypted email handoff is still available.

Reuse `SIMULATION_EMAIL_ENCRYPTION_SECRET`, `SIMULATION_EMAIL_HASH_SECRET`, and
`SIMULATION_RATE_LIMIT_SUBJECT_SALT`. This is acceptable because verification
requests, consent records, sessions, rate-limit cleanup, exact email search,
and lead rows must all agree on the same normalized-email hash boundary.
Rotation for these secrets remains an environment-wide simulation identity
migration event. No `NEXT_PUBLIC_` secret is allowed.

## Scope Decision

This spec spans Supabase storage, admin API, admin UI, privacy copy, and
deletion behavior. Keep it as one plan because the dashboard is not safe to
ship without all of those pieces connected: storing retained emails without
admin deletion, or shipping UI without the privacy update, would violate
`SPEC-0020`.

Worker code stays unchanged. Lead creation belongs to the server-side public
simulation job creation path, not the in-home simulation worker.

## File Map

- Create `supabase/migrations/20260511000200_admin_simulation_leads.sql` for:
  - `simulation_leads`;
  - `simulation_lead_jobs`;
  - service-role-only RLS policies and grants;
  - `record_simulation_lead_for_job(p_in_home_simulation_job_id uuid)`;
  - replacement of `create_in_home_simulation_job_for_visitor_dispatch_outbox`
    so it records a lead after the underlying job row is created;
  - `admin_list_simulation_leads`;
  - `admin_list_simulation_lead_jobs`;
  - `admin_delete_simulation_lead_identity`.
- Create `scripts/admin-simulation-leads-migration.test.mjs` for source-grep
  migration coverage of the tables, RLS, lead creation rules, list/job RPCs,
  delete cleanup, revocation, and customer-artifact exclusions.
- Create `apps/web/src/lib/admin-simulation-leads.ts` for request parsing,
  response types, safe status labels, date range helpers, cursor helpers, and
  response shaping.
- Create `apps/web/src/lib/admin-simulation-leads-route-handlers.ts` for
  admin-authorized list, jobs, and delete route-handler logic.
- Create `apps/web/src/lib/admin-simulation-leads-server.ts` for the
  Supabase-backed admin lead store, email decrypt/hash helpers, safe preview
  URL builder, and Supabase Auth Admin transient-user cleanup.
- Create `apps/web/src/lib/admin-simulation-leads-route-handlers.test.ts` for
  API behavior, authorization, response safety, filtering, sorting, search,
  deletion, stale lead handling, and failure responses.
- Create `apps/web/src/lib/admin-simulation-leads-server.test.ts` for
  encryption/decryption, exact normalized-email hash lookup, preview URL
  safety, rate-limit hash cleanup input, and transient Auth user cleanup order.
- Create `apps/web/src/app/api/admin/simulation-leads/route.ts`.
- Create `apps/web/src/app/api/admin/simulation-leads/[lead_id]/route.ts`.
- Create `apps/web/src/app/api/admin/simulation-leads/[lead_id]/jobs/route.ts`.
- Create `apps/web/src/app/admin/leads/page.tsx`.
- Create `apps/web/src/app/admin/leads/page.test.tsx`.
- Create `apps/web/src/app/admin/leads/AdminSimulationLeadsDashboard.tsx`.
- Create `apps/web/src/app/admin/leads/AdminSimulationLeadsDashboard.test.tsx`.
- Modify `apps/web/src/app/admin/AdminDashboard.tsx` and
  `apps/web/src/app/admin/AdminDashboard.test.tsx` to add the dashboard entry.
- Modify `apps/web/src/app/admin/AdminShell.tsx` if the top admin navigation
  should include the Leads section.
- Modify `apps/web/src/app/admin/admin-copy.ts` and
  `apps/web/src/app/admin/admin-copy.test.ts` for French admin labels and safe
  error messages.
- Modify `apps/web/src/app/globals.css` for the lead table, filters, central
  jobs dialog, delete confirmation state, and mobile layout.
- Modify `apps/web/src/app/politique-de-confidentialite/page.tsx` and
  `apps/web/src/app/politique-de-confidentialite/page.test.tsx` so the public
  privacy page explains retained lead records created from optional commercial
  contact consent before production release.
- Modify `docs/specs/manifest.json` to register `PLAN-0080` under
  `SPEC-0020`.
- Modify `docs/roadmap/web.md` and `docs/roadmap/supabase.md` after
  implementation and verification pass.

All touched `.tsx` files must keep the required top Russian/French comment
block from `AGENTS.md`. Add or refresh comments before data variables,
automatic blocks, user-action functions, forms, lists, modals, and large page
sections. Avoid the forbidden comment words listed in `AGENTS.md`.

## Data Contracts

### Lead List Response

`GET /api/admin/simulation-leads` returns:

```json
{
  "data": {
    "leads": [
      {
        "lead_id": "00000000-0000-0000-0000-000000000001",
        "email": "client@example.com",
        "last_simulation_at": "2026-05-11T10:00:00.000Z",
        "matching_job_count": 3
      }
    ],
    "next_cursor": null
  },
  "meta": {}
}
```

Allowed query parameters:

- `range=day|week|month`;
- `from=<ISO date>` and `to=<ISO date>` for custom date ranges;
- `sort=newest|oldest`, default `newest`;
- `email=<exact email>`;
- `limit=<1..100>`, default `50`;
- `cursor=<base64url JSON cursor>`.

The API trims and lowercases `email`, hashes it with
`SIMULATION_EMAIL_HASH_SECRET`, and only returns an exact retained lead match.

### Lead Jobs Response

`GET /api/admin/simulation-leads/{lead_id}/jobs` returns:

```json
{
  "data": {
    "email": "client@example.com",
    "matching_job_count": 2,
    "jobs": [
      {
        "preview_image_url": "/api/admin/storage-assets/00000000-0000-0000-0000-000000000010/preview?variant=medium",
        "sofa_name": "Canape droit",
        "fabric_name": "Tissu beige",
        "visual_position_label": "Vue de face",
        "simulation_date": "2026-05-11T10:00:00.000Z",
        "status_label": "Terminee"
      }
    ]
  },
  "meta": {}
}
```

The URL must be a first-party admin preview URL for a catalog sofa render only.
It must not be a signed storage URL, raw object path, customer room photo,
generated customer room output, or worker artifact path.

### Delete Response

`DELETE /api/admin/simulation-leads/{lead_id}` returns:

```json
{
  "data": {
    "deleted": true
  },
  "meta": {}
}
```

If the lead was already deleted, return the same success shape. Do not expose
the email, decrypted value, internal session ids, job ids, consent ids, Auth
provider details, SQL messages, or storage paths in the response.

## Tasks

### Phase 0 - Branch And Traceability

- [x] Create the workflow-compliant branch:

```bash
pnpm branch:create -- --type feature --area web --work "Admin simulation leads dashboard" --spec SPEC-0020 --plan PLAN-0080
```

- [x] Confirm `docs/specs/manifest.json` includes `PLAN-0080` in
      `SPEC-0020.implementationPlans`.
- [x] Keep this plan in `docs/plans/active` until implementation, roadmap
      updates, and verification are complete.

### Phase 1 - Supabase Tests First

- [x] Add `scripts/admin-simulation-leads-migration.test.mjs`.
      Cover these exact expectations:
  - the migration creates `simulation_leads` with encrypted email, unique
    normalized-email hash, first/last simulation timestamps, job count, and
    timestamps;
  - the migration creates `simulation_lead_jobs` with one row per original
    in-home simulation job and snapshot fields for sofa, fabric, visual
    position, status, simulation date, render cell, and sofa asset;
  - both tables revoke anon/authenticated access, grant service-role access,
    enable RLS, and create service-role-only policies;
  - `record_simulation_lead_for_job` requires required email consent granted,
    optional commercial contact consent granted, an encrypted email handoff,
    and a successfully created simulation job;
  - rejected optional commercial consent returns without inserting a lead;
  - verified email without a simulation job has no path to insert a lead;
  - the dispatch-outbox create-job wrapper calls
    `record_simulation_lead_for_job` after the underlying job is created;
  - `admin_list_simulation_leads` groups by email hash and returns encrypted
    email plus latest matching simulation date and matching job count;
  - date filters use `simulation_lead_jobs.simulation_created_at`;
  - sorting uses latest matching simulation date;
  - exact email search uses `email_normalized_hash`;
  - `admin_list_simulation_lead_jobs` returns only catalog render asset
    identifiers and snapshots, not customer room paths or generated outputs;
  - `admin_delete_simulation_lead_identity` deletes lead rows, nulls or
    replaces email-derived values, revokes sessions, removes identifiable
    email rate-limit rows, and does not delete anonymized original
    `in_home_simulation_jobs` rows.

- [x] Run the migration test before implementation:

```bash
pnpm vitest run scripts/admin-simulation-leads-migration.test.mjs
```

Expected: fail because the migration does not exist.

### Phase 2 - Supabase Implementation

- [x] Create `supabase/migrations/20260511000200_admin_simulation_leads.sql`.
- [x] Add `simulation_leads`:
  - `id uuid primary key default gen_random_uuid()`;
  - `email_address_encrypted text not null`;
  - `email_normalized_hash text not null unique`;
  - `first_simulation_at timestamptz not null`;
  - `last_simulation_at timestamptz not null`;
  - `job_count integer not null default 0`;
  - `created_at timestamptz not null default now()`;
  - `updated_at timestamptz not null default now()`;
  - non-blank email constraints and non-negative job count constraint.
- [x] Add `simulation_lead_jobs`:
  - fields from `SPEC-0020`;
  - `unique (in_home_simulation_job_id)`;
  - indexes on `(simulation_lead_id, simulation_created_at desc)` and
    `(simulation_created_at)`;
  - nullable render/asset references so historical rows survive missing
    previews.
- [x] Enable RLS on both new tables, revoke anon/authenticated access, grant
      service-role access, and add service-role-only policies.
- [x] Implement `record_simulation_lead_for_job(p_in_home_simulation_job_id uuid)`.
      The function must:
  - lock the job/session/request/consent rows it reads where useful;
  - return without writing if optional commercial consent is absent, rejected,
    revoked, or not linked to the active session;
  - return without writing if the encrypted email handoff is missing;
  - upsert `simulation_leads` by `email_normalized_hash`;
  - insert one `simulation_lead_jobs` row per original simulation job;
  - snapshot sofa public name, fabric public name, visual position label,
    status, created date, render cell, and prepared sofa asset;
  - update `first_simulation_at`, `last_simulation_at`, `job_count`, and
    `updated_at` from retained lead jobs.
- [x] Replace `create_in_home_simulation_job_for_visitor_dispatch_outbox` so it
      calls the existing checkpoint-pump create function, records a lead only
      for returned job rows, and returns the original six-column response
      unchanged.
- [x] Implement `admin_list_simulation_leads` with date filters, exact hash
      search, newest/oldest sorting, and cursor pagination.
- [x] Implement `admin_list_simulation_lead_jobs` with the same date filters
      and job-card fields only.
- [x] Implement `admin_delete_simulation_lead_identity` to:
  - lock the lead row by id;
  - delete `simulation_lead_jobs`;
  - delete `simulation_leads`;
  - set `email_verification_requests.email_address_encrypted = null`;
  - replace or null email-derived hashes in `email_verification_requests`,
    `simulation_sessions`, and `consent_records`;
  - set related `simulation_sessions.status = 'revoked'` and
    `expires_at = least(expires_at, now())`;
  - delete matching `simulation_rate_limits` rows for the computed email
    rate-limit subject hash;
  - leave original `in_home_simulation_jobs` rows in place when they no longer
    contain email identity data.
- [x] Run the migration test again:

```bash
pnpm vitest run scripts/admin-simulation-leads-migration.test.mjs
```

Expected: pass.

### Phase 3 - Admin API Tests First

- [x] Add `apps/web/src/lib/admin-simulation-leads-route-handlers.test.ts`.
      Cover:
  - anonymous requests return the existing safe admin rejection;
  - authenticated non-admin requests return the existing safe admin rejection;
  - list responses include readable email for authorized admins only;
  - list responses do not include job ids, consent ids, verification request
    ids, session ids, storage paths, signed URLs, customer room paths, or
    generated output paths;
  - `range=day`, `range=week`, `range=month`, and custom `from`/`to` filters
    pass correct bounds to the store;
  - date filters affect matching job count;
  - newest and oldest sorting are validated and passed to the store;
  - exact email search trims and lowercases before hashing;
  - invalid filters return safe validation errors;
  - jobs responses include only safe preview URL, sofa name, fabric name,
    visual position label, simulation date, and safe status label;
  - jobs responses omit private artifact details;
  - delete calls transient Auth cleanup before database identity deletion;
  - delete treats already-deleted leads as success;
  - store failures return safe messages without SQL, stack, provider, storage,
    encryption, or secret details.

- [x] Add `apps/web/src/lib/admin-simulation-leads-server.test.ts`.
      Cover:
  - readable email is produced by decrypting `email_address_encrypted` only in
    server-side code;
  - exact search uses `SIMULATION_EMAIL_HASH_SECRET`;
  - delete rate-limit cleanup computes the same email subject hash as
    `simulation-rate-limit.ts`;
  - transient Auth users are deleted only when there is no remaining
    non-deleted app record that needs the Auth user;
  - a missing Auth user during retry is treated as already cleaned;
  - safe preview URLs use only the protected admin storage asset preview route
    and `variant=medium`.

- [x] Run the focused API tests before implementation:

```bash
pnpm --filter @mobel-unique/web test -- src/lib/admin-simulation-leads-route-handlers.test.ts src/lib/admin-simulation-leads-server.test.ts
```

Expected: fail because the lead API modules do not exist.

### Phase 4 - Admin API Implementation

- [x] Create `apps/web/src/lib/admin-simulation-leads.ts`.
      Include:
  - `AdminSimulationLeadRow`;
  - `AdminSimulationLeadJobRow`;
  - `AdminSimulationLeadSort = "newest" | "oldest"`;
  - date filter parser for `day`, `week`, `month`, custom `from`/`to`, and
    clear filter;
  - email normalizer that trims and lowercases;
  - cursor encoder/decoder;
  - safe status label formatter;
  - response shapers that whitelist allowed fields.
- [x] Create `apps/web/src/lib/admin-simulation-leads-route-handlers.ts`.
      Use the same authorization shape as existing admin catalog handlers.
- [x] Create `apps/web/src/lib/admin-simulation-leads-server.ts`.
      Use `createClient` with `SUPABASE_SERVICE_ROLE_KEY` only on the server.
      Reuse the existing simulation email encryption/hash algorithms from
      `simulation-public-server.ts`; if the helper functions are private,
      move them to a small server-only module and update existing tests.
- [x] Implement delete ordering:
  - load lead and candidate Auth user ids;
  - delete safe transient Supabase Auth users first through the Admin API;
  - then call `admin_delete_simulation_lead_identity`;
  - if Auth deletion fails, do not call the database delete RPC;
  - if the database delete RPC fails after an Auth user was already deleted,
    return a safe failure and keep the lead row available for retry.
- [x] Create the thin Next.js route files under
      `apps/web/src/app/api/admin/simulation-leads`.
- [x] Run the focused API tests:

```bash
pnpm --filter @mobel-unique/web test -- src/lib/admin-simulation-leads-route-handlers.test.ts src/lib/admin-simulation-leads-server.test.ts
```

Expected: pass.

### Phase 5 - Admin UI Tests First

- [x] Add `apps/web/src/app/admin/leads/page.test.tsx`.
      Cover noindex metadata and route composition.
- [x] Add `apps/web/src/app/admin/leads/AdminSimulationLeadsDashboard.test.tsx`.
      Cover:
  - anonymous visitor redirects through the existing admin access flow;
  - non-admin user sees the safe forbidden state;
  - empty retained leads state;
  - empty selected date filter state;
  - empty exact email search state;
  - failed list load state;
  - main rows show readable email, latest matching simulation date, jobs
    button text such as `1 job` and `3 jobs`, and delete action;
  - main rows do not show UUIDs, consent ids, session ids, storage paths,
    signed URLs, private room photos, or generated output URLs;
  - last day, last week, last month, custom range, and clear filter reload the
    list with the correct query;
  - newest/oldest sort reloads the list;
  - search trims/lowercases exact email input;
  - clicking the jobs button opens one centered dialog;
  - the dialog title includes email and matching job count;
  - dialog cards show catalog render preview when available, sofa name, fabric
    name, visual position label, simulation date, and safe status;
  - missing preview image uses a safe empty visual state;
  - archived sofa/fabric snapshots still display;
  - failed jobs load shows a safe dialog error;
  - close button and Escape close the dialog;
  - delete opens a confirmation state on the row;
  - cancel keeps the lead unchanged;
  - confirm calls delete, removes the row, and never shows a technical id;
  - stale lead already deleted in another admin tab is removed from the UI.
- [x] Update `apps/web/src/app/admin/AdminDashboard.test.tsx` for the
      `/admin/leads` entry point.
- [x] Update `apps/web/src/app/admin/admin-copy.test.ts` for new French labels
      and error-message mappings.
- [x] Run the focused UI tests before implementation:

```bash
pnpm --filter @mobel-unique/web test -- src/app/admin/leads/page.test.tsx src/app/admin/leads/AdminSimulationLeadsDashboard.test.tsx src/app/admin/AdminDashboard.test.tsx src/app/admin/admin-copy.test.ts
```

Expected: fail because the route, UI, labels, and dashboard entry do not exist.

### Phase 6 - Admin UI Implementation

- [x] Create `apps/web/src/app/admin/leads/page.tsx` with `robots.index=false`
      metadata and the protected admin shell route.
- [x] Create
      `apps/web/src/app/admin/leads/AdminSimulationLeadsDashboard.tsx`.
      Keep the default dependency layer small:
  - get the Supabase browser access token;
  - call `/api/admin/session` only for the admin gate when needed;
  - call `/api/admin/simulation-leads` for list data;
  - call `/api/admin/simulation-leads/{lead_id}/jobs` only when the jobs
    dialog opens;
  - call `DELETE /api/admin/simulation-leads/{lead_id}` only after
    confirmation.
- [x] Add date filter controls:
  - segmented choices for last day, last week, last month;
  - custom `from` and `to` date inputs;
  - clear filter action.
- [x] Add exact email search:
  - trim and lowercase before request;
  - do not implement fuzzy, domain, or partial encrypted-email search.
- [x] Add newest/oldest sorting.
- [x] Add the main lead list with one row per email address.
- [x] Add the jobs button with singular/plural text.
- [x] Add one central jobs dialog:
  - centered on desktop;
  - dimmed page behind it;
  - single close button;
  - scrollable job list inside the dialog;
  - mobile width/height constrained to viewport;
  - actions reachable without covering content.
- [x] Add row-level delete confirmation with clear French copy explaining that
      the email is removed from the lead dashboard and app-owned email identity
      records.
- [x] Update `AdminDashboard.tsx`, `AdminShell.tsx` if needed, and
      `admin-copy.ts`.
- [x] Update `globals.css` with stable dimensions for filter controls, table
      rows, job cards, preview boxes, icon buttons, and dialog layout.
- [x] Refresh all required `.tsx` comments in touched files.
- [x] Run the focused UI tests:

```bash
pnpm --filter @mobel-unique/web test -- src/app/admin/leads/page.test.tsx src/app/admin/leads/AdminSimulationLeadsDashboard.test.tsx src/app/admin/AdminDashboard.test.tsx src/app/admin/admin-copy.test.ts
```

Expected: pass.

### Phase 7 - Privacy Page Tests And Copy

- [x] Update `apps/web/src/app/politique-de-confidentialite/page.test.tsx`.
      Add assertions that the French copy explains:
  - optional commercial contact consent can create a retained lead record;
  - retained lead records can include readable email for authorized admin
    follow-up, selected sofa, selected fabric, selected visual position,
    simulation date, and safe status;
  - customer room photos and generated room outputs still follow the 24-hour
    purge behavior;
  - the visitor can ask for deletion and admin deletion removes the app-owned
    email identity.
- [x] Run the privacy test before changing copy:

```bash
pnpm --filter @mobel-unique/web test -- src/app/politique-de-confidentialite/page.test.tsx
```

Expected: fail because retained lead records are not described yet.

- [x] Update `apps/web/src/app/politique-de-confidentialite/page.tsx` with the
      retained-lead copy. Keep the text concise, French, and free of storage
      paths, signed URLs, Supabase internals, service-role wording, provider
      details, API internals, and internal IDs.
- [x] Refresh required `.tsx` comments in the privacy page.
- [x] Run the privacy test again:

```bash
pnpm --filter @mobel-unique/web test -- src/app/politique-de-confidentialite/page.test.tsx
```

Expected: pass.

### Phase 8 - Integration Checks

- [x] Run the combined focused tests:

```bash
pnpm vitest run scripts/admin-simulation-leads-migration.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/admin-simulation-leads-route-handlers.test.ts src/lib/admin-simulation-leads-server.test.ts src/app/admin/leads/page.test.tsx src/app/admin/leads/AdminSimulationLeadsDashboard.test.tsx src/app/admin/AdminDashboard.test.tsx src/app/admin/admin-copy.test.ts src/app/politique-de-confidentialite/page.test.tsx
```

- [x] Run web typecheck:

```bash
pnpm --filter @mobel-unique/web typecheck
```

- [x] Run the Supabase migration uniqueness test:

```bash
pnpm vitest run scripts/supabase-migrations-unique.test.mjs scripts/admin-simulation-leads-migration.test.mjs
```

- [x] Run the specification guard:

```bash
pnpm spec:check
```

- [x] If shared simulation email encryption helpers move files, also run:

```bash
pnpm --filter @mobel-unique/web test -- src/lib/simulation-public-server.test.ts src/lib/env-example.test.ts
```

- [x] If CSS changes affect broad admin layout, also run:

```bash
pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx src/app/admin/AdminDashboard.test.tsx
```

### Phase 9 - Roadmap And Closure

- [x] Update `docs/roadmap/web.md` only after tests and typecheck pass.
      The entry should claim the protected `/admin/leads` route, dashboard
      entry point, filters, sorting, exact email search, jobs dialog, delete
      flow, privacy copy update, and API/UI safety tests.
- [x] Update `docs/roadmap/supabase.md` only after tests pass. The entry should
      claim the lead tables, service-role-only policies, lead recording during
      public simulation job creation, admin list/job/delete RPCs, and email
      identity cleanup.
- [x] Move this plan to `docs/plans/done` only after implementation, roadmap
      updates, and verification pass.
- [x] Add a closure note summarizing implemented behavior and verification.
- [x] Do not commit automatically unless the user asks for a commit.

## Closure Note

2026-05-11: PLAN-0080 implemented the protected admin simulation leads
dashboard, service-role-only lead retention tables/RPCs, admin API route
handlers, exact email/date/sort filtering, jobs dialog with safe previews,
row-level email identity deletion, dashboard/shell navigation, and privacy
copy for retained contact records. Verification completed with the migration
regression, focused API/UI/privacy tests, full web test suite, web typecheck,
migration uniqueness checks, helper regression tests, broad admin layout tests,
and `pnpm spec:check`.

## Tests

Narrow failing-first tests:

```bash
pnpm vitest run scripts/admin-simulation-leads-migration.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/admin-simulation-leads-route-handlers.test.ts src/lib/admin-simulation-leads-server.test.ts
pnpm --filter @mobel-unique/web test -- src/app/admin/leads/page.test.tsx src/app/admin/leads/AdminSimulationLeadsDashboard.test.tsx src/app/admin/AdminDashboard.test.tsx src/app/admin/admin-copy.test.ts
pnpm --filter @mobel-unique/web test -- src/app/politique-de-confidentialite/page.test.tsx
```

Quality checks:

```bash
pnpm --filter @mobel-unique/web typecheck
pnpm vitest run scripts/supabase-migrations-unique.test.mjs scripts/admin-simulation-leads-migration.test.mjs
pnpm spec:check
```

Broader checks when implementation touches shared helpers or broad admin CSS:

```bash
pnpm --filter @mobel-unique/web test
pnpm test:supabase:schema
```

## Roadmap

Update after implementation and verification:

- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`

Do not update `docs/roadmap/image-worker.md`; this plan intentionally has no
worker behavior changes.

## Acceptance Mapping

- Admin dashboard links to protected simulation leads dashboard: Phase 5 and
  Phase 6.
- One row per opted-in email: Phase 1, Phase 2, Phase 5, and Phase 6.
- Both consents required: Phase 1 and Phase 2.
- Row shows readable email, latest matching simulation date, jobs count, and
  delete action: Phase 5 and Phase 6.
- Jobs count opens one central modal: Phase 5 and Phase 6.
- Modal shows safe catalog sofa render preview and safe job details: Phase 3,
  Phase 4, Phase 5, and Phase 6.
- UI and API hide technical ids, private room photos, generated room outputs,
  storage paths, and signed private URLs: Phase 3, Phase 4, Phase 5, and
  Phase 6.
- Date filters support last day, last week, last month, and custom range:
  Phase 3 through Phase 6.
- Sort supports newest first and oldest first: Phase 3 through Phase 6.
- Exact email search works for retained leads: Phase 3 through Phase 6.
- Delete removes email identity from app-owned records after confirmation:
  Phase 1 through Phase 6.
- Existing 24-hour purge behavior remains unchanged: Phase 2 verifies no
  worker or artifact retention changes, and Phase 7 keeps privacy copy clear.
- Privacy page describes retained lead records from optional commercial
  contact consent: Phase 7.

## Notes

- The list API returns `lead_id` because `SPEC-0020` defines it as the admin
  API handle. The UI must not display this id.
- The jobs API must not return `in_home_simulation_job_id` or
  `simulation_lead_jobs.id`.
- The preview URL may reuse the existing protected admin storage-asset preview
  facade for catalog render assets. It must not return raw Supabase signed URLs
  or object paths.
- Email hash rotation is outside this plan. If rotation becomes necessary,
  create a separate accepted spec or change request before changing identity
  derivation.
- Public visitors and authenticated non-admin users must receive the same safe
  admin rejection behavior already defined by `SPEC-0011`.
