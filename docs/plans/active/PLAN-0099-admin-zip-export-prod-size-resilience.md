# PLAN-0099 Admin ZIP Export Production Size Resilience

Plan: PLAN-0099
Spec: SPEC-0010
Related specs: SPEC-0009, SPEC-0013
Status: active
Owner area: web
Depends on: PLAN-0051
Affected packages:

- `apps/web`
- `supabase/migrations`
- `scripts`
- `docs/roadmap/web.md`
- `docs/roadmap/supabase.md`

## Goal

Make admin render ZIP exports succeed for current production sofas whose
private render assets total more than the current 50 MB Storage object limit,
while keeping ZIP artifacts private and signed download URLs short-lived.

## Workflow Decision

No new spec or change request is required.

`SPEC-0010` already defines the Admin ZIP Export API and requires private ZIP
artifacts with short-lived admin-only signed URLs. `SPEC-0009` already says MVP
ZIP export generation may start as a server-side action and may move to an async
job if file count, runtime, or platform limits make synchronous generation
unreliable. This plan hardens the current synchronous implementation against
the production platform limit now proven by production data.

The plan does not change the public API route shape, private storage boundary,
admin authorization model, signed URL model, or the definition of which render
assets are included in an export.

## Production Evidence

On 2026-05-18, production read-only SQL showed these current private render
totals:

| Sofa | Render count | Total MB |
| ---- | ------------ | -------- |
| Eva ll | 30 | 81.26 |
| ARTE ANGLE | 29 | 72.17 |
| THANOS PANORAMIQUE | 29 | 68.66 |
| Elias | 33 | 60.90 |

The `catalog-private-assets` bucket currently has `file_size_limit = 52428800`
bytes, which is 50 MB. The ZIP builder stores already-compressed image bytes
without compression, so the ZIP artifact is approximately the sum of the current
private render asset sizes plus small ZIP headers. These production sofas exceed
the current bucket object limit before any browser download URL can be issued.

## Current Problem

The admin button calls:

- `POST /api/admin/sofas/{sofa_id}/render-exports`
- `GET /api/admin/render-exports/{export_id}`

The server implementation:

1. Creates a `sofa_render_exports` row.
2. Downloads every current private render asset for the sofa.
3. Builds a ZIP in memory.
4. Uploads the ZIP to `catalog-private-assets`.
5. Creates a `storage_assets` row and marks the export `succeeded`.
6. Returns a short-lived signed URL from the status endpoint.

Production fails at the upload step for real sofas above 50 MB. The current
error mapping turns Storage upload failures into `CATALOG_UNAVAILABLE`, which is
safe but generic. The route also has `runtime = "nodejs"` but no
explicit `maxDuration`, so large synchronous exports remain vulnerable to a
Vercel function duration limit even after the Storage object limit is raised.

## Architecture

Use the smallest production-safe hardening pass.

1. Raise only the `catalog-private-assets` object limit to 200 MB with a forward
   Supabase migration. Keep `catalog-public-assets` and
   `simulation-private-artifacts` unchanged.
2. Keep the current synchronous ZIP export for MVP, but add an explicit
   `maxDuration = 60` to the ZIP export route so Vercel has enough time for
   60-90 MB exports.
3. Keep async export worker orchestration out of scope for this fix. If the
   post-deploy validation still shows Vercel timeouts or memory failures below
   200 MB, open a follow-up plan to move ZIP generation to an async job.

## Out Of Scope

- Changing which render assets are included in the ZIP.
- Exporting medium/public variants instead of current private render masters.
- Public access to ZIP artifacts.
- Long-lived browser persistence of ZIP signed URLs.
- Frontend or admin-copy changes for a new ZIP size error.
- New environment variables for ZIP size limits.
- Application-level preflight size checks before ZIP upload.
- Compression work. Most inputs are JPEG, PNG, or WebP, so ZIP compression is
  unlikely to reliably reduce 60-90 MB exports below 50 MB.
- Async worker orchestration unless this plan's post-deploy validation proves
  synchronous export is still unreliable.

## Tasks

- [ ] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type fix --area web --work "Admin ZIP export production size resilience" --spec SPEC-0010 --plan PLAN-0099
  ```

- [ ] Add a migration source regression in
      `scripts/fabric-render-worker-migration.test.mjs`.

  Add this path constant near the existing migration path constants:

  ```js
  const adminZipExportSizeLimitMigrationPath =
    "supabase/migrations/20260518000100_admin_zip_export_size_limit.sql";
  ```

  Add this test near the admin publication and storage migration tests:

  ```js
  it("raises only the catalog private ZIP artifact object limit", async () => {
    const sql = await readFile(adminZipExportSizeLimitMigrationPath, "utf8");

    expect(sql).toContain("update storage.buckets");
    expect(sql).toContain("file_size_limit = 209715200");
    expect(sql).toContain("where id = 'catalog-private-assets'");
    expect(sql).toContain("'application/zip'");
    expect(sql).not.toContain("where id = 'catalog-public-assets'");
    expect(sql).not.toContain("where id = 'simulation-private-artifacts'");
  });
  ```

- [ ] Run the migration source regression and confirm it fails before the
      migration exists:

  ```powershell
  pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs
  ```

  Expected before implementation: FAIL because
  `20260518000100_admin_zip_export_size_limit.sql` does not exist.

- [ ] Add the Supabase migration
      `supabase/migrations/20260518000100_admin_zip_export_size_limit.sql`.

  Use this exact migration body:

  ```sql
  -- PLAN-0099 Admin ZIP Export Production Size Resilience
  --
  -- Production render ZIP artifacts can exceed the original 50 MB catalog
  -- private bucket object limit. Raise only this private catalog bucket so
  -- admin ZIP exports remain private while real sofa render sets can be stored.

  update storage.buckets
  set
    file_size_limit = 209715200,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/zip'
    ]
  where id = 'catalog-private-assets';
  ```

- [ ] Re-run the migration source regression:

  ```powershell
  pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs
  ```

  Expected after implementation: PASS.

- [ ] Add a web source test for the ZIP export route duration guardrail.

  In `apps/web/src/lib/admin-catalog.test.ts`, add source-level checks near the
  other source guard tests:

  ```ts
  it("keeps admin ZIP export route duration explicit", () => {
    const routeSource = readFileSync(
      join(
        process.cwd(),
        "src/app/api/admin/sofas/[sofa_id]/render-exports/route.ts",
      ),
      "utf8",
    );

    expect(routeSource).toContain("export const maxDuration = 60");
  });
  ```

- [ ] Run the new web source test and confirm it fails before implementation:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
  ```

  Expected before implementation: FAIL because the route duration export does
  not exist.

- [ ] Add `export const maxDuration = 60` to
      `apps/web/src/app/api/admin/sofas/[sofa_id]/render-exports/route.ts`.

  Keep the existing exports:

  ```ts
  export const dynamic = "force-dynamic";
  export const runtime = "nodejs";
  export const maxDuration = 60;
  ```

- [ ] Re-run the focused web test:

  ```powershell
  pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts
  ```

  Expected after implementation: PASS.

- [ ] Run typecheck for the web package:

  ```powershell
  pnpm --filter @mobel-unique/web typecheck
  ```

  Expected: PASS.

- [ ] Run the specification guard:

  ```powershell
  pnpm spec:check
  ```

  Expected: PASS.

- [ ] If local Supabase is running, run the schema smoke:

  ```powershell
  pnpm test:supabase:schema
  ```

  Expected: PASS. If local Supabase is not running, record that clearly in the
  completion notes instead of claiming it passed.

- [ ] Update roadmaps after verification:

  - `docs/roadmap/web.md`: record the ZIP export route duration guard.
  - `docs/roadmap/supabase.md`: record the private catalog ZIP artifact object
    limit migration.

- [ ] Post-deploy production validation.

  First verify the bucket limit with read-only SQL:

  ```sql
  select id, file_size_limit, allowed_mime_types
  from storage.buckets
  where id = 'catalog-private-assets';
  ```

  Expected: `file_size_limit = 209715200`.

  Then request ZIP exports for:

  - `Eva ll` (`81.26 MB`)
  - `ARTE ANGLE` (`72.17 MB`)
  - `Elias` (`60.90 MB`)

  Verify with read-only SQL:

  ```sql
  select
    e.id,
    e.sofa_id,
    s.internal_name,
    e.status,
    e.included_render_count,
    e.last_error_message,
    a.byte_size,
    round(a.byte_size / 1024.0 / 1024.0, 2) as zip_mb,
    e.created_at,
    e.completed_at
  from sofa_render_exports e
  join sofas s on s.id = e.sofa_id
  left join storage_assets a on a.id = e.asset_id
  order by e.created_at desc
  limit 20;
  ```

  Expected: the tested exports have `status = 'succeeded'`, non-null
  `asset_id`, and a working signed download link from the admin UI.

## Fallback Decision

If the Storage limit migration succeeds but production still fails with Vercel
timeouts, memory errors, or request cancellation for exports below 200 MB, do
not keep increasing timeouts. Open a follow-up plan that moves ZIP generation to
an async job backed by Supabase Edge Functions or a durable worker model, while
keeping the existing `POST` and `GET` contracts.

## Completion Notes

Local implementation completed on branch
`fix/web/spec-0010-plan-0099-admin-zip-export-production-size-resilience`.

Verification:

- Migration source regression was added first and failed before
  `20260518000100_admin_zip_export_size_limit.sql` existed.
- `pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs` passed
  after the migration was added.
- Web source regression was added first and failed before the ZIP export route
  declared `maxDuration`.
- `pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts`
  passed after the route export was added.
- `pnpm --filter @mobel-unique/web typecheck` passed.
- `pnpm test:supabase:schema` passed against the running local Supabase setup.
- `pnpm spec:check` passed after roadmap updates.

Post-deploy production validation was not run locally. After the migration and
web route are deployed, run the SQL and admin export checks listed in this plan
for `Eva ll`, `ARTE ANGLE`, and `Elias`.
