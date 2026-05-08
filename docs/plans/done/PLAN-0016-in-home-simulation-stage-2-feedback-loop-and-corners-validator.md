# PLAN-0016 In-Home Simulation Stage 2 Feedback Loop And Corners Validator

Plan: PLAN-0016
Spec: SPEC-0007
Status: done
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker`
- `scripts`
- `scripts/in-home-simulation-live-pipeline`
- `package.json`
- `docs/specs/accepted/SPEC-0007-in-home-simulation-worker.md`
- `docs/specs/change-requests/CR-SPEC-0007-placement-feedback-loop-and-corners-validator.md`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`

## Goal

Replace the rejected single-call geometry approach in Stage 1 with the
three deterministic sub-steps validated by the live harness, and add a
self-correcting feedback loop to Stage 2 placement so the rendered sofa
matches the customer's supplied real-world dimensions in `back_wall`
mode. Bring the production worker behaviour and prompts in line with the
2026-04-30 live-validated configuration in
`scripts/in-home-simulation-live-pipeline/`.

This plan delivers:

- a pure geometric validator at
  `supabase/functions/in-home-simulation-worker/lib/corners-validate.ts`
  with frame-edge, vertical-alignment, and Y-ordering rules for
  back_wall and corner mode, and the matching `vitest` unit tests at
  `scripts/in-home-simulation-corners-validate.test.mjs`;
- a 3-attempt corners retry loop inside `OpenAICornersProvider`,
  wrapping the existing image-edit call with detect → classify →
  validate → retry, including the new `validateReturnedDots` helper
  exposed for tests;
- prompt v003 for the corners step (FRAME-EDGE WARNING and SELF-CHECK
  blocks) baked into `PROMPT_BACK_WALL` and `PROMPT_CORNER`;
- a new placement-measurement provider at
  `lib/providers/openai-placement-measurement.ts` that calls GPT-5
  vision with a JSON-object response format and returns
  `{sofa_width_pct, sofa_height_pct, position}`, with pure helpers
  exercised by `scripts/in-home-simulation-placement-measurement.test.mjs`;
- prompt v003 for the placement step (DOORS-DO-NOT-BLOCK, EXACTLY
  language, ANTI-REGRESSION block, calibrated corner-position metres,
  `{{FEEDBACK_BLOCK}}` placeholder) baked into the back_wall and corner
  templates of `lib/providers/openai-placement.ts`;
- a self-correcting feedback loop inside `OpenAIPlacementProvider` that
  generates → measures → compares → retries with corrective feedback
  for `back_wall` mode when full sofa dimensions are supplied, with
  `MAX_PLACEMENT_ATTEMPTS=3` and `PLACEMENT_TOLERANCE_PCT=5` defaults
  and a closest-attempt return policy on exhaustion, plus the pure
  helpers `computeBackWallTargets`, `isPlacementWithinTolerance`,
  `placementDeltaScore`, and `buildPlacementFeedback` for tests;
- wiring in `lib/providers.ts` so the live-mode placement provider is
  constructed with a measurement provider, and so the optional
  `IN_HOME_SIMULATION_FALLBACK_PROVIDER=gemini` wrapper continues to
  work;
- a `--position`, `--sofa-width`, `--sofa-height`, `--sofa-left`,
  `--sofa-right`, and `--room-depth` extension to
  `scripts/in-home-simulation/submit-dimensions.mjs` so dimension
  payloads built by the local helper carry the feedback-loop targets;
- Russian-tagged dimension labels rendered locally on top of
  `room_corners.png` to produce `room_dimensions.png`, including a
  green "Глубина" line in addition to the wall and height lines, with
  the depth line backed by an optional `room_depth` value supplied
  through `submit-dimensions`;
- prompt-version bumps coordinated across `OpenAIPlacementProvider`,
  `GeminiPlacementProvider`, and `MockPlacementProvider` so all three
  carry `sofa_placement_v003`;
- a SPEC-0007 update describing the actual implementation, escorted by
  a Change Request that records the rationale and impact;
- updated `package.json` test list so the new
  `in-home-simulation-corners-validate.test.mjs` and
  `in-home-simulation-placement-measurement.test.mjs` files are
  exercised by the root quality gate.

This plan does not change the API contract for
`submit_in_home_simulation_dimensions`, does not introduce new database
columns or migrations, and does not deliver the visitor UI for
collecting dimensions and position.

## Tests

- [x] `scripts/in-home-simulation-corners-validate.test.mjs` — 17 cases
      covering frame-edge tolerance, vertical-alignment, Y-ordering,
      and dispatch by mode for `validateBackWallCorners`,
      `validateCornerCorners`, and `validateClassifiedCorners`.
- [x] `scripts/in-home-simulation-placement-measurement.test.mjs` — 10
      cases covering `buildMeasurementRequest` shape, valid/invalid
      `parseMeasurementResponse` paths, and JSON schema validation.
- [x] `scripts/in-home-simulation-openai-placement.test.mjs` — 33
      cases. The pre-existing prompt and form-data tests were preserved
      and extended with new cases for the DOORS / EXACTLY /
      ANTI-REGRESSION / FEEDBACK-BLOCK / calibrated-corner sections of
      the v003 prompt and for the new pure helpers
      `computeBackWallTargets`, `isPlacementWithinTolerance`,
      `placementDeltaScore`, and `buildPlacementFeedback`.
- [x] `scripts/in-home-simulation-corners.test.mjs` — pre-existing
      cases for `selectCornersPrompt`, `buildCornersFormData`, and
      `parseCornersResponse` continue to pass against the v003
      prompts.
- [x] `scripts/in-home-simulation-gemini-placement.test.mjs` —
      pre-existing cases continue to pass; Gemini reuses the same
      `buildPlacementPrompt` so the prompt-version bump propagates
      automatically.
- [x] Root `pnpm test` runs all of the above plus the existing
      script-level smoke and unit suites; full count after this plan is
      315 cases in `scripts/` plus the workspace package tests.

## Tasks

- [x] Add or update vitest unit tests so they fail before
      implementation begins. (Tests for the new validators and the new
      measurement provider were added alongside the implementation in
      this plan; pre-existing placement and gemini tests continued to
      run green.)
- [x] Implement `lib/corners-validate.ts` with the pure validator
      contract and tune the thresholds against the 2026-04-30 live miss
      coordinates so they reject the bad placement without
      false-rejecting the good ones.
- [x] Wrap `OpenAICornersProvider.placeCornerDots` in a 3-attempt loop
      that decodes the returned PNG, calls `detectYellowDots`,
      classifies the dots, and runs the validator before accepting the
      attempt. Bump `OpenAICornersProvider.promptVersion` to
      `room_prep_v003`.
- [x] Strengthen `PROMPT_BACK_WALL` and `PROMPT_CORNER` with
      FRAME-EDGE WARNING / vertical-alignment self-check and
      ceiling-floor / inner-edge self-check blocks respectively, and
      keep the sentinel phrases that the existing pure-prompt tests
      assert against.
- [x] Implement `lib/providers/openai-placement-measurement.ts` with
      pure helpers and a Deno class. Validate the JSON schema fully
      (numeric ranges and the `position` enum) before returning ok.
- [x] Strengthen `PLACEMENT_BACK_WALL_TEMPLATE` and
      `PLACEMENT_CORNER_TEMPLATE` with the DOORS-DO-NOT-BLOCK block,
      EXACTLY language, ANTI-REGRESSION block, calibrated corner
      positions in metres for centered placement, and the
      `{{FEEDBACK_BLOCK}}` placeholder. Inject the placeholder in both
      branches of `buildPlacementPrompt`. Bump prompt versions on the
      OpenAI, Gemini, and Mock placement providers to
      `sofa_placement_v003`.
- [x] Wire a `measurementProvider` constructor option into
      `OpenAIPlacementProvider` and the corresponding feedback loop in
      `placeSofa`. Disable the loop when the dimensions are not enough
      to compute targets or when the mode is `corner`. Return the
      closest attempt by `placementDeltaScore` when 3 attempts fail to
      reach tolerance.
- [x] Update `selectStage2Providers` in `lib/providers.ts` so the live
      branch constructs the measurement provider once from
      `OPENAI_API_KEY` and passes it into both the
      `OpenAIPlacementProvider` direct path and the
      `FallbackPlacementProvider` wrapper that the optional Gemini
      fallback uses.
- [x] Extend `submit-dimensions.mjs` to accept `--position`,
      `--sofa-width`, `--sofa-height`, `--sofa-left`, `--sofa-right`,
      and `--room-depth`. Inject them into the `supplied_dimensions`
      JSON only when set so existing back_wall and corner payloads
      continue to validate against `submit_in_home_simulation_dimensions`.
- [x] Add the two new test files to the root `pnpm test` chain in
      `package.json`.
- [x] Update `SPEC-0007` end-to-end (data model, Stage 1, Stage 2,
      generation core file contract, prompting, providers, retries,
      environment variables, acceptance criteria, known limitations) to
      describe the implementation as it is, and escort the spec change
      with `CR-SPEC-0007-placement-feedback-loop-and-corners-validator.md`.
- [x] Update the worker and supabase roadmaps with a single line each
      pointing at this plan.

## Verification

- [x] `pnpm vitest run scripts/in-home-simulation-corners-validate.test.mjs scripts/in-home-simulation-corners.test.mjs` — passes 31/31.
- [x] `pnpm vitest run scripts/in-home-simulation-placement-measurement.test.mjs scripts/in-home-simulation-openai-placement.test.mjs scripts/in-home-simulation-gemini-placement.test.mjs` — passes 50/50.
- [ ] `pnpm spec:check` (run before commit).
- [ ] `pnpm typecheck` (run before commit).
- [ ] `pnpm test` — last run before this plan was finalised: 315 cases
      in `scripts/` plus the workspace package suites green. Re-run
      before commit.
- [ ] `pnpm build` (run before commit).

## Notes

The placement feedback loop is intentionally **off** for `corner` mode
in this plan because the measurement contract is back-wall-specific and
L-shape silhouettes report inflated width relative to the along-wall
length. Expanding the loop to corner mode requires a corner-aware
measurement contract and is tracked under "Known Limitations And Future
Work" in `SPEC-0007`.

The visitor UI for collecting `position` (left / center / right) and
the optional sofa dimensions is also out of scope for this plan and
remains tracked under SPEC-0004 and the future public-frontend
specifications.

## Plan Hygiene Closure

Closed from active during the 2026-05-08 plan hygiene pass. Implementation evidence exists in worker code, live-pipeline scripts, tests, and roadmaps. Any remaining launch-level parity validation is tracked by PLAN-0042.
