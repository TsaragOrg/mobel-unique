# CR-SPEC-0007 Placement Feedback Loop And Corners Validator

Target spec ids: SPEC-0007
Related draft specs: none
Status: accepted

## Reason For Change

`SPEC-0007` was originally written assuming a single image-model JSON call
would return room geometry mode plus point coordinates plus confidence in
one shot. That approach was implemented and rejected during validation
because gpt-image-2 is unreliable at producing structured numeric
coordinates from a photograph: the model placed dots inconsistently,
returned malformed JSON in a non-trivial fraction of attempts, and made
extra retries economically painful. The validated alternative was to
split geometry detection into three deterministic steps that each have a
single responsibility and that each can be unit-tested independently.

In parallel, end-to-end live validation on 2026-04-30 found that the
Stage 2 placement step rendered the customer's sofa at a noticeably
smaller width than the supplied real-world dimensions when the back wall
contained a door, window, or AC unit. The model regressed toward a
generic stock-sofa proportion (typically ~67% wall width when the
customer asked for ~78%) and shifted the sofa horizontally to "avoid"
architectural features. Customers reading the result saw a sofa that
clearly did not match the dimensions they entered.

The accepted solution is a self-correcting feedback loop in Stage 2:
generate, measure the rendered output with a dedicated vision JSON call,
compare against target ratios, and retry with corrective feedback when
the result is off-target. The loop converges in 1-2 attempts on most
back_wall photos and returns the closest candidate when 3 attempts are
exhausted.

The Stage 1 corners step received parallel hardening: a deterministic
geometric validator (frame-edge, vertical-alignment, and Y-ordering
rules) plus a 3-attempt retry loop, plus prompt strengthening
(FRAME-EDGE WARNING and SELF-CHECK blocks). The validator was tuned to
the actual misplacement modes observed during live testing.

These changes make the worker behave consistently with the customer's
supplied dimensions and bring placement quality to acceptance grade.
The original spec text described the rejected single-call approach and
the unenforced placement quality, so the spec must be updated to match
the implementation that was validated end-to-end.

## Proposed Change

Update `SPEC-0007` so that:

- the Stage 1 geometry process is described as three deterministic
  sub-steps (vision-JSON scene classifier, image-edit corners step,
  pure-code dot detection and classification with geometric validator
  retry) instead of one image-model JSON call;
- the data-model section names the corner coordinates that the worker
  actually persists (`topLeft`, `topRight`, `bottomLeft`, `bottomRight`
  for `back_wall`; `topLeft`, `topCenter`, `topRight`, `bottomLeft`,
  `bottomCenter`, `bottomRight` for `corner`);
- the Stage 2 section describes the self-correcting feedback loop, the
  vision-based placement-measurement provider, the `MAX_PLACEMENT_ATTEMPTS`
  budget (default 3), the `PLACEMENT_TOLERANCE_PCT` (default 5), and the
  closest-attempt return policy when the loop is exhausted;
- the Stage 2 section documents that the feedback loop is active for
  `back_wall` mode only in the current MVP and that `corner` mode
  remains single-shot with the strengthened prompt;
- the `supplied_dimensions` schema lists the optional sofa-dimension
  keys (`sofa_width`, `sofa_height` for `back_wall`; `sofa_left`,
  `sofa_right`, `sofa_height` for `corner`) and the optional `position`
  keyword (`left`, `center`, `right`) and the optional `room_depth`
  field, and explains that the feedback loop only activates when the
  target ratios can be computed from supplied dimensions;
- the spec acknowledges that `room_depth` is collected through the
  green "Глубина" line in the dimension-guide overlay and is used as
  an optional input for placement scaling;
- the prompt versions are bumped to `room_prep_v003` for the corners
  prompt and `sofa_placement_v003` for the placement prompt, with
  short summaries of what each version contains;
- the Providers section lists six provider roles (validation, cleaning,
  scene classifier, corners, placement, placement-measurement) and the
  optional Gemini fallback wrapper;
- the Retries section names three distinct budgets: stage-level claim
  retries on the job row, the corners-step in-stage retry budget, and
  the placement-step feedback-loop budget;
- the Environment Variables section names every variable the worker
  actually reads, including `IN_HOME_SIMULATION_PROVIDER_MODE`,
  `IN_HOME_SIMULATION_FALLBACK_PROVIDER`, `IN_HOME_SIMULATION_MAX_EDGE_PX`,
  `IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE`, and
  `IN_HOME_SIMULATION_WORKER_ID_PREFIX`;
- the scratch folder contract is updated to match the artifacts the
  worker actually emits (`room_corners.png`, `room_dimensions.png`,
  `worker_error.txt`).

## Impact

- Worker: `supabase/functions/in-home-simulation-worker/lib/providers/openai-corners.ts`,
  `lib/providers/openai-placement.ts`, `lib/providers/openai-placement-measurement.ts`
  (new), `lib/providers/gemini-placement.ts`, `lib/providers.ts`,
  `lib/corners-validate.ts` (new), and the lines step.
- Tests: `scripts/in-home-simulation-corners.test.mjs`,
  `scripts/in-home-simulation-corners-validate.test.mjs` (new),
  `scripts/in-home-simulation-openai-placement.test.mjs`,
  `scripts/in-home-simulation-placement-measurement.test.mjs` (new),
  and the test list in `package.json`.
- Provider keys: `OPENAI_API_KEY` is now read by the placement-measurement
  provider in addition to the existing roles. No new keys are introduced.
  The Gemini fallback is unchanged in scope.
- API contracts: `supplied_dimensions` accepts the new optional keys when
  callers are ready to send them; the worker still works without them.
  No API contract is broken. The `submit-dimensions` CLI helper is
  extended to forward `--position`, `--sofa-width`, `--sofa-height`,
  `--sofa-left`, `--sofa-right`, and `--room-depth` flags.
- Public UI: no immediate impact. A future visitor UI update should
  surface `position` (left / center / right) and the optional sofa
  dimensions through the dimension-collection step described in
  `SPEC-0004`.
- Cost: live-mode jobs in `back_wall` mode now incur up to two
  additional vision-JSON calls when the loop retries. Worst case is
  three placement generations plus three measurements; typical case is
  one or two. The expected average cost increase per job is small
  (single-digit cents on current OpenAI pricing) and is offset by
  removing the customer-facing regression where the rendered sofa was
  visibly the wrong size.

## Approval Note

Validated end-to-end on 2026-04-30 across two real customer photos in
both back_wall and corner modes. Two-photo end-to-end test set
confirmed by Ahmed: corner-mode placement (Letto 75) hit on first
attempt; back_wall L-shape (Cremona 97) loop ran three attempts and
returned the closest with acceptable visual quality. Visual results on
both photos confirmed acceptable to product. Placement v003 prompts and
the feedback-loop parameters are recorded as locked in repository memory
to prevent accidental rewording in future sessions.
