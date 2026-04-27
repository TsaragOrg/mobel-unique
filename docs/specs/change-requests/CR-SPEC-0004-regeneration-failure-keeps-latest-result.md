# CR-SPEC-0004 Regeneration Failure Keeps Latest Result

Target spec ids: SPEC-0004
Related draft specs: SPEC-0007
Status: accepted

## Reason For Change

The public result experience allows visitors to regenerate a simulation result
when they are not satisfied. The accepted public spec did not explicitly define
what happens when a regeneration fails after a previous result already exists.

The current product decision is that a failed regeneration must not remove or
hide the latest successful result.

## Proposed Change

Update `SPEC-0004` so that:

- a regeneration failure after a successful result keeps the previous result
  visible while retained;
- the public experience can show a readable regeneration error;
- the failed regeneration does not consume one of the three generated results
  unless a new output was successfully produced.

## Impact

- Public UI: the result screen should keep the latest successful result visible
  when a regeneration fails.
- API and worker: `SPEC-0007` defines the technical status transition and output
  counting behavior.

## Approval Note

Accepted during in-home simulation specification review to prevent a failed
regeneration from making an otherwise valid result unavailable.
