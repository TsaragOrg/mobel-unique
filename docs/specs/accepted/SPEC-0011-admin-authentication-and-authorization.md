# SPEC-0011 Admin Authentication And Authorization

Spec: SPEC-0011
Status: accepted
Layer: technical
Parent Spec: SPEC-0010
Depends On: SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0008, SPEC-0009, SPEC-0010
Areas: web, api, supabase, workflow
Implementation Plans: none yet

## Traceability

This spec resolves the admin authentication dependency left open by `SPEC-0010 API Contracts And Edge Functions`.

It follows:

- `SPEC-0001 Repo Foundation`, which defines the monorepo, environment separation, and workflow rules;
- `SPEC-0003 Business Context - AI Sofa Visualization`, which requires an admin back office for catalog, rendering, and operational workflows;
- `SPEC-0005 Admin Catalog and Fabric Management`, which defines administrator catalog capabilities;
- `SPEC-0008 Local Supabase Worker Development`, which defines local-only smoke-test exceptions;
- `SPEC-0009 Data Model And Storage`, which requires RLS and admin authorization before back-office reads and mutations;
- `SPEC-0010 API Contracts And Edge Functions`, which defines `/api/admin/*`, `/api/internal/*`, and worker API boundaries.

This spec is expected to feed implementation plans for the admin UI, Supabase Edge Functions, RLS policies, local admin smoke tests, and deployment checks.

## Goal

Define the MVP admin authentication and authorization model so that:

- only the single authorized MVP administrator can access the back office;
- the administrator can remain signed in on a trusted mobile device without periodic forced re-login;
- `/api/admin/*` endpoints reject anonymous users and authenticated non-admin users;
- admin claims are represented consistently to Supabase Edge Functions and any web API proxy;
- service-role credentials, provider keys, private bucket paths, and internal worker controls never reach browser-facing code;
- local development can test admin behavior without weakening DEV or PROD defaults;
- future multi-admin roles or audit trails can be added later without polluting the MVP data model.

## Scope

This spec includes:

- the MVP admin identity provider decision;
- the admin claim model;
- admin session requirements;
- trusted admin device session requirements;
- automatic session refresh requirements;
- admin account provisioning rules;
- authorization checks for `/api/admin/*`;
- separation between admin authorization and internal service authorization;
- local development and smoke-test rules;
- RLS policy expectations for admin access;
- storage and signed URL access rules for admin workflows;
- minimum testing requirements for admin auth.

## Out Of Scope

This spec does not define:

- privacy wording, visitor consent copy, retention legal basis, abuse thresholds, or deletion workflows;
- public visitor accounts;
- multi-admin role-based access control;
- per-action permissions such as editor, viewer, publisher, or super admin;
- mandatory two-factor authentication;
- native mobile app device attestation, biometrics, or OS-level secure enclave integration;
- SSO, OAuth, SAML, or enterprise identity providers;
- custom password storage or custom password hashing;
- final environment variable names and platform-specific deployment settings;
- a persistent application-level admin activity log;
- frontend page layout details for the admin login screen.

Those topics belong to later privacy, operations, environment, deployment, or multi-admin specs if they become necessary.

## Users And Permissions

### Public Visitor

A public visitor may use only the visitor-safe public API behavior exposed through `SPEC-0010`.

A public visitor must not be able to:

- access `/api/admin/*`;
- access `/api/internal/*`;
- call worker functions directly;
- read draft, unpublished, archived, admin-only, or private storage data;
- obtain service-role credentials or provider credentials.

### MVP Administrator

The MVP has one administrator.

The administrator can:

- access the admin UI after successful authentication;
- call `/api/admin/*` endpoints after admin authorization is proven;
- manage sofas, fabrics, tags, visual matrix columns, uploads, publication, render jobs, render candidates, ZIP exports, and operational views defined by accepted specs.

The administrator cannot:

- receive service-role credentials in browser-facing code;
- call `/api/internal/*` or worker-only endpoints from the browser by using the admin session alone;
- bypass API validation by writing directly to application tables or private buckets from the browser;
- create additional administrators through the MVP admin UI.

### Authenticated Non-Admin User

The MVP should not intentionally create public customer accounts.

If an authenticated non-admin Supabase user exists through local testing, future work, or accidental configuration, that user receives no back-office privileges by default.

### API Service

The API service may use server-side credentials only after request authentication and authorization are validated at the boundary required by the endpoint.

For admin requests, the API service must:

- verify the caller's Supabase Auth access token;
- verify the admin claim from server-controlled metadata;
- reject missing, invalid, expired, or non-admin tokens before performing back-office work.

### Internal Service Actor

Internal scheduler, cleanup, and worker-control actors are not administrators.

Internal service authorization must be separate from admin authorization. An admin browser session must not be enough to call `/api/internal/*` endpoints or worker-only functions unless a future accepted spec explicitly changes that boundary.

### Developer

A developer may run local admin smoke tests against the local Supabase stack.

Local development must not require DEV or PROD credentials. Local admin credentials and local bypass flags, if any, must be local-only and must not be committed.

## Authentication Model

### Identity Provider

The MVP admin identity provider is Supabase Auth.

The application must not implement a custom password verifier, custom password hash table, or custom browser-auth token format for the MVP.

Admin login must use a Supabase Auth session. The default MVP login method is email and password because it is testable locally without requiring a production email provider.

Password reset, invite email, email confirmation, and exact Supabase Auth project settings belong to the later environment and deployment spec.

### Admin Account Provisioning

The administrator account must be provisioned intentionally.

Allowed provisioning methods:

- manual provisioning through the Supabase Dashboard for DEV and PROD;
- a server-side provisioning script or migration helper that runs with service-role credentials outside browser code;
- a local-only seed command for local development.

The application must not expose public signup or self-service admin registration in the MVP.

The admin account's email must be allowlisted before the admin role is assigned. The exact allowlist variable names and deployment storage location belong to the environment and deployment spec.

### Admin Claim

The authoritative admin claim must live in Supabase Auth server-controlled metadata, not in browser-controlled metadata.

The canonical MVP claim shape is:

```json
{
  "app_metadata": {
    "mobel_unique": {
      "role": "admin"
    }
  }
}
```

Rules:

- `user_metadata` must not grant admin privileges;
- request body fields, query parameters, cookies, or custom browser headers must not grant admin privileges by themselves;
- the admin email alone must not grant admin privileges without the server-controlled admin claim;
- implementation may also enforce an admin email allowlist as defense in depth;
- any future role model must remain deny-by-default for users without an explicit server-controlled admin role.

### Admin Session

The admin UI must preserve the Supabase Auth session on a trusted admin device so the administrator is not forced to log in repeatedly.

Rules:

- browser-facing code may use only the public Supabase URL and public anon or publishable key;
- browser-facing code must never receive a service-role key;
- admin API calls must include the Supabase access token in the standard `Authorization: Bearer <token>` header or an equivalent secure server-side session bridge;
- admin authorization must be checked on every protected API request;
- the admin UI must enable Supabase Auth session persistence and automatic token refresh for the trusted device;
- the admin UI must refresh or validate the session when the admin app opens, resumes, regains network connectivity, or is about to perform a protected action;
- expired access tokens must be refreshed automatically when a valid refresh session is still available;
- the MVP must not impose periodic forced password re-entry only because time has passed;
- logout must clear the browser session used by the admin UI;
- if refresh fails because the session was revoked, the trusted device was revoked, the admin claim was removed, the browser cleared storage, or the auth provider invalidated the refresh token, the admin UI must fail closed and require a new login.

### Trusted Admin Device Session

After a successful admin login, the implementation must register or confirm the current browser or mobile device as a trusted admin device for that Supabase Auth user.

The trusted device mechanism must be server-verifiable and environment-specific.

Rules:

- a trusted device secret must be high entropy and unguessable;
- only a hash of the trusted device secret may be stored server-side;
- when the implementation uses a web proxy, the preferred storage for the trusted device secret is a `Secure`, `HttpOnly`, `SameSite` cookie;
- if direct Edge Function calls require browser-managed storage, the implementation must still avoid exposing service-role credentials and must bind the device secret to the verified admin session;
- the trusted device secret alone must not grant admin privileges without a valid Supabase Auth session and server-controlled admin claim;
- a valid Supabase Auth session without a trusted device may be allowed immediately after login so the device can be registered, but steady-state admin access must verify both the admin session and trusted device state;
- trusted devices must be revocable by server-side operation, even if the MVP UI does not expose a full device-management screen;
- a trusted device must be scoped to one Supabase environment and must not authorize DEV with PROD credentials or PROD with DEV credentials;
- successful admin app opens and protected admin actions should update the trusted device's `last_seen_at`.

The intended mobile behavior is:

- the administrator logs in once on the mobile device;
- the device becomes trusted after the login succeeds and the admin claim is proven;
- later visits refresh the Supabase session automatically;
- the administrator can manage the back office without repeated login prompts while the device remains trusted and the refresh session remains valid;
- re-login is required only for explicit logout, device revocation, admin deprovisioning, browser storage loss, auth-provider token invalidation, or another security failure.

## Authorization Boundaries

### Public APIs

Public APIs remain visitor-safe. A valid admin session must not change public API response shape or expose private fields through `/api/public/*`.

### Admin APIs

All `/api/admin/*` endpoints require admin authorization.

The required authorization sequence is:

1. Extract the access token from the request.
2. Verify the token against the correct Supabase project for the current environment.
3. Reject invalid, expired, missing, malformed, or wrong-environment tokens with `401 Unauthorized`.
4. Read the server-controlled admin claim from the verified token or from Supabase Auth.
5. Reject authenticated users without the admin claim with `403 Forbidden`.
6. Run endpoint-specific validation and authorization checks before using service-side privileges.

Admin APIs may expose internal database identifiers needed by the admin UI, but they must not expose:

- service-role credentials;
- provider credentials;
- raw private bucket paths unless a later accepted spec explicitly requires them;
- worker-only queue internals;
- unrelated visitor personal data;
- stack traces or provider error details.

### Internal APIs

All `/api/internal/*` endpoints require service-side authorization.

Internal authorization may use scheduler secrets, service tokens, Supabase infrastructure identity, or another server-only mechanism defined by the later environment and deployment spec.

Admin JWTs must not authorize internal endpoints by default.

### Worker Functions

Worker functions must require service-side authorization in DEV and PROD.

Local smoke tests may use simplified worker invocation only when:

- the endpoint is clearly local-only;
- the behavior is documented by the relevant implementation plan;
- the local exception cannot be enabled accidentally in DEV or PROD.

### First-Party Admin API Facade

Browser-based admin workflows, including mobile admin use, must use a first-party Next.js API facade for `/api/admin/*`.

The admin browser calls routes on the web domain, such as `/api/admin/uploads`, rather than calling worker-only functions or private service endpoints directly.

The Next.js API facade must:

- verify the Supabase Auth session;
- verify the server-controlled admin claim;
- verify trusted device state for steady-state admin access;
- enforce endpoint-specific validation and authorization;
- call Supabase Edge Functions or service-side Supabase APIs only after admin authorization succeeds;
- keep service-role credentials server-side only;
- store trusted device state through first-party mechanisms, preferably `Secure`, `HttpOnly`, `SameSite` cookies;
- avoid becoming a generic service-role proxy.

Supabase Edge Functions remain the production backend boundary for business logic, background workflow coordination, storage operations, and worker-facing behavior.

When the Next.js API facade calls Supabase Edge Functions, the Edge Functions must authenticate the server-to-server call through a server-only mechanism. Edge Functions must not trust arbitrary browser requests or unauthenticated proxy-shaped requests.

Direct browser calls to Supabase Edge Functions are allowed only for public visitor-safe endpoints or local smoke-test workflows explicitly documented by implementation plans. Admin browser workflows must not depend on direct Edge Function calls in the MVP.

## Admin Web Flow

The expected MVP admin flow is:

1. The administrator opens the admin login page.
2. The administrator enters the provisioned admin email and password.
3. The web app creates a Supabase Auth session.
4. The server verifies the token and admin claim.
5. The server registers or refreshes the trusted device session.
6. If authorized, the administrator can use the back office.
7. Admin API calls include the current access token and trusted device state when required by the chosen implementation.
8. On later mobile visits, the app refreshes the Supabase session automatically and updates trusted device activity.
9. On logout, revocation, missing admin claim, or failed refresh, admin pages become inaccessible until login succeeds again.

Rules:

- there must be no public signup link for admin access in the MVP;
- login errors must be generic and must not reveal whether an email is allowlisted;
- the admin UI must handle refreshable `401` states by attempting one controlled session refresh before requiring login again;
- the admin UI must handle `403` by showing an authorization failure, not by silently retrying with stronger credentials.

## Data Model

### Application Tables

The MVP does not require an application-level `admins` table.

Admin identity should come from Supabase Auth users and server-controlled `app_metadata`.

The MVP must not add generic domain actor fields such as:

- `created_by`;
- `updated_by`;
- `deleted_by`;
- `published_by`;
- `last_admin_id`.

If future multi-admin needs require actor attribution, those fields or an audit table must be introduced through a later accepted spec or change request.

### Trusted Admin Devices

The MVP requires server-side trusted device state so the administrator can stay signed in on a known mobile device without repeated login prompts.

The implementation should create an `admin_trusted_devices` table or equivalent server-side auth state with at least:

- `id`;
- `auth_user_id`;
- `device_token_hash`;
- `created_at`;
- `last_seen_at`;
- `revoked_at`.

Rules:

- trusted device rows are auth state, not domain actor attribution;
- the table must not store plaintext trusted device secrets;
- the table must not store service-role credentials or Supabase refresh tokens;
- one admin may have more than one trusted device, but only intentionally registered devices should be active;
- revoked devices must fail admin authorization even if stale browser storage remains on the device;
- trusted device state must be environment-specific and must not be shared between local, DEV, and PROD.

### Audit And Operational Logs

The MVP does not require a persistent application-level admin audit table.

Server-side admin actions should still emit structured operational logs where practical, including:

- request id;
- action name;
- resource type;
- resource id when safe;
- success or failure status;
- failure code when safe.

Operational logs must not include service-role credentials, provider keys, raw private storage paths, verification codes, or sensitive visitor image data.

## RLS And Database Access

Application tables that contain catalog, admin, job, consent, verification, or operational data must have RLS enabled according to `SPEC-0009`.

Minimum admin policy requirements:

- anonymous users receive no back-office table privileges;
- authenticated non-admin users receive no back-office table privileges by default;
- admin table access, when implemented directly through Supabase policies, must check the server-controlled admin claim;
- policies must not rely on `user_metadata` for admin authorization;
- policies must not trust request body fields, query parameters, or browser-supplied custom headers as proof of admin access;
- service-role Edge Functions may bypass RLS only for server-side operations defined by accepted specs and only after request boundary authorization has succeeded when the operation is user-initiated.

Preferred MVP pattern:

- browser-facing admin UI calls server-side API or Edge Functions;
- server-side API validates the admin token and performs controlled mutations;
- direct table writes from the browser are avoided for back-office workflows.

## Storage And Asset Access

Admin browser sessions must not bypass private storage boundaries.

Rules:

- admin uploads must use tightly scoped signed upload capabilities created by server-side APIs;
- private asset reads from the admin UI must use short-lived signed URLs created after admin authorization;
- public catalog assets remain stable public URLs and do not require admin auth for visitor reads;
- private bucket paths must not become durable browser state;
- admin ZIP export downloads must use short-lived signed URLs and require admin authorization before generation or retrieval;
- service-role credentials must never be used from browser-facing code to access storage.

## API Requirements

### Current Admin Session

The implementation may expose a lightweight admin session endpoint if the admin UI needs server-confirmed state.

Logical endpoint:

- `GET /api/admin/session`

Successful response:

```json
{
  "admin": {
    "authenticated": true,
    "role": "admin"
  }
}
```

Rules:

- the response must not include service-role credentials;
- the response must not include raw Supabase JWT claims beyond what the UI needs;
- the response must not include private visitor data;
- unauthenticated callers receive `401`;
- authenticated non-admin callers receive `403`.

### Admin API Error Semantics

Admin auth errors must use the envelope conventions from `SPEC-0010`.

Required behavior:

- missing token: `401 Unauthorized` with `AUTH_REQUIRED`;
- invalid, expired, malformed, or wrong-environment token: `401 Unauthorized` with `AUTH_INVALID`;
- valid authenticated user without admin claim: `403 Forbidden` with `ADMIN_REQUIRED`;
- disabled or deprovisioned admin account: `403 Forbidden` with `ADMIN_DISABLED`;
- local-only bypass accidentally requested outside local development: `403 Forbidden` with `LOCAL_AUTH_BYPASS_FORBIDDEN`.

Error messages must be safe for display and must not reveal sensitive auth internals.

## Local Development

Local admin development must prefer a seeded local Supabase Auth admin user.

Local-only requirements:

- local admin credentials may live in ignored local environment files;
- local seed commands must never point at DEV or PROD;
- local test users must use non-production email addresses;
- local smoke tests must verify both authorized and unauthorized admin behavior;
- local smoke tests must not require real DEV or PROD Supabase resources.

An implementation plan may include a local-only admin auth bypass only if all of the following are true:

- it is disabled by default;
- it requires an explicit local-only environment flag;
- it is ignored or rejected in DEV and PROD;
- it is covered by tests that prove it cannot authorize DEV or PROD requests;
- it is documented as temporary local development behavior.

## Environment Variables

This spec defines logical environment needs. Final variable names, storage locations, and platform settings belong to the later environment and deployment spec.

Logical environment needs:

- browser-safe Supabase project URL;
- browser-safe Supabase anon or publishable key;
- server-side Supabase service-role key for Edge Functions, provisioning, and server-side operations only;
- admin email allowlist;
- local admin seed email and password;
- trusted device cookie or storage configuration;
- optional local-only admin auth bypass flag, if an implementation plan justifies it;
- internal service or scheduler authorization secret for `/api/internal/*`;
- approved admin web origins for CORS.

Rules:

- frontend `.env.example` files must not include service-role credentials;
- committed examples must use placeholders, not real secrets;
- DEV and PROD must not share admin credentials, service-role keys, allowlists, or Supabase projects;
- local scripts must make it difficult to accidentally target DEV or PROD.

## Security Requirements

The implementation must enforce:

- deny-by-default admin authorization;
- server-controlled admin claims only;
- no admin privileges from `user_metadata`;
- no public signup or self-service admin registration;
- persistent trusted-device sessions for the single admin without periodic forced re-login;
- no service-role credentials in browser-facing code;
- no provider keys in browser-facing code;
- no admin browser access to `/api/internal/*` by default;
- no local auth bypass in DEV or PROD;
- trusted device secrets stored only as hashes server-side;
- trusted device secrets unable to grant admin access without a valid Supabase Auth admin session;
- no direct browser writes to private buckets or back-office tables outside scoped API behavior;
- generic login and auth error messages that avoid account enumeration;
- structured operational logging for admin auth failures and sensitive admin actions where practical.

## API Testing Requirements

Implementation plans for this spec must add tests for:

- anonymous callers cannot call `/api/admin/*`;
- authenticated non-admin Supabase users cannot call `/api/admin/*`;
- authenticated users with only `user_metadata` admin-like fields cannot call `/api/admin/*`;
- authenticated users with the server-controlled admin claim can call authorized admin endpoints;
- expired or malformed tokens receive `401`;
- expired access tokens are refreshed automatically when a valid refresh session and trusted device remain available;
- wrong-environment tokens receive `401`;
- non-admin users receive `403`;
- revoked trusted devices cannot call `/api/admin/*`;
- trusted device secrets alone cannot call `/api/admin/*` without a valid Supabase Auth admin session;
- mobile app revisit after a successful login can restore admin access without password re-entry when the refresh session and trusted device are valid;
- admin browser workflows call the first-party Next.js `/api/admin/*` facade rather than direct Supabase Edge Function URLs;
- Supabase Edge Functions reject unauthenticated or browser-shaped admin calls that do not come through the required server-to-server path;
- service-role keys are not exposed through admin session responses;
- browser-facing environment examples do not include service-role credentials;
- local admin seed flow works against local Supabase only;
- any local auth bypass is disabled outside local development;
- admin JWTs cannot call `/api/internal/*` endpoints by default;
- admin upload and signed URL APIs require admin authorization.

## Acceptance Criteria

- The spec traces to `SPEC-0010` and resolves its admin auth dependency.
- The MVP uses Supabase Auth for admin identity.
- The MVP supports one provisioned administrator and no public admin signup.
- The administrator can stay signed in on a trusted mobile device without periodic forced re-login.
- Trusted admin device state is server-verifiable and revocable.
- Browser-based admin workflows use a first-party Next.js API facade for `/api/admin/*`.
- Supabase Edge Functions remain the backend business-logic boundary and require authenticated server-to-server calls for admin workflows.
- The authoritative admin role is stored in server-controlled `app_metadata`.
- `user_metadata` and browser-supplied fields cannot grant admin privileges.
- `/api/admin/*` endpoints reject anonymous callers and authenticated non-admin users.
- `/api/internal/*` and worker-only functions remain service-authorized, not admin-browser-authorized.
- Browser-facing code never receives service-role credentials.
- Admin upload, private asset read, and ZIP export behavior remains mediated by server-side authorization.
- The MVP does not add generic `created_by`, `updated_by`, or persistent admin audit tables.
- The MVP may add trusted-device auth state without treating it as domain actor attribution.
- Local admin testing is supported without DEV or PROD credentials.
- Any local-only auth bypass is explicitly disabled outside local development.

## Review Checklist For Next Pass

- Confirm the claim shape is practical with Supabase Auth JWTs and RLS policies.
- Confirm the chosen login method is acceptable for the MVP admin workflow.
- Confirm trusted-device storage works on mobile browsers without requiring repeated login prompts.
- Confirm this spec does not introduce actor fields rejected by `SPEC-0009` and accepted change requests.
- Confirm admin auth remains separate from internal service authorization.
- Confirm local smoke-test exceptions from `SPEC-0008` do not leak into DEV or PROD defaults.
- Confirm the future environment and deployment spec owns final variable names, CORS origins, and Supabase Auth project settings.

## Open Questions

- None.
