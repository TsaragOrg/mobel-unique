-- SPEC-0015 PLAN-0039: fix cost-meter charge RPC ambiguity.
--
-- The first implementation returned a table with an output column named
-- `cost_date` and also used `on conflict (cost_date)`. In PL/pgSQL that
-- unqualified name can resolve as either the output variable or the table
-- column, so Postgres raises 42702 (`column reference "cost_date" is
-- ambiguous`) when the worker records a provider charge.

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
  charged_cost_date date;
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
  on conflict on constraint simulation_cost_meter_pkey do update
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
    charged_cost_date,
    next_total,
    next_paused;

  cost_date := charged_cost_date;
  usd_cost_estimate_cents := next_total;
  worker_paused := next_paused;
  return next;
end;
$$;

grant execute on function public.simulation_cost_meter_record_charge(integer, integer)
  to service_role;
