-- SPEC-0015 PLAN-0039: simulation_cost_meter increment RPC.
--
-- Atomically charges today's cost meter for a single paid provider
-- call and flips `worker_paused = true` when the running total
-- crosses the cap. Used by the in-home simulation worker
-- (`lib/cost-meter.ts`) after each successful OpenAI call.
--
-- Idempotent shape: the upsert creates today's row if missing and
-- accumulates cents otherwise. Once `worker_paused` becomes true,
-- subsequent calls never flip it back to false; only the cron
-- reset (next UTC day creates a new row) clears the pause.
--
-- The function does not enforce any role-specific cents value;
-- callers pass the cents to add. Cap policy lives in the worker's
-- environment configuration so operators can shrink the cap in
-- staging without a migration.

create or replace function public.simulation_cost_meter_record_charge(
  charge_cents integer,
  cap_cents integer
)
returns table (
  cost_date date,
  usd_cost_estimate_cents integer,
  worker_paused boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  today_date date := (now() at time zone 'utc')::date;
  next_total integer;
  next_paused boolean;
begin
  if charge_cents is null or charge_cents < 0 then
    raise exception 'charge_cents must be a non-negative integer';
  end if;

  if cap_cents is null or cap_cents < 0 then
    raise exception 'cap_cents must be a non-negative integer';
  end if;

  insert into public.simulation_cost_meter as m (
    cost_date,
    usd_cost_estimate_cents,
    worker_paused,
    updated_at
  )
  values (
    today_date,
    charge_cents,
    charge_cents >= cap_cents,
    now()
  )
  on conflict (cost_date) do update
    set
      usd_cost_estimate_cents =
        m.usd_cost_estimate_cents + excluded.usd_cost_estimate_cents,
      worker_paused = m.worker_paused
        or (m.usd_cost_estimate_cents + excluded.usd_cost_estimate_cents
              >= cap_cents),
      updated_at = now()
  returning
    m.cost_date,
    m.usd_cost_estimate_cents,
    m.worker_paused
  into
    cost_date,
    next_total,
    next_paused;

  usd_cost_estimate_cents := next_total;
  worker_paused := next_paused;
  return next;
end;
$$;

grant execute on function public.simulation_cost_meter_record_charge(integer, integer)
  to service_role;
