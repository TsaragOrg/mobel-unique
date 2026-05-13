# PLAN-0093 Swatch Small Backfill Batches

Plan: PLAN-0093
Spec: SPEC-0012
Status: done
Owner area: workflow
Affected packages:

- `package.json`
- `scripts/backfill-catalog-image-variants.mjs`
- `scripts/backfill-catalog-image-variants.test.mjs`
- `docs/roadmap/workflow.md`

## Goal

Provide explicit DEV and PROD backfill batches for the `swatch_small` fabric
swatch variant rollout without touching render image variants.

## Scope

- Keep the existing generic catalog variant backfill commands available.
- Add a swatch-only backfill scope to the existing backfill script.
- Add dedicated DEV and PROD `pnpm` scripts that use the swatch-only scope.
- Keep the PROD write guarded by `--confirm-prod`.
- Keep DEV and PROD credentials separated through the existing environment
  variables.

## Acceptance Criteria

- DEV dry-run and write commands target only active `fabric_swatch_public`
  assets.
- PROD dry-run and write commands target only active `fabric_swatch_public`
  assets.
- PROD write still requires an explicit confirmation flag.
- Tests cover the scope parsing, swatch-only candidate filtering, and package
  scripts.

## Verification

```bash
pnpm vitest run scripts/backfill-catalog-image-variants.test.mjs
pnpm spec:check
```

## Closure Note

Completed on 2026-05-13.

The catalog image variant backfill now accepts `--scope swatches`, and the root
package exposes dedicated DEV and PROD swatch-only batch commands. These
commands keep the generic variant backfill path available while making the
`swatch_small` rollout operation explicit and guarded.
