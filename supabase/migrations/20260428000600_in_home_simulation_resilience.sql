-- SPEC-0007 PLAN-0012 in-home simulation resilience SQL surface.
--
-- These functions cover the per-stage retry, expired-claim recovery,
-- retention purge, and operational metadata transitions required by
-- `SPEC-0007 Retries`, `SPEC-0007 Idempotency And Claiming`, and
-- `SPEC-0007 Retention`.
--
--   - `release_in_home_simulation_room_prep_claim` returns a claimed
--     Stage 1 job to `queued` so a transient failure can retry through
--     the existing pgmq visibility timeout. The attempt counter is not
--     reset; the per-stage cap continues to apply.
--   - `release_in_home_simulation_placement_claim` does the same for
--     Stage 2.
--   - `recover_expired_in_home_simulation_claims` is the sweep that
--     finds jobs whose `claim_expires_at` has passed in any processing
--     state and either re-queues them (when attempts remain and the
--     retention deadline is still in the future) or marks them
--     `failed`.
--   - `list_expired_in_home_simulation_jobs` returns the rows whose
--     `retention_deadline` has passed so the caller can iterate and
--     delete the matching storage prefix.
--   - `mark_in_home_simulation_job_purged` finalizes a purge by
--     setting the row to `expired`, recording `expired_at`, and
--     stamping `purged_at` on every related output. The function is
--     idempotent so the purge can re-run on a partial failure.

create or replace function public.release_in_home_simulation_room_prep_claim(
  job_id uuid,
  worker_identifier text,
  error_code text default null,
  error_message text default null
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

  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  update public.in_home_simulation_jobs
  set
    status = 'queued',
    claim_expires_at = null,
    last_error_code = release_in_home_simulation_room_prep_claim.error_code,
    last_error_message = release_in_home_simulation_room_prep_claim.error_message,
    updated_at = now()
  where id = release_in_home_simulation_room_prep_claim.job_id
    and status = 'room_prep_processing'
    and claimed_by = worker_identifier;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'job % is not in room_prep_processing or is claimed by another worker',
      release_in_home_simulation_room_prep_claim.job_id;
  end if;
end;
$$;

create or replace function public.release_in_home_simulation_placement_claim(
  job_id uuid,
  worker_identifier text,
  error_code text default null,
  error_message text default null
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

  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  update public.in_home_simulation_jobs
  set
    status = 'placement_queued',
    claim_expires_at = null,
    last_error_code = release_in_home_simulation_placement_claim.error_code,
    last_error_message = release_in_home_simulation_placement_claim.error_message,
    updated_at = now()
  where id = release_in_home_simulation_placement_claim.job_id
    and status = 'placement_processing'
    and claimed_by = worker_identifier;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'job % is not in placement_processing or is claimed by another worker',
      release_in_home_simulation_placement_claim.job_id;
  end if;
end;
$$;

create or replace function public.recover_expired_in_home_simulation_claims(
  batch_size integer default 100
)
returns table (
  job_id uuid,
  previous_status public.simulation_job_status,
  new_status public.simulation_job_status,
  reason text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate record;
  next_status public.simulation_job_status;
  next_reason text;
begin
  if batch_size is null or batch_size <= 0 then
    raise exception 'batch_size must be a positive integer';
  end if;

  for candidate in
    select *
    from public.in_home_simulation_jobs
    where claim_expires_at is not null
      and claim_expires_at <= now()
      and status in ('room_prep_processing', 'placement_processing')
    order by claim_expires_at asc
    limit batch_size
    for update skip locked
  loop
    if candidate.retention_deadline <= now() then
      next_status := 'failed';
      next_reason := 'retention_deadline passed during processing';
    elsif candidate.status = 'room_prep_processing'
      and candidate.room_prep_attempt_count >= candidate.max_attempts_per_stage then
      next_status := 'failed';
      next_reason := 'room_prep_attempt_count reached max_attempts_per_stage with expired claim';
    elsif candidate.status = 'placement_processing'
      and candidate.placement_attempt_count >= candidate.max_attempts_per_stage then
      next_status := 'failed';
      next_reason := 'placement_attempt_count reached max_attempts_per_stage with expired claim';
    elsif candidate.status = 'room_prep_processing' then
      next_status := 'queued';
      next_reason := 'room_prep claim expired; returning to queued';
    else
      next_status := 'placement_queued';
      next_reason := 'placement claim expired; returning to placement_queued';
    end if;

    update public.in_home_simulation_jobs
    set
      status = next_status,
      claim_expires_at = null,
      last_error_code = case
        when next_status = 'failed' then 'claim_expired'
        else last_error_code
      end,
      last_error_message = case
        when next_status = 'failed' then next_reason
        else last_error_message
      end,
      updated_at = now()
    where id = candidate.id;

    job_id := candidate.id;
    previous_status := candidate.status;
    new_status := next_status;
    reason := next_reason;
    return next;
  end loop;
end;
$$;

create or replace function public.list_expired_in_home_simulation_jobs(
  batch_size integer default 100
)
returns table (
  job_id uuid,
  storage_prefix text,
  status public.simulation_job_status,
  retention_deadline timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if batch_size is null or batch_size <= 0 then
    raise exception 'batch_size must be a positive integer';
  end if;

  return query
  select
    j.id,
    j.storage_prefix,
    j.status,
    j.retention_deadline
  from public.in_home_simulation_jobs as j
  where j.retention_deadline <= now()
    and j.status <> 'expired'
  order by j.retention_deadline asc
  limit batch_size;
end;
$$;

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
