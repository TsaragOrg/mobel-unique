# SPEC-0020 Admin Simulation Leads Dashboard

Spec: SPEC-0020
Status: accepted
Layer: feature
Parent Spec: SPEC-0013
Depends On: SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0012, SPEC-0013, SPEC-0015, SPEC-0018
Areas: web, supabase
Implementation Plans: PLAN-0080, PLAN-0081

## Supersession

`CR-SPEC-0015-SPEC-0020-remove-simulation-email-retention` supersedes this
feature. `PLAN-0081` removes application-owned public simulation email
retention, optional commercial contact consent, retained simulation lead tables,
lead RPCs, and the `/admin/leads` surface. No future implementation should
create or restore readable/encrypted simulation email lead records without a new
accepted change request.

## Traceability

This spec defines the admin lead dashboard for visitors who run public in-home
simulations and explicitly accept both the required simulation email consent and
the optional commercial contact consent.

It follows:

- `SPEC-0015`, which defines the public simulation email gate and simulation
  job creation flow;
- `SPEC-0009`, which defines email verification requests, consent records,
  simulation sessions, and in-home simulation jobs;
- `SPEC-0013`, which defines the protected admin shell and identifies
  simulation operational views as future work;
- `SPEC-0018`, which requires a separate accepted spec before adding longer
  retention or new consent-backed data handling;
- `CR-SPEC-0013-SPEC-0018 Admin Simulation Leads Dashboard`, which updates the
  older accepted admin and privacy contracts so this feature is traceable from
  the existing route map and public privacy page requirements.

This spec intentionally creates a separate lead surface instead of reusing the
short-lived email verification handoff. The email handoff remains temporary and
is still purged by the existing public simulation cleanup. Lead records exist
only for visitors who granted optional commercial contact consent.

## Goal

Give the administrator a simple, non-technical dashboard for simulation leads:

- which opted-in email addresses ran simulations;
- which sofas, fabrics, and visual positions they selected;
- when the simulations happened;
- how many simulations each email has;
- quick filtering by date, sorting by date, search by email, and full email
  deletion from app-owned system records.

The dashboard must be useful for follow-up without exposing private room
photos, generated customer room outputs, storage paths, signed URLs, or
technical identifiers.

## Scope

This spec includes:

- a new protected admin lead dashboard route, recommended as `/admin/leads`;
- a dashboard entry point from `/admin`;
- a grouped lead list with one row per email address;
- a central modal dialog that opens from a `{n} jobs` button and lists the
  matching simulations for that email;
- exact-email search;
- date filters for last day, last week, last month, and custom range;
- sort order for newest first and oldest first;
- delete action for fully removing the email identity from app-owned system
  records, not only hiding it from the dashboard;
- database storage for consent-backed lead records separate from the temporary
  email verification handoff;
- admin API endpoints under the first-party `/api/admin/*` facade.

## Out Of Scope

This spec does not include:

- customer room photos in the admin UI;
- generated customer room result images in the admin UI;
- private storage paths, signed URLs, internal job ids, consent ids, session
  ids, or verification request ids in the admin UI;
- a second popup inside the jobs modal;
- editing lead email addresses;
- sending marketing emails from the app;
- bulk export, CSV download, tags, CRM stages, notes, assignments, or call
  history;
- fuzzy email search, domain search, or partial encrypted-email search;
- deleting the original simulation job records outside the existing retention
  and purge behavior;
- deleting non-email operational records that no longer contain an email,
  encrypted email, or email-derived value.

## Users And Permissions

Only an authorized administrator can access the lead dashboard.

Rules:

- public visitors cannot access the route or API endpoints;
- authenticated non-admin users must receive the same safe admin rejection
  behavior defined by `SPEC-0011`;
- admin browser code must call only first-party `/api/admin/*` endpoints;
- browser code must not call Supabase tables, Supabase Edge Functions, or
  worker-only functions directly;
- service-role credentials, encryption secrets, and storage paths must never be
  exposed to the browser.

## User Flow

1. A visitor opens the public simulation email gate.
2. The visitor enters an email address and accepts both consent boxes:
   required simulation email consent and optional commercial contact consent.
3. The visitor verifies the email and creates at least one simulation job.
4. When the job row is created successfully, the system records or updates a
   lead for that email.
5. The administrator opens the lead dashboard from the admin dashboard.
6. The administrator sees a table grouped by email.
7. The administrator filters by date, sorts by date, or searches by exact
   email address.
8. The administrator clicks a button such as `3 jobs`.
9. A central modal dialog opens and shows the simulations for that email.
10. The administrator can close the modal or delete the lead from the main
    list after confirmation.

## Admin UI

### Route

Recommended route:

- `/admin/leads`

The route must use the protected admin shell, noindex metadata, and the
existing admin visual system.

### Main List

The main list shows one row per email address.

Visible columns:

- email address;
- last matching simulation date;
- jobs button, such as `1 job` or `3 jobs`;
- delete action.

The email address must be visible as readable text in the admin UI for an
authorized administrator. The two accepted consents are the product rule that
allows this lead email to be shown for follow-up. Encryption applies to storage
at rest, not to the authorized admin display.

The main list must not show:

- job id;
- simulation session id;
- consent record id;
- verification request id;
- private image links;
- generated customer room images;
- raw storage paths.

### Date Filters

The dashboard supports:

- last day;
- last week;
- last month;
- custom date range;
- clear filter.

Date filters apply to simulation job creation dates.

When a date filter is active:

- the main list shows only emails with at least one matching job;
- the jobs button count is the number of matching jobs;
- the modal shows only matching jobs;
- clearing the filter returns to all retained lead jobs.

### Sorting

The dashboard supports:

- newest first;
- oldest first.

Sorting uses the latest matching simulation date for each email row.

### Email Search

MVP search supports exact normalized email search.

Rules:

- the search value is trimmed and lowercased before lookup;
- no result is shown if the email has no retained lead record;
- partial search can be considered later, but it is not part of this MVP
  because lead emails are encrypted at rest.

### Jobs Modal

Clicking the jobs button opens one central modal dialog.

Desktop behavior:

- the modal appears centered on the page;
- the page behind it is dimmed;
- the modal has a clear close button;
- the modal title shows the email and the matching jobs count;
- the job list scrolls inside the modal when needed.

Mobile behavior:

- the modal remains a single central dialog;
- it may use most of the viewport width and height;
- the list scrolls inside the modal;
- action buttons remain reachable without covering content.

Each job card shows:

- a safe catalog sofa render for the selected sofa, fabric, and visual
  position when available;
- sofa public name;
- fabric public name;
- visual position label;
- simulation date;
- safe status label.

The modal must not show customer room photos or generated customer room
outputs. The visual image is the catalog sofa render only.

### Delete Action

The delete action is shown at the right side of each main list row.

Behavior:

- clicking delete opens a confirmation state;
- confirmation text explains that the email will be removed from the lead
  dashboard and from app-owned email identity records;
- confirming permanently deletes the lead and its lead-job rows;
- confirming purges or anonymizes every app-owned record that still contains
  the email, encrypted email, normalized email hash, or another value derived
  from that email;
- confirming revokes the related public simulation sessions so the deleted
  email cannot continue using old simulation access cookies;
- canceling keeps the lead unchanged;
- deletion must not expose or require a technical id in the visible UI.

Deletion must remove or anonymize email data in:

- `simulation_leads`;
- `simulation_lead_jobs`;
- `email_verification_requests`;
- `simulation_sessions`;
- `consent_records`;
- email-based rate-limit rows when they can be identified from the deleted
  email;
- transient Supabase Auth users created only for this public simulation email,
  when no remaining non-deleted record still needs that Auth user.

Deletion does not have to delete original `in_home_simulation_jobs` rows or
storage objects when those records no longer contain the email or any
email-derived value. Those operational records may remain only in an anonymized
form and only without customer room images or generated outputs being shown in
the lead dashboard.

## Data Model

### New Table: `simulation_leads`

Stores one lead per normalized email hash. The email is encrypted in the
database, but the admin API decrypts it after admin authorization and returns a
readable email string for the dashboard.

Fields:

- `id` uuid primary key;
- `email_address_encrypted` text not null;
- `email_normalized_hash` text not null unique;
- `first_simulation_at` timestamptz not null;
- `last_simulation_at` timestamptz not null;
- `job_count` integer not null default 0;
- `created_at` timestamptz not null default now();
- `updated_at` timestamptz not null default now().

Rules:

- raw email must not be stored in plaintext;
- exact email search uses `email_normalized_hash`;
- the admin API decrypts email only after admin authorization succeeds and only
  to return the readable email value to the protected admin UI;
- admin deletion hard-deletes the lead row after related email identity cleanup
  succeeds;
- accepting both consents is required before creating or updating this row.

### New Table: `simulation_lead_jobs`

Stores the simulation rows shown inside the jobs modal.

Fields:

- `id` uuid primary key;
- `simulation_lead_id` uuid not null references `simulation_leads(id)`;
- `in_home_simulation_job_id` uuid not null references
  `in_home_simulation_jobs(id)`;
- `selected_sofa_id` uuid not null references `sofas(id)`;
- `selected_fabric_id` uuid not null references `fabrics(id)`;
- `selected_visual_matrix_column_id` uuid not null references
  `visual_matrix_columns(id)`;
- `prepared_render_cell_id` uuid nullable references `sofa_render_cells(id)`;
- `prepared_sofa_asset_id` uuid nullable references `storage_assets(id)`;
- `sofa_public_name_snapshot` text not null;
- `fabric_public_name_snapshot` text not null;
- `visual_position_label_snapshot` text;
- `simulation_status_snapshot` text not null;
- `simulation_created_at` timestamptz not null;
- `created_at` timestamptz not null default now().

Rules:

- one simulation job can appear at most once in this table;
- snapshots keep the modal understandable even if catalog labels later change;
- live job status may be refreshed from `in_home_simulation_jobs` when the
  admin opens the modal;
- the image preview must come from the catalog render asset, not from customer
  room artifacts.

### Lead Creation Rule

When a public simulation job is created, the system creates or updates lead
records only if:

- the required email consent record is granted;
- the optional commercial contact consent record is granted;
- the email verification request still has an encrypted email available for the
  server to decrypt and re-encrypt into the lead store;
- the simulation job was created successfully.

If optional commercial contact consent is rejected, no lead record is created.

If the visitor verifies email but never creates a simulation job, no lead record
is created.

## API

All endpoints are under the first-party admin facade and require admin
authorization.

### `GET /api/admin/simulation-leads`

Returns the grouped lead list.

Query parameters:

- `range`: optional, one of `day`, `week`, `month`;
- `from`: optional ISO date for custom range;
- `to`: optional ISO date for custom range;
- `sort`: `newest` or `oldest`, default `newest`;
- `email`: optional exact email search;
- `limit`: optional page size;
- `cursor`: optional pagination cursor.

Response data for each row:

- `lead_id`;
- `email`, as a readable email string for the authorized admin UI;
- `last_simulation_at`;
- `matching_job_count`.

The response must not include internal job ids, consent ids, verification ids,
storage paths, signed URLs, or private artifact paths.

### `GET /api/admin/simulation-leads/{lead_id}/jobs`

Returns the jobs shown inside the central modal.

Query parameters:

- same date filter parameters as the list endpoint.

Response data for each job:

- safe preview image URL or null;
- sofa name;
- fabric name;
- visual position label;
- simulation date;
- safe status label.

The safe preview image URL must reference only a catalog sofa render that is
allowed for admin display. It must not reference customer room photos,
generated customer room outputs, private room artifact paths, or raw signed
storage paths.

### `DELETE /api/admin/simulation-leads/{lead_id}`

Deletes the email identity from the lead dashboard and all app-owned email
identity records.

Behavior:

- loads the lead by admin-only id;
- decrypts the lead email server-side only when needed to compute lookup
  hashes for cleanup;
- deletes `simulation_lead_jobs` rows for the lead;
- deletes the `simulation_leads` row;
- purges `email_verification_requests.email_address_encrypted`;
- replaces or removes normalized email hashes in
  `email_verification_requests`, `simulation_sessions`, and `consent_records`
  so they are no longer derived from the deleted email;
- revokes or expires related `simulation_sessions`;
- removes matching email-based rate-limit rows when identifiable;
- deletes the transient Supabase Auth user for the public simulation email when
  it is safe to do so;
- returns success if the email identity was already deleted.

The endpoint must be transactional where possible. If any email-bearing cleanup
step fails, the endpoint must fail safely and keep enough server-side state to
retry; it must not report success while the email still remains in app-owned
records.

## Worker Jobs

No worker behavior changes are required.

The public simulation worker must not write lead records directly. Lead
creation belongs to the server-side simulation job creation path, where consent
and encrypted email handoff data are available.

Existing purge behavior for private room photos, generated outputs, and email
verification handoff data remains unchanged.

## Environment Variables

The implementation may reuse the existing email encryption and hash secrets if
the plan confirms that their rotation and access boundaries are acceptable for
lead retention.

If the implementation chooses separate lead secrets, it must add them to the
web server environment and `.env.example`:

- `SIMULATION_LEAD_EMAIL_ENCRYPTION_SECRET`;
- `SIMULATION_LEAD_EMAIL_HASH_SECRET`.

No browser-exposed environment variables are allowed for lead email encryption,
hashing, or admin lead access.

## Privacy And Retention

Lead records are different from temporary simulation artifacts.

Rules:

- lead email retention is allowed only when optional commercial contact consent
  is granted;
- readable email display in the admin UI is allowed only for authorized admins
  and only for leads where both required simulation email consent and optional
  commercial contact consent were granted;
- private room photos, intermediate artifacts, and generated customer room
  outputs remain temporary and follow the existing 24-hour purge behavior;
- the public privacy page must be updated before production release so it
  clearly explains that optional commercial contact consent can create a
  retained lead record;
- admin deletion fully removes the email identity from app-owned records,
  including encrypted email and email-derived hashes;
- if optional commercial consent wording changes, the wording version must be
  captured through the existing consent records.

## Error And Empty States

The dashboard must handle:

- no retained leads;
- no leads for the selected date filter;
- no exact email search result;
- failed list load;
- failed modal load;
- failed delete;
- stale lead deleted in another admin tab;
- missing catalog preview image;
- archived sofa or fabric still appearing in historical lead jobs.

Errors must be safe and must not expose SQL errors, stack traces, provider
details, storage paths, service credentials, encryption details, or private
visitor artifacts.

## Testing Requirements

Implementation plans must add tests for:

- no lead is created when optional commercial contact consent is rejected;
- a lead is created when both consents are granted and a simulation job is
  created;
- email verification without job creation does not create a lead;
- multiple jobs for the same email are grouped into one lead row;
- date filters affect row visibility, jobs count, and modal content;
- newest and oldest sorting use the latest matching simulation date;
- exact email search returns only the matching lead;
- authorized admin responses include the readable email value while database
  storage keeps the email encrypted at rest;
- the admin list response does not expose job ids, consent ids, verification
  request ids, session ids, storage paths, or signed private URLs;
- the modal uses catalog sofa render previews and does not expose customer room
  photos or generated customer room outputs;
- deleting a lead removes the email, encrypted email, email-derived hashes,
  lead rows, and related public simulation access from app-owned records;
- deleting a lead does not expose technical ids and does not require deleting
  anonymized simulation job rows that no longer contain email identity data;
- anonymous and non-admin users cannot access the lead route or API endpoints.

## Acceptance Criteria

- The admin dashboard links to a protected simulation leads dashboard.
- The lead dashboard shows one row per opted-in email address.
- Only visitors who granted both required simulation email consent and optional
  commercial contact consent appear in the lead dashboard.
- Each row shows the readable email address, latest matching simulation date,
  jobs count, and delete action.
- Clicking the jobs count opens one central modal dialog.
- The modal shows safe catalog sofa render previews, sofa name, fabric name,
  visual position, simulation date, and status for matching jobs.
- The UI never shows technical job ids, consent ids, session ids, verification
  ids, private room photos, generated customer room outputs, storage paths, or
  signed private URLs.
- Date filters support last day, last week, last month, and custom range.
- Sort supports newest first and oldest first.
- Exact email search works for retained leads.
- Delete fully removes the email identity from app-owned system records after
  confirmation, including the retained lead email, encrypted email handoff
  values, email-derived hashes, and related public simulation access.
- Existing 24-hour purge behavior for private simulation artifacts remains
  unchanged.
- The privacy page is updated before production release to describe retained
  lead records created from optional commercial contact consent.

## Open Questions

- None.
