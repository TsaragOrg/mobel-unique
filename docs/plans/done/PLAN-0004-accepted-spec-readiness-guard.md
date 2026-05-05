# PLAN-0004 Accepted Spec Readiness Guard

Plan: PLAN-0004
Spec: SPEC-0001
Status: done
Owner area: workflow
Affected packages:

- `scripts/spec-guard.mjs`
- `scripts/spec-guard.test.mjs`
- `docs/specs/accepted`
- `docs/specs/change-requests`
- `docs/roadmap/workflow.md`

## Goal

Prevent accepted specs from retaining draft-era language that says work must be
completed before the spec can be accepted.

## Tasks

- [x] Write or update tests first.
- [x] Implement the smallest change that satisfies the spec.
- [x] Update relevant roadmap.
- [x] Run the quality gate.

## Tests

- Add a spec-guard test that rejects accepted specs with pre-acceptance blocker
  language.
- Run `pnpm spec:check`.
- Run `pnpm test -- scripts/spec-guard.test.mjs`.

## Roadmap

- `docs/roadmap/workflow.md`

## Notes

This is a workflow guardrail change under `SPEC-0001`. It does not change
product behavior.
