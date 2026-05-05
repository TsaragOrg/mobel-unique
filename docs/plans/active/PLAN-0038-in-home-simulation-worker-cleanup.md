# PLAN-0038 In-Home Simulation Worker Cleanup

Plan: PLAN-0038
Spec: SPEC-0015
Status: active
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker`
- `docs/roadmap/supabase.md`
- `docs/roadmap/image-worker.md`

## Goal

Bring the in-home simulation worker codebase in line with the worker-cleanup
section of SPEC-0015 by removing the dead Gemini placement provider, removing
the scene classifier provider (room geometry mode now comes from the job row
deterministically), and tightening `lib/dimensions.ts` so `room_depth` is a
required `supplied_dimensions` key for both `back_wall` and `corner` modes.

This plan does not touch the validated v003 prompt path, the corners
retry+validate loop, or the back-wall placement feedback loop. The dots/
lines/sofa output for the standard test photo must remain pixel-equivalent
to the terminal-harness baseline after this plan ships.

## Tasks

- [x] Add unit test asserting `lib/providers.ts` no longer references the
      Gemini placement provider and that `IN_HOME_SIMULATION_FALLBACK_PROVIDER=gemini`
      is no longer wired through.
- [x] Delete `supabase/functions/in-home-simulation-worker/lib/providers/gemini-placement.ts`
      and remove `IN_HOME_SIMULATION_FALLBACK_PROVIDER` / `GEMINI_API_KEY`
      handling from `lib/providers.ts`.
- [x] Remove `GEMINI_API_KEY` and `IN_HOME_SIMULATION_FALLBACK_PROVIDER` from
      the worker's `.env.example` and any local development docs that still
      mention them.
- [x] Add unit tests for `lib/dimensions.ts` rejecting `back_wall` payloads
      that omit `room_depth` and `corner` payloads that omit `room_depth`,
      plus a happy-path test that includes `room_depth` in both modes.
- [x] Update `lib/dimensions.ts` so the validator treats `room_depth` as a
      required positive number in both `back_wall` and `corner` modes.
- [x] Add unit test confirming the Stage 1 dispatch path no longer calls a
      scene classifier and instead reads `room_geometry_mode` from the
      reloaded job row.
- [x] Delete `lib/providers/openai-scene-classifier.ts`.
- [x] Remove the scene-classifier role from `lib/providers.ts` and the
      `IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE` env handling.
- [x] Update Stage 1 dispatch (`index.ts` / dispatch helper) to read
      `room_geometry_mode` directly from the job row and pass it into the
      corners step.
- [x] Remove or rewrite the existing scene-classifier tests under
      `scripts/in-home-simulation-*` so the suite stays green.
- [x] Update `docs/roadmap/supabase.md` and `docs/roadmap/image-worker.md`
      with the cleanup outcome and the SPEC-0015 reference.
- [x] Run `pnpm typecheck`, `pnpm test`, `pnpm spec:check`.
- [ ] Worker behavior parity check (executed manually by Ahmed, not by
      Claude): run `pnpm sim:live:*` against the standard test photo and
      confirm dots/lines/sofa output is pixel-equivalent to the previous
      baseline. Pending Ahmed's local verification.

## Tests

- New unit tests for `lib/dimensions.ts` covering `room_depth` requirement
  in both modes (positive case + missing-key case).
- New unit tests for `lib/providers.ts` confirming Gemini and scene-classifier
  roles are absent from the live wiring.
- Updated dispatch tests that supply `room_geometry_mode` on the job row and
  assert no scene classifier is called.
- Existing corners step, placement step, feedback loop, and corners retry
  tests must keep passing unchanged.

## Roadmap

- `docs/roadmap/supabase.md`
- `docs/roadmap/image-worker.md`

## Notes

- The worker-cleanup section of SPEC-0015 explicitly requires removing
  Gemini and scene classifier and making `room_depth` required. This plan
  is the only place those changes happen; subsequent plans (DB foundation,
  API, UI, production test) must not touch worker code.
- v003 prompts (`PROMPT_BACK_WALL`, `PROMPT_CORNER`, `sofa_placement_v003`),
  the `MAX_CORNER_PLACEMENT_ATTEMPTS=3` retry loop, the back-wall feedback
  loop, the `MAX_PLACEMENT_ATTEMPTS=3` budget, and the
  `PLACEMENT_TOLERANCE_PCT=5` default are all out of scope for this plan.
- Scene classifier removal trades one GPT-5 vision call per simulation for
  a deterministic `room_geometry_mode` from sofa tags. Catalog owner must
  tag every corner sofa explicitly; PLAN-0042 owns the cross-team sign-off.
- Production worker behavior must equal the terminal-harness baseline after
  this plan ships. If the parity check fails, revert this plan before the
  remainder of the SPEC-0015 work continues.
- Hotfix `d4cb6ea` added `drop function if exists` before both
  `create or replace function` blocks in
  `supabase/migrations/20260502000100_in_home_simulation_stage_1_claim_returns_geometry_mode.sql`
  after the original migration deploy failed on `dev` with
  "cannot change return type of existing function". The fix is a
  pure deploy-side correction — no production behavior change, no
  unit-testable surface (the prior migrations already cover the
  Stage 1 claim semantics). Quality-gate spec guard exempts this
  case via the `## Notes` explanation.
