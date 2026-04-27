create extension if not exists pgcrypto;
create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1
    from pgmq.meta
    where queue_name = 'local_fabric_render_jobs'
  ) then
    perform pgmq.create('local_fabric_render_jobs');
  end if;

  if not exists (
    select 1
    from pgmq.meta
    where queue_name = 'local_in_home_simulation_jobs'
  ) then
    perform pgmq.create('local_in_home_simulation_jobs');
  end if;

  if not exists (
    select 1
    from pgmq.meta
    where queue_name = 'local_worker_smoke_jobs'
  ) then
    perform pgmq.create('local_worker_smoke_jobs');
  end if;
end $$;

create table if not exists public.worker_smoke_jobs (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null,
  status text not null default 'created',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_smoke_jobs_status_idx
  on public.worker_smoke_jobs (status);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'worker-input-artifacts',
    'worker-input-artifacts',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'worker-generated-artifacts',
    'worker-generated-artifacts',
    false,
    52428800,
    array['image/png']
  ),
  (
    'simulation-private-artifacts',
    'simulation-private-artifacts',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.worker_smoke_run(queue_name text default 'local_worker_smoke_jobs')
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  bucket_count integer;
  smoke_job_id uuid;
  queue_message record;
  queued_job_id uuid;
begin
  select count(*)
  into bucket_count
  from storage.buckets
  where id in (
    'worker-input-artifacts',
    'worker-generated-artifacts',
    'simulation-private-artifacts'
  )
  and public = false;

  if bucket_count <> 3 then
    raise exception 'Local worker storage buckets are not configured';
  end if;

  insert into public.worker_smoke_jobs (queue_name, status, payload)
  values (queue_name, 'queued', jsonb_build_object('source', 'worker-smoke'))
  returning id into smoke_job_id;

  perform pgmq.send(
    queue_name,
    jsonb_build_object('job_id', smoke_job_id, 'type', 'worker_smoke')
  );

  select *
  into queue_message
  from pgmq.read(queue_name, 30, 1)
  limit 1;

  if queue_message.msg_id is null then
    raise exception 'No smoke queue message was available';
  end if;

  queued_job_id := (queue_message.message ->> 'job_id')::uuid;

  update public.worker_smoke_jobs
  set
    status = 'processed',
    processed_at = now(),
    updated_at = now(),
    payload = payload || jsonb_build_object(
      'processed_by', 'worker-smoke',
      'queue_msg_id', queue_message.msg_id
    )
  where id = queued_job_id;

  perform pgmq.delete(queue_name, queue_message.msg_id);

  return jsonb_build_object(
    'status', 'ok',
    'job_id', queued_job_id,
    'queue_name', queue_name
  );
end;
$$;
