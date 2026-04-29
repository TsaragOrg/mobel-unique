# Fabric Render Worker Provider Ownership Refactor

Plan: PLAN-0026
Spec: SPEC-0006
Status: done
Owner area: supabase
Depends on: PLAN-0025

## Goal

Move fabric render provider and model ownership out of the Vercel admin API and
into the Supabase fabric render worker.

The admin API should only create durable render jobs and enqueue them. The
worker should choose the configured provider/model at claim time, record the
actual provider/model on the job, and persist that metadata to generated
candidates.

## Scope

This plan includes:

- removing provider/model selection from `apps/web` job creation;
- updating duplicate detection to ignore provider/model because they are worker
  concerns;
- updating the worker claim RPC so the worker records the actual provider/model
  when it claims a job;
- updating the Edge Function to resolve provider/model from worker environment;
- removing provider/model env examples from browser-facing Vercel web config;
- updating cron SQL so cron invokes the worker without selecting a provider;
- focused tests for the ownership boundary.

This plan does not include:

- adding OpenAI provider implementation;
- changing prompt behavior;
- changing candidate selection or publication workflows;
- changing production secret names except removing provider/model from Vercel.

## Tasks

- [x] Add failing tests that admin job creation does not require or store
      provider/model.
- [x] Implement admin job creation without provider/model ownership.
- [x] Add failing worker/migration tests for provider/model assignment at worker
      claim time.
- [x] Implement worker-side provider/model assignment.
- [x] Remove cron provider header and Vercel provider/model env examples.
- [x] Run focused tests and typecheck.

## Verification

Required checks:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-migration.test.mjs
pnpm.cmd --filter @mobel-unique/web typecheck
pnpm.cmd spec:check
```
