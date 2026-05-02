-- SPEC-0015 PLAN-0040 atomic rate-limit increment.
--
-- The public simulation API enforces per-IP and per-email caps inside
-- the upload route handler. To avoid SELECT-then-UPDATE races at the
-- 24-hour window boundary, the increment runs as a single SQL call
-- that upserts the row and bumps `count` by one in the same
-- statement. The function returns the new count plus whether it is
-- still within the supplied cap so the caller can short-circuit.
--
-- Even rejected calls increment the counter on purpose: a visitor
-- attempting to brute-force the limit must not get a free probe
-- window. Once the cap is reached the row stays at or above the cap
-- for the remainder of the window.

create or replace function public.increment_simulation_rate_limit(
  p_subject_kind text,
  p_subject_value_hash text,
  p_window_start timestamptz,
  p_cap integer
)
returns table (count integer, allowed boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_count integer;
begin
  if p_subject_kind is null or p_subject_kind not in ('ip', 'email') then
    raise exception 'p_subject_kind must be ip or email';
  end if;

  if p_subject_value_hash is null or length(btrim(p_subject_value_hash)) = 0 then
    raise exception 'p_subject_value_hash is required';
  end if;

  if p_window_start is null then
    raise exception 'p_window_start is required';
  end if;

  if p_cap is null or p_cap < 0 then
    raise exception 'p_cap must be a non-negative integer';
  end if;

  insert into public.simulation_rate_limits as srl (
    subject_kind, subject_value_hash, window_start, count
  )
  values (p_subject_kind, p_subject_value_hash, p_window_start, 1)
  on conflict (subject_kind, subject_value_hash, window_start)
  do update set count = srl.count + 1
  returning srl.count into current_count;

  count := current_count;
  allowed := current_count <= p_cap;
  return next;
end;
$$;

grant execute on function public.increment_simulation_rate_limit(text, text, timestamptz, integer)
  to service_role;
