# PLAN-0003 Spec Language Guard

Plan: PLAN-0003
Spec: SPEC-0001
Status: done
Owner area: workflow
Affected packages:

- `scripts`
- `docs`

## Goal

Require specification content to stay in English before commits and reviews.

## Tasks

- [x] Document the repository-wide English language rule in `AGENTS.md`.
- [x] Add a language check to the specification guard for `docs/specs`.
- [x] Add tests for English spec acceptance and non-English spec rejection.
- [x] Translate existing draft spec content to English.
- [x] Update the workflow roadmap.
- [x] Run the focused guard and test checks.

## Tests

- Root Vitest tests cover the spec language guard passing English content and rejecting French content.
- `pnpm spec:check` runs the language guard together with the existing specification workflow checks.

## Roadmap

- `docs/roadmap/workflow.md`

## Notes

The language guard uses a local heuristic for French text markers. It is intentionally dependency-free so it can run before commits without network access.
