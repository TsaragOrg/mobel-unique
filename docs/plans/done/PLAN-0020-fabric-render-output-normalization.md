# Fabric Render Output Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing TypeScript fabric render worker match the local Python worker output sizing behavior.

**Architecture:** This plan does not create a new worker. It modifies the existing `supabase/functions/fabric-render-worker` implementation from `PLAN-0006` and `PLAN-0010`: keep queue claiming, storage paths, mock provider behavior, Gemini provider calls, private candidate creation, and refine job separation, but replace the old output sizing behavior. The worker must send Gemini the closest supported aspect ratio from the authority image dimensions, then normalize the provider image with simple centered crop and resize before uploading `output.png`.

**Tech Stack:** Supabase Edge Functions on Deno, Gemini REST `generateContent`, browser-compatible image processing in the Edge Function runtime, Vitest script tests, `pnpm`.

---

Plan: PLAN-0020
Spec: SPEC-0006
Change Requests:

- `docs/specs/change-requests/CR-SPEC-0006-fabric-render-output-normalization.md`
- `docs/specs/change-requests/CR-SPEC-0006-refine-prompt-mode.md`

Status: done
Owner area: image-worker
Depends on: PLAN-0006, PLAN-0010

## Scope

This plan includes:

- calculating the closest Gemini-supported aspect ratio from the authority
  image dimensions;
- sending that ratio through `generationConfig.imageConfig.aspectRatio`;
- removing exact pixel dimension instructions from the `initial` and `refine`
  prompt text;
- adding deterministic output normalization after provider success and before
  upload;
- normalizing `initial` outputs to target sofa dimensions;
- normalizing `refine` outputs to the selected current output dimensions;
- using simple centered crop plus resize only;
- storing generated candidate metadata for the normalized `output.png`;
- keeping the existing mock provider deterministic and cheap;
- focused unit tests and an optional real-photo Gemini check after
  implementation.

This plan does not include:

- creating a new worker;
- replacing Supabase Queues, job claiming, or storage paths;
- changing the approved Gemini model;
- adding smart crop, sofa detection, segmentation, or bounding-box logic;
- publishing generated candidates publicly;
- admin API or admin UI job creation changes;
- production Python runtime usage.

## Relationship To Previous Plans

- Keep `PLAN-0006` queue, mock provider, job status, and private storage
  foundation.
- Keep `PLAN-0010` Gemini provider foundation, private input download, output
  upload, candidate creation, and optional real Gemini smoke approach.
- Supersede the `PLAN-0010` output sizing rule that wrote exact pixel
  dimensions into prompt text and saved raw provider image bytes without visual
  post-processing.
- Keep the refine prompt contract from `CR-SPEC-0006-refine-prompt-mode`:
  refine sends only the selected current output image plus the refine prompt,
  not `fabric_ref.jpg`, `target_sofa.jpg`, or the fixed `v007` transfer prompt.

## File Structure

- Modify: `scripts/fabric-render-worker-gemini-provider.test.mjs`
  - Owns deterministic tests for prompt content and Gemini request shape.
- Modify: `scripts/fabric-render-worker-storage.test.mjs`
  - Owns deterministic tests for image metadata and new output normalization
    behavior.
- Modify: `scripts/fabric-render-worker-function.test.mjs`
  - Verifies the Edge Function wires normalization before output upload and
    success metadata persistence.
- Modify: `supabase/functions/fabric-render-worker/prompt.ts`
  - Removes exact pixel dimension instructions from initial and refine prompt
    text while preserving fixed prompt and refine wrapper intent.
- Modify: `supabase/functions/fabric-render-worker/gemini.ts`
  - Owns Gemini request construction, supported aspect ratio selection, and REST
    `imageConfig.aspectRatio` emission.
- Create: `supabase/functions/fabric-render-worker/image-normalization.ts`
  - Owns centered crop and resize of provider image bytes to authority
    dimensions.
- Create: `supabase/functions/fabric-render-worker/jpeg-js-deno.ts`
  - Bridges JPEG decoding through Deno's `npm:` import syntax for Supabase
    Edge Functions.
- Create: `supabase/functions/fabric-render-worker/deno.json`
  - Registers the `jpeg-js` npm import used by the Edge Function runtime.
- Modify: `supabase/functions/fabric-render-worker/index.ts`
  - Calls output normalization after Gemini returns image bytes and before
    scratch success, upload, dimension parsing, and succeed RPC.
- Modify: `docs/roadmap/image-worker.md`
  - Records the active and completed image-worker work.
- Modify: `docs/roadmap/workflow.md`
  - Records test workflow coverage when provider/normalization tests are added
    or changed.

## Tasks

### Task 1: Add Failing Provider Request And Prompt Tests

**Files:**

- Modify: `scripts/fabric-render-worker-gemini-provider.test.mjs`
- Later modify: `supabase/functions/fabric-render-worker/prompt.ts`
- Later modify: `supabase/functions/fabric-render-worker/gemini.ts`

- [x] **Step 1: Update prompt expectations**

Add or update tests proving:

```js
expect(prompt).not.toContain("1024x768");
expect(prompt).not.toContain("dimensions exactly");
expect(prompt).toContain("Return one generated image only.");
```

For refine prompt wrapper tests, assert:

```js
expect(refinePrompt).not.toContain("1024x768");
expect(refinePrompt).not.toContain("dimensions exactly");
expect(refinePrompt).toContain("Administrator refine instruction:");
```

- [x] **Step 2: Add aspect-ratio config expectations**

Add or update tests proving an `initial` request with `targetWidthPx: 1478` and
`targetHeightPx: 2048` returns:

```js
expect(request.config.imageConfig?.aspectRatio).toBe("3:4");
```

Add or update REST body assertions:

```js
expect(body.generationConfig.imageConfig?.aspectRatio).toBe("3:4");
```

Add a refine request assertion with `targetWidthPx: 1024` and
`targetHeightPx: 768`:

```js
expect(request.config.imageConfig?.aspectRatio).toBe("4:3");
```

- [x] **Step 3: Run provider tests and verify RED**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-provider.test.mjs
```

Expected: FAIL until prompt text and Gemini request config match the new spec.

### Task 2: Implement Prompt And Gemini Aspect-Ratio Request Behavior

**Files:**

- Modify: `supabase/functions/fabric-render-worker/prompt.ts`
- Modify: `supabase/functions/fabric-render-worker/gemini.ts`
- Test: `scripts/fabric-render-worker-gemini-provider.test.mjs`

- [x] **Step 1: Remove exact pixel dimensions from prompts**

Update `buildFabricRenderPrompt` so it keeps the fixed `v007` transfer rules
and prompt-note append behavior, but does not include a sentence like:

```text
The output image must keep the target sofa dimensions exactly 1024x768 pixels.
```

Update the refine prompt wrapper so it does not include exact pixel dimensions.

- [x] **Step 2: Add supported Gemini aspect-ratio selection**

Add a helper equivalent to the Python worker's
`closest_gemini_aspect_ratio`:

```ts
const GEMINI_SUPPORTED_ASPECT_RATIOS = [
  { height: 1, value: "1:1", width: 1 },
  { height: 3, value: "2:3", width: 2 },
  { height: 2, value: "3:2", width: 3 },
  { height: 4, value: "3:4", width: 3 },
  { height: 3, value: "4:3", width: 4 },
  { height: 5, value: "4:5", width: 4 },
  { height: 4, value: "5:4", width: 5 },
  { height: 16, value: "9:16", width: 9 },
  { height: 9, value: "16:9", width: 16 },
  { height: 9, value: "21:9", width: 21 },
] as const;
```

The helper must throw a readable error for non-positive dimensions.

- [x] **Step 3: Emit REST `imageConfig.aspectRatio`**

Update `buildGeminiGenerateContentRequest` and `buildGeminiRestRequestBody` so
REST requests include:

```ts
generationConfig: {
  imageConfig: {
    aspectRatio: request.config.imageConfig.aspectRatio
  },
  responseModalities: ["TEXT", "IMAGE"]
}
```

- [x] **Step 4: Run provider tests and verify GREEN**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-provider.test.mjs
```

Expected: PASS.

### Task 3: Add Failing Output Normalization Tests

**Files:**

- Modify: `scripts/fabric-render-worker-storage.test.mjs`
- Later create: `supabase/functions/fabric-render-worker/image-normalization.ts`

- [x] **Step 1: Add no-op normalization test**

Add a test proving that when a PNG already matches target dimensions, the
normalizer returns PNG bytes whose parsed dimensions match the target and
reports that no crop or resize was needed.

Use generated fixture bytes from the existing PNG helper style in the test file
rather than committed binary assets.

- [x] **Step 2: Add centered crop and resize test**

Add a test using a deterministic synthetic PNG where the source dimensions are
wider than the target ratio. Assert the normalized output dimensions equal the
target dimensions and that the algorithm reports a centered crop.

The test should verify behavior, not exact pixel-perfect photographic quality.
It must prove the crop is centered by checking known synthetic edge colors or
metadata returned by the helper.

- [x] **Step 3: Add tall-image centered crop and resize test**

Add a test where the source dimensions are taller than the target ratio. Assert
the normalized output dimensions equal the target dimensions and that the
algorithm reports a centered crop.

- [x] **Step 4: Add unsupported image failure test**

Add a test proving unsupported input bytes fail with a readable non-retryable
error before upload/succeed metadata would be written.

- [x] **Step 5: Run storage tests and verify RED**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-storage.test.mjs
```

Expected: FAIL because `image-normalization.ts` does not exist yet.

### Task 4: Implement Output Normalization Helper

**Files:**

- Create: `supabase/functions/fabric-render-worker/image-normalization.ts`
- Modify if needed: `supabase/functions/fabric-render-worker/image-metadata.ts`
- Test: `scripts/fabric-render-worker-storage.test.mjs`

- [x] **Step 1: Choose Edge-compatible image implementation**

Use a browser-compatible or Deno-compatible image library/API that can run in
Supabase Edge Functions. Do not use native Node-only `sharp` inside the Edge
Function.

The implementation must support decoding provider output, centered crop,
resize, and PNG output encoding.

- [x] **Step 2: Implement normalizer API**

Create an exported helper with this shape or an equivalent simple shape:

```ts
export type OutputNormalizationResult = {
  contentType: "image/png";
  outputBytes: Uint8Array;
  normalizedWidthPx: number;
  normalizedHeightPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
  cropApplied: boolean;
  resizeApplied: boolean;
};

export async function normalizeGeneratedOutput(input: {
  outputBytes: Uint8Array;
  outputContentType: string;
  targetWidthPx: number;
  targetHeightPx: number;
}): Promise<OutputNormalizationResult>;
```

- [x] **Step 3: Implement centered crop rules**

If the provider output ratio is wider than the target ratio, crop equal visual
space from the left and right sides as closely as integer pixels allow.

If the provider output ratio is taller than the target ratio, crop equal visual
space from the top and bottom as closely as integer pixels allow.

Do not inspect sofa position or image semantics.

- [x] **Step 4: Implement resize and PNG encoding**

After optional crop, resize to `targetWidthPx` by `targetHeightPx` and encode as
PNG. Return `contentType: "image/png"` so downstream metadata and upload are
based on the normalized artifact.

- [x] **Step 5: Run storage tests and verify GREEN**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-storage.test.mjs
```

Expected: PASS.

### Task 5: Wire Normalization Into Existing Worker

**Files:**

- Modify: `supabase/functions/fabric-render-worker/index.ts`
- Modify: `scripts/fabric-render-worker-function.test.mjs`
- Tests:
  - `scripts/fabric-render-worker-function.test.mjs`
  - `scripts/fabric-render-worker-storage.test.mjs`

- [x] **Step 1: Add worker wiring assertions**

Update function tests to verify `index.ts` imports and calls
`normalizeGeneratedOutput` after provider output is available and before:

- `recordFabricRenderScratchSuccess`;
- `readImageDimensions`;
- `uploadStorageObject`;
- `fabric_render_worker_succeed`.

The test should assert the succeed RPC receives normalized dimensions, not raw
provider dimensions.

- [x] **Step 2: Run function tests and verify RED**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs
```

Expected: FAIL until `index.ts` is wired to the normalizer.

- [x] **Step 3: Normalize `initial` output to target sofa dimensions**

In the existing `initial` branch, pass:

- `generatedImage.outputBytes`;
- `generatedImage.contentType`;
- `resolvedJob.target_sofa.width_px`;
- `resolvedJob.target_sofa.height_px`.

Use the normalized result for scratch success, dimension parsing, storage
upload, byte size, content type, and succeed RPC.

- [x] **Step 4: Normalize `refine` output to refinement source dimensions**

In the existing `refine` branch, pass:

- `generatedImage.outputBytes`;
- `generatedImage.contentType`;
- `resolvedJob.refinement_source.width_px`;
- `resolvedJob.refinement_source.height_px`.

Use the normalized result for scratch success, dimension parsing, storage
upload, byte size, content type, and succeed RPC.

- [x] **Step 5: Keep mock provider behavior deterministic**

Either leave the mock provider path unchanged or normalize it only when doing so
does not make deterministic local and CI tests brittle. The real Gemini path is
the required normalization target for this plan.

- [x] **Step 6: Run focused worker tests and verify GREEN**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-storage.test.mjs
```

Expected: PASS.

### Task 6: Focused Verification And Optional Real-Photo Check

**Files:**

- No source files required.

- [x] **Step 1: Run deterministic worker tests**

Run:

```bash
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-provider.test.mjs scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-storage.test.mjs
```

Expected: PASS.

- [x] **Step 2: Run Edge Function TypeScript check**

Run:

```bash
apps\web\node_modules\.bin\tsc.cmd --noEmit --noCheck --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 supabase\functions\fabric-render-worker\index.ts
```

Expected: PASS.

- [x] **Step 3: Run spec guard**

Run:

```bash
pnpm.cmd spec:check
```

Expected: PASS.

- [x] **Step 4: Optional real-photo initial generation**

Run locally on 2026-04-28 with:

- `test-assets/fabric-  render/fabric_ref.jpeg`;
- `test-assets/fabric-  render/target_sofa.jpeg`.

Result:

- job id: `5add2246-7a41-4d6b-81d5-6f53c60e34c2`;
- target input metadata: `1478x2048`;
- normalized output metadata: `1478x2048`;
- output content type: `image/png`;
- output path:
  `catalog-private-assets/renders/3fb09a82-b36d-4956-b392-5aa4fa69d474/f538321d-33f1-4be0-be32-294a492acc80/ca2b7111-3432-4de9-bf19-71765c5e7aef/candidates/5add2246-7a41-4d6b-81d5-6f53c60e34c2/output.png`.

Follow-up local check:

- job id: `33d43a11-f919-487d-b3fa-c7161168005e`;
- initial request parts were aligned with the Python worker order:
  role label, image, role label, image, prompt;
- output path:
  `catalog-private-assets/renders/fd761982-0e29-4e2a-b1fc-15c3518a9d27/1b023f9e-30ba-4d46-aa9d-0598abd3996a/de71b2bf-cc6e-4d85-9d32-cf339339d86e/candidates/33d43a11-f919-487d-b3fa-c7161168005e/output.png`;
- output metadata remained `1478x2048`, and visual review showed the target
  sofa composition was preserved instead of copying the fabric source sofa.

With local Supabase and the Edge Function running, create one `initial` job
using:

```text
test-assets/fabric-  render/fabric_ref.jpeg
test-assets/fabric-  render/target_sofa.jpeg
```

Expected for the current known test target:

- target input metadata: `1478x2048`;
- Gemini API aspect ratio: `3:4`;
- normalized output metadata: `1478x2048`;
- output path remains under
  `catalog-private-assets/renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/candidates/{job_id}/output.png`.

Do not run this optional check in CI.

### Task 7: Update Roadmaps And Close Plan

**Files:**

- Modify: `docs/roadmap/image-worker.md`
- Modify: `docs/roadmap/workflow.md`
- Move when complete:
  `docs/plans/active/PLAN-0020-fabric-render-output-normalization.md` to
  `docs/plans/done/PLAN-0020-fabric-render-output-normalization.md`

- [x] **Step 1: Update roadmap active entry before implementation if needed**

Add or keep an active row describing output normalization parity work.

- [x] **Step 2: Update roadmap done entry after implementation**

When implementation is complete, update roadmap wording to say the existing
fabric render worker now matches the Python worker output sizing behavior by
sending Gemini aspect ratio config and normalizing outputs with centered crop
and resize.

- [x] **Step 3: Move the plan to done after verification**

Move the plan file to `docs/plans/done` and change:

```text
Status: active
```

to:

```text
Status: done
```

- [x] **Step 4: Run final focused checks**

Run:

```bash
pnpm.cmd spec:check
pnpm.cmd vitest run scripts/fabric-render-worker-gemini-provider.test.mjs scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-storage.test.mjs
```

Expected: PASS.

## Tests

Required deterministic tests:

- `scripts/fabric-render-worker-gemini-provider.test.mjs`
  - prompt excludes exact pixel dimensions;
  - Gemini request includes `imageConfig.aspectRatio`;
  - initial and refine use authority dimensions for ratio selection.
- `scripts/fabric-render-worker-storage.test.mjs`
  - output normalization no-op behavior;
  - JPEG provider output decoding and PNG normalization;
  - centered crop for wide provider output;
  - centered crop for tall provider output;
  - resize to target dimensions;
  - unsupported image failure.
- `scripts/fabric-render-worker-function.test.mjs`
  - Edge Function calls normalization before upload and succeed metadata;
  - `initial` uses target sofa dimensions;
  - `refine` uses refinement source dimensions.

Optional manual verification:

- One real-photo local `initial` generation using
  `test-assets/fabric-  render` should finish with normalized output metadata
  equal to the target sofa dimensions.

## Notes

The implementation must stay inside the existing worker path. Do not create a
parallel worker or bypass the existing queue, storage, and candidate lifecycle.

Do not use smart crop. The crop is a simple centered canvas crop, matching the
local Python worker behavior in `C:\dev\worker`.

Do not expose service-role keys, storage object contents, or Gemini keys to
browser-facing code.

Do not make generated candidates public. Public render acceptance remains a
separate admin workflow.
