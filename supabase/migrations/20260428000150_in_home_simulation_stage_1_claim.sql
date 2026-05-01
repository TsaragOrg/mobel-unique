-- SPEC-0007 PLAN-0010 in-home simulation Stage 1 atomic claim function.
--
-- The Edge Function `in-home-simulation-worker` calls this RPC to atomically
-- move one queued in-home simulation job from `queued` to
-- `room_prep_processing`. The atomicity guarantees come from
-- `for update skip locked`, which lets multiple concurrent worker
-- invocations contend for jobs without double-claiming the same row.
--
-- The function returns at most one row. Callers must treat a zero-row
-- result as "no work available" rather than as an error.

create or replace function public.claim_in_home_simulation_room_prep_job(
  worker_identifier text,
  claim_ttl_seconds integer default 600
)
returns table (
  job_id uuid,
  storage_prefix text,
  customer_room_original_path text,
  retention_deadline timestamptz,
  room_prep_attempt_count integer,
  max_attempts_per_stage integer,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate_id uuid;
  ttl_interval interval;
  new_claim_expires_at timestamptz;
  claimed_storage_prefix text;
  claimed_customer_room_original_path text;
  claimed_retention_deadline timestamptz;
  claimed_room_prep_attempt_count integer;
  claimed_max_attempts_per_stage integer;
begin
  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  if claim_ttl_seconds is null or claim_ttl_seconds <= 0 then
    raise exception 'claim_ttl_seconds must be a positive integer';
  end if;

  ttl_interval := make_interval(secs => claim_ttl_seconds);

  select id
  into candidate_id
  from public.in_home_simulation_jobs
  where status = 'queued'
    and retention_deadline > now()
    and room_prep_attempt_count < max_attempts_per_stage
  order by queued_at nulls last, created_at
  for update skip locked
  limit 1;

  if candidate_id is null then
    return;
  end if;

  new_claim_expires_at := now() + ttl_interval;

  update public.in_home_simulation_jobs
  set
    status = 'room_prep_processing',
    room_prep_attempt_count = room_prep_attempt_count + 1,
    claimed_by = worker_identifier,
    claimed_at = now(),
    claim_expires_at = new_claim_expires_at,
    room_prep_started_at = coalesce(room_prep_started_at, now()),
    updated_at = now()
  where id = candidate_id
  returning
    storage_prefix,
    customer_room_original_path,
    retention_deadline,
    room_prep_attempt_count,
    max_attempts_per_stage
  into
    claimed_storage_prefix,
    claimed_customer_room_original_path,
    claimed_retention_deadline,
    claimed_room_prep_attempt_count,
    claimed_max_attempts_per_stage;

  job_id := candidate_id;
  storage_prefix := claimed_storage_prefix;
  customer_room_original_path := claimed_customer_room_original_path;
  retention_deadline := claimed_retention_deadline;
  room_prep_attempt_count := claimed_room_prep_attempt_count;
  max_attempts_per_stage := claimed_max_attempts_per_stage;
  claim_expires_at := new_claim_expires_at;

  return next;
end;
$$;
