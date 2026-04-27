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
| Done   | SPEC-0006 | PLAN-0030 | Fabric render refine jobs use the persisted refine prompt without prompt-note fallback.                                                                          |
| Done   | SPEC-0006 | PLAN-0031 | Fabric render Edge Function uses manual pump/job modes with bounded active one-job workers instead of cron-driven draining.                                      |
| Active | SPEC-0007 | PLAN-0010 | In-home simulation Stage 1 room preparation Edge Function with normalization, validation, cleaning, geometry detection, and dimension-guide overlay, locally testable end to end. |
| Active | SPEC-0007 | PLAN-0011 | In-home simulation Stage 2 sofa placement and regeneration cycle with regeneration-indexed outputs and the three-result MVP cap.                                |
| Active | SPEC-0007 | PLAN-0012 | In-home simulation resilience: per-stage retry policy, expired-claim recovery, 24-hour retention purge, orphan upload cleanup, and the operational observability surface. |

## Next

- Add public publication workflows through later plans.
