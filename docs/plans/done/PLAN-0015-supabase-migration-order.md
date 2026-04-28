# PLAN-0015 Supabase Migration Order

Plan: PLAN-0015
Spec: SPEC-0001
Status: done
Owner area: workflow
Affected packages:

- `.github/workflows/quality.yml`
- `package.json`
- `scripts/supabase-dev-deploy-workflow.test.mjs`
- `docs/roadmap/workflow.md`

## Goal

Allow the Supabase DEV deployment workflow to apply a missing local migration
whose timestamp is older than the latest migration already recorded on the
remote DEV database.

The failure happened after parallel work merged in this order:

- `20260428000100_spec_0011_admin_trusted_devices.sql` was applied to DEV.
- `20260427000400_fabric_render_gemini_provider.sql` merged later, but its
  timestamp sorts before the already-applied admin migration.

Supabase CLI blocks that case by default and asks for `--include-all`. The DEV
workflow should use that flag so a valid missing migration can still be applied
after a parallel merge.

## Tasks

- [x] Add a workflow regression test for the Supabase DEV deploy command.
- [x] Update the DEV deploy command to pass `--include-all` with
      `supabase db push`.
- [x] Keep seed data out of DEV deployment.
- [x] Update the workflow roadmap.
- [x] Run focused and broad verification.

## Tests

- `pnpm.cmd exec vitest run scripts/supabase-dev-deploy-workflow.test.mjs`
- `pnpm.cmd spec:check`
- `pnpm.cmd test`

## Roadmap

- `docs/roadmap/workflow.md`
