-- SPEC-0007 PLAN-0010 in-home simulation Stage 1 pgmq consumer helpers.
--
-- The Edge Function `in-home-simulation-worker` consumes work messages from
-- the `local_in_home_simulation_jobs` queue rather than scanning the job
-- table directly, so each stage remains queue-claimable, retryable, and
-- observable per `SPEC-0007 Runtime And Queue`. These helpers wrap the
-- pgmq surface the Edge Function needs:
--
--   - `dequeue_in_home_simulation_room_prep_messages` reads up to a
--     batch of messages with a visibility timeout, so a crashed worker
--     does not lose work. Messages stay invisible for `visibility_seconds`
--     and reappear automatically if not deleted.
--   - `claim_specific_in_home_simulation_room_prep_job` performs the same
--     atomic queued -> room_prep_processing transition as the generic
--     claim function but only for a specific `job_id` taken from a
--     dequeued message.
--   - `delete_in_home_simulation_room_prep_message` confirms the message
--     was processed and removes it from the queue.

create or replace function public.dequeue_in_home_simulation_room_prep_messages(
  queue_name text default 'local_in_home_simulation_jobs',
  visibility_seconds integer default 600,
  batch_size integer default 1
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
begin
  if queue_name is null or length(btrim(queue_name)) = 0 then
    raise exception 'queue_name is required';
  end if;

  if visibility_seconds is null or visibility_seconds <= 0 then
    raise exception 'visibility_seconds must be a positive integer';
  end if;

  if batch_size is null or batch_size <= 0 then
    raise exception 'batch_size must be a positive integer';
  end if;

  return query
  select
    r.msg_id,
    r.read_ct,
    r.enqueued_at,
    r.vt,
    r.message
  from pgmq.read(queue_name, visibility_seconds, batch_size) as r;
end;
$$;

create or replace function public.delete_in_home_simulation_room_prep_message(
  queue_name text,
  msg_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  deleted boolean;
begin
  if queue_name is null or length(btrim(queue_name)) = 0 then
    raise exception 'queue_name is required';
  end if;

  if msg_id is null then
    raise exception 'msg_id is required';
  end if;

  select pgmq.delete(queue_name, msg_id) into deleted;
  return coalesce(deleted, false);
end;
$$;

create or replace function public.claim_specific_in_home_simulation_room_prep_job(
  target_job_id uuid,
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
  if target_job_id is null then
    raise exception 'job_id is required';
  end if;

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
  where id = target_job_id
    and status = 'queued'
    and retention_deadline > now()
    and room_prep_attempt_count < max_attempts_per_stage
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
