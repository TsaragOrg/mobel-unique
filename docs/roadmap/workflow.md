# Workflow Roadmap

## Current

| Status | Spec      | Plan      | Work                                                                                                                                      |
| ------ | --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Done   | SPEC-0001 | PLAN-0001 | Specification-based TDD workflow, guardrails, review docs, and CI baseline.                                                               |
| Done   | SPEC-0002 | PLAN-0002 | Repository command for AI-safe branch creation.                                                                                           |
| Done   | SPEC-0001 | PLAN-0003 | English-only specification language guard before commits and reviews.                                                                     |
| Done   | SPEC-0001 | PLAN-0004 | Guard accepted specs against draft-era pre-acceptance blocker language.                                                                   |
| Done   | SPEC-0008 | PLAN-0008 | Local Supabase scripts and worker smoke-test workflow.                                                                                    |
| Done   | SPEC-0009 | PLAN-0009 | Root schema smoke command for validating the Supabase data model locally, including Docker psql fallback.                                 |
| Done   | SPEC-0006 | PLAN-0006 | Windows-safe spec guard path handling needed for fabric render worker verification.                                                       |
| Done   | SPEC-0011 | PLAN-0011 | Admin auth smoke test added to the root test gate and local smoke tests adjusted to run without opening sandbox-blocked ports.            |
| Done   | SPEC-0006 | PLAN-0010 | Fabric render Gemini provider tests and smoke helpers added to the root test workflow, including Windows-safe `node --import` mock paths. |
| Done   | SPEC-0001 | PLAN-0014 | Supabase DEV migration deployment runs after the quality gate on push to `dev`.                                                           |
| Done   | SPEC-0001 | PLAN-0015 | Supabase DEV migration deployment applies missing out-of-order migrations with `--include-all` while still excluding seed data.           |
| Done   | SPEC-0010 | PLAN-0016 | Admin catalog smoke script added for the local draft sofa and tag API flow, with mocked coverage in the root test workflow.               |
| Done   | SPEC-0013 | PLAN-0018 | Admin fabrics smoke script added for the local upload, fabric, assignment, readiness, and archive flow.                                   |
| Done   | SPEC-0013 | PLAN-0019 | Admin render preparation smoke script added for the visual matrix, source photo, coverage, and queued render job handoff flow.            |
| Done   | SPEC-0006 | PLAN-0020 | Fabric render tests cover Gemini aspect-ratio config, separated refine requests, and centered crop/resize output normalization.           |
| Done   | SPEC-0013 | PLAN-0021 | Admin render prep smoke extends through candidate selection and private manual render attachment.                                         |
| Done   | SPEC-0013 | PLAN-0023 | Admin render prep smoke covers source-photo-complete cells, redundant generation rejection, and alternate fabric queueing.                |
| Done   | SPEC-0010 | PLAN-0024 | Public catalog smoke script added to the root test workflow with clear local skip behavior.                                               |
| Done   | SPEC-0006 | PLAN-0025 | Fabric render production cron runner checks cover provider defaults, worker invocation secret wiring, cron SQL, and admin polling.        |
| Done   | SPEC-0006 | PLAN-0026 | Fabric render ownership checks cover worker-level provider selection and admin API provider isolation.                                    |
| Done   | SPEC-0001 | PLAN-0027 | Supabase DEV deploy configures worker secrets, deploys the fabric render Edge Function, and upserts cron Vault secrets.                   |
| Done   | SPEC-0013 | PLAN-0028 | Admin render input test coverage includes worker scratch failure recording for early local worker errors.                                 |
| Done   | SPEC-0010 | PLAN-0029 | Admin publication checks cover public asset RPCs, first-party admin endpoints, and sofa edit publish/unpublish actions.                   |
| Done   | SPEC-0006 | PLAN-0030 | Fabric render migration and worker source tests cover admin prompt notes and refine prompt ownership.                                     |
| Done | SPEC-0006 | PLAN-0031 | Manual fabric render pump/job tests cover `request_id`, no cron dependency, Realtime observation, and resume behavior.                    |
| Done | SPEC-0008 | PLAN-0032 | Local Supabase reset now loads reusable admin catalog fixtures and supports ignored local image manifests.                                 |

## Next

- Replace CODEOWNERS placeholders with real GitHub users or teams.
- Enable branch protection rules on GitHub for `dev` and `main`.
- Add PROD deployment automation after the PROD Supabase project exists.
