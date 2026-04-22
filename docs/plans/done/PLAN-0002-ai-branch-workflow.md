# PLAN-0002 AI Branch Workflow

Plan: PLAN-0002
Spec: SPEC-0002
Status: done
Owner area: workflow
Affected packages:

- `scripts`
- `docs`

## Goal

Add a repository command for developers and AI agents to create workflow-compliant Git branches.

## Tasks

- [x] Write tests for branch naming validation.
- [x] Add the branch creation script.
- [x] Expose the script through `pnpm`.
- [x] Document the command in agent and workflow docs.
- [x] Update the workflow roadmap.
- [x] Run the quality gate.

## Tests

- Root Vitest tests cover branch name generation and input validation.
- `pnpm test` runs root workflow script tests before workspace package tests.

## Roadmap

- `docs/roadmap/workflow.md`

## Notes

The command creates local branches only. Pushes and pull requests remain explicit developer actions.
