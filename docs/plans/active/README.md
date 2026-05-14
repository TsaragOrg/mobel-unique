# Active Plans

Execution plans currently being implemented.

Every active plan must reference a registered spec id from `docs/specs/manifest.json`.
Plans that have shipped or have been superseded by a newer active plan must be
moved to `docs/plans/done` with a closure note before new implementation work
continues.

| Plan | Spec | Status | Owner area | Summary |
| ---- | ---- | ------ | ---------- | ------- |
| PLAN-0042 | SPEC-0015 | active | workflow | Production launch test, cross-team sign-off, and operations runbook. |
| PLAN-0087 | SPEC-0012 | active | web | Public catalog and sofa detail loading states will reserve card and hero-shaped skeleton space to reduce CLS from the old 150 px loading panel replacement. |
| PLAN-0094 | SPEC-0012 | active | web | Public catalog cache boundary will keep catalog JSON fresh after publish/unpublish while making public image objects long-cacheable through immutable Storage paths. |
| PLAN-0095 | SPEC-0012 | active | web | Public fabric switching preloads variant renders and keeps the previous render visible until the next render is decoded, removing the desktop white flash and the first-switch network delay. |
| PLAN-0096 | SPEC-0004 | active | web | Public catalog card CTA simplifies to a single `Simuler` label by removing the leading sparkle glyph and the duplicated sofa name from the card link. |
