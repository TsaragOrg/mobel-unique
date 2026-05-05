# PLAN-0062 Supabase PROD Deploy Workflow

Plan: PLAN-0062
Spec: SPEC-0001
Status: done
Owner area: workflow
Affected packages:

- `.github/workflows/quality.yml`
- `scripts/supabase-dev-deploy-workflow.test.mjs`
- `docs/roadmap/workflow.md`

## Goal

Add a dedicated GitHub Actions deployment path for Supabase PROD when `main`
receives a push, using only `SUPABASE_PROD_*` repository secrets and keeping
the existing DEV deployment behavior unchanged.

## Tasks

- [x] Add workflow regression tests for the PROD deploy job, secrets, runtime
      env, function deployment, and Vault cron secret upserts.
- [x] Add a `supabase-prod` job that runs after the quality gate only on
      `refs/heads/main`.
- [x] Configure the job with PROD-specific Supabase project, database, provider,
      and worker invocation secrets.
- [x] Mirror the existing migration, Edge Function deployment, and Vault upsert
      flow from DEV while setting `APP_ENV=prod`.
- [x] Update the workflow roadmap.
- [x] Run the narrow workflow test and specification guard.

## Tests

- `pnpm exec vitest run scripts/supabase-dev-deploy-workflow.test.mjs`
- `pnpm spec:check`

## Roadmap

- `docs/roadmap/workflow.md`

## Notes

This plan only configures Supabase PROD deployment automation. Vercel
Production environment variables remain configured directly in Vercel.
