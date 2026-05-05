-- SPEC-0015 PLAN-0040 owned-job read for the public simulation API.
--
-- The GET /api/public/simulations/{id} route handler resolves the
-- requesting visitor's session via the SHA-256 hash of their access
-- token (see `create_in_home_simulation_job_for_visitor`). This
-- function returns the job row only when (a) the row exists and (b)
-- its `simulation_session_id` is bound to a session whose
-- `access_token_hash` matches the supplied hash.
--
-- Cross-visitor access returns zero rows, so the route handler can
-- map "wrong session" and "missing id" to the same response shape per
-- SPEC-0015 §Users And Permissions.

create or replace function public.get_in_home_simulation_job_for_visitor(
  p_job_id uuid,
  p_access_token_hash text
)
returns table (
  out_job_id uuid,
  out_status public.simulation_job_status,
  out_room_geometry_mode public.room_geometry_mode,
  out_created_at timestamptz,
  out_retention_deadline timestamptz,
  out_storage_prefix text,
  out_dimension_guide_overlay_path text,
  out_generated_output_count integer,
  out_latest_generated_output_index integer,
  out_last_error_message text,
  out_last_regeneration_error_message text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    j.id,
    j.status,
    j.room_geometry_mode,
    j.created_at,
    j.retention_deadline,
    j.storage_prefix,
    j.dimension_guide_overlay_path,
    j.generated_output_count,
    j.latest_generated_output_index,
    j.last_error_message,
    j.last_regeneration_error_message
  from public.in_home_simulation_jobs j
  join public.simulation_sessions s on s.id = j.simulation_session_id
  where j.id = p_job_id
    and s.access_token_hash = p_access_token_hash
  limit 1;
$$;

grant execute on function public.get_in_home_simulation_job_for_visitor(uuid, text)
  to service_role;
