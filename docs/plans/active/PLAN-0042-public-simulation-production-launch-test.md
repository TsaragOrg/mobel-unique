# PLAN-0042 Public Simulation Production Launch Test And Cross-Team Sign-Off

Plan: PLAN-0042
Spec: SPEC-0015
Status: active
Owner area: workflow
Affected packages:

- `docs/specs/accepted/SPEC-0015-public-simulation-wizard.md` (Open Questions resolution)
- `docs/operations/simulation-launch-runbook.md` (new)
- `scripts/seed-simulation-test-data.mjs` (final corner-tag value)
- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`

## Goal

Validate the SPEC-0015 wizard against the production worker on real
photos, confirm rate-limit, cost-cap, idempotency, regeneration, and
expiration mechanics, and obtain catalog-owner sign-off on the
corner-tag value. After this plan, the wizard is ready for first
public exposure.

This plan is mostly manual and is the last gate before launch. Per the
recorded "production worker input parity" rule, side-by-side parity
between terminal-harness output and production worker output is a
non-negotiable acceptance criterion.

## Tasks

### Cross-team sign-off

- [ ] Confirm with the catalog owner the exact tag value(s) that mean
      "corner sofa". Document the decision in the launch runbook.
- [ ] Update `scripts/seed-simulation-test-data.mjs` with the confirmed
      value and re-run the seed against the production catalog.
- [ ] Update SPEC-0015 Open Questions to mark the corner-tag value
      resolved. Note the decision date in `Last Reviewed`.

### Manual happy paths

- [ ] Back-wall happy path: real iPhone room photo of a back wall →
      upload → enter dimensions → review result → request one
      regeneration → confirm second result.
- [ ] Corner happy path: real iPhone room corner photo → upload → enter
      four dimension fields including `room_depth` → review result.
- [ ] For each happy path: side-by-side parity capture. Run the same
      source photo through `pnpm sim:live:*` (Ahmed only, per the
      "do not auto-run live pipeline" memory rule). Compare the dots,
      lines, and sofa output. Production must equal terminal within
      tolerance. Block launch if not.

### Defensive paths

- [ ] Trip per-IP rate limit: four uploads from one IP within 24 hours.
      Confirm the fourth returns the safe rate-limit message and no job
      is created.
- [ ] Trip per-email rate limit: three uploads under one verified email
      within 24 hours. Confirm the third is rejected.
- [ ] Cost-cap test in staging: temporarily lower
      `SIMULATION_DAILY_COST_CAP_USD` to a small value, run a
      simulation, confirm `simulation_cost_meter.worker_paused = true`
      and that subsequent claims return zero rows. Restore the cap
      before leaving staging.
- [ ] Idempotency test: post `POST /api/public/simulations` twice with
      the same `Idempotency-Key`. Confirm the same `simulation_job_id`
      comes back and only one storage object exists under
      `simulations/{job_id}/inputs/`.
- [ ] Regeneration limit test: complete a job, then request four
      successful regenerations. Confirm the fourth is rejected and the
      previous result remains visible.
- [ ] Expiration test in staging: shorten `SIMULATION_RETENTION_HOURS`
      to a small value, let a job expire, confirm the expired screen
      renders without a Restart action, and confirm the purge removed
      every artifact under the job prefix and the matching
      `idempotency_keys` rows.
- [ ] Error path test: upload a non-room photo (e.g. a portrait shot)
      and confirm the error screen offers Restart without
      re-verifying. Then upload a valid room photo and confirm the
      flow completes.

### Documentation and launch readiness

- [ ] Author `docs/operations/simulation-launch-runbook.md` capturing
      the production envs, the rate-limit defaults, the cost-cap
      defaults, the parity-baseline regeneration command, the
      catalog-owner contract, and a one-page rollback procedure.
- [ ] Update `docs/roadmap/web.md` and `docs/roadmap/supabase.md` to
      reflect SPEC-0015 launch readiness.
- [ ] Keep PLAN-0042 in `docs/plans/active` until production launch sign-off.
      PLAN-0038, PLAN-0039, PLAN-0040, and PLAN-0041 were already moved to
      `docs/plans/done` during the 2026-05-08 plan hygiene pass; any remaining
      launch-level parity or manual verification belongs here.
- [ ] Run `pnpm spec:check`.
- [ ] Sign off (Ahmed) on production launch.

## Tests

- Mostly manual; capture screenshots and worker artifact diffs in the
  launch runbook.
- Automated where they belong (rate-limit and idempotency assertions
  can sit in PLAN-0040; this plan re-runs them against production).

## Roadmap

- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`

## Notes

- The "production worker input parity" memory rule is the binding
  acceptance criterion for this plan: production worker output for any
  given source photo must equal what the same photo produces in the
  validated terminal harness. If parity drifts, the plan is incomplete.
- This plan never asks Claude to run `pnpm sim:live:*`. Per the
  "do not auto-run live pipeline" memory rule, Ahmed runs the live
  harness himself; Claude only documents the commands and inspects
  artifacts after Ahmed reports back.
- The regeneration limit (3 successful results per job) and the
  retention deadline (24 hours) are SPEC-0007 invariants; this plan
  verifies them in production but cannot relax them.
- Cost-cap restoration is a checklist item, not a script. Failing to
  restore the cap after the staging test would silently disable
  protection in production; the runbook calls this out explicitly.
