# SPEC-0001 Repo Foundation

Status: accepted

## Goal

Establish a clean Mobel Unique monorepo foundation that supports specification-based development, test-driven development, Codex-assisted work, and separate deployable services.

## Scope

- Monorepo workspace for web, API, image worker, shared package, and Supabase migrations.
- Durable Codex instructions through `AGENTS.md`.
- Specs, plans, roadmaps, and architecture decision locations.
- Initial guardrails for spec-linked work.
- Initial test infrastructure for TDD.
- GitHub PR and CI structure for first repository push.

## Out Of Scope

- Product feature implementation.
- Real Supabase schema.
- Production deployment configuration inside Vercel or Railway.
- Real DEV and PROD secrets.

## Users And Permissions

No application users are introduced by this spec.

Repository contributors must not commit secrets and must keep DEV and PROD environments separated.

## User Flow

Developers start from an accepted spec, create an execution plan, write tests first, implement, update the roadmap, and run the quality gate before opening a PR.

## Data Model

No application data model is introduced.

## API

The API exposes a minimal `/health` endpoint for service readiness.

## Worker Jobs

The image worker has a minimal boot and heartbeat loop. Real image jobs are out of scope.

## Environment Variables

Initial `.env.example` files describe local and platform variables for:

- `apps/web`
- `apps/api`
- `workers/image`

## Acceptance Criteria

- The repository has clear monorepo package boundaries.
- Codex instructions exist at the repository root.
- Specs, plans, roadmaps, and review guidance exist.
- The specification guard can be run with `pnpm spec:check`.
- Tests can be run with `pnpm test`.
- CI can run the quality gate on GitHub.

## Open Questions

- Exact GitHub CODEOWNERS reviewers should be replaced with real GitHub handles or teams.

