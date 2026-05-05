# CR-SPEC-0004-SPEC-0005 MVP Catalog Metadata Scope

Target spec ids: SPEC-0004, SPEC-0005
Related draft specs: SPEC-0009
Status: accepted

## Reason For Change

During `SPEC-0009 Data Model And Storage` drafting, the catalog data model was
reviewed for MVP complexity. The accepted public and admin specs still allow or
imply a generic public sofa attributes model and optional free-form admin notes.

Those concepts add database and UI complexity before the MVP has a concrete
workflow for them. The current product decision is to keep the MVP catalog model
focused on the fields already needed by the public and admin flows.

## Proposed Change

Update `SPEC-0004` and `SPEC-0005` so that:

- MVP public sofa information is limited to public name, public description,
  public dimensions, public tags, public renders, and Shopify order URL;
- the MVP does not require a generic structured public sofa attributes table;
- additional structured public sofa attributes require a later accepted spec or
  change request;
- dimensions stored on a published sofa are public dimensions in the MVP, so no
  per-sofa dimension visibility flag is required;
- free-form internal notes or admin-only metadata fields are not required for
  sofas or fabrics in the MVP;
- internal notes or richer admin-only metadata require a later accepted spec or
  change request tied to a concrete admin workflow.

## Impact

- Public UI: catalog and sofa detail pages remain focused on tags, description,
  dimensions, renders, simulation, and Shopify return.
- Admin UI: sofa and fabric forms avoid low-value optional notes and generic
  attribute management.
- Data model: `SPEC-0009` does not need `sofa_public_attributes`,
  `dimensions_are_public`, or `admin_notes` fields for the MVP.
- API: public read contracts do not need generic public attribute payloads for
  the MVP.
- Future work: structured public attributes, private dimensions, or admin notes
  remain possible through later specs when a concrete product need exists.

## Approval Note

Accepted during `SPEC-0009` drafting to keep the MVP catalog schema and admin
UI focused on the fields required by the approved public customer and admin
catalog workflows.
