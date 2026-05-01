-- SPEC-0007 PLAN-0010 in-home simulation Stage 1 completion function.
--
-- The Edge Function `in-home-simulation-worker` calls this RPC after a
-- successful Stage 1 run to atomically transition the job from
-- `room_prep_processing` to `awaiting_dimensions` and persist the Stage 1
-- output references on the row. The function enforces that only the
-- worker that currently holds the claim can complete the stage and that
-- the job is still in the expected processing state.
--
-- This slice persists the path fields and the room geometry. Real image
-- processing (normalization, cleaning, geometry detection, overlay
-- rendering) is layered on by subsequent commits without changing this
-- function's contract.

create or replace function public.complete_in_home_simulation_room_prep_stage(
  job_id uuid,
  worker_identifier text,
  room_normalized_path text,
  room_compressed_path text,
  room_cleaned_path text,
  dimension_guide_overlay_path text,
  room_geometry_mode public.room_geometry_mode,
  room_geometry_points jsonb,
  room_geometry_confidence numeric default null
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

  if room_normalized_path is null
    or length(btrim(room_normalized_path)) = 0 then
    raise exception 'room_normalized_path is required';
  end if;

  if room_compressed_path is null
    or length(btrim(room_compressed_path)) = 0 then
    raise exception 'room_compressed_path is required';
  end if;

  if room_cleaned_path is null
    or length(btrim(room_cleaned_path)) = 0 then
    raise exception 'room_cleaned_path is required';
  end if;

  if dimension_guide_overlay_path is null
    or length(btrim(dimension_guide_overlay_path)) = 0 then
    raise exception 'dimension_guide_overlay_path is required';
  end if;

  if room_geometry_mode is null then
    raise exception 'room_geometry_mode is required';
  end if;

  if room_geometry_points is null then
    raise exception 'room_geometry_points is required';
  end if;

  if room_geometry_confidence is not null
    and (room_geometry_confidence < 0 or room_geometry_confidence > 1) then
    raise exception 'room_geometry_confidence must be between 0 and 1';
  end if;

  update public.in_home_simulation_jobs
  set
    status = 'awaiting_dimensions',
    room_normalized_path = complete_in_home_simulation_room_prep_stage.room_normalized_path,
    room_compressed_path = complete_in_home_simulation_room_prep_stage.room_compressed_path,
    room_cleaned_path = complete_in_home_simulation_room_prep_stage.room_cleaned_path,
    dimension_guide_overlay_path = complete_in_home_simulation_room_prep_stage.dimension_guide_overlay_path,
    room_geometry_mode = complete_in_home_simulation_room_prep_stage.room_geometry_mode,
    room_geometry_points = complete_in_home_simulation_room_prep_stage.room_geometry_points,
    room_geometry_confidence = complete_in_home_simulation_room_prep_stage.room_geometry_confidence,
    room_geometry_failure_reason = null,
    awaiting_dimensions_at = now(),
    claim_expires_at = null,
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
  where id = complete_in_home_simulation_room_prep_stage.job_id
    and status = 'room_prep_processing'
    and claimed_by = complete_in_home_simulation_room_prep_stage.worker_identifier;

  get diagnostics matched = row_count;

  if matched = 0 then
    raise exception 'job % is not in room_prep_processing or is claimed by another worker',
      complete_in_home_simulation_room_prep_stage.job_id;
  end if;
end;
$$;
