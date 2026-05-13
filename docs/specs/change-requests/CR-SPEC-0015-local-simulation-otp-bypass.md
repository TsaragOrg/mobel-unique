# CR-SPEC-0015 Local Simulation OTP Bypass

Change Request: CR-SPEC-0015-local-simulation-otp-bypass
Status: accepted
Date: 2026-05-12
Target Spec: SPEC-0015
Implementation Plan: PLAN-0092

## Summary

Allow a local-only fixed OTP bypass for the public simulation email gate so
developers can test the simulation flow without opening Mailpit for every run.

The bypass must not change DEV or PROD behavior.

## Decision

The web server may accept `SIMULATION_EMAIL_OTP_BYPASS_CODE` only when both
`APP_ENV` and `NEXT_PUBLIC_APP_ENV` are exactly `local`.

When enabled:

- the public simulation email gate still collects an email address;
- the server still creates the normal verification request;
- the browser still submits `email + code`;
- the server accepts only the configured six-digit code;
- the server creates a transient local Supabase Auth user for the session
  foreign-key boundary;
- the existing verified-session, cookie, and rate-limit behavior remains
  unchanged;
- the transient Auth user cleanup path still runs after the application session
  is created.

## Constraints

- The bypass variable must be server-only and must not use a `NEXT_PUBLIC_`
  prefix.
- The bypass must fail fast when configured outside local environments.
- The bypass must not store readable or encrypted simulation emails.
- The bypass must not bypass application session creation or rate limiting.
- Existing Mailpit OTP testing remains supported when the bypass variable is
  unset.

## Acceptance Criteria

- Local developers can enter the configured six-digit code to pass the email
  gate.
- Wrong codes still fail with the same invalid-code path.
- DEV and PROD cannot enable the bypass accidentally.
- Tests cover the bypass provider and environment guard.
