# Mobel Unique

Minimal monorepo foundation for the Mobel Unique project.

## Structure

```text
apps/
  web/          Next.js frontend for Vercel
  api/          Legacy local Node.js Express API foundation
workers/
  image/        Legacy local Node.js image worker foundation
packages/
  shared/       Shared code when needed
supabase/
  migrations/   Database migrations and policies
  functions/    Supabase Edge Functions for production API and workers
docs/
  specs/       Product, technical, and feature specs
  plans/       Execution plans linked to specs
  roadmap/     Package-level roadmap tracking
  decisions/   Architecture decisions
  quality/     Code review guidance
.github/
  workflows/   CI quality gate
```

## Environments

The project uses two isolated environments:

```text
dev   -> Vercel DEV, Supabase DEV
main  -> Vercel PROD, Supabase PROD
```

Recommended flow:

```text
feature branch -> dev -> main
```

Keep DEV and PROD secrets, databases, storage buckets, and service URLs separate.

## Specs And Decisions

Future app specs live in `docs/specs`:

- `docs/specs/drafts`: specs being shaped.
- `docs/specs/accepted`: approved specs, frozen by default.
- `docs/specs/change-requests`: explicit requests to change accepted specs.
- `docs/specs/manifest.json`: accepted spec registry.

Architecture decisions live in `docs/decisions`.
Execution plans live in `docs/plans`.
Package-level roadmaps live in `docs/roadmap`.

Use `docs/specs/_template.md` for new specs.

## Deployment Roots

Configure each platform service to use the matching monorepo root directory:

```text
apps/web             -> Vercel
supabase/migrations  -> Supabase database migrations
supabase/functions   -> Supabase Edge Functions for API and workers
```

## Local Development

Install dependencies:

```bash
pnpm install
```

Run all local services:

```bash
pnpm dev
```

Run one service:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

Run the local Supabase worker foundation:

```bash
pnpm supabase:start
pnpm supabase:functions:serve
pnpm test:workers:local
```

See `docs/local-supabase-worker-development.md` for setup details.

Build all packages:

```bash
pnpm build
```

Run the full quality gate:

```bash
pnpm check
```
