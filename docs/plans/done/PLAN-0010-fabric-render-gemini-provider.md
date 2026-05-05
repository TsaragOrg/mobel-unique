# PLAN-0010 Fabric Render Gemini Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Plan: PLAN-0010
Spec: SPEC-0006
Status: done
Owner area: supabase
Depends on: SPEC-0009, PLAN-0006, PLAN-0009
Affected packages:

- `supabase/functions/fabric-render-worker`
- `supabase/migrations`
- `scripts`
- `package.json`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`

## Goal

Add the real Gemini fabric render provider path to the Supabase Edge Function while keeping the mock provider as the default deterministic local and CI path.

## Architecture

The existing `fabric-render-worker` Edge Function already proves queue claiming, mock output upload, and succeeded/failed status transitions. This plan adds focused provider, storage, prompt, and image metadata helpers around that foundation so the worker can download private input assets, call Gemini with the fixed `v007` prompt, store the returned image as a private generated candidate, and preserve the existing mock smoke path.

The worker continues to make no public catalog publication decisions. It creates private generated candidates only. Admin/API job creation, candidate review, public publication, and batch coverage generation remain separate plans.

## Tech Stack

- Supabase Edge Functions on Deno
- Supabase Storage REST API
- Supabase PostgREST RPC helpers
- Gemini API over HTTPS with `GEMINI_API_KEY`
- Vitest for deterministic helper and script tests
- Optional manual Gemini smoke command

## External Documentation Checked

- Gemini API image generation docs: `https://ai.google.dev/gemini-api/docs/image-generation`
- Gemini API image understanding docs for inline image data: `https://ai.google.dev/gemini-api/docs/image-understanding`
- Gemini API interactions docs for `gemini-3-pro-image-preview`: `https://ai.google.dev/gemini-api/docs/interactions`

The accepted spec pins the first provider model to `gemini-3-pro-image-preview`. Do not change that model in this plan. If current Gemini production access requires a different model name, create a change request against `SPEC-0006` before implementation changes the model.

## Scope

This plan includes:

- the real `gemini` provider branch in `fabric-render-worker`;
- fixed prompt version `v007` assembly;
- optional admin prompt note appending without overriding the base prompt;
- initial and refine mode input ordering for the provider request;
- the `SPEC-0006` scratch artifact contract with `fabric_ref.jpg`,
  `target_sofa.jpg`, optional `refine_source.png`, `output.png`, and
  `error.txt`;
- private storage downloads for fabric reference, target sofa, and optional refine source assets;
- 2048 px input metadata guard before provider calls;
- provider response image extraction;
- private generated output upload;
- output metadata persistence in the generated candidate path;
- a successful private candidate that remains unaccepted until an explicit admin workflow accepts it;
- retryable versus non-retryable error classification for provider, storage, and input validation failures;
- deterministic tests with mocked `fetch`;
- optional real Gemini smoke verification guarded by `GEMINI_API_KEY` and `FABRIC_RENDER_ENABLE_GEMINI_SMOKE=1`.

This plan does not include:

- admin UI screens;
- final admin API routes for creating jobs;
- public render publication;
- batch generation for complete sofa coverage;
- in-home simulation behavior from `SPEC-0007`;
- provider cost dashboards;
- making real Gemini checks mandatory in CI.

## File Structure

- Create: `supabase/functions/fabric-render-worker/prompt.ts`
  - Owns `v007` prompt text and prompt-note appending.
- Create: `supabase/functions/fabric-render-worker/gemini.ts`
  - Owns Gemini request creation, provider call, response image extraction, and provider error classification.
- Create: `supabase/functions/fabric-render-worker/storage.ts`
  - Owns private storage download/upload helpers and base64 conversion.
- Create: `supabase/functions/fabric-render-worker/scratch.ts`
  - Owns the `SPEC-0006` scratch folder contract and stale output/error cleanup.
- Create: `supabase/functions/fabric-render-worker/image-metadata.ts`
  - Owns small PNG/JPEG dimension parsing needed for generated output metadata.
- Create: `supabase/functions/fabric-render-worker/job.ts`
  - Owns worker job input types, input guards, output path building, and retry decision helpers.
- Modify: `supabase/functions/fabric-render-worker/index.ts`
  - Keeps HTTP handling and queue orchestration; delegates provider-specific behavior to focused helpers.
- Create: `supabase/migrations/20260427000400_fabric_render_gemini_provider.sql`
  - Adds or replaces worker RPC helpers needed to resolve private input metadata and persist real output metadata.
- Create: `scripts/fabric-render-worker-gemini-provider.test.mjs`
  - Tests prompt assembly, Gemini payload shape, image extraction, and error classification.
- Create: `scripts/fabric-render-worker-storage.test.mjs`
  - Tests storage URL construction, input guard behavior, output path shape, and image metadata parsing.
- Modify: `scripts/fabric-render-worker-function.test.mjs`
  - Verifies the Edge Function wires mock and Gemini branches through the shared helpers.
- Modify: `scripts/fabric-render-worker-gemini-smoke.mjs`
  - Keeps opt-in real provider smoke behavior and improves skip messaging when no claimable job exists.
- Create: `scripts/seed-fabric-render-gemini-smoke.mjs`
  - Creates a local queued Gemini smoke job with private test inputs and no committed secrets.
- Modify: `package.json`
  - Adds the new tests to the root `test` script.

## Tasks

### Task 1: Add Prompt And Gemini Provider Tests

**Files:**

- Create: `scripts/fabric-render-worker-gemini-provider.test.mjs`
- Create later in this plan: `supabase/functions/fabric-render-worker/prompt.ts`
- Create later in this plan: `supabase/functions/fabric-render-worker/gemini.ts`

- [x] **Step 1: Write failing prompt and payload tests**

Add tests that import these functions:

```js
import {
  FABRIC_RENDER_PROMPT_VERSION,
  buildFabricRenderPrompt
} from "../supabase/functions/fabric-render-worker/prompt.ts";
import {
  buildGeminiGenerateContentRequest,
  extractGeminiImage,
  classifyGeminiProviderError
} from "../supabase/functions/fabric-render-worker/gemini.ts";
```

Required test cases:

- `FABRIC_RENDER_PROMPT_VERSION` is exactly `"v007"`.
- initial mode prompt includes target dimensions and the fixed preservation rules from `SPEC-0006`.
- prompt note is appended under a separate additional-instructions section.
- refine mode prompt includes refinement-source instructions.
- Gemini request parts keep this order: fabric image, target sofa image, optional refine image, assembled prompt.
- Gemini request uses model `"gemini-3-pro-image-preview"` by default.
- Gemini request asks for image output.
- Gemini request includes role labels or equivalent text so the provider can distinguish the material reference image from the locked target sofa image.
- `extractGeminiImage` returns base64 image bytes and MIME type when the response contains image data.
- `extractGeminiImage` throws a readable non-retryable error when no image data exists.
- rate limit, 5xx, timeout, and network errors classify as retryable.
- 4xx provider validation errors classify as non-retryable, except 429.

- [x] **Step 2: Run tests and verify they fail because the helper modules do not exist**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-provider.test.mjs
```

Expected: FAIL with an import error for the missing helper modules.

### Task 2: Implement Prompt And Gemini Provider Helpers

**Files:**

- Create: `supabase/functions/fabric-render-worker/prompt.ts`
- Create: `supabase/functions/fabric-render-worker/gemini.ts`
- Test: `scripts/fabric-render-worker-gemini-provider.test.mjs`

- [x] **Step 1: Create the fixed prompt helper**

Implement `prompt.ts` with:

```ts
export const FABRIC_RENDER_PROMPT_VERSION = "v007";

export type FabricRenderPromptInput = {
  generationMode: "initial" | "refine";
  targetWidthPx: number;
  targetHeightPx: number;
  promptNote?: string | null;
};

export function buildFabricRenderPrompt(input: FabricRenderPromptInput): string {
  const basePrompt = [
    "You are generating one product sofa render for a catalog preparation workflow.",
    `The output image must keep the target sofa dimensions exactly ${input.targetWidthPx}x${input.targetHeightPx} pixels.`,
    "Use the first image only as the fabric material reference.",
    "Use the second image as the locked target sofa photo.",
    "Preserve the target sofa geometry, camera view, composition, folds, cushions, armrests, legs, and overall shape.",
    "Transfer only the fabric material, texture, color, weave, pattern scale, and finish from the fabric reference image.",
    "Do not copy the fabric reference sofa shape, shadows, folds, buttons, background, room context, or camera angle.",
    "Return one generated image only."
  ];

  if (input.generationMode === "refine") {
    basePrompt.push(
      "Use the third image as the render selected for refinement.",
      "Improve the selected refinement image while preserving the locked target sofa geometry, camera view, composition, dimensions, and target fabric identity."
    );
  }

  const note = input.promptNote?.trim();
  if (note) {
    basePrompt.push("Additional administrator instruction appended to the fixed prompt:");
    basePrompt.push(note);
  }

  return basePrompt.join("\n");
}
```

- [x] **Step 2: Create the Gemini helper**

Implement `gemini.ts` with exported functions:

```ts
export type GeminiImageInput = {
  dataBase64: string;
  mimeType: string;
};

export type GeminiRequestInput = {
  model: string;
  fabricReference: GeminiImageInput;
  targetSofa: GeminiImageInput;
  refineSource?: GeminiImageInput | null;
  prompt: string;
};

export type GeminiGeneratedImage = {
  dataBase64: string;
  mimeType: string;
};
```

Use the current Gemini image-generation API shape verified during implementation. The implementation must not expose private Supabase storage objects as public URLs, so provider inputs must be sent as private bytes, inline data, uploaded provider file references, or an equivalent server-side-only provider mechanism. Tests must assert the `SPEC-0006` contract: Gemini provider, `gemini-3-pro-image-preview`, required input order, role labels or equivalent instructions, and image output extraction. Do not make the tests depend on a specific Gemini endpoint name unless that endpoint is the only supported API shape at implementation time.

- [x] **Step 3: Run provider tests**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-provider.test.mjs
```

Expected: PASS.

### Task 3: Add Storage, Input Guard, Output Path, And Metadata Tests

**Files:**

- Create: `scripts/fabric-render-worker-storage.test.mjs`
- Create later in this plan: `supabase/functions/fabric-render-worker/storage.ts`
- Create later in this plan: `supabase/functions/fabric-render-worker/scratch.ts`
- Create later in this plan: `supabase/functions/fabric-render-worker/image-metadata.ts`
- Create later in this plan: `supabase/functions/fabric-render-worker/job.ts`

- [x] **Step 1: Write failing storage and metadata tests**

Required test cases:

- private storage download URL is built as `/storage/v1/object/{bucket}/{object_path}`;
- download requests include service-role `Authorization` and `apikey` headers;
- generated output path is `renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/candidates/{job_id}/output.png`;
- scratch preparation writes `fabric_ref.jpg` and `target_sofa.jpg`;
- scratch preparation writes `refine_source.png` only for `refine` mode;
- scratch preparation clears stale `output.png` and `error.txt` before each attempt;
- a successful attempt writes `output.png` and does not leave `error.txt`;
- a failed attempt writes `error.txt` and does not leave stale `output.png`;
- input metadata with missing width or height is a non-retryable validation error;
- input metadata with longest edge greater than `2048` is a non-retryable validation error;
- `initial` mode does not require or materialize `refine_source.png`;
- unexpected refinement metadata on an `initial` job is a non-retryable invalid job metadata error;
- `refine` mode requires a refinement source input;
- PNG output dimensions are read from the PNG header;
- JPEG output dimensions are read from the JPEG header;
- unknown output image bytes produce a readable non-retryable error.

- [x] **Step 2: Run tests and verify they fail because the helper modules do not exist**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-storage.test.mjs
```

Expected: FAIL with import errors for the missing helper modules.

### Task 4: Implement Storage, Job, And Image Metadata Helpers

**Files:**

- Create: `supabase/functions/fabric-render-worker/storage.ts`
- Create: `supabase/functions/fabric-render-worker/scratch.ts`
- Create: `supabase/functions/fabric-render-worker/image-metadata.ts`
- Create: `supabase/functions/fabric-render-worker/job.ts`
- Test: `scripts/fabric-render-worker-storage.test.mjs`

- [x] **Step 1: Implement storage helpers**

Implement helpers that accept `supabaseUrl`, `serviceRoleKey`, bucket id, object path, and a `fetch` function. Do not read environment variables inside these helpers.

Required exported helpers:

- `downloadStorageObject(...)`
- `uploadStorageObject(...)`
- `uint8ArrayToBase64(...)`
- `base64ToUint8Array(...)`

- [x] **Step 2: Implement scratch folder helpers**

Implement helpers that materialize the exact `SPEC-0006` scratch contract for
one attempt:

- `fabric_ref.jpg` for the fabric AI reference input;
- `target_sofa.jpg` for the target sofa input;
- `refine_source.png` only for `refine` mode;
- `output.png` only after successful provider image generation;
- `error.txt` only after a failed attempt.

The helper must clear stale `output.png` and `error.txt` before every initial or
refine attempt.

- [x] **Step 3: Implement job input guards**

Implement job helpers that:

- accept only `initial` and `refine`;
- reject missing input metadata;
- reject input width or height over `2048`;
- require refine source only for `refine`;
- build the final `SPEC-0009` candidate output path.

- [x] **Step 4: Implement output image metadata parsing**

Implement minimal PNG and JPEG dimension parsing from returned provider bytes. The parser must not resize or visually transform output bytes.

- [x] **Step 5: Run storage tests**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-storage.test.mjs
```

Expected: PASS.

### Task 5: Add Worker RPC Support For Real Inputs And Output Metadata

**Files:**

- Create: `supabase/migrations/20260427000400_fabric_render_gemini_provider.sql`
- Modify: `scripts/fabric-render-worker-migration.test.mjs`

- [x] **Step 1: Write failing migration tests**

Update `scripts/fabric-render-worker-migration.test.mjs` so it verifies that the new migration defines:

- `public.fabric_render_worker_resolve_inputs(job_id uuid)`;
- an updated `public.fabric_render_worker_succeed(...)` signature that accepts byte size, width, and height metadata while staying backward compatible for the existing mock call;
- active/private storage asset checks;
- `greatest(width_px, height_px) <= 2048`;
- final output path compatibility with `renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/candidates/{job_id}/output.png`;
- successful jobs create a private `fabric_render_candidates` row with `accepted_at` null;
- successful jobs do not update `sofa_render_cells.accepted_fabric_render_candidate_id`;
- successful jobs do not update `sofa_render_cells.current_private_asset_id` unless a later admin acceptance workflow explicitly does that.

- [x] **Step 2: Run migration tests and verify they fail**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-migration.test.mjs
```

Expected: FAIL because the new migration does not exist yet.

- [x] **Step 3: Add the migration**

Create a forward migration that:

- creates `fabric_render_worker_resolve_inputs(job_id uuid)`;
- returns job id, sofa id, fabric id, visual matrix column id, render cell id, generation mode, prompt note, provider name, provider model, prompt version, and input asset metadata;
- validates that source assets are active private catalog assets;
- validates that source asset content types are image types the worker supports;
- validates the 2048 px longest-edge limit using stored metadata;
- validates refine source presence for `refine` mode;
- replaces `fabric_render_worker_succeed` with optional output metadata arguments while preserving the existing two-argument call path;
- creates a private `fabric_render_candidates` row for successful jobs;
- leaves candidate acceptance and current render selection to a future explicit admin workflow.

- [x] **Step 4: Run migration tests**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-migration.test.mjs
```

Expected: PASS.

### Task 6: Wire The Edge Function To The Helpers

**Files:**

- Modify: `supabase/functions/fabric-render-worker/index.ts`
- Modify: `scripts/fabric-render-worker-function.test.mjs`
- Tests:
  - `scripts/fabric-render-worker-function.test.mjs`
  - `scripts/fabric-render-worker-gemini-provider.test.mjs`
  - `scripts/fabric-render-worker-storage.test.mjs`

- [x] **Step 1: Update function wiring tests**

Extend `scripts/fabric-render-worker-function.test.mjs` to verify:

- `index.ts` imports the new helper modules;
- mock provider remains supported;
- `gemini` provider requires `GEMINI_API_KEY`;
- the function calls `fabric_render_worker_resolve_inputs` before provider work;
- the function calls the updated succeed RPC with output metadata;
- the function materializes the scratch files before provider work and writes `output.png` or `error.txt` according to the attempt result;
- the function does not accept the generated candidate or publish any public asset;
- retryable provider errors call `fabric_render_worker_fail` with `retryable: true`;
- non-retryable validation and storage errors call `fabric_render_worker_fail` with `retryable: false`.

- [x] **Step 2: Run function tests and verify they fail**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs
```

Expected: FAIL until `index.ts` is updated.

- [x] **Step 3: Update `index.ts`**

Keep `Deno.serve` in `index.ts`, but move business work into helper calls:

- read provider from `x-fabric-render-provider` first, then `FABRIC_RENDER_PROVIDER`, defaulting to `mock`;
- keep `mock` as the default local and CI provider;
- require `GEMINI_API_KEY` only when provider is `gemini`;
- claim the job exactly once through `fabric_render_worker_claim_next`;
- resolve inputs through `fabric_render_worker_resolve_inputs`;
- for mock provider, keep deterministic PNG behavior;
- for gemini provider, download private inputs, materialize scratch inputs, build the `v007` prompt, call Gemini, write `output.png`, parse returned image metadata, upload the returned bytes, and mark the job succeeded;
- for failure after claim, write `error.txt`, remove stale `output.png`, and then call the failure RPC;
- on any processing error after claim, call `fabric_render_worker_fail` with the classification from the helper layer.

- [x] **Step 4: Run function and helper tests**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-gemini-provider.test.mjs scripts/fabric-render-worker-storage.test.mjs
```

Expected: PASS.

### Task 7: Update Smoke Scripts And Package Scripts

**Files:**

- Modify: `scripts/fabric-render-worker-gemini-smoke.mjs`
- Modify: `scripts/fabric-render-worker-gemini-smoke.test.mjs`
- Modify: `package.json`

- [x] **Step 1: Update Gemini smoke tests first**

Add tests proving that the Gemini smoke script:

- skips when `GEMINI_API_KEY` is missing;
- skips when `FABRIC_RENDER_ENABLE_GEMINI_SMOKE` is not exactly `1`;
- skips clearly when the local function returns `204` because no job is queued;
- passes only when the function returns `status: "succeeded"` and `output_path`;
- prints a message telling the operator to create a valid local Gemini job when there is no claimable work.

- [x] **Step 2: Run Gemini smoke tests and verify they fail**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-smoke.test.mjs
```

Expected: FAIL until the script handles the no-job case clearly.

- [x] **Step 3: Update the script without adding model overrides**

Keep the real Gemini smoke command optional. Do not add it to mandatory `check`.

Do not add a runtime model override. The worker must use the `SPEC-0006` model
`gemini-3-pro-image-preview`. If the model is unavailable during implementation,
stop and create a change request instead of silently switching models.

- [x] **Step 4: Add new tests to root `test`**

Update `package.json` so `pnpm test` includes:

```text
scripts/fabric-render-worker-gemini-provider.test.mjs
scripts/fabric-render-worker-storage.test.mjs
```

- [x] **Step 5: Run smoke script tests**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-smoke.test.mjs
```

Expected: PASS.

### Task 8: Local Verification

**Files:**

- No new source files.

- [x] **Step 1: Run deterministic worker tests**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-smoke.test.mjs scripts/fabric-render-worker-gemini-smoke.test.mjs scripts/fabric-render-worker-migration.test.mjs scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-gemini-provider.test.mjs scripts/fabric-render-worker-storage.test.mjs
```

Expected: PASS.

- [x] **Step 2: Run the mock worker smoke path**

Run with local Supabase and functions served:

```bash
pnpm.cmd supabase:reset
pnpm.cmd supabase:functions:serve
pnpm.cmd test:workers:fabric-render
```

Expected: PASS with a succeeded mock job and private `output.png`.

- [x] **Step 3: Run the optional Gemini smoke path**

Prepare one valid local queued `fabric_render_jobs` row whose target sofa and fabric AI reference assets exist in `catalog-private-assets`, are active/private, and have stored dimensions no larger than 2048 px.

Run:

```bash
$env:FABRIC_RENDER_ENABLE_GEMINI_SMOKE='1'
$env:GEMINI_API_KEY='<local key only>'
pnpm.cmd test:workers:fabric-render:gemini
```

Expected: PASS with a succeeded Gemini job and private generated candidate output. If no job is queued, the script must SKIP with instructions instead of pretending the provider was tested.

Result in this session: PASS after adding local keys, restarting
`supabase:functions:serve`, and seeding a valid local Gemini job with
`scripts/seed-fabric-render-gemini-smoke.mjs`.

- [x] **Step 4: Run repository guardrails**

Run:

```bash
pnpm.cmd spec:check
pnpm.cmd typecheck
pnpm.cmd test
```

Expected: PASS. If local Supabase is not running, scripts that are designed to skip may skip clearly, but unit tests and spec guard must pass.

### Task 9: Update Roadmaps And Move Plan When Complete

**Files:**

- Modify: `docs/roadmap/image-worker.md`
- Modify: `docs/roadmap/supabase.md`
- Move when complete: `docs/plans/active/PLAN-0010-fabric-render-gemini-provider.md` to `docs/plans/done/PLAN-0010-fabric-render-gemini-provider.md`

- [x] **Step 1: Update roadmap status after implementation**

When implementation is complete, update both roadmap files from active wording to done wording.

- [x] **Step 2: Move the plan to done**

Move this file to:

```text
docs/plans/done/PLAN-0010-fabric-render-gemini-provider.md
```

Change `Status: active` to `Status: done`.

- [x] **Step 3: Run final checks**

Run:

```bash
pnpm.cmd spec:check
pnpm.cmd test
pnpm.cmd build
```

Expected: PASS before the implementation branch is handed to review.

## Tests

Required deterministic tests:

- `scripts/fabric-render-worker-gemini-provider.test.mjs`
  - prompt version and prompt note behavior;
  - provider payload input order;
  - generated image extraction;
  - provider error classification.
- `scripts/fabric-render-worker-storage.test.mjs`
  - private storage URL and headers;
  - scratch folder materialization and stale output/error cleanup;
  - input metadata guards;
  - final candidate output path;
  - PNG/JPEG output dimension parsing.
- `scripts/fabric-render-worker-migration.test.mjs`
  - input resolver RPC;
  - updated succeed RPC metadata support;
  - private/active/2048 px guard presence.
  - candidate remains private and unaccepted after worker success.
- `scripts/fabric-render-worker-function.test.mjs`
  - Edge Function wiring for mock and Gemini providers.
- `scripts/fabric-render-worker-gemini-smoke.test.mjs`
  - optional smoke skip/pass behavior.

Required local smoke checks:

- `pnpm.cmd test:workers:fabric-render`
  - mandatory mock path.
- `pnpm.cmd seed:workers:fabric-render:gemini`
  - local helper to create a valid private-input Gemini smoke job.
- `pnpm.cmd test:workers:fabric-render:gemini`
  - optional manual real provider path only when explicitly enabled and configured.

## Roadmap

Update these roadmap files:

- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`

## Notes

Keep `mock` as the default provider so CI and local checks stay deterministic and cheap.

Do not add a runtime model override for Gemini. The approved model is
`gemini-3-pro-image-preview`. A model change requires a change request against
`SPEC-0006`.

Do not expose private storage object paths, signed URLs, service-role keys, or Gemini keys to browser-facing code.

Do not make the worker publish generated images publicly. The worker only creates private generated candidates. Public publication belongs to the admin/API publication workflow.

Do not make the worker accept generated candidates automatically. Candidate
acceptance belongs to an explicit admin workflow.

Do not resize, crop, pad, stretch, or visually transform provider output after Gemini returns it. Output metadata parsing is allowed only to store dimensions and byte size.

The real provider smoke command proves only the provider path. It does not replace the deterministic mock smoke command.
