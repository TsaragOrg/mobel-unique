# Specs

This directory is the working space for future Mobel Unique app specifications.

## Structure

- `drafts`: specs that can still change.
- `accepted`: specs approved for implementation. These are frozen by default.
- `change-requests`: explicit requests to change accepted specs.
- `manifest.json`: registry of accepted specs.

## Specification Architecture

Specs are organized as a traceable specification graph.

The graph can look like a tree when one parent business spec creates several child specs, but it is not required to be a strict tree. Some specs can depend on more than one prior spec, especially cross-cutting topics such as privacy, authentication, operations, or infrastructure.

Each spec must declare its layer and traceability metadata:

- `business-context`: parent product and business framing. Defines product intent, boundaries, actors, MVP scope, and invariants.
- `domain`: product or business-domain detail. Defines behavior for a major product area.
- `technical`: implementation contracts and technical design. Defines database, API, workers, storage, queues, providers, environment variables, or platform concerns.
- `cross-cutting`: behavior that affects several product areas, such as privacy, retention, abuse prevention, authentication, or operations.
- `workflow`: repository, process, branch, CI, review, or agent workflow.

Use these metadata fields at the top of every new spec:

```md
Spec: SPEC-0000
Status: draft
Layer: domain
Parent Spec: SPEC-0000
Depends On: none
Areas: web, api
Implementation Plans: none yet
```

`Parent Spec` identifies the spec that created or framed the need for this spec. `Depends On` identifies accepted specs whose decisions this spec must follow. `Implementation Plans` remains `none yet` until a plan is created.

Accepted specs must be registered in `manifest.json` with the same traceability information:

```json
{
  "id": "SPEC-0000",
  "title": "Spec Title",
  "status": "accepted",
  "layer": "domain",
  "parent": "SPEC-0000",
  "dependsOn": ["SPEC-0000"],
  "implementationPlans": ["PLAN-0000"],
  "path": "docs/specs/accepted/SPEC-0000-spec-title.md",
  "areas": ["web", "api"]
}
```

## Specification-Driven Development Flow

1. Start with a draft spec.
2. Create all necessary parent, domain, technical, and cross-cutting specs before implementation.
3. Move a spec to `accepted` only when it is approved.
4. Register accepted specs in `manifest.json`.
5. Create an execution plan under `docs/plans/active` only after the relevant spec is accepted.
6. Add or update tests before implementation for functional changes.
7. Update the relevant roadmap when implementation work changes a package or workflow.
8. Use a change request before editing an accepted spec.

Implementation must follow this traceability chain:

```text
Business decision -> accepted spec -> implementation plan -> tests -> code -> roadmap update
```

An accepted spec means the intended behavior is approved. It does not mean the behavior is implemented. Implementation status is tracked through plans, tests, code changes, and roadmaps.

Use `_template.md` as the starting point for new specs.
