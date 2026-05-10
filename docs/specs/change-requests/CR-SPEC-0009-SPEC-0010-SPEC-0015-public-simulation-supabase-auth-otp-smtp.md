# CR-SPEC-0009-SPEC-0010-SPEC-0015 Public Simulation Supabase Auth OTP SMTP

Target spec ids: SPEC-0009, SPEC-0010, SPEC-0015
Related spec ids: SPEC-0012
Status: accepted
Implementation Plans: PLAN-0074

## Reason For Change

The public in-home simulation email gate exists, but the current backend
implementation is a launch-window stub. It creates a local
`verification_request_id`, accepts a code without provider validation, and lets
the simulation creation RPC synthesize verified identity rows later. That is
not acceptable for production because the email is not really verified and the
database identity model does not prove consent or ownership.

The project has decided to use Supabase Auth email OTP with a custom SMTP
provider instead of building and operating an application-managed OTP engine.
This reduces custom security code for code generation, code storage, expiry,
attempt handling, and provider delivery while keeping the existing public
simulation API facade stable for the frontend.

## Proposed Change

The public simulation email verification endpoints keep their public route
shapes and response contract, but their implementation changes:

- `POST /api/public/simulation/email-verifications` validates the email and
  required consent, records a short-lived verification request with a normalized
  email hash and encrypted email handoff value, records required and optional
  consent separately, then delegates OTP delivery to Supabase Auth
  `signInWithOtp`.
- Supabase Auth email templates must be configured to send a numeric OTP using
  `{{ .Token }}` through the configured SMTP provider, not a magic link.
- `POST /api/public/simulation/email-verifications/{verification_request_id}/verify`
  loads the request, decrypts the email only for provider verification, calls
  Supabase Auth `verifyOtp`, records the returned `auth.users.id`, marks the
  verification request verified, creates or refreshes the application
  `simulation_sessions` row, and issues the existing opaque
  `simulation_access_token` cookie.
- The public browser does not receive Supabase Auth access tokens, refresh
  tokens, service-role keys, SMTP credentials, or private identity table ids.
- Public simulation creation must require an existing verified
  `simulation_sessions` row. The create-job RPC must stop synthesizing fake
  `email_verification_requests`, `consent_records`, or `simulation_sessions`
  rows from a stub request id.

The data model must allow Supabase Auth-backed OTP requests:

- `email_verification_requests` may reference the verified `auth.users.id`.
- `verification_code_hash` may be nullable when Supabase Auth owns code
  generation, storage, expiry, and verification. It remains required only for a
  future application-managed OTP provider.
- `consent_records` may be linked to the verification request that captured the
  consent before OTP delivery.
- `simulation_sessions` may reference the Supabase Auth user id while continuing
  to authorize public simulation actions through the application-owned opaque
  access-token hash.

Retention and consent behavior must be explicit:

- Raw email must not be logged or stored in plaintext.
- The encrypted email handoff value is retained only for the operational
  verification and simulation window, with a maximum of 24 hours for this MVP.
- Transient Supabase Auth users created only for public simulation verification
  must be soft-deleted or hard-deleted by a scheduled cleanup after the
  operational window unless a later accepted customer-account spec promotes the
  identity.
- Optional commercial contact consent controls a separate marketing/contact
  record and proof of consent. It must not be satisfied by retaining transient
  Supabase Auth users.
- Rejecting optional commercial contact consent must not block verification or
  simulation.

## Impact

- `SPEC-0009` must allow Auth-backed OTP metadata and retention links in the
  verification, consent, and simulation-session tables.
- `SPEC-0010` must clarify that Supabase Auth may be the verifier behind the
  public email verification facade and that Supabase Auth sessions remain
  server-side implementation details for this flow.
- `SPEC-0015` must replace the launch-window verification stub scope with the
  real Supabase Auth OTP + SMTP implementation while preserving the wizard
  routes and public API boundary.
- `PLAN-0074` must own the implementation, tests, SMTP configuration checklist,
  cleanup schedule, and rollout.
- Existing Realtime/checkpoint work under `PLAN-0068` is not changed by this
  request.

## Approval Note

Accepted for implementation because the product needs real email verification
before production use, and Supabase Auth OTP with custom SMTP is the selected
provider path for the public simulation gate.
