# Admin Render Prompt And Refine Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing admin/API path for initial prompt notes and refine jobs so the existing fabric render worker can be used from the back office.

**Architecture:** The worker already supports prompt notes for `initial` jobs and `refine` provider calls, but the admin facade currently only creates `initial` jobs with `prompt_note: null`. This plan adds the missing database field for `refine_prompt`, expands the first-party admin API validation and job creation, then exposes small admin UI controls for prompt notes and candidate refinement while keeping worker execution, candidate privacy, and publication rules unchanged.

**Tech Stack:** Next.js route handlers, React admin UI, Supabase migrations and RPCs, Supabase Edge Function worker, Vitest, `pnpm`.

---

Plan: PLAN-0030
Spec: SPEC-0006
Related Specs:

- SPEC-0009
- SPEC-0010
- SPEC-0013

Status: done
Owner area: web
Depends on:

- PLAN-0019
- PLAN-0020
- PLAN-0021
- PLAN-0026

Affected packages:

- `apps/web`
- `supabase`
- `scripts`
- `docs/roadmap`

## Scope

This plan includes:

- adding persistent `refine_prompt` storage for fabric render jobs;
- keeping `prompt_note` valid only for `initial` generation;
- allowing the admin API to create `refine` jobs from an existing private render candidate asset for the same render cell;
- requiring a non-empty `refine_prompt` for `refine` mode;
- ensuring `refine` jobs do not send or treat `prompt_note` as the refine prompt;
- adding a prompt note textarea for initial generation in the admin render coverage matrix;
- adding a refine prompt textarea and `Refine` action in private candidate review;
- polling a queued refine job the same way the current Generate action polls initial jobs;
- focused tests and roadmap updates.

This plan does not include:

- changing the approved Gemini model;
- changing the fixed `v007` initial prompt text;
- adding public customer simulation behavior;
- selecting refined candidates automatically;
- publishing generated candidates automatically;
- making the browser call the worker directly;
- adding job retry or cancel endpoints.

## Current Gap

- `supabase/functions/fabric-render-worker/index.ts` already reads `resolvedJob.refine_prompt` and has a `refine` branch.
- `supabase/functions/fabric-render-worker/prompt.ts` already has `buildFabricRenderRefinePrompt`.
- `apps/web/src/lib/admin-catalog.ts` currently types `FabricRenderJobCreateInput.generation_mode` as `"initial"` only.
- `apps/web/src/lib/admin-catalog.ts` currently rejects non-null `refinement_source_asset_id` and non-null `refine_prompt`.
- `apps/web/src/app/admin/AdminCatalogPages.tsx` currently sends `prompt_note: null` for every Generate click.
- `public.fabric_render_jobs` currently has `prompt_note` and `refinement_source_asset_id`, but not `refine_prompt`.

## File Structure

- Modify: `supabase/migrations/20260430000200_admin_render_prompt_and_refine_flow.sql`
  - Adds `fabric_render_jobs.refine_prompt`.
  - Recreates the active job idempotency index with `refine_prompt`.
  - Updates `fabric_render_worker_resolve_inputs(job_id uuid)` to return `refine_prompt`.
- Modify: `scripts/fabric-render-worker-migration.test.mjs`
  - Verifies the migration contract for `refine_prompt`.
- Modify: `scripts/fabric-render-worker-function.test.mjs`
  - Verifies the worker uses `refine_prompt` for refine and does not fall back to `prompt_note`.
- Modify: `apps/web/src/lib/admin-catalog.ts`
  - Adds union input types for `initial` and `refine`.
  - Updates validation, safe response shaping, duplicate detection, and job creation.
- Modify: `apps/web/src/lib/admin-catalog.test.ts`
  - Adds validation and store-level coverage for initial prompt notes and refine job creation.
- Modify: `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Adds route-handler coverage for refine requests.
- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Adds prompt note and refine UI controls.
  - Updates RU/FR comments around new data, automatic blocks, actions, and large UI sections.
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Adds UI coverage for initial prompt notes and candidate refine.
- Modify: `docs/roadmap/web.md`
  - Records active and completed admin prompt/refine work.
- Modify: `docs/roadmap/api.md`
  - Records active and completed admin API refine job work.
- Modify: `docs/roadmap/supabase.md`
  - Records active and completed `refine_prompt` persistence work.
- Modify: `docs/roadmap/image-worker.md`
  - Records the worker safety check for refine prompt ownership.
- Modify when complete: `docs/plans/active/README.md`
  - Removes the active row after the plan moves to `docs/plans/done`.

## Tasks

### Task 1: Migration Contract For Refine Prompt

**Files:**

- Create: `supabase/migrations/20260430000200_admin_render_prompt_and_refine_flow.sql`
- Modify: `scripts/fabric-render-worker-migration.test.mjs`

- [x] **Step 1: Add failing migration assertions**

Add assertions to `scripts/fabric-render-worker-migration.test.mjs`:

```js
const refineMigration = readFileSync(
  "supabase/migrations/20260430000200_admin_render_prompt_and_refine_flow.sql",
  "utf8",
);

expect(refineMigration).toContain("add column if not exists refine_prompt text");
expect(refineMigration).toContain(
  "constraint fabric_render_jobs_refine_prompt_mode_check",
);
expect(refineMigration).toContain(
  "drop index if exists fabric_render_jobs_active_idempotency_idx",
);
expect(refineMigration).toContain("coalesce(refine_prompt, '')");
expect(refineMigration).toContain("'refine_prompt', target_job.refine_prompt");
```

Run:

```powershell
pnpm.cmd vitest run scripts/fabric-render-worker-migration.test.mjs
```

Expected before implementation: FAIL because the migration file does not exist.

- [x] **Step 2: Add the migration**

Create `supabase/migrations/20260430000200_admin_render_prompt_and_refine_flow.sql` with this structure:

```sql
alter table public.fabric_render_jobs
  add column if not exists refine_prompt text;

alter table public.fabric_render_jobs
  drop constraint if exists fabric_render_jobs_refine_prompt_mode_check;

alter table public.fabric_render_jobs
  add constraint fabric_render_jobs_refine_prompt_mode_check check (
    (
      generation_mode = 'initial'
      and refine_prompt is null
    )
    or (
      generation_mode = 'refine'
      and refinement_source_asset_id is not null
      and prompt_note is null
      and refine_prompt is not null
      and length(btrim(refine_prompt)) > 0
    )
  );

drop index if exists fabric_render_jobs_active_idempotency_idx;

create unique index fabric_render_jobs_active_idempotency_idx
  on public.fabric_render_jobs (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    target_sofa_asset_id,
    fabric_ai_reference_asset_id,
    coalesce(refinement_source_asset_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(provider_name, ''),
    coalesce(provider_model, ''),
    prompt_version,
    generation_mode,
    coalesce(prompt_note, ''),
    coalesce(refine_prompt, '')
  )
  where status in ('queued', 'processing');
```

Also replace `public.fabric_render_worker_resolve_inputs(job_id uuid)` by copying the current function body from `20260427000400_fabric_render_gemini_provider.sql` and adding:

```sql
'refine_prompt', target_job.refine_prompt,
```

inside the returned `jsonb_build_object`.

- [x] **Step 3: Verify migration tests**

Run:

```powershell
pnpm.cmd vitest run scripts/fabric-render-worker-migration.test.mjs
```

Expected after implementation: PASS.

### Task 2: Worker Safety Around Refine Prompt

**Files:**

- Modify: `scripts/fabric-render-worker-function.test.mjs`
- Modify: `supabase/functions/fabric-render-worker/index.ts`

- [x] **Step 1: Add failing worker source assertions**

Add assertions that prevent `prompt_note` fallback in the refine branch:

```js
expect(source).toContain("refinePrompt: resolvedJob.refine_prompt");
expect(source).not.toContain("input.refinePrompt ?? input.promptNote");
expect(source).toContain("buildFabricRenderRefinePrompt");
```

Run:

```powershell
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs
```

Expected before implementation: FAIL because the worker currently falls back from `refinePrompt` to `promptNote`.

- [x] **Step 2: Update worker refine call**

In `supabase/functions/fabric-render-worker/index.ts`, change the `runGeminiProvider` call input to:

```ts
refinePrompt: resolvedJob.refine_prompt,
```

Inside `runGeminiProvider`, change the refine prompt construction to:

```ts
prompt: buildFabricRenderRefinePrompt({
  refinePrompt: input.refinePrompt ?? "",
}),
```

`buildFabricRenderRefinePrompt` already throws when the prompt is empty, so this keeps malformed refine jobs non-retryable after claim.

- [x] **Step 3: Verify worker source tests**

Run:

```powershell
pnpm.cmd vitest run scripts/fabric-render-worker-function.test.mjs
```

Expected after implementation: PASS.

### Task 3: Admin API Validation And Store Creation

**Files:**

- Modify: `apps/web/src/lib/admin-catalog.ts`
- Modify: `apps/web/src/lib/admin-catalog.test.ts`

- [x] **Step 1: Add failing validation tests**

Update the existing fabric render validation test in `apps/web/src/lib/admin-catalog.test.ts` to expect:

```ts
expect(
  validateFabricRenderJobCreatePayload({
    fabric_id: fabricRecord.id,
    generation_mode: "refine",
    prompt_note: null,
    refine_prompt: "  reduce wrinkles on the left arm  ",
    refinement_source_asset_id: fabricRenderCandidateRecord.asset_id,
    sofa_id: sofaRecord.id,
    visual_matrix_column_id: visualMatrixColumnRecord.id,
  }),
).toEqual({
  ok: true,
  value: {
    fabric_id: fabricRecord.id,
    generation_mode: "refine",
    prompt_note: null,
    refine_prompt: "reduce wrinkles on the left arm",
    refinement_source_asset_id: fabricRenderCandidateRecord.asset_id,
    sofa_id: sofaRecord.id,
    visual_matrix_column_id: visualMatrixColumnRecord.id,
  },
});

expect(
  validateFabricRenderJobCreatePayload({
    fabric_id: fabricRecord.id,
    generation_mode: "refine",
    prompt_note: "wrong place",
    refine_prompt: "try again",
    refinement_source_asset_id: fabricRenderCandidateRecord.asset_id,
    sofa_id: sofaRecord.id,
    visual_matrix_column_id: visualMatrixColumnRecord.id,
  }),
).toMatchObject({
  error: {
    code: "VALIDATION_FAILED",
    details: {
      fields: ["prompt_note"],
    },
  },
  ok: false,
  status: 422,
});
```

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
```

Expected before implementation: FAIL because refine mode is rejected.

- [x] **Step 2: Update input and record types**

In `apps/web/src/lib/admin-catalog.ts`, replace the single-mode input with:

```ts
export type FabricRenderJobCreateInput =
  | {
      fabric_id: string;
      generation_mode: "initial";
      idempotency_key?: string;
      prompt_note: string | null;
      refinement_source_asset_id?: null;
      refine_prompt?: null;
      sofa_id: string;
      visual_matrix_column_id: string;
    }
  | {
      fabric_id: string;
      generation_mode: "refine";
      idempotency_key?: string;
      prompt_note?: null;
      refinement_source_asset_id: string;
      refine_prompt: string;
      sofa_id: string;
      visual_matrix_column_id: string;
    };
```

Add these fields to `AdminFabricRenderJobRecord` and `shapeFabricRenderJobResponse`:

```ts
refinement_source_asset_id: string | null;
refine_prompt: string | null;
```

Add the same fields to `FABRIC_RENDER_JOB_SELECT`.

- [x] **Step 3: Update payload validation**

Change `validateFabricRenderJobCreatePayload` to branch on mode:

```ts
const generationMode =
  payload.generation_mode === "initial" || payload.generation_mode === "refine"
    ? payload.generation_mode
    : null;

if (!generationMode) {
  fields.push("generation_mode");
} else {
  value.generation_mode = generationMode;
}
```

For `initial`:

```ts
if (generationMode === "initial") {
  // keep existing prompt_note trimming behavior
  // reject non-null refinement_source_asset_id and refine_prompt
}
```

For `refine`:

```ts
if (generationMode === "refine") {
  const refinementSourceAssetId = readUuidField(
    payload,
    "refinement_source_asset_id",
    { required: true },
  );
  const refinePrompt = readStringField(payload, "refine_prompt", {
    allowNull: false,
    required: true,
  });

  if (!refinementSourceAssetId.ok || !refinementSourceAssetId.present) {
    fields.push("refinement_source_asset_id");
  } else {
    value.refinement_source_asset_id = refinementSourceAssetId.value;
  }

  if (!refinePrompt.ok || !refinePrompt.value?.trim()) {
    fields.push("refine_prompt");
  } else {
    value.refine_prompt = refinePrompt.value;
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "prompt_note") &&
    payload.prompt_note !== null
  ) {
    fields.push("prompt_note");
  } else {
    value.prompt_note = null;
  }
}
```

- [x] **Step 4: Add refine relationship validation**

Add a helper near `validateInitialRenderJobInput`:

```ts
async function validateRefineRenderJobInput(
  client: SupabaseCatalogClient,
  input: Extract<FabricRenderJobCreateInput, { generation_mode: "refine" }>,
): Promise<AdminCatalogOperationErrorData | null> {
  const initialContextError = await validateInitialRenderJobInput(client, {
    fabric_id: input.fabric_id,
    generation_mode: "initial",
    prompt_note: null,
    sofa_id: input.sofa_id,
    visual_matrix_column_id: input.visual_matrix_column_id,
  });

  if (initialContextError) {
    return initialContextError;
  }

  const renderCell = await fetchRenderCellForPair(client, {
    fabricId: input.fabric_id,
    sofaId: input.sofa_id,
    visualMatrixColumnId: input.visual_matrix_column_id,
  });

  if (!renderCell) {
    return {
      code: "RENDER_CELL_NOT_FOUND",
      message: "Render cell was not found.",
      status: 404,
    };
  }

  const candidate = await fetchRenderCandidateForAsset(client, {
    assetId: input.refinement_source_asset_id,
    renderCellId: renderCell.id,
  });

  if (!candidate) {
    return {
      code: "FABRIC_RENDER_CANDIDATE_NOT_FOUND",
      details: {
        fields: ["refinement_source_asset_id"],
      },
      message: "Refinement source candidate was not found for this render cell.",
      status: 422,
    };
  }

  return null;
}
```

Add `fetchRenderCandidateForAsset` using `fabric_render_candidates` and `FABRIC_RENDER_CANDIDATE_SELECT`.

- [x] **Step 5: Update duplicate detection and insert**

Change `findActiveFabricRenderJob` input to include:

```ts
refinePrompt: string | null;
refinementSourceAssetId: string | null;
```

Add query conditions:

```ts
query =
  input.refinementSourceAssetId === null
    ? query.is("refinement_source_asset_id", null)
    : query.eq("refinement_source_asset_id", input.refinementSourceAssetId);

query =
  input.refinePrompt === null
    ? query.is("refine_prompt", null)
    : query.eq("refine_prompt", input.refinePrompt);
```

When inserting, include:

```ts
prompt_note: input.generation_mode === "initial" ? promptNote : null,
refinement_source_asset_id:
  input.generation_mode === "refine"
    ? input.refinement_source_asset_id
    : null,
refine_prompt:
  input.generation_mode === "refine" ? input.refine_prompt : null,
```

- [x] **Step 6: Verify admin catalog tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
```

Expected after implementation: PASS.

### Task 4: Admin Route Handler Coverage

**Files:**

- Modify: `apps/web/src/lib/admin-catalog-route-handlers.test.ts`

- [x] **Step 1: Add failing route-handler test for refine**

Extend the fake store to keep `refinement_source_asset_id` and `refine_prompt` on jobs. Add a route-handler case:

```ts
const refineJobResponse = await handleCreateFabricRenderJobRequest({
  ...input,
  request: jsonRequest({
    fabric_id: targetFabricId,
    generation_mode: "refine",
    prompt_note: null,
    refine_prompt: "reduce wrinkles on the left arm",
    refinement_source_asset_id: candidate.asset_id,
    sofa_id: sofaId,
    visual_matrix_column_id: columnId,
  }),
});

expect(refineJobResponse.status).toBe(201);
await expect(refineJobResponse.json()).resolves.toMatchObject({
  data: {
    fabric_render_job: {
      generation_mode: "refine",
      refine_prompt: "reduce wrinkles on the left arm",
      refinement_source_asset_id: candidate.asset_id,
      status: "queued",
    },
  },
});
```

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog-route-handlers.test.ts
```

Expected before implementation: FAIL until the fake store and response shaping include the new fields.

- [x] **Step 2: Update fake route store records**

In the fake store job object, add:

```ts
refinement_source_asset_id:
  input.generation_mode === "refine"
    ? input.refinement_source_asset_id
    : null,
refine_prompt:
  input.generation_mode === "refine" ? input.refine_prompt : null,
```

- [x] **Step 3: Verify route-handler tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog-route-handlers.test.ts
```

Expected after implementation: PASS.

### Task 5: Admin UI Prompt Note And Refine Controls

**Files:**

- Modify: `apps/web/src/app/admin/AdminCatalogPages.tsx`
- Modify: `apps/web/src/app/admin/AdminCatalogPages.test.tsx`

- [x] **Step 1: Add failing UI tests for prompt note**

Add a test that types into a prompt note textarea and clicks `Generate`:

```ts
fireEvent.change(screen.getByLabelText("Prompt note"), {
  target: {
    value: "Keep seams visible",
  },
});
fireEvent.click(screen.getByRole("button", { name: "Generate" }));

await waitFor(() => {
  expect(dependencies.createFabricRenderJob).toHaveBeenCalledWith(
    "admin-token",
    expect.objectContaining({
      generation_mode: "initial",
      prompt_note: "Keep seams visible",
    }),
  );
});
```

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
```

Expected before implementation: FAIL because the UI does not render a prompt note textarea.

- [x] **Step 2: Add failing UI tests for refine**

Add a candidate review test that types a refine prompt and clicks `Refine`:

```ts
fireEvent.click(screen.getByRole("button", { name: "Review candidates" }));

await screen.findByRole("button", { name: "Use candidate" });

fireEvent.change(screen.getByLabelText("Refine prompt"), {
  target: {
    value: "Reduce wrinkles on the left arm",
  },
});
fireEvent.click(screen.getByRole("button", { name: "Refine" }));

await waitFor(() => {
  expect(dependencies.createFabricRenderJob).toHaveBeenCalledWith(
    "admin-token",
    expect.objectContaining({
      generation_mode: "refine",
      prompt_note: null,
      refine_prompt: "Reduce wrinkles on the left arm",
      refinement_source_asset_id: "00000000-0000-4000-8000-000000000907",
    }),
  );
});
```

Use the existing candidate fixture's `asset_id` (`00000000-0000-4000-8000-000000000907`) as `refinement_source_asset_id`.

- [x] **Step 3: Update UI input type**

In `AdminCatalogPages.tsx`, replace the single-mode `FabricRenderJobCreateInput` with the same union shape used in `admin-catalog.ts`.

- [x] **Step 4: Add prompt note data**

Inside `RenderCoverageSection`, add:

```ts
const [initialPromptNotes, setInitialPromptNotes] = useState<
  Record<string, string>
>({});
```

Add the required RU/FR comment immediately before it. The comment must not use these words: `hook`, `state`, `props`, `render`, `component`, `callback`, `mount`.

- [x] **Step 5: Send prompt note from Generate**

Update `handleGenerate`:

```ts
const promptNote = initialPromptNotes[cell.id]?.trim() || null;

const job = await dependencies.createFabricRenderJob(accessToken, {
  fabric_id: cell.fabric_id,
  generation_mode: "initial",
  prompt_note: promptNote,
  sofa_id: cell.sofa_id,
  visual_matrix_column_id: cell.visual_matrix_column_id,
});
```

- [x] **Step 6: Add prompt note textarea**

Near the `Generate` button, add:

```tsx
<label className="field">
  <span>Prompt note</span>
  <textarea
    name={`prompt_note_${cell.id}`}
    onChange={(event) =>
      setInitialPromptNotes((current) => ({
        ...current,
        [cell.id]: event.currentTarget.value,
      }))
    }
    rows={2}
    value={initialPromptNotes[cell.id] ?? ""}
  />
</label>
```

Add RU/FR comments before the large interface section affected by this change.

- [x] **Step 7: Add refine action**

Add a handler:

```ts
async function handleRefineCandidate(
  cell: AdminCatalogRenderCell,
  candidate: AdminCatalogRenderCandidate,
  form: HTMLFormElement,
) {
  const formData = new FormData(form);
  const refinePrompt = String(formData.get("refine_prompt") ?? "").trim();

  if (!refinePrompt) {
    setErrorMessage("REFINE_PROMPT_REQUIRED");
    return;
  }

  setErrorMessage(null);
  setActiveCellId(cell.id);

  try {
    const job = await dependencies.createFabricRenderJob(accessToken, {
      fabric_id: cell.fabric_id,
      generation_mode: "refine",
      prompt_note: null,
      refine_prompt: refinePrompt,
      refinement_source_asset_id: candidate.asset_id,
      sofa_id: cell.sofa_id,
      visual_matrix_column_id: cell.visual_matrix_column_id,
    });

    await onRefresh();
    void pollFabricRenderJobResult({
      accessToken,
      dependencies,
      isActive: () => isAliveRef.current,
      jobId: job.id,
      onRefresh,
    });
  } catch (error) {
    setErrorMessage(readErrorMessage(error));
  } finally {
    setActiveCellId(null);
  }
}
```

Add the required RU/FR comment immediately before the function. Keep the comment simple.

- [x] **Step 8: Add refine form in candidate row**

Inside each candidate row, add:

```tsx
<form
  className="admin-cell-form"
  onSubmit={(event) => {
    event.preventDefault();
    void handleRefineCandidate(cell, candidate, event.currentTarget);
  }}
>
  <label className="field">
    <span>Refine prompt</span>
    <textarea name="refine_prompt" required rows={2} />
  </label>
  <button disabled={activeCellId === cell.id} type="submit">
    Refine
  </button>
</form>
```

- [x] **Step 9: Verify UI tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
```

Expected after implementation: PASS.

### Task 6: Focused Verification

**Files:**

- No new source files.

- [x] **Step 1: Run focused web tests**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts src/app/admin/AdminCatalogPages.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run focused worker and migration tests**

Run:

```powershell
pnpm.cmd vitest run scripts/fabric-render-worker-migration.test.mjs scripts/fabric-render-worker-function.test.mjs
```

Expected: PASS.

- [x] **Step 3: Run typecheck for web**

Run:

```powershell
pnpm.cmd --filter @mobel-unique/web typecheck
```

Expected: PASS.

- [x] **Step 4: Run spec guard**

Run:

```powershell
pnpm.cmd spec:check
```

Expected: PASS.

### Task 7: Roadmaps And Plan Closure

**Files:**

- Modify: `docs/roadmap/web.md`
- Modify: `docs/roadmap/api.md`
- Modify: `docs/roadmap/supabase.md`
- Modify: `docs/roadmap/image-worker.md`
- Modify: `docs/plans/active/README.md`
- Move when complete: `docs/plans/active/PLAN-0030-admin-render-prompt-and-refine-flow.md` to `docs/plans/done/PLAN-0030-admin-render-prompt-and-refine-flow.md`

- [x] **Step 1: Mark active roadmap work before implementation**

Add active rows:

```markdown
| Active | SPEC-0006 | PLAN-0030 | Admin render coverage can send prompt notes and queue refine jobs from reviewed private candidates. |
```

Use the closest wording per roadmap file:

- web: UI controls;
- api: admin job validation and creation;
- supabase: `refine_prompt` persistence;
- image-worker: no prompt-note fallback for refine.

- [x] **Step 2: Mark done roadmap work after verification**

Change the rows from `Active` to `Done` after all focused checks pass.

- [x] **Step 3: Move the plan after verification**

Move this file to:

```text
docs/plans/done/PLAN-0030-admin-render-prompt-and-refine-flow.md
```

Change:

```text
Status: done
```

to:

```text
Status: done
```

Remove the active row from `docs/plans/active/README.md`.

## Tests

Required checks:

```powershell
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
pnpm.cmd --filter @mobel-unique/web test -- src/lib/admin-catalog-route-handlers.test.ts
pnpm.cmd --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx
pnpm.cmd vitest run scripts/fabric-render-worker-migration.test.mjs scripts/fabric-render-worker-function.test.mjs
pnpm.cmd --filter @mobel-unique/web typecheck
pnpm.cmd spec:check
```

Optional local smoke after implementation and review:

```powershell
pnpm.cmd supabase:reset
pnpm.cmd supabase:functions:serve
pnpm.cmd test:admin:render-prep:local
```

## Roadmap

Update these roadmap files during implementation:

- `docs/roadmap/web.md`
- `docs/roadmap/api.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/image-worker.md`

## Notes

- This plan intentionally pauses after plan creation for user review.
- Do not implement this plan until the user approves it.
- Keep all repository-authored plan, roadmap, test, and UI copy in English.
- In `.tsx` edits, add or refresh the required RU/FR comments around new data variables, automatic blocks, action functions, and large UI sections. Do not use the forbidden words listed in the repository instructions inside those comments.
- Refine jobs must use only the selected candidate image and `refine_prompt` in the provider request. They must not send `fabric_ref.jpg`, `target_sofa.jpg`, or the fixed `v007` prompt as provider inputs.
- Generated candidates remain private and unselected until the admin explicitly uses a candidate as current.

## Self-Review

- Spec coverage: SPEC-0006 refine mode, SPEC-0010 job creation rules, SPEC-0013 candidate refine action, and SPEC-0009 job/candidate data fields are covered.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: `refine_prompt`, `refinement_source_asset_id`, `prompt_note`, and `generation_mode` names are consistent across database, API, worker, and UI tasks.
