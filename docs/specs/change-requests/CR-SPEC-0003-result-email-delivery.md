# CR-SPEC-0003 Result Email Delivery

Target spec id: SPEC-0003
Status: accepted

## Reason For Change

`SPEC-0003` currently states that visitors can download the generated simulation result while it is retained.

During `SPEC-0004 Public Customer Experience` drafting, the product decision changed: the MVP should not expose a direct browser download for the private generated simulation image. Instead, visitors should request the generated result by email.

This supports lead capture while keeping the public simulation flow account-free.

## Proposed Change

Update `SPEC-0003` so that:

- visitors can view the generated simulation result after a successful simulation;
- visitors can request the generated result by email while it is still retained;
- direct browser download of the private simulation result is not required in MVP;
- email is required only for result email delivery, not for browsing, choosing a sofa, or starting/viewing a simulation;
- result email delivery requires a consent step explaining temporary retention and deletion no later than 24 hours after creation;
- optional marketing or contact consent is separate from required result-delivery consent.

## Impact

- Public UI: result delivery requires an email form and consent checkboxes.
- Privacy: the privacy spec must define consent storage, retention wording, and deletion behavior.
- API: API contracts must support result email delivery requests.
- Worker: worker jobs may need email delivery or handoff to an email provider.
- Data model: storage is needed for result email requests and consent state.
- Roadmaps: no implementation roadmap changes until plans are created.

## Approval Note

Accepted during `SPEC-0004` drafting to align the parent business-context spec with email-based result delivery for the MVP.
