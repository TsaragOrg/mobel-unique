-- PLAN-0068 in-home simulation checkpoint dispatch outbox.
--
-- Public simulation API RPCs persist checkpoints inside the same database
-- transaction as the visitor-visible state transition. This outbox adds the
-- durable dispatch intent that a dispatcher/backstop drains outside the public
-- request path.

create table if not exists public.in_home_simulation_checkpoint_dispatch_outbox (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.in_home_simulation_checkpoints (id) on delete cascade,
  in_home_simulation_job_id uuid not null references public.in_home_simulation_jobs (id) on delete cascade,
  checkpoint_key public.simulation_checkpoint_key not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  dispatch_started_at timestamptz,
  dispatched_at timestamptz,
  locked_by text,
  lock_expires_at timestamptz,
  last_error_code text,
  last_error_message text,
  reason text not null default 'checkpoint_claimable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ihs_dispatch_status_valid
    check (status in ('pending', 'dispatching', 'dispatched', 'retrying', 'failed')),
  constraint ihs_dispatch_attempt_count_non_negative
    check (attempt_count >= 0),
  constraint ihs_dispatch_max_attempts_positive
    check (max_attempts > 0),
  constraint ihs_dispatch_attempt_count_within_max
    check (attempt_count <= max_attempts),
  constraint ihs_dispatch_reason_not_blank
    check (length(btrim(reason)) > 0),
  constraint ihs_dispatch_locked_by_not_blank
    check (locked_by is null or length(btrim(locked_by)) > 0),
  constraint ihs_dispatch_error_code_not_blank
    check (last_error_code is null or length(btrim(last_error_code)) > 0),
  constraint ihs_dispatch_error_message_not_blank
    check (last_error_message is null or length(btrim(last_error_message)) > 0),
  constraint ihs_dispatch_lock_required
    check (
      status <> 'dispatching'
      or (locked_by is not null and lock_expires_at is not null)
    )
);

create unique index if not exists ihs_dispatch_checkpoint_unique_idx
  on public.in_home_simulation_checkpoint_dispatch_outbox (checkpoint_id);

create index if not exists ihs_dispatch_due_idx
  on public.in_home_simulation_checkpoint_dispatch_outbox (next_attempt_at, created_at, id)
  where status in ('pending', 'retrying');

create index if not exists ihs_dispatch_stale_lock_idx
  on public.in_home_simulation_checkpoint_dispatch_outbox (lock_expires_at)
  where status = 'dispatching';

create index if not exists ihs_dispatch_job_idx
  on public.in_home_simulation_checkpoint_dispatch_outbox (in_home_simulation_job_id);

drop trigger if exists set_updated_at_ihs_dispatch_outbox
  on public.in_home_simulation_checkpoint_dispatch_outbox;

create trigger set_updated_at_ihs_dispatch_outbox
  before update on public.in_home_simulation_checkpoint_dispatch_outbox
  for each row
  execute function public.set_updated_at();

alter table public.in_home_simulation_checkpoint_dispatch_outbox
  enable row level security;

revoke all on table public.in_home_simulation_checkpoint_dispatch_outbox
  from anon, authenticated;

grant all on table public.in_home_simulation_checkpoint_dispatch_outbox
  to service_role;

drop policy if exists spec_0068_service_role_all_ihs_dispatch_outbox
  on public.in_home_simulation_checkpoint_dispatch_outbox;

create policy spec_0068_service_role_all_ihs_dispatch_outbox
  on public.in_home_simulation_checkpoint_dispatch_outbox
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.is_in_home_simulation_worker_checkpoint_key(
  p_checkpoint_key public.simulation_checkpoint_key
)
returns boolean
language sql
immutable
as $$
  select p_checkpoint_key in (
    'room_validation',
    'room_cleaning',
    'room_corners',
    'dimension_guide',
    'placement_generation',
    'placement_measurement',
    'placement_finalize'
  );
$$;

grant execute on function public.is_in_home_simulation_worker_checkpoint_key(
  public.simulation_checkpoint_key
) to service_role;

create or replace function public.enqueue_in_home_simulation_checkpoint_dispatch(
  p_checkpoint_id uuid,
  p_reason text default 'checkpoint_claimable',
  p_max_attempts integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  checkpoint_record record;
  dispatch_id uuid;
begin
  if p_checkpoint_id is null then
    raise exception 'p_checkpoint_id is required';
  end if;

  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'p_reason is required';
  end if;

  if p_max_attempts is null or p_max_attempts <= 0 then
    raise exception 'p_max_attempts must be positive';
  end if;

  select
    c.id,
    c.in_home_simulation_job_id,
    c.checkpoint_key
  into checkpoint_record
  from public.in_home_simulation_checkpoints as c
  where c.id = p_checkpoint_id
  for update;

  if checkpoint_record.id is null then
    raise exception 'in_home_simulation_checkpoints row not found for id %', p_checkpoint_id;
  end if;

  if not public.is_in_home_simulation_worker_checkpoint_key(checkpoint_record.checkpoint_key) then
    return null;
  end if;

  insert into public.in_home_simulation_checkpoint_dispatch_outbox (
    checkpoint_id,
    in_home_simulation_job_id,
    checkpoint_key,
    status,
    max_attempts,
    next_attempt_at,
    reason
  )
  values (
    checkpoint_record.id,
    checkpoint_record.in_home_simulation_job_id,
    checkpoint_record.checkpoint_key,
    'pending',
    p_max_attempts,
    now(),
    p_reason
  )
  on conflict (checkpoint_id) do update
  set
    status = case
      when public.in_home_simulation_checkpoint_dispatch_outbox.status = 'dispatching'
        and public.in_home_simulation_checkpoint_dispatch_outbox.lock_expires_at > now()
      then public.in_home_simulation_checkpoint_dispatch_outbox.status
      else 'pending'
    end,
    in_home_simulation_job_id = excluded.in_home_simulation_job_id,
    checkpoint_key = excluded.checkpoint_key,
    max_attempts = greatest(
      public.in_home_simulation_checkpoint_dispatch_outbox.max_attempts,
      excluded.max_attempts
    ),
    next_attempt_at = case
      when public.in_home_simulation_checkpoint_dispatch_outbox.status = 'dispatching'
        and public.in_home_simulation_checkpoint_dispatch_outbox.lock_expires_at > now()
      then public.in_home_simulation_checkpoint_dispatch_outbox.next_attempt_at
      else now()
    end,
    dispatch_started_at = case
      when public.in_home_simulation_checkpoint_dispatch_outbox.status = 'dispatching'
        and public.in_home_simulation_checkpoint_dispatch_outbox.lock_expires_at > now()
      then public.in_home_simulation_checkpoint_dispatch_outbox.dispatch_started_at
      else null
    end,
    dispatched_at = null,
    locked_by = case
      when public.in_home_simulation_checkpoint_dispatch_outbox.status = 'dispatching'
        and public.in_home_simulation_checkpoint_dispatch_outbox.lock_expires_at > now()
      then public.in_home_simulation_checkpoint_dispatch_outbox.locked_by
      else null
    end,
    lock_expires_at = case
      when public.in_home_simulation_checkpoint_dispatch_outbox.status = 'dispatching'
        and public.in_home_simulation_checkpoint_dispatch_outbox.lock_expires_at > now()
      then public.in_home_simulation_checkpoint_dispatch_outbox.lock_expires_at
      else null
    end,
    last_error_code = null,
    last_error_message = null,
    reason = excluded.reason,
    updated_at = now()
  returning id into dispatch_id;

  return dispatch_id;
end;
$$;

grant execute on function public.enqueue_in_home_simulation_checkpoint_dispatch(
  uuid,
  text,
  integer
) to service_role;

create or replace function public.claim_in_home_simulation_checkpoint_dispatches(
  p_dispatcher_identifier text,
  p_lock_ttl_seconds integer default 60,
  p_batch_size integer default 10,
  p_max_active_checkpoints integer default 1
)
returns table (
  dispatch_id uuid,
  checkpoint_id uuid,
  job_id uuid,
  checkpoint_key public.simulation_checkpoint_key,
  attempt_count integer,
  max_attempts integer,
  generation_index integer,
  lock_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  active_checkpoint_count integer;
  target_limit integer;
  new_lock_expires_at timestamptz;
begin
  if p_dispatcher_identifier is null or length(btrim(p_dispatcher_identifier)) = 0 then
    raise exception 'p_dispatcher_identifier is required';
  end if;

  if p_lock_ttl_seconds is null or p_lock_ttl_seconds <= 0 then
    raise exception 'p_lock_ttl_seconds must be positive';
  end if;

  if p_batch_size is null or p_batch_size <= 0 then
    raise exception 'p_batch_size must be positive';
  end if;

  if p_max_active_checkpoints is null or p_max_active_checkpoints <= 0 then
    raise exception 'p_max_active_checkpoints must be positive';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('in_home_simulation_checkpoint_dispatch_capacity', 0)
  );

  if public.simulation_cost_meter_paused() then
    return;
  end if;

  select count(*)::integer
  into active_checkpoint_count
  from public.in_home_simulation_checkpoints as c
  where c.status = 'processing'
    and c.claim_expires_at > now();

  target_limit := least(
    p_batch_size,
    greatest(p_max_active_checkpoints - active_checkpoint_count, 0)
  );

  if target_limit <= 0 then
    return;
  end if;

  new_lock_expires_at := now() + make_interval(secs => p_lock_ttl_seconds);

  return query
  with candidates as (
    select d.id
    from public.in_home_simulation_checkpoint_dispatch_outbox as d
    join public.in_home_simulation_checkpoints as c
      on c.id = d.checkpoint_id
    join public.in_home_simulation_jobs as j
      on j.id = d.in_home_simulation_job_id
    where (
        d.status in ('pending', 'retrying')
        or (d.status = 'dispatching' and d.lock_expires_at <= now())
      )
      and d.attempt_count < d.max_attempts
      and d.next_attempt_at <= now()
      and c.status in ('queued', 'retrying')
      and public.is_in_home_simulation_worker_checkpoint_key(c.checkpoint_key)
      and j.retention_deadline > now()
      and not exists (
        select 1
        from public.in_home_simulation_checkpoints as active
        where active.in_home_simulation_job_id = c.in_home_simulation_job_id
          and active.status = 'processing'
      )
      and (
        (
          c.checkpoint_key in (
            'room_validation',
            'room_cleaning',
            'room_corners',
            'dimension_guide'
          )
          and j.status in ('queued', 'room_prep_processing')
        )
        or (
          c.checkpoint_key in (
            'placement_generation',
            'placement_measurement',
            'placement_finalize'
          )
          and j.status in ('placement_queued', 'placement_processing')
        )
      )
    order by d.next_attempt_at, d.created_at, d.id
    for update of d skip locked
    limit target_limit
  )
  update public.in_home_simulation_checkpoint_dispatch_outbox as d
  set
    status = 'dispatching',
    attempt_count = d.attempt_count + 1,
    last_attempt_at = now(),
    dispatch_started_at = coalesce(d.dispatch_started_at, now()),
    locked_by = p_dispatcher_identifier,
    lock_expires_at = new_lock_expires_at,
    updated_at = now()
  from candidates
  cross join public.in_home_simulation_checkpoints as c
  where d.id = candidates.id
    and c.id = d.checkpoint_id
  returning
    d.id,
    d.checkpoint_id,
    d.in_home_simulation_job_id,
    c.checkpoint_key,
    d.attempt_count,
    d.max_attempts,
    c.generation_index,
    d.lock_expires_at;
end;
$$;

grant execute on function public.claim_in_home_simulation_checkpoint_dispatches(
  text,
  integer,
  integer,
  integer
) to service_role;

create or replace function public.mark_in_home_simulation_checkpoint_dispatch_dispatched(
  p_dispatch_id uuid,
  p_dispatcher_identifier text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched integer;
begin
  if p_dispatch_id is null then
    raise exception 'p_dispatch_id is required';
  end if;

  update public.in_home_simulation_checkpoint_dispatch_outbox as d
  set
    status = 'dispatched',
    dispatched_at = now(),
    locked_by = null,
    lock_expires_at = null,
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
  where d.id = p_dispatch_id
    and d.status = 'dispatching'
    and (
      p_dispatcher_identifier is null
      or d.locked_by = p_dispatcher_identifier
      or d.lock_expires_at <= now()
    );

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'dispatch % is not dispatching or is locked by another dispatcher', p_dispatch_id;
  end if;
end;
$$;

grant execute on function public.mark_in_home_simulation_checkpoint_dispatch_dispatched(
  uuid,
  text
) to service_role;

create or replace function public.mark_in_home_simulation_checkpoint_dispatch_retryable(
  p_dispatch_id uuid,
  p_dispatcher_identifier text,
  p_error_code text,
  p_error_message text,
  p_next_attempt_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dispatch_record public.in_home_simulation_checkpoint_dispatch_outbox%rowtype;
  next_status text;
  resolved_next_attempt_at timestamptz;
begin
  if p_dispatch_id is null then
    raise exception 'p_dispatch_id is required';
  end if;

  if p_dispatcher_identifier is null or length(btrim(p_dispatcher_identifier)) = 0 then
    raise exception 'p_dispatcher_identifier is required';
  end if;

  if p_error_code is null or length(btrim(p_error_code)) = 0 then
    raise exception 'p_error_code is required';
  end if;

  if p_error_message is null or length(btrim(p_error_message)) = 0 then
    raise exception 'p_error_message is required';
  end if;

  select *
  into dispatch_record
  from public.in_home_simulation_checkpoint_dispatch_outbox
  where id = p_dispatch_id
    and status = 'dispatching'
    and (
      locked_by = p_dispatcher_identifier
      or lock_expires_at <= now()
    )
  for update;

  if dispatch_record.id is null then
    raise exception 'dispatch % is not dispatching or is locked by another dispatcher', p_dispatch_id;
  end if;

  next_status := case
    when dispatch_record.attempt_count >= dispatch_record.max_attempts then 'failed'
    else 'retrying'
  end;

  resolved_next_attempt_at := case
    when next_status = 'failed' then dispatch_record.next_attempt_at
    else coalesce(p_next_attempt_at, now() + make_interval(secs => 30))
  end;

  update public.in_home_simulation_checkpoint_dispatch_outbox
  set
    status = next_status,
    next_attempt_at = resolved_next_attempt_at,
    locked_by = null,
    lock_expires_at = null,
    last_error_code = p_error_code,
    last_error_message = left(p_error_message, 1000),
    updated_at = now()
  where id = dispatch_record.id;

  return jsonb_build_object(
    'status', next_status,
    'dispatch_id', dispatch_record.id,
    'checkpoint_id', dispatch_record.checkpoint_id,
    'retryable', next_status = 'retrying',
    'next_attempt_at', resolved_next_attempt_at
  );
end;
$$;

grant execute on function public.mark_in_home_simulation_checkpoint_dispatch_retryable(
  uuid,
  text,
  text,
  text,
  timestamptz
) to service_role;

create or replace function public.requeue_stale_in_home_simulation_checkpoint_dispatches(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  requeued_count integer;
begin
  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit must be positive';
  end if;

  with stale as (
    select id
    from public.in_home_simulation_checkpoint_dispatch_outbox
    where status = 'dispatching'
      and lock_expires_at <= p_now
    order by lock_expires_at, id
    for update skip locked
    limit p_limit
  )
  update public.in_home_simulation_checkpoint_dispatch_outbox as d
  set
    status = case
      when d.attempt_count >= d.max_attempts then 'failed'
      else 'retrying'
    end,
    next_attempt_at = case
      when d.attempt_count >= d.max_attempts then d.next_attempt_at
      else p_now
    end,
    locked_by = null,
    lock_expires_at = null,
    last_error_code = coalesce(d.last_error_code, 'dispatch_lock_expired'),
    last_error_message = coalesce(d.last_error_message, 'Dispatch lock expired before completion.'),
    updated_at = now()
  from stale
  where d.id = stale.id;

  get diagnostics requeued_count = row_count;
  return requeued_count;
end;
$$;

grant execute on function public.requeue_stale_in_home_simulation_checkpoint_dispatches(
  timestamptz,
  integer
) to service_role;

create or replace function public.recover_stale_in_home_simulation_checkpoints(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate record;
  recovered_count integer := 0;
  should_retry boolean;
  next_checkpoint_status public.simulation_checkpoint_status;
  next_job_status public.simulation_job_status;
  recovery_message text;
begin
  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit must be positive';
  end if;

  for candidate in
    select
      c.id as checkpoint_id,
      c.in_home_simulation_job_id,
      c.checkpoint_key,
      c.attempt_number,
      c.max_attempts,
      j.generated_output_count,
      j.retention_deadline
    from public.in_home_simulation_checkpoints as c
    join public.in_home_simulation_jobs as j
      on j.id = c.in_home_simulation_job_id
    where c.status = 'processing'
      and c.claim_expires_at <= p_now
    order by c.claim_expires_at, c.id
    limit p_limit
    for update of c, j skip locked
  loop
    should_retry :=
      candidate.retention_deadline > p_now
      and candidate.attempt_number < candidate.max_attempts;

    next_checkpoint_status := case
      when should_retry then 'retrying'::public.simulation_checkpoint_status
      else 'failed'::public.simulation_checkpoint_status
    end;

    next_job_status := case
      when should_retry then public.in_home_simulation_checkpoint_job_status(candidate.checkpoint_key)
      when candidate.checkpoint_key in (
        'placement_generation',
        'placement_measurement',
        'placement_finalize'
      ) and candidate.generated_output_count > 0 then 'succeeded'::public.simulation_job_status
      else 'failed'::public.simulation_job_status
    end;

    recovery_message := case
      when should_retry then 'Checkpoint claim expired before completion; returning to dispatch.'
      else 'Checkpoint claim expired before completion and no retry remains.'
    end;

    update public.in_home_simulation_checkpoints
    set
      status = next_checkpoint_status,
      claimed_by = null,
      claimed_at = null,
      claim_expires_at = null,
      retryable = should_retry,
      safe_error_code = case
        when should_retry then coalesce(safe_error_code, 'checkpoint_claim_expired')
        else 'checkpoint_claim_expired'
      end,
      safe_error_message = case
        when should_retry then coalesce(safe_error_message, recovery_message)
        else recovery_message
      end,
      completed_at = case when should_retry then completed_at else p_now end,
      updated_at = now()
    where id = candidate.checkpoint_id;

    update public.in_home_simulation_jobs
    set
      status = next_job_status,
      claimed_by = null,
      claim_expires_at = null,
      current_checkpoint = candidate.checkpoint_key,
      current_checkpoint_status = next_checkpoint_status,
      last_error_code = case
        when next_job_status = 'failed' then coalesce(last_error_code, 'checkpoint_claim_expired')
        else last_error_code
      end,
      last_error_message = case
        when next_job_status = 'failed' then coalesce(last_error_message, recovery_message)
        else last_error_message
      end,
      last_regeneration_error_message = case
        when next_job_status = 'succeeded'
          and candidate.checkpoint_key in (
            'placement_generation',
            'placement_measurement',
            'placement_finalize'
          )
        then coalesce(last_regeneration_error_message, recovery_message)
        else last_regeneration_error_message
      end,
      reserved_generation_index = case
        when next_job_status = 'succeeded'
          and candidate.checkpoint_key in (
            'placement_generation',
            'placement_measurement',
            'placement_finalize'
          )
        then null
        else reserved_generation_index
      end,
      progress_updated_at = now(),
      updated_at = now()
    where id = candidate.in_home_simulation_job_id;

    perform public.record_in_home_simulation_progress(
      candidate.in_home_simulation_job_id,
      candidate.checkpoint_key,
      next_checkpoint_status,
      candidate.checkpoint_key::text,
      null,
      null,
      false,
      false,
      next_job_status = 'succeeded' and candidate.generated_output_count > 0,
      next_job_status = 'succeeded' and candidate.generated_output_count < 3
    );

    if should_retry then
      perform public.enqueue_in_home_simulation_checkpoint_dispatch(
        candidate.checkpoint_id,
        'checkpoint_claim_expired',
        candidate.max_attempts
      );
    else
      update public.in_home_simulation_checkpoint_dispatch_outbox
      set
        status = 'failed',
        locked_by = null,
        lock_expires_at = null,
        last_error_code = 'checkpoint_claim_expired',
        last_error_message = recovery_message,
        updated_at = now()
      where checkpoint_id = candidate.checkpoint_id
        and status in ('pending', 'retrying', 'dispatching');
    end if;

    recovered_count := recovered_count + 1;
  end loop;

  return recovered_count;
end;
$$;

grant execute on function public.recover_stale_in_home_simulation_checkpoints(
  timestamptz,
  integer
) to service_role;

create or replace function public.enqueue_in_home_simulation_checkpoint(
  p_simulation_job_id uuid,
  p_checkpoint_key public.simulation_checkpoint_key,
  p_generation_index integer default null,
  p_max_attempts integer default 3,
  p_progress_step_key text default null,
  p_progress_step_ordinal integer default null,
  p_progress_total_steps integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_job public.in_home_simulation_jobs%rowtype;
  checkpoint_id uuid;
  next_job_status public.simulation_job_status;
begin
  if p_simulation_job_id is null then
    raise exception 'p_simulation_job_id is required';
  end if;

  if p_checkpoint_key is null then
    raise exception 'p_checkpoint_key is required';
  end if;

  if p_max_attempts is null or p_max_attempts <= 0 then
    raise exception 'p_max_attempts must be positive';
  end if;

  if p_generation_index is not null and p_generation_index not in (0, 1, 2) then
    raise exception 'p_generation_index must be 0, 1, 2, or null';
  end if;

  select *
  into target_job
  from public.in_home_simulation_jobs
  where id = p_simulation_job_id
  for update;

  if target_job.id is null then
    raise exception 'in_home_simulation_jobs row not found for id %', p_simulation_job_id;
  end if;

  if target_job.retention_deadline <= now() then
    raise exception 'in_home_simulation_jobs row % is past retention deadline', p_simulation_job_id;
  end if;

  next_job_status := public.in_home_simulation_checkpoint_job_status(p_checkpoint_key);

  insert into public.in_home_simulation_checkpoints (
    in_home_simulation_job_id,
    checkpoint_key,
    status,
    attempt_number,
    max_attempts,
    generation_index
  )
  values (
    p_simulation_job_id,
    p_checkpoint_key,
    'queued',
    1,
    p_max_attempts,
    p_generation_index
  )
  on conflict (
    in_home_simulation_job_id,
    checkpoint_key,
    (coalesce(generation_index, -1))
  )
  where status in ('queued', 'processing', 'retrying')
  do update set
    status = case
      when public.in_home_simulation_checkpoints.status = 'processing'
        then public.in_home_simulation_checkpoints.status
      else 'queued'::public.simulation_checkpoint_status
    end,
    max_attempts = greatest(public.in_home_simulation_checkpoints.max_attempts, excluded.max_attempts),
    updated_at = now()
  returning id into checkpoint_id;

  update public.in_home_simulation_jobs
  set
    status = case
      when next_job_status in ('failed', 'expired', 'succeeded', 'awaiting_dimensions')
        then next_job_status
      else status
    end,
    current_checkpoint = p_checkpoint_key,
    current_checkpoint_status = 'queued',
    updated_at = now()
  where id = p_simulation_job_id;

  perform public.record_in_home_simulation_progress(
    p_simulation_job_id,
    p_checkpoint_key,
    'queued',
    coalesce(p_progress_step_key, p_checkpoint_key::text),
    p_progress_step_ordinal,
    p_progress_total_steps,
    p_checkpoint_key = 'awaiting_dimensions',
    p_checkpoint_key = 'awaiting_dimensions',
    target_job.generated_output_count > 0,
    target_job.status = 'succeeded' and target_job.generated_output_count < 3
  );

  if public.is_in_home_simulation_worker_checkpoint_key(p_checkpoint_key) then
    perform public.enqueue_in_home_simulation_checkpoint_dispatch(
      checkpoint_id,
      'checkpoint_enqueued',
      5
    );
  end if;

  return checkpoint_id;
end;
$$;

grant execute on function public.enqueue_in_home_simulation_checkpoint(
  uuid,
  public.simulation_checkpoint_key,
  integer,
  integer,
  text,
  integer,
  integer
) to service_role;

create or replace function public.create_in_home_simulation_job_for_visitor_dispatch_outbox(
  p_verification_request_id text,
  p_sofa_slug text,
  p_fabric_id uuid,
  p_visual_position_id uuid,
  p_customer_room_original_path text,
  p_room_geometry_mode public.room_geometry_mode,
  p_job_id_override uuid default null,
  p_retention_hours integer default 24
)
returns table (
  out_job_id uuid,
  out_status public.simulation_job_status,
  out_created_at timestamptz,
  out_retention_deadline timestamptz,
  out_room_geometry_mode public.room_geometry_mode,
  out_storage_prefix text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select *
  from public.create_in_home_simulation_job_for_visitor_checkpoint_pump(
    p_verification_request_id,
    p_sofa_slug,
    p_fabric_id,
    p_visual_position_id,
    p_customer_room_original_path,
    p_room_geometry_mode,
    p_job_id_override,
    p_retention_hours
  );
end;
$$;

grant execute on function public.create_in_home_simulation_job_for_visitor_dispatch_outbox(
  text, text, uuid, uuid, text, public.room_geometry_mode, uuid, integer
) to service_role;

create or replace function public.submit_in_home_simulation_dimensions_dispatch_outbox(
  p_job_id uuid,
  p_supplied_dimensions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return public.submit_in_home_simulation_dimensions_checkpoint_pump(
    p_job_id,
    p_supplied_dimensions
  );
end;
$$;

grant execute on function public.submit_in_home_simulation_dimensions_dispatch_outbox(
  uuid, jsonb
) to service_role;

create or replace function public.request_in_home_simulation_regeneration_dispatch_outbox(
  p_job_id uuid,
  p_supplied_dimensions jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return public.request_in_home_simulation_regeneration_checkpoint_pump(
    p_job_id,
    p_supplied_dimensions
  );
end;
$$;

grant execute on function public.request_in_home_simulation_regeneration_dispatch_outbox(
  uuid, jsonb
) to service_role;
