# Mobel Unique

Minimal monorepo foundation for the Mobel Unique project.

## Structure

```text
apps/
  web/          Next.js frontend for Vercel
  api/          Node.js Express API for Railway
workers/
  image/        Node.js image worker for Railway
packages/
  shared/       Shared code when needed
supabase/
  migrations/   Database migrations and policies
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
dev   -> Vercel DEV, Railway API DEV, Railway Worker DEV, Supabase DEV
main  -> Vercel PROD, Railway API PROD, Railway Worker PROD, Supabase PROD
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
apps/web       -> Vercel
apps/api       -> Railway API service
workers/image  -> Railway worker service
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

Build all packages:

```bash
pnpm build
```

Run the full quality gate:

```bash
pnpm check
```
