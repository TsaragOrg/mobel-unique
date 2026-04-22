# AGENTS.md

Instructions for Codex and other coding agents working in this repository.

## Scope

These instructions apply to the whole monorepo.

## Project Shape

This is the Mobel Unique monorepo:

- `apps/web`: Next.js frontend, deployed to Vercel.
- `apps/api`: Node.js Express API, deployed to Railway.
- `workers/image`: Node.js image-processing worker, deployed to Railway.
- `packages/shared`: shared types and utilities.
- `supabase/migrations`: database migrations and policies.
- `docs/specs`: product and technical specifications for future work.
- `docs/plans`: execution plans linked to accepted specs.
- `docs/roadmap`: package-level roadmaps.

## Package Manager

Use `pnpm` only.

- The root `package.json` pins `pnpm` through `packageManager`.
- Keep one lockfile at the repository root: `pnpm-lock.yaml`.
- Do not add `package-lock.json`, `yarn.lock`, or `bun.lockb`.
- Add dependencies with workspace filters:
  - Web: `pnpm --filter @mobel-unique/web add <package>`
  - API: `pnpm --filter @mobel-unique/api add <package>`
  - Worker: `pnpm --filter @mobel-unique/image-worker add <package>`
  - Root tooling: `pnpm add -w -D <package>`

## Common Commands

- Install dependencies: `pnpm install`
- Run all dev services: `pnpm dev`
- Run web only: `pnpm dev:web`
- Run API only: `pnpm dev:api`
- Run image worker only: `pnpm dev:worker`
- Create a workflow-compliant branch: `pnpm branch:create -- --type <type> --area <area> --work "<short work description>"`
- Typecheck all packages: `pnpm typecheck`
- Test all packages: `pnpm test`
- Run specification guardrails: `pnpm spec:check`
- Run the full local quality gate: `pnpm check`
- Build all packages: `pnpm build`

If dependencies are not installed, state that clearly instead of pretending checks passed.

## Environment Rules

The project has two isolated environments:

- `dev`: Vercel DEV, Railway API DEV, Railway Worker DEV, Supabase DEV.
- `main`: Vercel PROD, Railway API PROD, Railway Worker PROD, Supabase PROD.

Never mix DEV and PROD URLs, keys, databases, buckets, or service credentials.

Never commit real secrets. Update `.env.example` when new environment variables are required.

Frontend code may use public Supabase anon keys only. Service-role keys and other private credentials belong only in server-side services such as `apps/api` or `workers/image`.

## Code Boundaries

- Keep browser-facing UI and admin UI in `apps/web`.
- Keep request/response business logic in `apps/api`.
- Keep long-running image-processing work in `workers/image`.
- Keep shared package code small, stable, and portable. Avoid Node-only APIs in `packages/shared` unless there is a clear cross-service need.
- Prefer explicit, boring code over abstractions that are not yet needed.

## Specification-Based Workflow

Before implementing a meaningful feature, create or update the relevant spec under `docs/specs`.

- Draft specs live in `docs/specs/drafts`.
- Accepted specs live in `docs/specs/accepted`.
- Accepted specs are frozen by default.
- Changes to accepted specs require an explicit change request in `docs/specs/change-requests`.
- Every accepted spec must be registered in `docs/specs/manifest.json`.
- Every implementation plan must reference a registered spec id.
- Every code change must be reflected in the relevant roadmap under `docs/roadmap`.
- Architecture decisions: `docs/decisions`

Specs should describe the intended behavior, data model impact, API impact, background jobs, permissions, and acceptance criteria when relevant.

## TDD Workflow

Use test-driven development for functional changes.

- Start from an accepted spec.
- Create or update an execution plan under `docs/plans/active`.
- Add a failing test that represents the intended behavior.
- Implement the smallest code change that makes the test pass.
- Run the narrowest relevant test first, then broader checks.
- Move completed plans to `docs/plans/done` and update the relevant roadmap.

If a code change does not need a test, the plan must explain why. This should be rare.

## Review Workflow

Use `docs/quality/code_review.md` for review expectations. Code reviews should prioritize bugs, regressions, missing tests, spec drift, security issues, and environment separation problems.

## Git Workflow

The expected flow is:

```text
feature branch -> dev -> main
```

Create branches with the repository command instead of hand-written names:

```bash
pnpm branch:create -- --type feature --area web --work "Admin catalogue upload" --spec SPEC-0002 --plan PLAN-0002
```

Branch format:

```text
type/area/spec-0000-plan-0000-work-slug
```

Allowed types: `feature`, `fix`, `chore`, `docs`, `refactor`, `test`, `spec`, `hotfix`.

Allowed areas: `web`, `api`, `image-worker`, `shared`, `supabase`, `workflow`, `repo`.

Use `--dry-run` to validate the generated branch name without creating it. Use `--type spec` for branches that only draft or update specifications before an accepted spec id exists.

Do not commit automatically unless the user asks for a commit.

## Verification

For code changes, prefer running the narrowest useful checks first, then broader checks when the change touches shared behavior:

- Package-level typecheck for isolated changes.
- Package-level tests for isolated changes.
- `pnpm spec:check` before opening a PR.
- Root `pnpm typecheck` for cross-package changes.
- Root `pnpm build` before deployment-facing changes.
