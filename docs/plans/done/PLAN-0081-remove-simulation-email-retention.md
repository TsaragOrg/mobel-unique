# PLAN-0081 Remove Simulation Email Retention

Plan: PLAN-0081
Spec: SPEC-0015
Status: done
Owner area: repo
Depends on: SPEC-0003, SPEC-0004, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0012, SPEC-0013, SPEC-0015, SPEC-0018, SPEC-0020
Change request: CR-SPEC-0015-SPEC-0020-remove-simulation-email-retention
Affected packages:

- `apps/web`
- `supabase/migrations`
- `supabase/functions`
- `scripts`
- `docs/specs`
- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Keep the public simulation email-code verification flow while removing
application-owned email retention, optional commercial contact consent, retained
simulation leads, and the admin lead dashboard.

After this plan ships, the simulation email address is used only to send and
verify the OTP and to enforce the configured 24-hour per-email simulation cap.
The admin side keeps only anonymized simulation metadata and analytics.

## Closure Note

Closed on 2026-05-12 after the implementation, tests, migration cleanup,
accepted-spec supersession notes, and package roadmaps were updated. This plan
ships the repo changes and a forward cleanup migration; DEV/PROD deployment and
post-deploy hard-drop cleanup remain operational rollout work outside this
branch.

## Current State

`dev` was updated on 2026-05-12 before creating this branch. The update added
`docs/specs/drafts/features/SPEC-0021-admin-simulation-analytics.md`, which is
the right replacement direction for admin insight but still described analytics
as separate from the existing lead dashboard. This plan aligns that draft with
the new no-email-retention decision.

Local database inspection on 2026-05-12 showed:

- `simulation_leads` and `simulation_lead_jobs` are not present locally because
  local migrations stop at `20260509000200`;
- `email_verification_requests` has 19 rows, 6 with `email_address_encrypted`;
- all 6 encrypted email rows are older than 24 hours;
- `consent_records` has 25 rows with email-derived hashes;
- `simulation_sessions` has 18 active rows with email-derived hashes, and all
  18 are expired;
- `simulation_rate_limits` has 15 `subject_kind = 'email'` rows;
- `auth.users` has 2 transient public simulation Auth users.

The repo still contains the lead implementation from `PLAN-0080`, including the
`/admin/leads` UI, `/api/admin/simulation-leads/*` routes, lead decryption
helpers, and the migration that creates retained lead tables.

## Target Architecture

The public flow remains:

1. Visitor enters an email address.
2. The server sends an OTP through Supabase Auth.
3. Visitor enters the code.
4. The browser submits `email` and `code` for verification.
5. The server verifies the OTP with the provider.
6. The server creates the application simulation session.
7. The server computes a non-reversible server-HMAC subject for request binding
   and the 24-hour rate limit.
8. The readable email is discarded.
9. The transient provider user is deleted immediately when feasible, with purge
   fallback inside the public simulation retention window.

No application table stores readable or encrypted email. Any stored
email-derived subject must be short-lived, server-HMAC based, never returned to
the browser, and unusable for admin contact workflows.

## Work Phases

### Phase 0 - Branch And Traceability

- [x] Update `dev` from `origin/dev`.
- [x] Create branch
      `feature/repo/remove-simulation-email-retention`.
- [x] Add accepted change request
      `CR-SPEC-0015-SPEC-0020-remove-simulation-email-retention`.
- [x] Create this implementation plan and close it in `docs/plans/done`.
- [x] Register `PLAN-0081` under `SPEC-0015` in `docs/specs/manifest.json`.
- [x] Update `docs/plans/active/README.md`.
- [x] Keep roadmap updates for the implementation phase before completion.

### Phase 1 - Tests First

- [x] Add migration/source tests covering the removal contract:
  - lead tables are dropped or guarded by a later drop migration;
  - lead RPCs are dropped or made no-op before final removal;
  - new verification request logic does not require
    `email_address_encrypted`;
  - `commercial_contact_optional` is not inserted by the public simulation
    flow;
  - rate-limit subject storage is short-lived and does not expose email values.
- [x] Update public simulation route-handler tests:
  - create email verification no longer accepts or records
    `consent_marketing`;
  - verify email request requires `email` plus `code`;
  - mismatched email/request subject fails safely;
  - successful verification creates a session without returning provider
    tokens.
- [x] Update Supabase-backed public simulation server tests:
  - no encrypted email is sent to RPCs;
  - no retained email hash is sent for lead behavior;
  - transient Auth user deletion is called after session creation when the
    provider returns an Auth user id;
  - provider cleanup failures are safe and covered by purge fallback.
- [x] Update public UI tests:
  - the optional marketing checkbox is gone;
  - the email step still sends a code;
  - the code step submits both email and code.
- [x] Update admin tests:
  - `/admin` and the admin shell no longer link to `/admin/leads`;
  - lead-specific copy is removed;
  - deleted lead pages/routes are not imported by active admin code.
- [x] Update privacy page tests:
  - no retained lead/contact wording remains;
  - OTP and 24-hour abuse-prevention wording remains.
- [x] Update environment example tests:
  - `SIMULATION_EMAIL_ENCRYPTION_SECRET` and
    `SIMULATION_EMAIL_HASH_SECRET` are no longer required if unused.

### Phase 2 - Specification And Product Copy Alignment

- [x] Update accepted specs through the accepted change request:
  - `SPEC-0003`: simulation operations are anonymized, not contact-driven.
  - `SPEC-0004`: remove commercial follow-up from the public simulation path.
  - `SPEC-0009`: replace retained email identity fields with short-lived
    verification/rate-limit subject storage.
  - `SPEC-0010`: update public verification API shape to verify with
    `email + code`.
  - `SPEC-0012`: remove optional commercial contact UI behavior.
  - `SPEC-0013`: remove `/admin/leads`; point future insight to anonymized
    analytics.
  - `SPEC-0015`: keep email OTP but remove application-owned email retention.
  - `SPEC-0018`: remove retained lead privacy language.
  - `SPEC-0020`: mark lead behavior superseded by the no-retention decision.
- [x] Update `SPEC-0021` draft so admin analytics replaces lead reporting
      instead of coexisting with it.

### Phase 3 - Public Email Verification Flow

- [x] Remove `consentMarketing` / `consent_marketing` from public simulation
      client, route handlers, tests, and UI.
- [x] Replace the required consent checkbox with clear explanatory copy unless
      a legal review requires an explicit acknowledgement.
- [x] Change verify request parsing so the body requires:
  - `email`;
  - `code`.
- [x] Bind verification requests to a short-lived subject HMAC so a request id
      created for one email cannot be verified with another email/code pair.
- [x] Remove encrypted-email DB handoff reads from verification.
- [x] Create or refresh simulation sessions with a short-lived
      `verification_subject_hash` instead of retained `email_normalized_hash`.
- [x] Keep per-verified-email rate limiting by hashing the verification subject
      with the existing server-only rate-limit secret.
- [x] Delete transient Supabase Auth users immediately after application session
      creation when possible.

### Phase 4 - Supabase Migrations And Data Cleanup

- [x] Add a forward migration that is safe whether or not the lead migration has
      already been applied in an environment.
- [x] Stop lead recording in
      `create_in_home_simulation_job_for_visitor_dispatch_outbox`.
- [x] Drop or no-op lead RPCs before dropping them finally:
  - `record_simulation_lead_for_job`;
  - `admin_list_simulation_leads`;
  - `admin_list_simulation_lead_jobs`;
  - `admin_delete_simulation_lead_identity`.
- [x] Delete and drop, if present:
  - `simulation_lead_jobs`;
  - `simulation_leads`.
- [x] Add replacement columns where needed:
  - `email_verification_requests.verification_subject_hash`;
  - `simulation_sessions.verification_subject_hash`.
- [x] Remove or relax old constraints that require
      `email_normalized_hash`.
- [x] Delete existing `commercial_contact_optional` records created by the
      public simulation flow.
- [x] Clear existing encrypted email handoff values.
- [x] Expire or revoke old simulation sessions that cannot be safely migrated
      without retaining identity.
- [x] Delete old email-based rate-limit rows.
- [x] Update purge SQL and Edge Function behavior so identity subjects,
      transient Auth users, expired sessions, and old rate-limit rows are
      cleaned reliably.
- [x] Keep old email columns nullable for compatibility and defer hard-dropping
      them until after the cleanup migration is deployed and observed:
  - `email_address_encrypted`;
  - old `email_normalized_hash` fields used only for retained identity;
  - optional commercial consent session links if unused.

### Phase 5 - Admin Lead Surface Removal

- [x] Remove `apps/web/src/app/admin/leads`.
- [x] Remove `apps/web/src/app/api/admin/simulation-leads`.
- [x] Remove `apps/web/src/lib/admin-simulation-leads*.ts`.
- [x] Remove lead navigation from `AdminDashboard` and `AdminShell`.
- [x] Remove lead copy from `admin-copy.ts`.
- [x] Remove lead CSS from `globals.css`.
- [x] Remove lead tests that no longer describe supported behavior.
- [x] Keep or create anonymized analytics work under `SPEC-0021`, not as a
      lead dashboard.

### Phase 6 - Privacy, Environment, And Roadmaps

- [x] Update `/politique-de-confidentialite` copy and tests.
- [x] Remove unused simulation email encryption/hash secrets from
      `apps/web/.env.example` and related env tests.
- [x] Keep Supabase purge env examples unchanged because the existing purge
      setting still controls the identity cleanup batch.
- [x] Update `docs/roadmap/web.md`.
- [x] Update `docs/roadmap/supabase.md`.
- [x] Update `docs/roadmap/workflow.md` only if spec/plan workflow metadata
      changes require it.

### Phase 7 - Rollout Preparation

- [x] Prepare a compatibility migration to deploy first:
  - stop new lead writes;
  - wipe retained lead data if present;
  - make lead RPCs harmless if old app code calls them briefly;
  - add new short-lived subject columns.
- [x] Prepare web code that removes lead UI and changes public verification.
- [x] Include one-time cleanup in the forward migration:
  - purge encrypted email handoff values;
  - delete lead tables data if present;
  - delete optional commercial simulation consent records;
  - clear old email-derived session/consent hashes;
  - delete old email rate-limit rows;
  - delete transient public simulation Auth users.
- [x] Leave row-count inspection for the operational deployment runbook before
      applying the migration to DEV or PROD.
- [x] Defer the final hard-drop migration until after the app is stable in the
      target environments.

## Verification Commands

Run narrow checks first, then broader checks:

```bash
pnpm spec:check
pnpm vitest run scripts/remove-simulation-email-retention-migration.test.mjs scripts/supabase-migrations-unique.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/simulation-public-route-handlers.test.ts src/lib/simulation-public-server.test.ts src/components/simulation/__tests__/EmailGateForm.test.tsx src/app/politique-de-confidentialite/page.test.tsx src/app/admin/AdminDashboard.test.tsx src/app/admin/admin-copy.test.ts
pnpm test:supabase:schema
pnpm --filter @mobel-unique/web test
pnpm typecheck
```

Run `pnpm build` before deployment-facing handoff if the implementation touches
Next.js routes or Supabase-backed server code broadly.

Completed verification:

```bash
pnpm spec:check
pnpm vitest run scripts/remove-simulation-email-retention-migration.test.mjs scripts/supabase-migrations-unique.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/simulation-client/auth.test.ts src/components/simulation/__tests__/EmailGateForm.test.tsx 'src/app/sofas/[slug]/simulate/start/PublicSimulationEmailGate.test.tsx' src/lib/simulation-public-route-handlers.test.ts src/lib/simulation-public-server.test.ts src/lib/simulation-rate-limit.test.ts src/app/admin/AdminDashboard.test.tsx src/app/admin/admin-copy.test.ts src/lib/env-example.test.ts src/app/politique-de-confidentialite/page.test.tsx
pnpm --filter @mobel-unique/web build
pnpm --filter @mobel-unique/web typecheck
pnpm test:supabase:schema
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -c "begin" -f supabase/migrations/20260509000400_public_simulation_supabase_auth_otp.sql -f supabase/migrations/20260509000500_public_simulation_identity_purge_cron.sql -f supabase/migrations/20260509000600_remove_in_home_simulation_worker_crons.sql -f supabase/migrations/20260511000100_in_home_simulation_checkpoint_purge.sql -f supabase/migrations/20260511000200_admin_simulation_leads.sql -f supabase/migrations/20260512000100_remove_simulation_email_retention.sql -c "rollback"
pnpm typecheck
pnpm test
pnpm test:root:parallel
pnpm build
```

## Acceptance Criteria

- Public visitors can still enter an email and receive a verification code.
- Public visitors can still verify the code and create simulations.
- The application database no longer stores readable or encrypted simulation
  email addresses.
- Optional commercial contact consent is gone from the public simulation flow.
- No retained simulation lead rows are created.
- `/admin/leads` and `/api/admin/simulation-leads/*` are removed or safely
  unavailable.
- Admin UI does not show, search, export, or delete email addresses for
  simulations.
- Per-email 24-hour simulation limiting still works through a short-lived
  server-HMAC subject.
- Expired verification/session/rate-limit identity state is purged.
- Transient Supabase Auth users from public simulation verification are deleted.
- Privacy copy states that simulation email is only for OTP and abuse
  prevention, not contact retention.
