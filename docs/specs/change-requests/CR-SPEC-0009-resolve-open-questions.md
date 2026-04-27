# CR-SPEC-0009 Resolve Open Questions

Target spec id: SPEC-0009
Status: accepted

## Reason For Change

`SPEC-0009 Data Model And Storage` was accepted with several open questions
that were intentionally left for product and implementation review.

Those questions now have MVP decisions. Resolving them before implementation
will keep the schema, API contracts, privacy spec, and execution plans focused
and avoid adding unnecessary generic data structures.

## Proposed Change

Update `SPEC-0009` so that:

- public catalog images use public copies in `catalog-public-assets` for the
  MVP;
- signed URLs remain reserved for private assets unless a later accepted spec or
  change request changes the public image strategy;
- future structured public sofa attributes should start as explicit typed fields
  when a concrete need exists;
- a generic attributes table should be introduced only if future public
  attributes become numerous or administrator-defined;
- future private or admin-only sofa dimensions should use a separate private
  measurement model rather than visibility flags on MVP public dimensions;
- future internal notes on sofas or fabrics require a concrete admin workflow
  and should start as simple fields only for simple single-note needs;
- richer internal notes, comments, or history should use a dedicated table or
  activity-log model;
- future multiple-admin actor attribution should start with an audit or
  activity log;
- direct `created_by` and `updated_by` columns should be added only when a
  concrete UI or reporting need requires them;
- MVP ZIP export generation may be implemented as a server-side action;
- ZIP export generation may move to an async job if file count, runtime, or
  platform limits make synchronous generation unreliable;
- analytics consent remains client-side only for MVP unless the privacy,
  retention, and abuse protection spec requires server-side auditability.

## Impact

- Data model: avoids adding generic attributes, private-dimension flags, admin
  note fields, and per-row actor attribution before concrete workflows exist.
- API: public catalog image URLs can use public asset URLs; private assets still
  require signed URLs.
- Admin UI: keeps MVP forms focused on required catalog, fabric, render, and
  publication workflows.
- Privacy: analytics consent persistence is deferred to the privacy spec unless
  server-side proof becomes required.
- Worker/export implementation: ZIP exports can start simple and move to a job
  without changing the accepted data model.

## Approval Note

Accepted after `SPEC-0009` acceptance to resolve remaining open questions before
implementation planning begins.
