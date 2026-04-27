# CR-SPEC-0004-SPEC-0005 Accepted Spec Readiness Language

Target spec ids: SPEC-0004, SPEC-0005
Status: accepted

## Reason For Change

`SPEC-0004` and `SPEC-0005` are accepted specs, but both still contain draft-era
wording that says some areas must be resolved before acceptance.

That wording contradicts their accepted status. The referenced topics are either
already decided in later accepted specs or intentionally delegated to follow-up
technical specs, data model specs, UI design, or implementation planning.

## Proposed Change

Update accepted specs so that:

- draft-era "before acceptance" headings are replaced with delegated-detail
  language;
- `SPEC-0004` records that slug collision behavior is covered by admin catalog
  and data model decisions, while exact result-screen details remain delegated;
- `SPEC-0005` records that remaining UI pattern details are delegated to design
  and implementation planning;
- open-question labels no longer refer to accepted specs as drafts.

## Impact

- Specs: removes contradictory accepted-spec wording.
- Workflow: enables a spec guard rule that rejects accepted specs containing
  pre-acceptance blocker language.
- Product behavior: no behavior change.
- API, database, worker, and UI: no implementation change.

## Approval Note

Accepted as documentation cleanup so accepted specs cannot claim they still have
acceptance blockers.
