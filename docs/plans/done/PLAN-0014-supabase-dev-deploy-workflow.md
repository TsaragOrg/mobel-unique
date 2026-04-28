# PLAN-0014 Supabase DEV Deploy Workflow

Plan: PLAN-0014
Spec: SPEC-0001
Status: done
Owner area: workflow
Affected packages:

- `.github/workflows/quality.yml`
- `docs/roadmap/workflow.md`

## Goal

Add the first shared DEV deployment automation for Supabase schema migrations.

The repository already runs the quality gate on pull requests and pushes. This
plan extends the existing quality workflow so that, after a successful push to
`dev`, GitHub Actions links to the Supabase DEV project and applies pending
migrations with `supabase db push`.

This plan does not configure Vercel, GitHub repository secrets, branch
protection, Supabase Auth users, or PROD deployment. Those remain platform
settings performed outside the repository.

## Tasks

- [x] Keep the existing PR and push quality gate unchanged.
- [x] Add a Supabase DEV deployment job that runs only on push to `dev`.
- [x] Require the quality job to pass before applying DEV migrations.
- [x] Use DEV-specific GitHub secrets:
      `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_ID`, and
      `SUPABASE_DEV_DB_PASSWORD`.
- [x] Do not include local seed data in DEV migration deployment.
- [x] Update the workflow roadmap.
- [x] Run the quality gate.

## Tests

No application tests are required because this plan changes CI orchestration
only. The existing `pnpm check` gate validates workflow-adjacent repository
guardrails and application build health before this plan is committed.

The deployment job itself is validated by GitHub Actions after the branch is
merged to `dev`, because it requires repository secrets and the real Supabase
DEV project.

## Roadmap

- `docs/roadmap/workflow.md`

## Notes

The workflow intentionally runs `supabase db push` without `--include-seed` so
the local-only Auth seed in `supabase/seed.sql` is never applied to DEV.

PROD deployment must use separate PROD-specific secrets and should be added
through a later explicit plan.
