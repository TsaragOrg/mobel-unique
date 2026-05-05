# PLAN-0033 Local Gemini Output Preservation

Plan: PLAN-0033
Spec: SPEC-0006
Status: done
Owner area: supabase
Affected packages:

- `supabase/functions/fabric-render-worker`
- `scripts`
- `docs`

## Goal

Prevent local Supabase CLI Gemini render jobs from being canceled by the Edge
runtime supervisor after Gemini returns an image and the worker enters the
CPU-heavy TypeScript PNG crop/resize path.

Production and deployed DEV workers keep strict output normalization by default.
Local workers preserve provider output unless
`FABRIC_RENDER_OUTPUT_NORMALIZATION=strict` is set for focused normalization
testing.

## Tasks

- [x] Add a worker source test for the local normalization mode switch.
- [x] Preserve Gemini provider output by default in local worker environments.
- [x] Keep strict normalization as the default outside local environments.
- [x] Document the local override.
- [x] Update relevant roadmaps.
- [x] Run focused worker tests and specification guardrails.

## Tests

```bash
pnpm vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-storage.test.mjs scripts/fabric-render-worker-gemini-provider.test.mjs
pnpm spec:check
```

## Roadmap

- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Notes

This plan intentionally avoids changing the accepted production normalization
requirement. It only changes the local default because the Supabase CLI Edge
runtime can hit the CPU hard limit while running in-process image decode,
resize, and encode work.
