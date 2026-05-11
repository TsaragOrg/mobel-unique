# PLAN-0079 In-Home Simulation Storage Upload Auth

Plan: PLAN-0079
Spec: SPEC-0007
Status: done
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker/index.ts`
- `scripts/in-home-simulation-worker-internal-fetch-timeouts.test.mjs`
- `docs/specs/manifest.json`
- `docs/roadmap/supabase.md`

## Goal

Fix the production in-home simulation worker failure where Stage 1 reaches the
normalized-room artifact upload and Supabase Storage rejects the request with
`Invalid Compact JWS`.

## Root Cause

The worker's Storage download path sent both service-role headers:
`Authorization: Bearer <service-role-key>` and `apikey: <service-role-key>`.
The upload path only sent `Authorization`. Supabase Storage expects the API key
header consistently for private object writes, so the upload request could fail
even after the original room-photo download and image normalization succeeded.

## Tasks

- [x] Add the missing service-role `apikey` header to
  `uploadStorageObject` in the in-home simulation worker.
- [x] Add a regression test that source-greps the worker upload helper for the
  service-role `apikey`, `Authorization`, and `x-upsert` headers.
- [x] Update the SPEC-0007 implementation plan list.
- [x] Update the Supabase roadmap.

## Verification

- [x] `pnpm vitest run scripts/in-home-simulation-worker-internal-fetch-timeouts.test.mjs`

## Deployment Note

Redeploy `in-home-simulation-worker` to the affected Supabase project after
merging so new simulation jobs use the corrected Storage upload headers.
