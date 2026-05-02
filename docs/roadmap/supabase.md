# Supabase Roadmap

## Current

| Status | Spec      | Plan      | Work                                                                                                                       |
| ------ | --------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Done   | SPEC-0001 | PLAN-0001 | Migration directory prepared.                                                                                              |
| Done   | SPEC-0008 | PLAN-0008 | Local Supabase worker development foundation with queues, storage, Edge Function smoke path, and local scripts.            |
| Done   | SPEC-0009 | PLAN-0009 | Supabase data model migration, storage buckets, RLS policies, public read views, cleanup helpers, and schema smoke checks. |
| Done   | SPEC-0006 | PLAN-0006 | Fabric render job queue, claim flow, private generated output, mock smoke test, and optional Gemini smoke test.            |
| Done   | SPEC-0011 | PLAN-0011 | Trusted admin device table, service-role-only RLS policy, and local seeded admin Auth user for smoke testing.              |
| Done   | SPEC-0006 | PLAN-0010 | Gemini provider path for fabric render jobs using private storage inputs and generated candidate output metadata.          |
| Done   | SPEC-0013 | PLAN-0019 | Service-role admin queue handoff helper for durable fabric render jobs created by the first-party admin facade.            |
| Done   | SPEC-0013 | PLAN-0021 | Existing private render cell and asset tables are used for candidate selection and manual render attachment.               |
| Done   | SPEC-0013 | PLAN-0023 | Existing render cell source-photo fields are used to complete the exact source fabric cell without public asset copies.    |
| Done   | SPEC-0010 | PLAN-0024 | Public per-sofa tag view added for safe public catalog assembly and tag filtering.                                         |
| Done   | SPEC-0006 | PLAN-0025 | Supabase Cron invokes the fabric render worker through a Vault-backed secret.                                              |
| Done   | SPEC-0006 | PLAN-0026 | Fabric render provider and model ownership moved from Vercel admin API to the Supabase worker claim path.                  |
| Done   | SPEC-0010 | PLAN-0029 | Publication RPCs create public render asset references from selected private render coverage and clear them on unpublish.   |
| Done   | SPEC-0006 | PLAN-0030 | Fabric render jobs store `refine_prompt` and resolve it for the fabric render worker without provider-owned idempotency.   |
| Done   | SPEC-0006 | PLAN-0031 | Fabric render `request_id`, pump/job claiming helpers, Realtime-safe job observation, and local Gemini concurrency defaults. |
| Done   | SPEC-0006 | PLAN-0033 | Local Gemini worker output preservation avoids Supabase CLI Edge runtime CPU cancellation while deployed workers keep strict normalization. |
| Done   | SPEC-0006 | PLAN-0036 | Local Gemini fabric render capacity is enforced globally across separate manual `Generate` requests, while deployed workers keep request-scoped capacity. |
| Done   | SPEC-0007 | PLAN-0010 | `in-home-simulation-worker` Stage 1 room preparation with HEIC/HEIF conversion, atomic claim, EXIF normalization, OpenAI vision validation, OpenAI image-edit cleaning, OpenAI vision geometry detection for both `back_wall` and `corner`, deterministic dimension-guide overlay, concurrency-bounded queue consumer (`runWithConcurrency`), and provider-no-image-data error path with `worker_error.txt` artifact. |
| Done   | SPEC-0007 | PLAN-0011 | `in-home-simulation-worker` Stage 2 sofa placement with the OpenAI image-edit primary provider, Gemini fallback via `IN_HOME_SIMULATION_FALLBACK_PROVIDER=gemini`, regeneration cycle persisting outputs at `simulations/{job_id}/outputs/output-{index}.png`, and the three-result MVP cap. |
| Done   | SPEC-0007 | PLAN-0012 | `in-home-simulation-purge` Edge Function and resilience helpers covering per-stage retry classification, expired-claim recovery, idempotent 24-hour retention purge, orphan upload cleanup, and the operational observability view backed by `worker_job_events`. |
| Active | SPEC-0007 | PLAN-0016 | `in-home-simulation-worker` Stage 1 corners geometric validator + 3-attempt retry, Stage 2 self-correcting placement feedback loop with the new `OpenAIPlacementMeasurementProvider` (GPT-5 vision JSON), prompt v003 across `OpenAIPlacementProvider`, `GeminiPlacementProvider`, and `MockPlacementProvider`, and the `--position` / `--sofa-*` / `--room-depth` extension to the `submit-dimensions` CLI. |
| Done   | SPEC-0007 | PLAN-0034 | Renumber SPEC-0007 in-home simulation migrations off the colliding `20260428000100` and `20260428000200` timestamps used by SPEC-0011 admin and admin fabric-render-job-enqueue migrations so the Supabase DEV deploy stops failing with the `schema_migrations_pkey` duplicate-key error. |
| Active | SPEC-0015 | PLAN-0038 | `in-home-simulation-worker` cleanup: Gemini placement provider and `IN_HOME_SIMULATION_FALLBACK_PROVIDER` removed (worker is OpenAI-only); scene classifier provider removed and Stage 1 reads `room_geometry_mode` from the new claim-RPC return shape so the API populates the mode at job creation per SPEC-0015 sofa-tag contract; `room_depth` is required in `supplied_dimensions` validation for both `back_wall` and `corner` modes per CR-SPEC-0012. v003 prompts and the corners + placement feedback loops are unchanged. |
| Active | SPEC-0015 | PLAN-0038 | Stage 1 claim RPC migration `20260502000100` now drops both `claim_in_home_simulation_room_prep_job` and `claim_specific_in_home_simulation_room_prep_job` before re-creating them, since Postgres rejects `create or replace function` when the return type changes. Fixes the Supabase DEV Deploy job that failed after PR #51 merged. |

## Next

- Add full data model policies and retention behavior after the provider path.
