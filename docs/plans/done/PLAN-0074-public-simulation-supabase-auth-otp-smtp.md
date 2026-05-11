# PLAN-0074 Public Simulation Supabase Auth OTP And SMTP

Plan: PLAN-0074
Spec: SPEC-0015
Related specs: SPEC-0009, SPEC-0010, SPEC-0012
Change request: CR-SPEC-0009-SPEC-0010-SPEC-0015-public-simulation-supabase-auth-otp-smtp
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `supabase/migrations`
- `supabase/functions`
- `docs/specs`
- `docs/roadmap`

## Goal

Replace the public simulation email-verification stub with real Supabase Auth
email OTP backed by a configured SMTP provider, while preserving the existing
public simulation frontend contract and the application-owned
`simulation_access_token` boundary.

The result is:

- a visitor receives a real OTP email before starting an in-home simulation;
- the OTP is verified by Supabase Auth, not by custom application code;
- the application creates a verified `simulation_sessions` row only after
  provider verification succeeds;
- simulation job creation no longer fabricates identity rows from a stub id;
- raw email is encrypted only for the short verification handoff and purged
  within the 24-hour operational window;
- transient Supabase Auth users created only for this visitor flow are cleaned
  up by scheduled retention work.

## Non-Goals

- Do not expose Supabase Auth access tokens or refresh tokens to the public
  simulation browser flow.
- Do not convert public simulation visitors into persistent customer accounts.
- Do not build an application-managed OTP generator, code hash verifier, or
  SMTP sender.
- Do not modify the checkpoint, Realtime, placement, or regeneration worker
  architecture owned by PLAN-0068.
- Do not use optional commercial contact consent as a reason to keep transient
  Auth users. Marketing retention must be represented by a separate contact or
  consent record when implemented.

## Architecture

The existing routes remain the public contract:

```text
POST /api/public/simulation/email-verifications
POST /api/public/simulation/email-verifications/{verification_request_id}/verify
```

The backend changes behind those routes:

1. Requesting a code validates the email and required email-use consent,
   normalizes and HMAC-hashes the email, encrypts the raw email for the short
   verification handoff, records the verification request and consent records,
   and calls Supabase Auth `signInWithOtp`.
2. Supabase Auth sends the OTP through the configured SMTP provider and owns
   code generation, expiry, provider delivery, and Auth-side rate limits.
3. Verifying a code loads the request, decrypts the email only inside the
   server-side handler, calls Supabase Auth `verifyOtp`, records the returned
   `auth.users.id`, creates or refreshes the application `simulation_sessions`
   row, and issues the existing HTTP-only `simulation_access_token` cookie.
4. Simulation creation validates the application access token, resolves the
   verified session by access-token hash, enforces rate limits by IP and email
   hash, then creates the job. The create-job RPC no longer creates fake
   verification, consent, or session rows.
5. Scheduled cleanup purges encrypted email handoff data and deletes or
   soft-deletes transient Supabase Auth users after the operational window.

## Tasks

### Phase 0 - SMTP And Auth Configuration

- [x] Configure Supabase Auth email OTP in DEV.
- [x] Configure the custom SMTP provider in Supabase DEV.
- [x] Verify the sending domain with SPF, DKIM, and DMARC.
- [x] Change the Supabase Auth email template to use `{{ .Token }}` for OTP
      delivery instead of a magic-link-only template.
- [x] Set OTP expiry and resend behavior in Supabase Auth settings.
- [x] Document the exact DEV and PROD dashboard settings without committing
      SMTP secrets.
- [x] Repeat the configuration separately for PROD before launch.

### Phase 1 - Tests First

- [x] Add route-handler tests for requesting an OTP through an injected
      Supabase Auth provider.
- [x] Add route-handler tests for verifying an OTP and creating the
      application simulation session.
- [x] Add negative tests for invalid email, missing required consent, provider
      send failure, wrong/expired code, and missing verification request.
- [x] Add tests proving Supabase Auth access and refresh tokens are not returned
      to the browser.
- [x] Add tests proving simulation creation fails without a verified
      application session.
- [x] Add retention tests for encrypted email purge and transient Auth user
      cleanup eligibility.

### Phase 2 - Database And RPCs

- [x] Add a migration for Auth-backed verification metadata:
      `email_verification_requests.auth_user_id`,
      `simulation_sessions.auth_user_id`, and an optional
      `consent_records.email_verification_request_id`.
- [x] Renumber PLAN-0074 public simulation migrations after the rebased
      `dev` branch introduced `20260509000100_fabric_render_selected_queue_resume.sql`,
      preserving unique Supabase migration version prefixes and the intended
      Auth OTP -> purge cron -> worker-cron removal order.
- [x] Allow `email_verification_requests.verification_code_hash` to be null
      only for Supabase Auth-backed OTP requests.
- [x] Add indexes for verification request lookup, Auth user cleanup, and
      active session lookup by access-token hash.
- [x] Replace the create-job RPC stub behavior so it requires an existing
      verified `simulation_sessions` row and never synthesizes verification or
      consent rows.
- [x] Keep RLS/service-role boundaries so private verification and consent rows
      are not readable by anonymous visitors.

### Phase 3 - Web Route Handlers

- [x] Introduce injectable dependencies for Supabase Auth OTP request/verify,
      encrypted email storage, consent persistence, and application session
      creation.
- [x] Update the email-verification create handler to persist the request and
      consent rows before calling Supabase Auth `signInWithOtp`.
- [x] Update the verify handler to call Supabase Auth `verifyOtp`, persist the
      verified Auth user id, create or refresh the application session, and set
      the existing `simulation_access_token` cookie.
- [x] Update `simulation-client/auth.ts` only where needed for new error codes,
      resend availability, or visitor-facing messages.
- [x] Keep local development supported through Supabase local email tooling or
      an explicitly local-only bypass. The bypass must be impossible in DEV and
      PROD.
- [x] Update `apps/web/.env.example` and env-example tests for any new
      server-only encryption or retention settings.

### Phase 4 - Simulation Session Integration

- [x] Update simulation job creation to resolve ownership from the verified
      `simulation_sessions` row, not a stub verification id.
- [x] Ensure rate limits use the verified email hash from the application
      session.
- [x] Ensure idempotency retries still resolve only jobs owned by the same
      access-token hash.
- [x] Verify status, dimensions, Realtime token, regeneration, and result
      download endpoints keep their existing authorization behavior.

### Phase 5 - Retention Cleanup

- [x] Implement a service-role cleanup path that nulls encrypted email handoff
      values after the operational window.
- [x] Implement transient Supabase Auth user cleanup using the Supabase Auth
      Admin API from trusted server-side code only.
- [x] Schedule cleanup with Supabase Cron. Hourly or daily is enough; this does
      not require a once-per-minute job.
- [x] Ensure cleanup does not remove data needed for an active simulation inside
      the 24-hour retention window.
- [x] Ensure commercial consent proof is separate from transient Auth user
      retention.

### Phase 6 - UX And Rollout

- [x] Add or finish "resend code" UX using provider resend availability.
- [x] Map provider errors to safe French visitor copy.
- [x] Smoke test local, DEV, and then PROD separately.
- [x] Confirm real email delivery, successful verification, simulation start,
      result access, and cleanup behavior before closing this plan.

## Tests

Required narrow checks:

- `apps/web/src/lib/simulation-public-route-handlers.test.ts`
- `apps/web/src/lib/simulation-client/auth.test.ts`
- migration/schema tests covering the verification/session changes
- retention cleanup tests for purge and Auth user cleanup eligibility

Required broader checks before PR:

- `pnpm spec:check`
- `pnpm --filter @mobel-unique/web test`
- `pnpm test:supabase:schema`
- root `pnpm typecheck` if shared contracts or generated types change

Manual checks:

- Supabase local or DEV OTP email arrives with a numeric code.
- The public simulation email gate verifies the code from the browser.
- `POST /api/public/simulations` rejects unverified visitors and accepts
  verified visitors.
- A verified visitor can complete the existing in-home simulation flow without
  Realtime/checkpoint regressions.
- Cleanup removes encrypted handoff email and transient Auth users after the
  configured window.

## Regression Risks

- Supabase Auth users may accumulate if cleanup is not implemented or scheduled.
- Returning Supabase Auth sessions to the browser would unintentionally turn
  this visitor flow into a persistent account login flow.
- Removing the create-job stub may break local tests that rely on `stub-*`
  verification ids.
- Rate-limit behavior can drift if the verified email hash changes between OTP
  request, session creation, and job creation.
- SMTP DEV and PROD settings can be mixed accidentally if dashboard setup is
  not documented and verified per environment.
- Auth-side OTP expiry or resend limits can conflict with frontend copy if the
  configured values are not reflected in the API response.

## Roadmap

Update these roadmaps while the plan is active and again when it is completed:

- `docs/roadmap/web.md`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`

## Notes

The implementation should treat Supabase Auth as the OTP verifier, not as the
public simulation authorization boundary. Public simulation actions continue to
use the application-owned `simulation_access_token` and `simulation_sessions`
authorization model already used by the wizard.

Closure note, 2026-05-11:

- The Supabase Auth email OTP path has been deployed and manually verified in
  PROD with a six-digit OTP email template and production Site URL.
- DEV and PROD SMTP/Auth settings are configured separately. Dashboard-only
  SMTP secrets remain outside the repository.
- The visitor resend path remains the existing email-step re-request flow,
  with provider-side resend and rate-limit behavior enforced by Supabase Auth.
- Retention and cleanup behavior is covered by the migration and route-handler
  tests listed above; production launch-level retention smoke testing remains
  tracked by PLAN-0042.
