# Image Worker Roadmap

## Current

| Status | Spec      | Plan      | Work                                                                                                                                                            |
| ------ | --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Done   | SPEC-0001 | PLAN-0001 | Minimal worker foundation and heartbeat configuration.                                                                                                          |
| Done   | SPEC-0008 | PLAN-0008 | Local worker environment examples align with local Supabase worker development.                                                                                 |
| Done   | SPEC-0006 | PLAN-0006 | Locally testable fabric render worker foundation with mock output and optional Gemini smoke verification.                                                       |
| Done   | SPEC-0006 | PLAN-0010 | Real Gemini fabric render provider path with private input downloads, fixed v007 prompt, and optional manual provider smoke verification.                       |
| Done   | SPEC-0006 | PLAN-0020 | Existing fabric render worker matches Python-worker output sizing with Gemini aspect-ratio config and centered crop/resize normalization before private upload. |
| Done   | SPEC-0006 | PLAN-0025 | Production fabric render worker invocation is protected by a shared secret and scheduled through Supabase Cron.                                                 |
| Done   | SPEC-0006 | PLAN-0026 | Fabric render worker owns provider/model selection and records the actual provider metadata when claiming jobs.                                                 |

## Next

- Add public publication workflows through later plans.
- Implement the accepted in-home simulation worker spec after the fabric render foundation proves the worker path.
