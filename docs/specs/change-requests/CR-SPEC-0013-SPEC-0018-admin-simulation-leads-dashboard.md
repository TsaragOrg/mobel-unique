# CR-SPEC-0013-SPEC-0018 Admin Simulation Leads Dashboard

Target spec ids: SPEC-0013, SPEC-0018
Related spec ids: SPEC-0020
Status: accepted

## Reason For Change

`SPEC-0020 Admin Simulation Leads Dashboard` introduces a protected admin lead
surface and retained lead email records for visitors who explicitly accept both
the required simulation email consent and the optional commercial contact
consent.

`SPEC-0013` already identifies simulation operations as future privacy-dependent
admin work, but its route map does not yet include a separate lead dashboard.
`SPEC-0018` already says any future change to consent storage, deletion request
tracking, or longer retention requires a separate accepted spec or change
request.

The accepted admin and privacy contracts should therefore point clearly to the
new lead dashboard and retained lead email behavior before `SPEC-0020` is moved
from draft to accepted.

## Proposed Change

Update `SPEC-0013` so that:

- `/admin/leads` is recorded as a protected admin route for the consent-backed
  simulation leads dashboard;
- the `/admin` dashboard and admin shell may link to the leads route;
- `/admin/leads` remains separate from the lightweight `/admin/operations`
  placeholder;
- the leads route must follow `SPEC-0020` and must not expose customer room
  photos, generated customer room outputs, private storage paths, signed URLs,
  or technical identifiers.

Update `SPEC-0018` so that:

- the privacy page must explain that optional commercial contact consent can
  create a retained lead record after a simulation job is created;
- the privacy page must keep retained lead records separate from the 24-hour
  private image retention rule;
- the privacy page must explain that authorized administrators may use retained
  lead email information for consent-backed commercial follow-up;
- the privacy page must continue to avoid private implementation details,
  technical identifiers, storage paths, signed URLs, and secrets.

## Impact

- Specs: closes the open traceability question in `SPEC-0020` and aligns the
  accepted admin and privacy contracts with the new feature spec.
- UI: future implementation plans should add an admin dashboard entry point to
  `/admin/leads` and update the public privacy page copy.
- API and database: the concrete lead tables, admin endpoints, deletion rules,
  and tests are owned by `SPEC-0020`.
- Worker: no worker behavior changes are introduced by this change request.
- Roadmaps: future implementation plans for `SPEC-0020` must update the web and
  Supabase roadmaps when work is planned or completed.

## Approval Note

Accepted to unblock `SPEC-0020` acceptance while keeping the older accepted
admin and privacy specs traceable to the new consent-backed lead dashboard.
