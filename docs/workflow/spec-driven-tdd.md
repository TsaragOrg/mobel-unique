# Specification-Driven TDD Workflow

Use this workflow for all meaningful product or platform changes.

## 1. Spec

Create a draft spec in `docs/specs/drafts`.

When approved, move it to `docs/specs/accepted` and register it in `docs/specs/manifest.json`.

Accepted specs are frozen. To change one, create a change request in `docs/specs/change-requests`.

## 2. Plan

Create an execution plan in `docs/plans/active`.

The plan must include:

- `Plan`
- `Spec`
- `Status`
- `Owner area`
- `Affected packages`
- `Tests`
- `Roadmap`

## 3. Red

Write or update the failing test first.

## 4. Green

Implement the smallest code change that satisfies the test and spec.

## 5. Refactor

Clean the implementation without changing behavior.

## 6. Verify

Run:

```bash
pnpm spec:check
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm check` to run the full quality gate.

## 7. Close

Update the relevant roadmap and move the completed plan to `docs/plans/done`.

