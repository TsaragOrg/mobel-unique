# PLAN-0006 Fabric Render Worker Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Plan: PLAN-0006
Spec: SPEC-0006
Status: done
Owner area: supabase
Affected packages:

- `package.json`
- `scripts`
- `supabase`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Build the first locally testable fabric render worker foundation for
`SPEC-0006`: a queued fabric render job can be claimed by a Supabase Edge
Function, processed with a mock image provider, saved as a private generated
artifact, and marked as succeeded without requiring a real Gemini call.

## Architecture

The first slice uses Supabase local development resources from `SPEC-0008`.
A migration creates the fabric render queue, a minimal `fabric_render_jobs`
table, and helper functions for claim and completion behavior. A new Edge
Function consumes one queued fabric render message, uses a mock provider by
default, writes `output.png` to private storage, and updates the job status.

Real Gemini execution is allowed only as an opt-in smoke path guarded by
`GEMINI_API_KEY`; the default local and CI checks must stay deterministic,
cheap, and independent from external AI services.

## Tech Stack

- Supabase Edge Functions on Deno
- Supabase Queues through `pgmq`
- Supabase Storage private buckets
- Node.js smoke scripts
- Vitest for script-level tests
- `pnpm` for all commands

## Scope

This plan includes:

- a minimal fabric render job record;
- queue message creation and worker consumption for `fabric_render_generation`;
- required status transitions for the first local path;
- claim TTL, attempt count, and failed-job recording for the first path;
- mock generated `output.png` storage;
- a local smoke command that needs no Gemini key;
- an optional Gemini smoke command that runs only when explicitly enabled.

This plan does not include:

- admin UI screens;
- final admin API routes;
- public render publication;
- full visual matrix coverage generation;
- full refine mode behavior;
- provider cost tracking;
- production monitoring dashboards;
- making Gemini smoke checks mandatory in CI.

## Files

- Create: `supabase/migrations/20260427000300_fabric_render_worker_foundation.sql`
  - Creates the local queue, `fabric_render_jobs`, status checks, claim helper,
    completion helper, failure helper, and a local seed helper for smoke tests.
- Create: `supabase/functions/fabric-render-worker/index.ts`
  - Handles `POST`, reads one queue message, claims the job, writes a mock
    `output.png`, and marks the job as `succeeded`.
- Create: `scripts/fabric-render-worker-smoke.mjs`
  - Calls the local Edge Function and verifies that one queued job is processed.
- Create: `scripts/fabric-render-worker-gemini-smoke.mjs`
  - Runs only when `GEMINI_API_KEY` and an explicit opt-in flag are present.
- Create: `scripts/fabric-render-worker-smoke.test.mjs`
  - Tests clear skip/pass/fail behavior for the smoke script.
- Modify: `package.json`
  - Adds local fabric render worker smoke scripts and includes the test in the
    root test command.
- Modify: `supabase/.env.example`
  - Documents local fabric render worker environment variables without secrets.
- Modify: `docs/roadmap/image-worker.md`
  - Marks this worker foundation plan as active.
- Modify: `docs/roadmap/supabase.md`
  - Marks this Supabase worker foundation plan as active.
- Modify: `docs/roadmap/workflow.md`
  - Notes the Windows-safe spec guard fix needed to verify this plan locally.

## Tasks

- [x] Add the failing script tests for the local smoke command.

  File: `scripts/fabric-render-worker-smoke.test.mjs`

  Required test cases:

  ```js
  import { spawn } from "node:child_process";
  import { fileURLToPath } from "node:url";
  import { describe, expect, it } from "vitest";

  const scriptPath = fileURLToPath(
    new URL("./fabric-render-worker-smoke.mjs", import.meta.url)
  );

  function runSmoke(env) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [scriptPath], {
        env: {
          ...process.env,
          ...env
        }
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("close", (status) => {
        resolve({ status, stderr, stdout });
      });
    });
  }

  describe("fabric render worker smoke script", () => {
    it("skips clearly when the local function is unreachable", async () => {
      const result = await runSmoke({
        FABRIC_RENDER_WORKER_FUNCTION_URL:
          "http://127.0.0.1:1/functions/v1/fabric-render-worker",
        FABRIC_RENDER_WORKER_SMOKE_TIMEOUT_MS: "250"
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SKIP fabric render worker smoke");
      expect(result.stdout).toContain("pnpm supabase:start");
    });

    it("passes when the function returns a succeeded job", async () => {
      const body = encodeURIComponent(
        JSON.stringify({
          job_id: "00000000-0000-4000-8000-000000000006",
          queue_name: "local_fabric_render_jobs",
          status: "succeeded",
          output_path:
            "fabric-render/00000000-0000-4000-8000-000000000006/output.png"
        })
      );
      const result = await runSmoke({
        FABRIC_RENDER_WORKER_FUNCTION_URL: `data:application/json,${body}`
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PASS fabric render worker smoke");
      expect(result.stdout).toContain("local_fabric_render_jobs");
      expect(result.stdout).toContain("output.png");
    });
  });
  ```

  Run:

  ```bash
  pnpm vitest run scripts/fabric-render-worker-smoke.test.mjs
  ```

  Expected before implementation: fail because the smoke script file does not
  exist.

- [x] Add the local smoke script.

  File: `scripts/fabric-render-worker-smoke.mjs`

  Behavior:

  - calls `FABRIC_RENDER_WORKER_FUNCTION_URL`, defaulting to
    `http://127.0.0.1:54321/functions/v1/fabric-render-worker`;
  - uses `POST`;
  - skips with exit code `0` when local Supabase or the local function is not
    reachable;
  - fails with exit code `1` for non-JSON, non-2xx, or unexpected responses;
  - passes only when the response has `status: "succeeded"`, `job_id`,
    `queue_name`, and `output_path`.

  Run:

  ```bash
  pnpm vitest run scripts/fabric-render-worker-smoke.test.mjs
  ```

  Expected after this step: pass.

- [x] Add package scripts.

  File: `package.json`

  Add:

  ```json
  {
    "test:workers:fabric-render": "node scripts/fabric-render-worker-smoke.mjs",
    "test:workers:fabric-render:gemini": "node scripts/fabric-render-worker-gemini-smoke.mjs"
  }
  ```

  Also include `scripts/fabric-render-worker-smoke.test.mjs` in the root
  `test` script next to the existing smoke script tests.

  Run:

  ```bash
  pnpm vitest run scripts/fabric-render-worker-smoke.test.mjs
  ```

  Expected: pass.

- [x] Add the migration for the fabric render worker foundation.

  File: `supabase/migrations/20260427000300_fabric_render_worker_foundation.sql`

  Required database objects:

  - `pgmq` queue named `local_fabric_render_jobs`;
  - `public.fabric_render_jobs`;
  - status check for `queued`, `processing`, `succeeded`, `failed`, `canceled`;
  - generation mode check for `initial`, `refine`;
  - default provider `mock`;
  - default provider model `mock-fabric-render-v1`;
  - default prompt version `v007`;
  - default max attempts `3`;
  - `public.fabric_render_worker_seed_mock_job(queue_name text)`;
  - `public.fabric_render_worker_claim_next(queue_name text, worker_id text, claim_ttl_seconds integer)`;
  - `public.fabric_render_worker_succeed(job_id uuid, output_path text)`;
  - `public.fabric_render_worker_fail(job_id uuid, error_message text, retryable boolean)`.

  Required minimum table columns:

  ```sql
  id uuid primary key default gen_random_uuid(),
  sofa_id uuid not null,
  fabric_id uuid not null,
  visual_matrix_column_id uuid not null,
  generation_mode text not null default 'initial',
  target_sofa_path text not null,
  fabric_reference_path text not null,
  refine_source_path text,
  prompt_note text,
  output_path text,
  provider_name text not null default 'mock',
  provider_model text not null default 'mock-fabric-render-v1',
  prompt_version text not null default 'v007',
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  queued_at timestamptz not null default now(),
  claimed_by text,
  claim_expires_at timestamptz,
  last_attempt_started_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
  ```

  Run:

  ```bash
  pnpm supabase:reset
  ```

  Expected when local Supabase is running: migration applies without SQL
  errors.

- [x] Add the fabric render Edge Function with mock provider behavior.

  File: `supabase/functions/fabric-render-worker/index.ts`

  Required behavior:

  - accepts only `POST`;
  - requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
  - reads `FABRIC_RENDER_QUEUE_NAME`, defaulting to `local_fabric_render_jobs`;
  - claims one job through `fabric_render_worker_claim_next`;
  - returns `204` when no queued job exists;
  - writes a deterministic tiny PNG to private bucket
    `catalog-private-assets`;
  - writes to
    `fabric-render/{job_id}/output.png`;
  - marks the job as `succeeded` through `fabric_render_worker_succeed`;
  - marks the job as `failed` through `fabric_render_worker_fail` if the mock
    generation or storage upload fails.

  The mock PNG may be a fixed base64 image decoded inside the function. It must
  not call Gemini.

  Run:

  ```bash
  pnpm supabase:functions:serve
  pnpm test:workers:fabric-render
  ```

  Expected when local Supabase is running and functions are served: pass with a
  processed job id and an `output.png` path.

- [x] Add the optional Gemini smoke script.

  File: `scripts/fabric-render-worker-gemini-smoke.mjs`

  Required behavior:

  - exits with `SKIP fabric render Gemini smoke` and code `0` when
    `GEMINI_API_KEY` is missing;
  - exits with `SKIP fabric render Gemini smoke` and code `0` unless
    `FABRIC_RENDER_ENABLE_GEMINI_SMOKE` is exactly `1`;
  - calls the same Edge Function with a request header
    `x-fabric-render-provider: gemini`;
  - fails clearly when the function returns an error;
  - passes only when the response includes `status: "succeeded"` and
    `output_path`.

  This script is for local manual verification only. It must not be added to
  the root `test` or `check` command.

  Run:

  ```bash
  FABRIC_RENDER_ENABLE_GEMINI_SMOKE=1 pnpm test:workers:fabric-render:gemini
  ```

  Expected while this foundation remains mock-only: the command skips unless it
  is explicitly enabled and fails clearly if the Edge Function still rejects the
  non-mock provider path.

- [x] Document environment variables.

  File: `supabase/.env.example`

  Add non-secret examples for:

  ```text
  FABRIC_RENDER_QUEUE_NAME=local_fabric_render_jobs
  FABRIC_RENDER_MAX_ATTEMPTS=3
  FABRIC_RENDER_MAX_CONCURRENT_JOBS=1
  FABRIC_RENDER_CLAIM_TTL_SECONDS=300
  FABRIC_RENDER_PROVIDER=mock
  FABRIC_RENDER_ENABLE_GEMINI_SMOKE=0
  GEMINI_API_KEY=
  ```

  The example file must not contain a real key.

- [x] Update roadmaps after implementation.

  Files:

  - `docs/roadmap/image-worker.md`
  - `docs/roadmap/supabase.md`

  Required change when implementation is complete:

  - move `PLAN-0006` from active/current wording to done wording;
  - keep the note that Gemini smoke remains optional and manual.

- [x] Run verification.

  Narrow checks:

  ```bash
  pnpm vitest run scripts/fabric-render-worker-smoke.test.mjs
  pnpm spec:check
  ```

  Local integration checks:

  ```bash
  pnpm supabase:reset
  pnpm supabase:functions:serve
  pnpm test:workers:fabric-render
  ```

  Optional real provider check:

  ```bash
  FABRIC_RENDER_ENABLE_GEMINI_SMOKE=1 pnpm test:workers:fabric-render:gemini
  ```

  Broad check before moving the plan to done:

  ```bash
  pnpm check
  ```

## Tests

The required tests for this plan are:

- `scripts/fabric-render-worker-smoke.test.mjs`
  - verifies clear skip behavior when the local Edge Function is unreachable;
  - verifies pass behavior when the function returns a succeeded fabric render
    job;
  - verifies that output includes the queue name and `output.png`.
- `pnpm test:workers:fabric-render`
  - verifies the local queue, claim, mock output, storage upload, and succeeded
    status path against local Supabase.
- `pnpm test:workers:fabric-render:gemini`
  - optional manual verification only;
  - skips unless a real `GEMINI_API_KEY` exists and
    `FABRIC_RENDER_ENABLE_GEMINI_SMOKE=1`.

## Roadmap

Update these roadmap files:

- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Notes

This is a foundation plan, not the full `SPEC-0006` implementation. It proves
that the worker path is testable end-to-end with a mock provider before adding
more expensive and less deterministic Gemini behavior.

The mock smoke test is the default quality gate. The Gemini smoke command is a
manual guard for the future real-provider path; it must stay optional until the
actual Gemini provider is implemented.
