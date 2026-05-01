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
