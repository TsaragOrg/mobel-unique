import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260427000300_fabric_render_worker_foundation.sql";
const geminiProviderMigrationPath =
  "supabase/migrations/20260427000400_fabric_render_gemini_provider.sql";
const productionCronMigrationPath =
  "supabase/migrations/20260429000200_fabric_render_worker_cron.sql";
const providerOwnershipMigrationPath =
  "supabase/migrations/20260429000300_fabric_render_worker_provider_ownership.sql";
const adminPublicationMigrationPath =
  "supabase/migrations/20260430000100_admin_sofa_publication.sql";
const adminRenderPromptRefineMigrationPath =
  "supabase/migrations/20260430000200_admin_render_prompt_and_refine_flow.sql";
const manualPumpRealtimeMigrationPath =
  "supabase/migrations/20260430000300_manual_fabric_render_pump_realtime.sql";
const globalCapacityMigrationPath =
  "supabase/migrations/20260501000100_fabric_render_worker_global_capacity.sql";
const webpInputMigrationPath =
  "supabase/migrations/20260504000200_fabric_render_worker_webp_input.sql";

describe("fabric render worker foundation migration", () => {
  it("defines the required local queue, job table, and worker helper functions", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("local_fabric_render_jobs");
    expect(sql).toContain("public.fabric_render_jobs");
    expect(sql).toContain("public.fabric_render_candidates");
    expect(sql).toContain("catalog-private-assets");
    expect(sql).toContain("fabric_render_worker_seed_mock_job");
    expect(sql).toContain("fabric_render_worker_claim_next");
    expect(sql).toContain("fabric_render_worker_succeed");
    expect(sql).toContain("fabric_render_worker_fail");
  });

  it("keeps the required SPEC-0006 defaults visible in the schema", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("'mock'");
    expect(sql).toContain("'mock-fabric-render-v1'");
    expect(sql).toContain("'v007'");
    expect(sql).toContain("'queued'");
  });

  it("defines real provider input resolution and private unaccepted candidate persistence", async () => {
    const sql = await readFile(geminiProviderMigrationPath, "utf8");

    expect(sql).toContain("public.fabric_render_worker_resolve_inputs");
    expect(sql).toContain(
      "drop function if exists public.fabric_render_worker_succeed(uuid, text)",
    );
    expect(sql).toContain("output_byte_size");
    expect(sql).toContain("output_width_px");
    expect(sql).toContain("output_height_px");
    expect(sql).toContain("asset.visibility <> 'private'");
    expect(sql).toContain("asset.lifecycle_state <> 'active'");
    expect(sql).toContain("greatest(asset.width_px, asset.height_px) <= 2048");
    expect(sql).toContain(
      "renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/candidates/{job_id}/output.png",
    );
    expect(sql).toContain("accepted_at");
    expect(sql).not.toContain("accepted_fabric_render_candidate_id =");
    expect(sql).not.toContain("current_private_asset_id =");
  });

  it("schedules the production fabric render worker through Supabase Cron", async () => {
    const sql = await readFile(productionCronMigrationPath, "utf8");

    expect(sql).toContain("create extension if not exists pg_net");
    expect(sql).toContain("create extension if not exists pg_cron");
    expect(sql).toContain("cron.schedule");
    expect(sql).toContain("fabric-render-worker-runner");
    expect(sql).toContain("net.http_post");
    expect(sql).toContain("fabric_render_worker_function_url");
    expect(sql).toContain("fabric_render_worker_invoke_secret");
    expect(sql).toContain("x-fabric-render-worker-secret");
    expect(sql).not.toContain("x-fabric-render-provider");
  });

  it("moves provider and model assignment to the worker claim path", async () => {
    const sql = await readFile(providerOwnershipMigrationPath, "utf8");

    expect(sql).toContain(
      "drop function if exists public.fabric_render_worker_claim_next(text, text, integer)",
    );
    expect(sql).toContain("claim_provider_name text");
    expect(sql).toContain("claim_provider_model text");
    expect(sql).toContain("provider_name = claim_provider_name");
    expect(sql).toContain("provider_model = claim_provider_model");
    expect(sql).toContain(
      "drop index if exists fabric_render_jobs_active_idempotency_idx",
    );
    expect(sql).not.toContain("coalesce(provider_name");
    expect(sql).not.toContain("coalesce(provider_model");
  });

  it("adds admin publication helpers that copy private render coverage to public references", async () => {
    const sql = await readFile(adminPublicationMigrationPath, "utf8");

    expect(sql).toContain("public.admin_publish_sofa");
    expect(sql).toContain("public.admin_unpublish_sofa");
    expect(sql).toContain("p_public_render_assets jsonb");
    expect(sql).toContain("catalog-public-assets");
    expect(sql).toContain("current_private_asset_id");
    expect(sql).toContain("current_public_asset_id");
    expect(sql).toContain("asset_kind");
    expect(sql).toContain("visibility");
    expect(sql).toContain("lifecycle_state");
    expect(sql).toContain("public.sofa_publication_readiness_errors");
    expect(sql).toContain("private_asset.visibility = 'private'");
    expect(sql).toContain("count(distinct render_cell_id)");
    expect(sql).toContain("valid_mappings");
    expect(sql).toContain("update public.sofas");
    expect(sql).toContain("lifecycle_state = 'published'");
    expect(sql).toContain("lifecycle_state = 'draft'");
  });

  it("adds admin prompt notes and refine prompts to render job persistence", async () => {
    const sql = await readFile(adminRenderPromptRefineMigrationPath, "utf8");

    expect(sql).toContain("add column if not exists refine_prompt text");
    expect(sql).toContain(
      "constraint fabric_render_jobs_refine_prompt_mode_check",
    );
    expect(sql).toContain(
      "drop index if exists fabric_render_jobs_active_idempotency_idx",
    );
    expect(sql).toContain("coalesce(refine_prompt, '')");
    expect(sql).toContain("public.fabric_render_worker_resolve_inputs");
    expect(sql).toContain("'refine_prompt', target_job.refine_prompt");
    expect(sql).not.toContain("coalesce(provider_name");
    expect(sql).not.toContain("coalesce(provider_model");
  });

  it("adds request-scoped manual pump helpers and supersedes cron pickup", async () => {
    const sql = await readFile(manualPumpRealtimeMigrationPath, "utf8");

    expect(sql).toContain("add column if not exists request_id uuid");
    expect(sql).toContain("alter column request_id set default gen_random_uuid()");
    expect(sql).toContain("set request_id = id");
    expect(sql).toContain("alter column request_id set not null");
    expect(sql).toContain("fabric_render_jobs_request_status_idx");
    expect(sql).toContain("fabric_render_jobs_request_processing_idx");
    expect(sql).toContain("public.fabric_render_worker_request_status");
    expect(sql).toContain("public.fabric_render_worker_claim_one_for_request");
    expect(sql).toContain("p_max_concurrent_jobs integer");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("hashtextextended(p_request_id::text, 0)");
    expect(sql).toContain("active_job_count >= p_max_concurrent_jobs");
    expect(sql).toContain("status', 'capacity_full'");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain("Worker claim expired before manual resume");
    expect(sql).toContain(
      "grant select on public.fabric_render_jobs to authenticated",
    );
    expect(sql).toContain(
      "spec_0031_admin_fabric_render_jobs_realtime_select",
    );
    expect(sql).toContain(
      "auth.jwt() -> 'app_metadata' -> 'mobel_unique' ->> 'role'",
    );
    expect(sql).toContain("supabase_realtime");
    expect(sql).toContain("fabric_render_jobs");
    expect(sql).toContain("fabric-render-worker-runner");
    expect(sql).toContain("cron.unschedule");
    expect(sql).not.toContain("cron.schedule(");
    expect(sql).not.toContain("attempt_count < max_attempts");
  });

  it("adds a global capacity scope for local Gemini request chains", async () => {
    const sql = await readFile(globalCapacityMigrationPath, "utf8");

    expect(sql).toContain("p_capacity_scope text default 'request'");
    expect(sql).toContain("active_processing");
    expect(sql).toContain("fabric_render_worker_global_capacity");
    expect(sql).toContain("p_capacity_scope = 'global'");
    expect(sql).toContain("public.fabric_render_worker_next_queued_request_id");
    expect(sql).toContain("status = 'queued'");
    expect(sql).toContain("job.request_id <> p_current_request_id");
    expect(sql).toContain("active_job_count >= p_max_concurrent_jobs");
    expect(sql).toContain("grant execute on function public.fabric_render_worker_request_status(uuid, text)");
    expect(sql).toContain("grant execute on function public.fabric_render_worker_claim_one_for_request");
    expect(sql).toContain("grant execute on function public.fabric_render_worker_next_queued_request_id(uuid)");
  });

  it("allows WebP private assets as fabric render worker inputs", async () => {
    const sql = await readFile(webpInputMigrationPath, "utf8");

    expect(sql).toContain("public.fabric_render_worker_validate_input_asset");
    expect(sql).toContain("'image/jpeg'");
    expect(sql).toContain("'image/png'");
    expect(sql).toContain("'image/webp'");
    expect(sql).toContain("catalog-private-assets");
    expect(sql).toContain("greatest(asset.width_px, asset.height_px) <= 2048");
  });
});
