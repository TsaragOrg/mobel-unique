# Supabase DEV Worker Deploy Workflow

Plan: PLAN-0027
Spec: SPEC-0001
Status: done
Owner area: workflow

## Goal

Extend the existing Supabase DEV deployment workflow so a push to `dev` deploys
the fabric render worker runtime, not only database migrations.

The workflow should configure DEV-only Edge Function secrets from GitHub
Actions secrets, deploy `fabric-render-worker`, and upsert the Supabase Vault
secrets that let Supabase Cron invoke the deployed worker.

## Scope

This plan includes:

- validating DEV worker GitHub Actions secrets before deployment;
- setting DEV Edge Function secrets for the fabric render worker;
- deploying the `fabric-render-worker` Edge Function to the DEV project;
- upserting DEV Vault secrets for the cron runner after the function deploys;
- adding focused workflow tests.

This plan does not include:

- PROD deployment automation;
- rotating existing secrets;
- changing the worker provider implementation;
- changing Vercel deployment behavior.

## Tasks

- [x] Add failing workflow tests for DEV worker secrets, function deploy, and
      Vault cron secrets.
- [x] Update the Supabase DEV GitHub Actions job.
- [x] Update workflow roadmap and spec manifest.
- [x] Run focused workflow verification and spec guard.

## Verification

Required checks:

```powershell
pnpm.cmd exec vitest run scripts/supabase-dev-deploy-workflow.test.mjs
pnpm.cmd spec:check
```
