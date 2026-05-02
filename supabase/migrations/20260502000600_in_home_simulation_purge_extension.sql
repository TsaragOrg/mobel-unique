-- SPEC-0015 PLAN-0039: extend in-home simulation purge for new tables.
--
-- The per-job purge RPC `mark_in_home_simulation_job_purged` is
-- extended to delete the matching `simulation_idempotency_keys`
-- rows so the 24-hour retention deadline applies to the
-- idempotency record too. The function body otherwise matches the
-- previous version exactly: same parameters, same return type,
-- same artifact-clearing semantics.
--
-- A new helper `cleanup_simulation_rate_limit_windows` truncates
-- `simulation_rate_limits` rows whose `window_start` predates a
-- caller-supplied cutoff (default 48 hours). The cleanup is run by
-- the same scheduled mechanism that triggers the per-job purge but
-- is not coupled to a specific job.

create or replace function public.mark_in_home_simulation_job_purged(
  job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched integer;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  update public.simulation_generated_outputs
  set purged_at = now(), object_path = null
  where in_home_simulation_job_id = mark_in_home_simulation_job_purged.job_id
    and purged_at is null;

  delete from public.simulation_idempotency_keys
  where simulation_job_id = mark_in_home_simulation_job_purged.job_id;

  update public.in_home_simulation_jobs
  set
    status = 'expired',
    expired_at = coalesce(expired_at, now()),
    customer_room_original_path = null,
    room_normalized_path = null,
    room_compressed_path = null,
    room_cleaned_path = null,
    dimension_guide_overlay_path = null,
    prepared_sofa_path = null,
    worker_error_path = null,
    reserved_generation_index = null,
    claim_expires_at = null,
    updated_at = now()
  where id = mark_in_home_simulation_job_purged.job_id;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;
end;
$$;

create or replace function public.cleanup_simulation_rate_limit_windows(
  older_than_hours integer default 48
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  deleted integer;
  cutoff timestamptz;
begin
  if older_than_hours is null or older_than_hours <= 0 then
    raise exception 'older_than_hours must be a positive integer';
  end if;

  cutoff := now() - make_interval(hours => older_than_hours);

  delete from public.simulation_rate_limits
  where window_start < cutoff;

  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

create or replace function public.cleanup_simulation_idempotency_keys()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  deleted integer;
begin
  delete from public.simulation_idempotency_keys
  where expires_at < now();

  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

grant execute on function public.cleanup_simulation_rate_limit_windows(integer)
  to service_role;
grant execute on function public.cleanup_simulation_idempotency_keys()
  to service_role;
