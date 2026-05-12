# PLAN-0088 Admin Publication Stale Render Cell Resilience

Plan: PLAN-0088
Spec: SPEC-0010
Related specs: SPEC-0009, SPEC-0013, SPEC-0014
Status: done
Owner area: supabase
Depends on: PLAN-0029, PLAN-0063, PLAN-0067
Affected packages:

- `supabase/migrations`
- `scripts`
- `docs/roadmap/supabase.md`

## Goal

Make admin unpublish and archive safe when a published sofa has stale private
render-cell rows that are no longer part of the current public catalog matrix.

## Workflow Decision

No new spec or change request is required.

`SPEC-0010` already requires `POST /api/admin/sofas/{sofa_id}/unpublish` and
archive behavior to remove or deactivate public asset references so unavailable
sofas are no longer served by the application. This plan fixes an implementation
bug in that accepted behavior: publication cleanup currently updates stale
non-public render-cell rows and can trip unrelated private render-cell
validation.

The production diagnostic that motivated this plan found three
`sofa_render_cells` for sofa `57815045-d137-48a2-b887-8580340f902c` where:

- `current_public_asset_id` is already `null`;
- `fabric_id = 4434411e-e757-4455-84fa-82395a52ac0b`;
- the fabric is no longer assigned to that sofa;
- `admin_unpublish_sofa` still updates those rows and therefore hits the
  `validate_sofa_render_cell` check for "fabric must be assigned to the sofa".

This plan must not include manual production data mutation. The fix should be a
forward migration that makes cleanup resilient for this sofa and future sofas.

## Current Problem

`admin_unpublish_sofa` currently runs:

```sql
update public.sofa_render_cells
set
  current_public_asset_id = null,
  updated_at = now()
where sofa_id = p_sofa_id;
```

`admin_archive_sofa` has the same broad update. That update touches every
render-cell row for the sofa, including stale rows that have no public asset to
clean up. A before-update trigger then revalidates the whole render-cell row.
That full validation is correct for normal editing, but it is too strict for a
cleanup operation that only removes public visibility.

## Architecture

Use a small forward Supabase migration.

First, make `admin_unpublish_sofa` and `admin_archive_sofa` update only rows
with `current_public_asset_id is not null`. This prevents no-op cleanup updates
from touching stale private rows.

Second, update `validate_sofa_render_cell` so a clear-only public reference
update is allowed even if unrelated private render-cell data is stale. The only
allowed fast path is:

- `UPDATE`;
- old `current_public_asset_id` was not null;
- new `current_public_asset_id` is null;
- all identity, private render, source photo, source type, accepted candidate,
  sofa, fabric, and visual position fields are unchanged.

That fast path removes public exposure and does not create a new invalid
private render-cell relationship. All normal inserts, private render edits,
candidate changes, source photo changes, and public asset additions keep the
existing strict validation.

## Expected File Structure

- Create:
  - `supabase/migrations/20260512000400_admin_publication_stale_render_cells.sql`
    - Replaces `validate_sofa_render_cell` with the clear-public-reference fast
      path.
    - Replaces `admin_unpublish_sofa` so it updates only public-referenced
      render cells.
    - Replaces `admin_archive_sofa` so it updates only public-referenced render
      cells.
    - Re-grants the RPCs to `service_role`.
- Modify:
  - `scripts/fabric-render-worker-migration.test.mjs`
    - Adds source assertions for the new migration.
  - `scripts/spec-0009-schema-smoke.mjs`
    - Adds an executable local DB regression for unpublishing a sofa with one
      stale non-public render cell.
  - `scripts/spec-0009-schema-smoke.test.mjs`
    - Updates the smoke-script source test expectations if needed.
- Modify after implementation:
  - `docs/roadmap/supabase.md`
    - Records the completed publication cleanup resilience fix.

## Tasks

- [x] Create the workflow branch:

  ```powershell
  pnpm branch:create -- --type fix --area supabase --work "Admin publication stale render cell resilience" --spec SPEC-0010 --plan PLAN-0088
  ```

- [x] Add the failing migration source regression in
  `scripts/fabric-render-worker-migration.test.mjs`.

  Add a constant near the other migration paths:

  ```js
  const adminPublicationStaleRenderCellsMigrationPath =
    "supabase/migrations/20260512000400_admin_publication_stale_render_cells.sql";
  ```

  Add a test near the admin publication/archive tests:

  ```js
  it("keeps admin unpublish and archive resilient to stale non-public render cells", async () => {
    const sql = await readFile(
      adminPublicationStaleRenderCellsMigrationPath,
      "utf8",
    );

    expect(sql).toContain(
      "create or replace function public.validate_sofa_render_cell()",
    );
    expect(sql).toContain("old.current_public_asset_id is not null");
    expect(sql).toContain("new.current_public_asset_id is null");
    expect(sql).toContain("new.current_private_asset_id is not distinct from old.current_private_asset_id");
    expect(sql).toContain("new.accepted_fabric_render_candidate_id is not distinct from old.accepted_fabric_render_candidate_id");
    expect(sql).toContain("create or replace function public.admin_unpublish_sofa");
    expect(sql).toContain("create or replace function public.admin_archive_sofa");
    expect(sql).toContain("and current_public_asset_id is not null");
    expect(sql).toContain(
      "grant execute on function public.admin_unpublish_sofa(uuid) to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.admin_archive_sofa(uuid) to service_role",
    );
  });
  ```

- [x] Run the migration source test and confirm it fails before implementation:

  ```powershell
  pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs
  ```

  Expected before implementation: FAIL because the new migration file does not
  exist.

- [x] Add the executable schema smoke regression in
  `scripts/spec-0009-schema-smoke.mjs`.

  Add a new published sofa fixture after the existing publication fixtures. Use
  a valid public render cell plus one stale non-public render cell, then remove
  the stale cell's fabric assignment before calling `admin_unpublish_sofa`.

  ```sql
  insert into public.sofas (
    id,
    lifecycle_state,
    internal_name,
    public_name,
    shopify_order_url
  )
  values (
    '00000000-0000-4000-8000-000000000205',
    'published',
    'SPEC-0009 Stale Render Cell Sofa',
    'SPEC-0009 Stale Render Cell Sofa',
    'https://shop.example/spec-0009-stale'
  );

  insert into public.fabrics (
    id,
    lifecycle_state,
    internal_name,
    public_name,
    swatch_asset_id,
    ai_reference_asset_id,
    is_premium
  )
  values (
    '00000000-0000-4000-8000-000000000302',
    'active',
    'SPEC-0009 Stale Fabric',
    'SPEC-0009 Stale Fabric',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    false
  );

  insert into public.sofa_fabrics (sofa_id, fabric_id, public_order)
  values
    (
      '00000000-0000-4000-8000-000000000205',
      '00000000-0000-4000-8000-000000000301',
      0
    ),
    (
      '00000000-0000-4000-8000-000000000205',
      '00000000-0000-4000-8000-000000000302',
      1
    );

  insert into public.visual_matrix_columns (id, sofa_id, sequence, admin_label, public_label)
  values (
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000205',
    1,
    'Front stale',
    'Front stale'
  );

  insert into public.sofa_render_cells (
    id,
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    current_private_asset_id,
    current_public_asset_id,
    source_type
  )
  values
    (
      '00000000-0000-4000-8000-000000000502',
      '00000000-0000-4000-8000-000000000205',
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000402',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000104',
      'manual_upload'
    ),
    (
      '00000000-0000-4000-8000-000000000503',
      '00000000-0000-4000-8000-000000000205',
      '00000000-0000-4000-8000-000000000302',
      '00000000-0000-4000-8000-000000000402',
      '00000000-0000-4000-8000-000000000103',
      null,
      'manual_upload'
    );

  delete from public.sofa_fabrics
  where sofa_id = '00000000-0000-4000-8000-000000000205'
    and fabric_id = '00000000-0000-4000-8000-000000000302';

  do $smoke$
  begin
    perform public.admin_unpublish_sofa('00000000-0000-4000-8000-000000000205');
  exception
    when others then
      insert into spec_0009_smoke_failures (failure)
      values ('admin_unpublish_sofa rejected a stale non-public render cell: ' || sqlerrm);
  end;
  $smoke$;

  insert into spec_0009_smoke_failures (failure)
  select 'admin_unpublish_sofa did not return stale render cell sofa to draft'
  where not exists (
    select 1
    from public.sofas
    where id = '00000000-0000-4000-8000-000000000205'
      and lifecycle_state = 'draft'
      and published_at is null
  );

  insert into spec_0009_smoke_failures (failure)
  select 'admin_unpublish_sofa did not clear public render references'
  where exists (
    select 1
    from public.sofa_render_cells
    where sofa_id = '00000000-0000-4000-8000-000000000205'
      and current_public_asset_id is not null
  );
  ```

- [x] Run the schema smoke unit/source test and confirm it still passes:

  ```powershell
  pnpm exec vitest run scripts/spec-0009-schema-smoke.test.mjs
  ```

  Expected before implementation: PASS if the test only validates the script
  source, or FAIL only if the test needs updated expectations for the new smoke
  text.

- [x] Create
  `supabase/migrations/20260512000400_admin_publication_stale_render_cells.sql`.

  Start the file with:

  ```sql
  -- PLAN-0088 Admin Publication Stale Render Cell Resilience
  --
  -- Unpublish and archive remove public visibility. They must not fail because
  -- stale private render-cell rows, already outside the public read model, no
  -- longer satisfy normal editing validation.
  ```

- [x] In the migration, replace `public.validate_sofa_render_cell()`.

  Copy the existing function body from
  `supabase/migrations/20260427000200_spec_0009_data_model_and_storage.sql`,
  then add this fast path immediately after `begin`:

  ```sql
  if tg_op = 'UPDATE'
    and old.current_public_asset_id is not null
    and new.current_public_asset_id is null
    and new.id is not distinct from old.id
    and new.sofa_id is not distinct from old.sofa_id
    and new.fabric_id is not distinct from old.fabric_id
    and new.visual_matrix_column_id is not distinct from old.visual_matrix_column_id
    and new.current_private_asset_id is not distinct from old.current_private_asset_id
    and new.source_type is not distinct from old.source_type
    and new.source_photo_id is not distinct from old.source_photo_id
    and new.accepted_fabric_render_candidate_id is not distinct from old.accepted_fabric_render_candidate_id
  then
    return new;
  end if;
  ```

  Keep all existing validation branches after that fast path.

- [x] In the same migration, replace `public.admin_unpublish_sofa(uuid)`.

  Copy the current function from
  `supabase/migrations/20260430000100_admin_sofa_publication.sql`, but change
  the render-cell cleanup to:

  ```sql
  update public.sofa_render_cells
  set
    current_public_asset_id = null,
    updated_at = now()
  where sofa_id = p_sofa_id
    and current_public_asset_id is not null;
  ```

  Keep the existing `P0002` not-found behavior, archived-sofa conflict, draft
  lifecycle update, and JSON response shape.

- [x] In the same migration, replace `public.admin_archive_sofa(uuid)`.

  Copy the current function from
  `supabase/migrations/20260505000100_admin_sofa_archive.sql`, but change the
  render-cell cleanup to:

  ```sql
  update public.sofa_render_cells
  set
    current_public_asset_id = null,
    updated_at = now()
  where sofa_id = p_sofa_id
    and current_public_asset_id is not null;
  ```

  Keep the existing not-found behavior, archive lifecycle update, and JSON
  response shape.

- [x] Revoke public execution and grant service-role execution for both RPCs:

  ```sql
  revoke all on function public.admin_unpublish_sofa(uuid)
    from public, anon, authenticated;
  revoke all on function public.admin_archive_sofa(uuid)
    from public, anon, authenticated;

  grant execute on function public.admin_unpublish_sofa(uuid) to service_role;
  grant execute on function public.admin_archive_sofa(uuid) to service_role;
  ```

- [x] Run the migration source test again:

  ```powershell
  pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs
  ```

  Expected after implementation: PASS.

- [x] Apply the migration locally and run the executable schema smoke:

  ```powershell
  pnpm supabase:reset:db-only
  pnpm test:supabase:schema
  ```

  Expected after implementation: PASS. If local Supabase is unavailable, record
  that clearly in the closure note and keep the migration source test as the
  narrow verification.

- [x] Run root migration guardrails:

  ```powershell
  pnpm exec vitest run scripts/supabase-migrations-unique.test.mjs scripts/fabric-render-worker-migration.test.mjs scripts/spec-0009-schema-smoke.test.mjs
  ```

  Expected: PASS.

- [x] Update `docs/roadmap/supabase.md` after implementation and verification.

  Add this completed entry:

  ```md
  | Done | SPEC-0010 | PLAN-0088 | Admin unpublish and archive RPCs now ignore stale non-public render cells while cleaning public render references, so old private render-cell rows for removed fabric assignments no longer block removing a sofa from the public catalog. |
  ```

- [x] Run repository guardrails:

  ```powershell
  pnpm spec:check
  pnpm typecheck
  pnpm test
  ```

  Expected: PASS. If dependencies or local services are missing, state that
  clearly instead of claiming the checks passed.

- [x] Prepare the production rollout note.

  Include these points:

  - this is a forward migration only;
  - it does not manually delete or update production catalog data;
  - it changes cleanup rules so public references can be removed safely;
  - after deployment, the client can retry the normal admin unpublish action;
  - no direct production SQL data fix is needed for the known Eva ll rows unless
    a later diagnostic proves a separate issue.

- [x] Move this plan to `docs/plans/done` only after implementation,
  verification, roadmap update, and rollout notes are complete. Add a closure
  note listing the commands that actually passed.

## Tests

Required focused checks:

```powershell
pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs
pnpm exec vitest run scripts/spec-0009-schema-smoke.test.mjs
pnpm exec vitest run scripts/supabase-migrations-unique.test.mjs scripts/fabric-render-worker-migration.test.mjs scripts/spec-0009-schema-smoke.test.mjs
```

Required local DB check when Supabase CLI is available:

```powershell
pnpm supabase:reset:db-only
pnpm test:supabase:schema
```

Required broader checks:

```powershell
pnpm spec:check
pnpm typecheck
pnpm test
```

## Roadmap

Update after implementation:

- `docs/roadmap/supabase.md`

Do not claim a production unpublish retry succeeded until the migration is
deployed and the client retries the normal admin action.

## Production Safety

Do not run ad hoc production `UPDATE`, `DELETE`, `ALTER`, or `DROP` statements
for this issue.

Production diagnostics may use read-only `SELECT` queries. Production behavior
should change only through the reviewed forward migration in this plan.

## Production Rollout Note

- This is a forward migration only.
- It does not manually delete or update production catalog data.
- It changes cleanup rules so public references can be removed safely.
- After deployment, the client can retry the normal admin unpublish action.
- No direct production SQL data fix is needed for the known Eva ll rows unless
  a later diagnostic proves a separate issue.

## Closure Note

Closed on May 12, 2026 on branch
`fix/supabase/spec-0010-plan-0088-admin-publication-stale-render-cell-resilience`.

Passed checks:

- `pnpm exec vitest run scripts/fabric-render-worker-migration.test.mjs`
- `pnpm exec vitest run scripts/spec-0009-schema-smoke.test.mjs`
- `pnpm test:supabase:schema`
- `pnpm exec vitest run scripts/supabase-migrations-unique.test.mjs scripts/fabric-render-worker-migration.test.mjs scripts/spec-0009-schema-smoke.test.mjs`
- `pnpm spec:check`
- `pnpm typecheck`
- `pnpm test`

Additional verification:

- The RED migration source test failed before implementation because
  `supabase/migrations/20260512000400_admin_publication_stale_render_cells.sql`
  did not exist yet.
- `pnpm supabase:reset:db-only` applied all local migrations, including
  `20260512000400_admin_publication_stale_render_cells.sql`, and seeded data.
  The command then failed in `pnpm supabase:realtime:local-compat` because the
  local `psql` executable is missing (`spawnSync psql ENOENT`), so it is not
  counted as a passed command.
- `pnpm test:supabase:schema` passed after the reset using the smoke script's
  database access path.

## Notes

- The known production stale rows already have `current_public_asset_id = null`.
  They are not part of the public read model and should not be manually deleted
  as part of this fix.
- Publish must remain strict. This plan does not relax publish readiness or
  public asset creation.
- Normal render-cell editing must remain strict. This plan only allows removing
  an existing public pointer without changing the private render-cell identity.
