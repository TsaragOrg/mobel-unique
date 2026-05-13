# PLAN-0092 Local Simulation OTP Bypass

Plan: PLAN-0092
Spec: SPEC-0015
Status: done
Owner area: web
Change request: CR-SPEC-0015-local-simulation-otp-bypass

## Goal

Make local public simulation testing faster by allowing a fixed six-digit OTP
code in local web environments while keeping the real verification request,
session, cookie, and rate-limit path intact.

## Scope

- Add server-only `SIMULATION_EMAIL_OTP_BYPASS_CODE`.
- Accept it only when `APP_ENV=local` and `NEXT_PUBLIC_APP_ENV=local`.
- Keep the normal Supabase Auth OTP provider when the variable is absent.
- Create or reuse only transient local public-simulation Auth users for the
  session foreign-key boundary.
- Reject wrong bypass codes without creating Auth users.
- Document the local setup in `.env.example` and the local Supabase guide.

## Verification

```bash
pnpm --filter @mobel-unique/web test -- src/lib/simulation-public-server.test.ts src/lib/env-example.test.ts
```

## Acceptance Criteria

- [x] Local developers can set `SIMULATION_EMAIL_OTP_BYPASS_CODE=000000`.
- [x] The email gate still executes the normal request/session flow.
- [x] The bypass cannot be enabled outside local app envs.
- [x] Wrong codes still fail.
- [x] The bypass variable is not exposed as a public env var.
