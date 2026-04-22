# Code Review Guide

Review with this priority order:

1. Behavior that does not match the linked spec.
2. Missing or weak tests for changed behavior.
3. Security, auth, privacy, or DEV/PROD environment separation risks.
4. API, database, storage, or worker contract regressions.
5. Error handling, retries, idempotency, and observability gaps.
6. Maintainability issues that will make near-term work harder.

Every review should check:

- The PR references a spec id from `docs/specs/manifest.json`.
- The PR references an execution plan.
- Relevant roadmaps are updated.
- Tests are added or updated before implementation is accepted.
- `.env.example` files are updated when new variables are introduced.
- No production secrets or real credentials are committed.

Prefer concrete findings with file and line references. Keep summaries secondary to issues.

