-- PLAN-0019 admin render preparation queue handoff.
-- Allows the first-party admin API to enqueue already-created durable render jobs
-- without exposing the pgmq schema directly to browser-facing code.

create or replace function public.fabric_render_admin_enqueue_job(
  render_job_id uuid,
  queue_name text default 'local_fabric_render_jobs'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  target_job public.fabric_render_jobs%rowtype;
begin
  if queue_name is null or length(btrim(queue_name)) = 0 then
    raise exception 'queue_name is required';
  end if;

  select *
  into target_job
  from public.fabric_render_jobs
  where id = render_job_id
    and status = 'queued';

  if target_job.id is null then
    raise exception 'Queued fabric render job % was not found', render_job_id;
  end if;

  perform pgmq.send(
    queue_name,
    jsonb_build_object(
      'job_id', target_job.id,
      'type', 'fabric_render_generation'
    )
  );

  return jsonb_build_object(
    'status', 'queued',
    'job_id', target_job.id,
    'queue_name', queue_name
  );
end;
$$;

grant execute on function public.fabric_render_admin_enqueue_job(uuid, text)
  to service_role;
