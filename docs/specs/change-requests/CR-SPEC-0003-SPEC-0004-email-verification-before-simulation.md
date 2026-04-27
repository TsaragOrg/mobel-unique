# CR-SPEC-0003-SPEC-0004 Email Verification Before Simulation

Target spec ids: SPEC-0003, SPEC-0004
Related draft specs: SPEC-0007
Status: accepted

## Reason For Change

The previous MVP decision allowed visitors to request the generated simulation
result by email while the result was retained. The current product decision
changes the email role: email is now required before simulation generation as an
anti-abuse verification step, and the generated result is displayed directly in
the browser after a successful verified simulation.

This supersedes the MVP result-delivery behavior recorded in
`CR-SPEC-0003-result-email-delivery`.

## Proposed Change

Update `SPEC-0003` and `SPEC-0004` so that:

- visitors must provide an email address before starting simulation generation;
- visitors must accept a required email-use consent for simulation verification,
  anti-abuse, and operational follow-up;
- visitors may optionally consent to commercial follow-up and offers;
- the system sends a short verification code to the provided email address;
- visitors must enter the verification code before simulation generation is
  allowed;
- a verified visitor may generate up to three results for the simulation attempt;
- generated results are displayed directly in the browser while retained;
- result delivery by email is not the MVP result-access mechanism.

## Impact

- Public UI: the simulation flow must include email capture, required consent,
  optional commercial contact consent, verification-code entry, resend/error
  states, and direct in-browser result display.
- API: API contracts must support verification-code request, code validation,
  verified simulation session state, simulation job creation only after
  verification, and regeneration within the verified session.
- Privacy: a follow-up privacy spec must define final email retention,
  consent wording, consent storage, and deletion or suppression behavior.
- Worker: worker jobs must assume the API has already verified the simulation
  session before queueing work.
- Data model: storage is needed for email verification attempts, verified
  simulation sessions, consent state, and anti-abuse metadata.
- Roadmaps: no implementation roadmap changes until plans are created.

## Approval Note

Accepted during in-home simulation specification review to make email
verification the MVP anti-abuse gate before generation while keeping result
display direct in the browser.
