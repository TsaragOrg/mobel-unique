# PLAN-0011 Admin Auth And API Facade Foundation

Plan: PLAN-0011
Spec: SPEC-0011
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `supabase/migrations`
- `supabase/seed.sql`
- `packages/shared`
- `docs/roadmap/web.md`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`

## Goal

Deliver the first testable admin foundation for the MVP: Supabase Auth login,
trusted admin device state, protected admin entry routes, and the first-party
Next.js `/api/admin/*` facade required before catalog management, upload, and
render workflows can be implemented safely.

This plan intentionally stops before implementing sofa, fabric, tag, upload,
publication, render, or ZIP export workflows. Those features should build on
this auth and API boundary once it is working locally.

## Related Specs

- `SPEC-0010` defines the logical `/api/admin/*` contracts and Edge Function
  boundary.
- `SPEC-0011` defines admin authentication, authorization, trusted device
  sessions, and first-party admin API facade behavior.
- `SPEC-0013` defines the admin frontend routes and requires protected admin
  pages to use the first-party `/api/admin/*` facade.

## Tasks

- [x] Add failing tests for admin authorization before implementation.
- [x] Add a server-side trusted admin device store, using
      `admin_trusted_devices` or an equivalent table with hashed device tokens,
      `last_seen_at`, and `revoked_at`.
- [x] Add local-only admin provisioning support for the local Supabase stack,
      without requiring DEV or PROD credentials.
- [x] Add browser-safe Supabase client setup for admin login and session
      refresh.
- [x] Add server-only Supabase helpers for admin API route handlers, keeping
      service-role credentials out of browser code.
- [x] Implement the canonical admin claim check:
      `app_metadata.mobel_unique.role === "admin"`.
- [x] Reject `user_metadata`, request body fields, query parameters, and custom
      browser headers as sources of admin privilege.
- [x] Implement trusted device registration after successful admin login.
- [x] Store the trusted device secret in a `Secure`, `HttpOnly`, `SameSite`
      first-party cookie, with only a hash stored server-side.
- [x] Implement trusted device validation for steady-state admin access.
- [x] Implement `GET /api/admin/session` through the Next.js first-party API
      facade with `401`, `403`, and successful admin responses.
- [x] Add a minimal `/admin/login` page that signs in with Supabase Auth and has
      no public signup or admin provisioning controls.
- [x] Add a minimal protected `/admin` page that validates the admin session,
      handles refresh, and fails closed when auth, admin claim, or trusted
      device validation fails.
- [x] Add logout behavior that clears the browser auth session and trusted
      device browser state.
- [x] Ensure admin pages emit `noindex, nofollow` metadata and do not expose
      service-role keys, provider keys, raw private storage paths, or stack
      traces.
- [x] Keep browser admin workflows pointed at first-party `/api/admin/*` routes,
      not direct Supabase Edge Function URLs.
- [x] Update relevant roadmaps after implementation.
- [x] Run the narrowest useful tests first, then the broader quality gate.

## Tests

Add or update tests before implementation:

- admin auth helper tests for missing, malformed, expired, and wrong-environment
  tokens returning `401`;
- admin auth helper tests proving authenticated non-admin users receive `403`;
- admin auth helper tests proving `user_metadata` admin-like fields do not grant
  admin access;
- admin auth helper tests proving a server-controlled
  `app_metadata.mobel_unique.role === "admin"` claim grants admin access;
- trusted device tests proving plaintext device secrets are not stored;
- trusted device tests proving revoked devices fail authorization;
- trusted device tests proving a trusted device cookie alone does not grant
  admin access without a valid Supabase Auth admin session;
- `GET /api/admin/session` tests for anonymous, non-admin, revoked-device, and
  valid admin cases;
- `/admin/login` tests proving no public signup or provisioning controls are
  exposed;
- `/admin` tests proving anonymous and non-admin users cannot access protected
  admin content;
- logout tests proving admin access is cleared after logout;
- environment exposure tests proving browser-facing env examples do not include
  service-role credentials;
- a local Supabase smoke test for seeded admin login and trusted device restore,
  skipped with a clear message when local Supabase is not running.

## Roadmap

Update these roadmap files when implementation changes are made:

- `docs/roadmap/web.md` for admin login, protected routes, and first-party API
  facade work;
- `docs/roadmap/api.md` for the admin API boundary and authorization behavior;
- `docs/roadmap/supabase.md` for trusted device storage and local admin seed
  behavior.

## Notes

Use Supabase Auth email and password for the MVP administrator. The application
must not expose public signup or self-service admin creation.

Prefer a cookie-backed admin session setup if the implementation needs
server-side route protection. Browser code may use only the public Supabase URL
and anon or publishable key.

Server-side route handlers may use service-side credentials only after request
authentication and authorization are validated. Service-role credentials must
remain server-only and must not appear in admin session responses, browser
bundles, public env files, logs, or client-visible errors.

The first implementation may keep the admin dashboard minimal. Its purpose is
to prove that the admin can sign in once, revisit on the same trusted mobile
device without repeated password prompts, call the first-party admin session
facade, and fail closed when auth conditions are not met.

Do not add generic domain actor fields such as `created_by`, `updated_by`,
`published_by`, or persistent admin audit tables as part of this plan.
