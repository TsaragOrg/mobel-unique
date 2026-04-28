# Supabase Roadmap

## Current

| Status | Spec      | Plan      | Work                                                                                                                       |
| ------ | --------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Done   | SPEC-0001 | PLAN-0001 | Migration directory prepared.                                                                                              |
| Done   | SPEC-0008 | PLAN-0008 | Local Supabase worker development foundation with queues, storage, Edge Function smoke path, and local scripts.            |
| Done   | SPEC-0009 | PLAN-0009 | Supabase data model migration, storage buckets, RLS policies, public read views, cleanup helpers, and schema smoke checks. |
| Done   | SPEC-0006 | PLAN-0006 | Fabric render job queue, claim flow, private generated output, mock smoke test, and optional Gemini smoke test.            |
| Done   | SPEC-0011 | PLAN-0011 | Trusted admin device table, service-role-only RLS policy, and local seeded admin Auth user for smoke testing.              |

## Next

- Use the admin auth foundation from Edge Functions and admin/public API contracts.
- Add production provider hardening, full data model policies, and retention behavior after the worker foundation.
