-- PLAN-0068 public Realtime access helper.
--
-- The public web API mints a short-lived Supabase Realtime JWT only after
-- this service-role RPC proves that the simulation access token owns the job.
-- The JWT carries the exact job/session pair consumed by the
-- `simulation_public_progress` RLS policy from the checkpoint foundation.

create or replace function public.get_in_home_simulation_progress_access_for_visitor(
  p_job_id uuid,
  p_access_token_hash text
)
returns table (
  out_job_id uuid,
  out_simulation_session_id uuid,
  out_retention_deadline timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    j.id,
    j.simulation_session_id,
    j.retention_deadline
  from public.in_home_simulation_jobs j
  join public.simulation_sessions s on s.id = j.simulation_session_id
  where j.id = p_job_id
    and s.access_token_hash = p_access_token_hash
    and j.retention_deadline > now()
  limit 1;
$$;

grant execute on function public.get_in_home_simulation_progress_access_for_visitor(uuid, text)
  to service_role;
