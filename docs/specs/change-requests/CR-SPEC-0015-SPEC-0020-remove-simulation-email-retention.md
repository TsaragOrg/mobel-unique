# CR-SPEC-0015-SPEC-0020 Remove Simulation Email Retention

Target spec ids: SPEC-0003, SPEC-0004, SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0013, SPEC-0015, SPEC-0018, SPEC-0020
Related spec ids: SPEC-0021
Status: accepted
Implementation Plans: PLAN-0081

## Reason For Change

The public in-home simulation flow currently asks for an email address so the
visitor can receive a verification code before creating simulations. Later
accepted work expanded that identity path into optional commercial contact
consent, retained lead records, an admin lead dashboard, exact email search,
and email deletion behavior.

The product direction has changed. The email address must remain useful only
for proving that the visitor controls the mailbox and for enforcing a small
number of simulations per 24-hour period. The application must not retain email
addresses for commercial follow-up, export, admin search, or long-term identity
management.

Keeping encrypted email addresses or normalized email hashes for lead behavior
adds privacy, operational, and deletion complexity that is no longer justified
by the product need.

## Proposed Change

Keep the email verification gate, but remove application-owned email retention.

The public simulation flow must continue to:

- ask the visitor for an email address;
- send an OTP or equivalent verification code to that email address;
- verify the submitted code through the configured provider;
- create an application-owned simulation session after successful verification;
- enforce the configured per-verified-email simulation cap for a 24-hour window.

The public simulation flow must no longer:

- store a readable email address in application tables;
- store an encrypted email address in application tables;
- create retained lead records;
- ask for optional commercial contact consent;
- create contact or marketing records from the simulation email gate;
- expose email addresses to administrators;
- support admin exact-email search or email export.

To avoid storing encrypted email handoff values, the verification step should
receive the email address again from the browser together with the code. The
server should verify the provider OTP with that email address, compute the
short-lived rate-limit subject hash, and then discard the readable email.

The application may store a non-reversible HMAC subject for verification and
rate limiting, but only with these constraints:

- it is derived with a server-only secret;
- it is not returned to the browser or admin UI;
- it is used only for request binding, simulation session authorization, and
  rate limiting;
- it is purged or made unusable after the simulation/rate-limit window;
- it must not be treated as a lead, customer id, or contact identity.

Transient Supabase Auth users created only for public simulation OTP must be
deleted immediately after the application session is created when feasible. If
immediate deletion is not reliable for a provider edge case, scheduled cleanup
must delete those transient users within the existing public simulation
retention window.

## Admin Experience Change

`SPEC-0020` lead behavior is superseded for future implementation.

The protected admin experience should not include `/admin/leads`,
`/api/admin/simulation-leads/*`, retained lead rows, readable email values,
email export, or email deletion tools.

Admin simulation insight should move to anonymized analytics:

- total simulation counts;
- selected sofa counts;
- selected fabric counts;
- selected sofa/fabric combination counts;
- safe status and timestamp summaries when useful;
- no email values, email hashes, session ids, consent ids, verification request
  ids, room photos, generated customer room outputs, storage paths, or signed
  URLs.

The draft `SPEC-0021 Admin Simulation Analytics` should be aligned with this
decision so it replaces the former lead dashboard direction rather than
coexisting with it.

## Data Model Impact

Forward migrations must remove the retained-lead surface and clean existing
identity state safely:

- stop recording leads during public simulation job creation;
- delete and drop `simulation_lead_jobs` if it exists;
- delete and drop `simulation_leads` if it exists;
- drop lead RPCs such as `record_simulation_lead_for_job`,
  `admin_list_simulation_leads`, `admin_list_simulation_lead_jobs`, and
  `admin_delete_simulation_lead_identity` if they exist;
- remove encrypted email handoff storage from `email_verification_requests`;
- replace long-lived email-normalized hashes with a short-lived verification or
  rate-limit subject hash;
- delete `commercial_contact_optional` consent rows created by the public
  simulation email gate;
- stop linking public simulation sessions to optional commercial contact
  consent records;
- delete or expire old email-based rate-limit rows when their subject kind
  represents the former email identity boundary;
- delete transient public simulation Supabase Auth users that are no longer
  needed.

The enum value `commercial_contact_optional` does not need to be dropped if
Postgres enum removal would add unnecessary migration risk. The value must stop
being used by the public simulation flow.

## API And Web Impact

The public API facade must keep the email-code flow but update request shapes as
needed:

- `POST /api/public/simulation/email-verifications` sends the code and creates
  only short-lived request metadata.
- `POST /api/public/simulation/email-verifications/{verification_request_id}/verify`
  should accept both `email` and `code`, verify the provider OTP, bind the
  verification request to the same short-lived subject hash, create the
  application session, and avoid returning provider tokens.
- public simulation creation still requires the application simulation access
  token.

The public UI must remove the optional commercial contact checkbox. It may show
plain explanatory copy that the email is used only for the verification code and
24-hour abuse prevention.

The admin UI must remove lead navigation, lead pages, lead API callers, lead
copy, and lead-specific tests.

## Privacy Impact

The privacy page must stop saying that the simulation email can create retained
lead records or be used for commercial follow-up.

It must say, in plain visitor-facing language, that the email address is used to
send the verification code and prevent abuse, and that the application does not
keep it as a contact record for the simulation flow.

## Environment Impact

If no remaining code path encrypts or hashes retained simulation email
identities, these environment variables must be removed from the web package
requirements and examples:

- `SIMULATION_EMAIL_ENCRYPTION_SECRET`;
- `SIMULATION_EMAIL_HASH_SECRET`.

The existing server-only rate-limit subject secret may remain for the
short-lived HMAC boundary.

## Implementation Plan

`PLAN-0081` owns the implementation sequence, tests, migrations, data cleanup,
rollout order, and roadmap updates.

## Approval Note

Accepted because the product now needs email only for public simulation OTP
verification and 24-hour anti-abuse limits. Retained contact records, admin lead
dashboards, exact email search, and email export are out of scope for this
simulation flow.
