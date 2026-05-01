# Local Supabase Worker Development

This guide covers the local worker foundation from `SPEC-0008`.

## Prerequisites

- Node.js 22 or newer.
- pnpm 10 or newer.
- A Docker-compatible runtime such as Docker Desktop, OrbStack, Rancher
  Desktop, Podman, or another compatible runtime.

Do not point local scripts at DEV or PROD Supabase resources.

## First Setup

Install dependencies:

```bash
pnpm install
```

Create local environment files from examples:

```bash
cp supabase/.env.example supabase/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp workers/image/.env.example workers/image/.env
```

Start Supabase and print local URLs and keys:

```bash
pnpm supabase:start
pnpm supabase:status
```

Copy the local anon key and service-role key from `pnpm supabase:status` into
the local `.env` files. Service-role keys belong only in local server-side env
files such as `supabase/.env.local`, `apps/api/.env`, and `workers/image/.env`.

## Local Commands

Start local Supabase:

```bash
pnpm supabase:start
```

Stop local Supabase:

```bash
pnpm supabase:stop
```

Reset the local database and reapply migrations:

```bash
pnpm supabase:reset
```

This also runs `pnpm supabase:realtime:local-compat` and
`pnpm seed:local:admin-fixtures` after the Supabase SQL seed. The Realtime
compatibility step keeps local Postgres change subscriptions working with the
current Supabase CLI stack. The fixture seed loads local admin catalog data
into the local database and Storage:

- at least three fabrics;
- at least two sofas;
- source photos for each seeded sofa;
- render cells that make the non-source fabrics eligible for `Generate all`.

The seed uses built-in placeholder PNGs by default. To use real local images,
copy `fixtures/local-admin-catalog/manifest.example.json` to
`fixtures/local-admin-catalog/manifest.json`, then place the referenced images
under `fixtures/local-admin-catalog/images/`. Supported formats are PNG, JPEG,
and WebP. The local `manifest.json` and `images/` directory are ignored by Git.

If you need to reset only the database and skip admin fixtures, run:

```bash
pnpm supabase:reset:db-only
```

This still runs the Realtime compatibility step because local admin pages depend
on Supabase Realtime for `fabric_render_jobs` status updates.

If an admin page subscribes successfully but generated candidates do not appear
until a browser refresh or another Generate action, inspect the browser console
or Realtime logs for `ERROR 42P10`. That means the local Realtime server
accepted the channel but failed to install the Postgres change subscription.
Run:

```bash
pnpm supabase:realtime:local-compat
```

Then refresh the admin page and rerun the generation.

When testing the real Gemini provider locally, keep
`FABRIC_RENDER_MAX_CONCURRENT_JOBS=1` in `supabase/.env.local` unless you are
explicitly stress-testing the local Edge runtime. The Supabase CLI runtime can
cancel parallel image-generation workers with CPU or wall-clock limits before
they can mark the job failed. Production can still set a higher value, such as
`3`, after validating provider and runtime limits.

The local worker also skips exact generated-output crop/resize normalization by
default because the TypeScript PNG decode, resize, and encode path can hit the
Supabase CLI Edge runtime CPU hard limit after Gemini returns an image. Deployed
environments still normalize output by default. To force local normalization for
focused worker testing, set this in `supabase/.env.local`:

```bash
FABRIC_RENDER_OUTPUT_NORMALIZATION=strict
```

Serve local Edge Functions:

```bash
pnpm supabase:functions:serve
```

Run the worker infrastructure smoke test in another terminal:

```bash
pnpm test:workers:local
```

If local Supabase or the Edge Function runtime is not running, the smoke test
prints an explicit skip message. If Supabase is running but the worker
foundation resources are missing, the smoke test fails.

## What The Smoke Test Covers

The smoke path proves that:

- local Supabase is reachable;
- a local Edge Function can run;
- the function can read local environment variables;
- the function can call local Supabase with server-side credentials;
- local queue resources exist;
- private worker storage buckets exist;
- a test job can move from queued to processed state.

The smoke path uses mocked worker behavior. It does not call Gemini, OpenAI, or
any other real AI provider.

## Real Provider Calls

Real provider calls are opt-in only. They require explicit local provider keys:

```bash
GEMINI_API_KEY=
OPENAI_API_KEY=
```

Do not commit provider keys or any other real secrets.

## In-Home Simulation Stage 1 Local Loop

After the local Supabase stack is running, you can drive the in-home
simulation worker (`SPEC-0007`, `PLAN-0010`) end to end with two CLIs.

Start the Edge Function runtime in one terminal:

```bash
pnpm supabase:functions:serve
```

In another terminal, enqueue a Stage 1 job using a JPEG or PNG room photo:

```bash
pnpm sim:enqueue:stage1 -- --photo /absolute/path/to/your/room.jpg
```

The CLI uploads the photo to `simulation-private-artifacts`, seeds the
catalog and simulation-session fixtures it needs, inserts an
`in_home_simulation_jobs` row in the `queued` state, and sends a
`local_in_home_simulation_jobs` queue message. It prints the resulting
`job_id` on success.

Trigger one Stage 1 invocation by calling the Edge Function:

```bash
curl -X POST $(pnpm -s supabase:status | awk '/API URL/ {print $3}')/functions/v1/in-home-simulation-worker
```

The response reports `noop`, `claimed`, `completed`, or `failed`. On
`completed`, the job is now in `awaiting_dimensions` and the worker has
written `room_guides.png` to
`simulations/{job_id}/room_guides.png`.

Inspect the job and grab signed URLs to view the artifacts:

```bash
pnpm sim:status -- <job_id>
```

The status output includes signed URLs (10 minute TTL) for every
persisted artifact and any generated outputs.

### Limitations of the current Stage 1 implementation

`PLAN-0010` is in progress. The current Stage 1 implementation:

- accepts only JPEG and PNG inputs. HEIC and HEIF photos must be
  converted to JPEG before enqueueing.
- runs validation, cleaning, and geometry detection through the mock
  provider stack by default. `IN_HOME_SIMULATION_PROVIDER_MODE=live`
  is reserved and currently fails fast until the OpenAI/Gemini
  adapters land.
- relies on the deterministic placeholder back-wall geometry from the
  mock geometry provider until the live adapter is wired.

## In-Home Simulation Stage 2 Local Loop

After Stage 1 reports `awaiting_dimensions`, you can drive Stage 2
(sofa placement) and the regeneration cycle locally.

Submit the visitor's wall dimensions for a back_wall job:

```bash
pnpm sim:dimensions:submit -- <job_id> --wall-width 4.0 --wall-height 2.5
```

For a corner job:

```bash
pnpm sim:dimensions:submit -- <job_id> --left-wall 3.0 --right-wall 3.0 --room-height 2.5
```

The CLI calls `submit_in_home_simulation_dimensions`, which transitions
the job to `placement_queued` and sends the placement work message.

Trigger one Edge Function invocation:

```bash
curl -X POST $(pnpm -s supabase:status | awk '/API URL/ {print $3}')/functions/v1/in-home-simulation-worker
```

On `completed`, the job is back in `succeeded`. The current placement
implementation stamps a deterministic placeholder rectangle on the
cleaned room as the result; replace the mock placement provider with
the OpenAI/Gemini adapter for production-quality output.

Inspect the job and grab signed URLs for every generated output:

```bash
pnpm sim:status -- <job_id>
```

Request a regeneration within the SPEC-0004 three-result cap, with an
optional wall-dimension override:

```bash
pnpm sim:regenerate -- <job_id>
pnpm sim:regenerate -- <job_id> --wall-width 4.5 --wall-height 2.5
```

Trigger another Edge Function invocation per regeneration request.

### Limitations of the current Stage 2 implementation

`PLAN-0011` is in progress. The current Stage 2 implementation:

- runs placement through the mock provider that stamps a placeholder
  rectangle. `IN_HOME_SIMULATION_PROVIDER_MODE=live` is reserved and
  currently fails fast until the OpenAI/Gemini adapters land.
- enforces dimension key presence per geometry mode in SQL but defers
  numeric sofa-vs-wall range checks until the prepared-sofa physical
  size is sourced.
- does not persist `worker_error.txt` artifacts on failure; the
  failure code and message are still recorded on the job row.

`PLAN-0012` adds per-stage retry policy, expired-claim recovery, the
24-hour retention purge, orphan upload cleanup, and the operational
observability surface.
