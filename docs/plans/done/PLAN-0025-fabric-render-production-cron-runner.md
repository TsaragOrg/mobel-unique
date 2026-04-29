# Fabric Render Production Cron Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production fabric render jobs run through Gemini without manual worker invocation.

**Architecture:** Admin APIs keep the existing queue handoff: pressing Generate creates a durable `fabric_render_jobs` row and sends a queue message. A Supabase Cron job invokes `fabric-render-worker` on a schedule, the worker claims queued jobs, calls Gemini, and writes private render candidates. The admin UI polls job status after generation is requested so administrators see completion without manually refreshing.

**Tech Stack:** Next.js admin route handlers, Supabase Edge Functions on Deno, Supabase Queues, Supabase Cron with `pg_cron` and `pg_net`, Supabase Vault, Vitest, `pnpm`.

---

Plan: PLAN-0025
Spec: SPEC-0006
Status: done
Owner area: supabase
Depends on: PLAN-0006, PLAN-0010, PLAN-0019, PLAN-0020, PLAN-0021

## Scope

This plan includes:

- production-oriented provider defaults for fabric render jobs;
- blocking accidental `mock` provider usage outside local/test environments;
- a worker invocation secret for non-local `fabric-render-worker` calls;
- a Supabase migration that installs a cron schedule for invoking the worker through `pg_net`;
- documented Vault secret names for the scheduled worker invocation;
- admin UI polling after `Generate` so the screen updates when the cron-driven worker finishes;
- focused tests and roadmap updates.

This plan does not include:

- making the browser call the worker directly;
- running Gemini inside the admin API request;
- selecting generated candidates automatically;
- public publication or export;
- in-home simulation worker behavior.

## Files

- Modify: `apps/web/src/lib/admin-catalog.ts`
  - Resolve provider defaults safely.
  - Use `gemini-3-pro-image-preview` for Gemini jobs.
  - Reject `mock` provider outside local/test environments.
- Modify: `apps/web/src/lib/admin-catalog.test.ts`
  - Cover provider config defaults and production mock rejection.
- Modify: `supabase/functions/fabric-render-worker/index.ts`
  - Require `x-fabric-render-worker-secret` when `FABRIC_RENDER_WORKER_INVOKE_SECRET` is configured or `APP_ENV` is not local.
- Modify: `scripts/fabric-render-worker-function.test.mjs`
  - Cover worker secret enforcement source wiring.
- Add: `supabase/migrations/20260429000200_fabric_render_worker_cron.sql`
  - Enable `pg_net` and `pg_cron`.
  - Schedule a recurring worker HTTP POST using Vault secrets.
- Modify: `scripts/fabric-render-worker-migration.test.mjs`
  - Cover cron migration content.
- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Poll job status after Generate and refresh render coverage on terminal status.
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Cover polling after Generate.
- Modify: `supabase/.env.example`
  - Document production Gemini provider and worker invocation secret variables.
- Modify: `docs/roadmap/supabase.md`, `docs/roadmap/image-worker.md`, `docs/roadmap/web.md`, `docs/roadmap/workflow.md`
  - Track this plan as active/done.

## Tasks

- [x] Add failing admin catalog tests for provider resolution.
- [x] Implement provider resolution in `admin-catalog.ts`.
- [x] Add failing worker source tests for invoke-secret enforcement.
- [x] Implement invoke-secret enforcement in `fabric-render-worker`.
- [x] Add failing migration tests for the cron runner migration.
- [x] Add the Supabase cron migration with Vault-based secrets.
- [x] Add failing admin UI test for job polling after Generate.
- [x] Implement admin UI job polling and render coverage refresh.
- [x] Update environment examples and roadmaps.
- [x] Run focused tests, typecheck, spec guard, and local schema smoke.

## Verification

Required checks:

```powershell
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-migration.test.mjs
pnpm.cmd --filter @mobel-unique/web test
pnpm.cmd --filter @mobel-unique/web typecheck
pnpm.cmd spec:check
pnpm.cmd test:supabase:schema
```

Manual production setup notes after deploy:

```sql
select vault.create_secret(
  'https://PROJECT_REF.supabase.co/functions/v1/fabric-render-worker',
  'fabric_render_worker_function_url',
  'Fabric render worker Edge Function URL'
);

select vault.create_secret(
  'REPLACE_WITH_LONG_RANDOM_SECRET',
  'fabric_render_worker_invoke_secret',
  'Fabric render worker cron invocation secret'
);
```

Required Supabase Edge Function secrets:

```text
APP_ENV=dev or prod
FABRIC_RENDER_PROVIDER=gemini
FABRIC_RENDER_PROVIDER_MODEL=gemini-3-pro-image-preview
FABRIC_RENDER_WORKER_INVOKE_SECRET=<same long random secret as Vault>
GEMINI_API_KEY=<server-only Gemini key>
```
