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
| Done | SPEC-0006 | PLAN-0031 | Fabric render `request_id`, pump/job claiming helpers, Realtime-safe job observation, and local Gemini concurrency defaults. |

## Next

- Add full data model policies and retention behavior after the provider path.
