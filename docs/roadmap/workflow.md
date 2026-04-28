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

## Next

- Replace CODEOWNERS placeholders with real GitHub users or teams.
- Enable branch protection rules on GitHub for `dev` and `main`.
- Add PROD deployment automation after the PROD Supabase project exists.
