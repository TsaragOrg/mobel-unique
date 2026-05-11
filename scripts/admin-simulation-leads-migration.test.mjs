import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260511000200_admin_simulation_leads.sql";

const sql = readFileSync(MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");
const compactSql = sql.replace(/\s+/g, " ").toLowerCase();

function functionBody(name) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  expect(start, `${name} function must exist`).toBeGreaterThanOrEqual(0);

  const nextFunction = sql.indexOf("\ncreate or replace function public.", start + 1);
  return sql.slice(start, nextFunction === -1 ? sql.length : nextFunction);
}

describe("PLAN-0080 admin simulation leads migration", () => {
  it("creates simulation_leads with encrypted email, unique email hash, lead timestamps, job count, and audit timestamps", () => {
    expect(sql).toContain("create table if not exists public.simulation_leads");
    expect(sql).toContain("email_address_encrypted text not null");
    expect(sql).toContain("email_normalized_hash text not null unique");
    expect(sql).toContain("first_simulation_at timestamptz not null");
    expect(sql).toContain("last_simulation_at timestamptz not null");
    expect(sql).toContain("job_count integer not null default 0");
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain("updated_at timestamptz not null default now()");
    expect(sql).toContain("simulation_leads_email_encrypted_not_blank");
    expect(sql).toContain("simulation_leads_email_hash_not_blank");
    expect(sql).toContain("simulation_leads_job_count_non_negative");
  });

  it("creates simulation_lead_jobs with one row per source job and safe catalog snapshots", () => {
    expect(sql).toContain("create table if not exists public.simulation_lead_jobs");
    expect(sql).toContain(
      "simulation_lead_id uuid not null references public.simulation_leads (id)"
    );
    expect(sql).toContain(
      "in_home_simulation_job_id uuid not null references public.in_home_simulation_jobs (id)"
    );
    expect(sql).toContain("selected_sofa_id uuid not null references public.sofas (id)");
    expect(sql).toContain("selected_fabric_id uuid not null references public.fabrics (id)");
    expect(sql).toContain(
      "selected_visual_matrix_column_id uuid not null references public.visual_matrix_columns (id)"
    );
    expect(sql).toContain(
      "prepared_render_cell_id uuid references public.sofa_render_cells (id)"
    );
    expect(sql).toContain(
      "prepared_sofa_asset_id uuid references public.storage_assets (id)"
    );
    expect(sql).toContain("sofa_public_name_snapshot text not null");
    expect(sql).toContain("fabric_public_name_snapshot text not null");
    expect(sql).toContain("visual_position_label_snapshot text");
    expect(sql).toContain("simulation_status_snapshot text not null");
    expect(sql).toContain("simulation_created_at timestamptz not null");
    expect(sql).toContain(
      "unique (in_home_simulation_job_id)"
    );
    expect(sql).toContain(
      "on public.simulation_lead_jobs (simulation_lead_id, simulation_created_at desc)"
    );
    expect(sql).toContain(
      "on public.simulation_lead_jobs (simulation_created_at)"
    );
  });

  it("locks both lead tables to service-role-only access with RLS", () => {
    for (const table of ["simulation_leads", "simulation_lead_jobs"]) {
      expect(sql).toContain(`alter table public.${table}\n  enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table}\n  from anon, authenticated`);
      expect(sql).toContain(`grant all on table public.${table}\n  to service_role`);
      expect(sql).toContain(`on public.${table}\n  for all\n  to service_role`);
      expect(sql).toContain("using (true)\n  with check (true)");
    }
  });

  it("records a lead only from a created simulation job with both consents and an encrypted email handoff", () => {
    const recordLead = functionBody("record_simulation_lead_for_job");

    expect(recordLead).toContain("p_in_home_simulation_job_id uuid");
    expect(recordLead).toContain("from public.in_home_simulation_jobs");
    expect(recordLead).toContain("for update");
    expect(recordLead).toContain("required_email_consent_record_id");
    expect(recordLead).toContain("optional_commercial_consent_record_id");
    expect(recordLead).toContain("'email_verification_required'");
    expect(recordLead).toContain("'commercial_contact_optional'");
    expect(recordLead).toContain("decision = 'granted'");
    expect(recordLead).toContain("revoked_at is null");
    expect(recordLead).toContain("email_address_encrypted is null");
    expect(recordLead).toContain("return");
    expect(recordLead).toContain("insert into public.simulation_leads");
    expect(recordLead).toContain("on conflict (email_normalized_hash) do update");
    expect(recordLead).toContain("insert into public.simulation_lead_jobs");
    expect(recordLead).toContain("on conflict (in_home_simulation_job_id) do nothing");
    expect(recordLead).toContain("count(*)");
  });

  it("has no direct verified-email insertion path without a created simulation job", () => {
    const recordLead = functionBody("record_simulation_lead_for_job");
    const wrapper = functionBody("create_in_home_simulation_job_for_visitor_dispatch_outbox");

    expect(recordLead).toContain("p_in_home_simulation_job_id uuid");
    expect(recordLead).not.toContain("p_email_normalized_hash");
    expect(recordLead).not.toContain("p_email_address_encrypted");
    expect(wrapper).toContain(
      "public.create_in_home_simulation_job_for_visitor_checkpoint_pump"
    );
    expect(wrapper).toContain("perform public.record_simulation_lead_for_job");
    expect(wrapper.indexOf("public.create_in_home_simulation_job_for_visitor_checkpoint_pump")).toBeLessThan(
      wrapper.indexOf("perform public.record_simulation_lead_for_job")
    );
  });

  it("keeps the dispatch-outbox wrapper response shape unchanged", () => {
    const wrapper = functionBody("create_in_home_simulation_job_for_visitor_dispatch_outbox");

    expect(wrapper).toContain("out_job_id uuid");
    expect(wrapper).toContain("out_status public.simulation_job_status");
    expect(wrapper).toContain("out_created_at timestamptz");
    expect(wrapper).toContain("out_retention_deadline timestamptz");
    expect(wrapper).toContain("out_room_geometry_mode public.room_geometry_mode");
    expect(wrapper).toContain("out_storage_prefix text");
    expect(wrapper).toContain("return next");
  });

  it("lists grouped leads by email hash with encrypted email, latest matching date, and matching job count", () => {
    const listLeads = functionBody("admin_list_simulation_leads");

    expect(listLeads).toContain("p_email_normalized_hash text default null");
    expect(listLeads).toContain("out_email_address_encrypted text");
    expect(listLeads).toContain("out_last_simulation_at timestamptz");
    expect(listLeads).toContain("out_matching_job_count integer");
    expect(listLeads).toContain("public.simulation_leads l");
    expect(listLeads).toContain("public.simulation_lead_jobs lj");
    expect(listLeads).toContain("group by");
    expect(listLeads).toContain("l.email_normalized_hash");
    expect(listLeads).toContain("max(lj.simulation_created_at)");
    expect(listLeads).toContain("count(lj.id)");
  });

  it("uses lead job simulation dates for filters, latest-date sorting, and exact email search", () => {
    const listLeads = functionBody("admin_list_simulation_leads");
    const listJobs = functionBody("admin_list_simulation_lead_jobs");

    expect(listLeads).toContain("lj.simulation_created_at >= p_from");
    expect(listLeads).toContain("lj.simulation_created_at < p_to");
    expect(listJobs).toContain("simulation_created_at >= p_from");
    expect(listJobs).toContain("simulation_created_at < p_to");
    expect(listLeads).toContain("latest_matching_simulation_at");
    expect(listLeads).toContain("p_sort = 'oldest'");
    expect(listLeads).toContain("p_sort = 'newest'");
    expect(listLeads).toContain("l.email_normalized_hash = p_email_normalized_hash");
  });

  it("lists lead jobs with only safe catalog asset identifiers and snapshots", () => {
    const listJobs = functionBody("admin_list_simulation_lead_jobs");

    expect(listJobs).toContain("out_prepared_render_cell_id uuid");
    expect(listJobs).toContain("out_prepared_sofa_asset_id uuid");
    expect(listJobs).toContain("out_sofa_name text");
    expect(listJobs).toContain("out_fabric_name text");
    expect(listJobs).toContain("out_visual_position_label text");
    expect(listJobs).toContain("out_simulation_date timestamptz");
    expect(listJobs).toContain("out_status text");
    expect(listJobs).toContain("sofa_public_name_snapshot");
    expect(listJobs).toContain("fabric_public_name_snapshot");
    expect(listJobs).toContain("visual_position_label_snapshot");
    expect(listJobs).not.toContain("customer_room_original_path");
    expect(listJobs).not.toContain("generated_output");
    expect(listJobs).not.toContain("storage_prefix");
    expect(listJobs).not.toContain("signed");
  });

  it("deletes the retained email identity while preserving anonymized original jobs", () => {
    const deleteLead = functionBody("admin_delete_simulation_lead_identity");

    expect(deleteLead).toContain("p_lead_id uuid");
    expect(deleteLead).toContain("p_email_normalized_hash text");
    expect(deleteLead).toContain("p_rate_limit_subject_hash text");
    expect(deleteLead).toContain("from public.simulation_leads");
    expect(deleteLead).toContain("for update");
    expect(deleteLead).toContain("delete from public.simulation_lead_jobs");
    expect(deleteLead).toContain("delete from public.simulation_leads");
    expect(deleteLead).toContain("email_address_encrypted = null");
    expect(deleteLead).toContain("email_normalized_hash = null");
    expect(deleteLead).toContain("status = 'revoked'");
    expect(deleteLead).toContain("expires_at = least(expires_at, now())");
    expect(deleteLead).toContain("delete from public.simulation_rate_limits");
    expect(deleteLead).toContain("subject_kind = 'email'");
    expect(deleteLead).toContain("subject_value_hash = p_rate_limit_subject_hash");
    expect(deleteLead).not.toContain("delete from public.in_home_simulation_jobs");
  });

  it("grants execute on the service-role RPCs only", () => {
    for (const fn of [
      "record_simulation_lead_for_job",
      "admin_list_simulation_leads",
      "admin_list_simulation_lead_jobs",
      "admin_delete_simulation_lead_identity",
    ]) {
      expect(compactSql).toContain(`grant execute on function public.${fn}`);
    }

    expect(compactSql).toContain("to service_role");
    expect(sql).not.toContain("to anon");
    expect(sql).not.toContain("to authenticated");
  });
});
