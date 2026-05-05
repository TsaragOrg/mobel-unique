-- SPEC-0015 PLAN-0039: simulation_cost_meter table.
--
-- Daily soft cap on OpenAI spend for the in-home simulation worker.
-- The worker increments `usd_cost_estimate_cents` after each paid
-- provider call using a small fixed-cost estimator (see
-- `lib/cost-meter.ts`). When the day's total reaches
-- `SIMULATION_DAILY_COST_CAP_USD` (default 50 USD = 5000 cents),
-- the worker flips `worker_paused = true` for the day. The Stage 1
-- and Stage 2 claim RPCs short-circuit while the meter is paused
-- (next migration), so no new provider calls run until the next
-- day's row appears.
--
-- This table is a backstop, not the only protection: per-IP and
-- per-email rate limits (see simulation_rate_limits) cap the
-- number of new jobs at the API level, and OpenAI itself enforces
-- the account-level monthly hard limit configured in the OpenAI
-- dashboard.
--
-- One row per UTC date. The `cost_date` primary key keeps the
-- table tiny — we only need today's row at runtime.

create table if not exists public.simulation_cost_meter (
  cost_date date primary key,
  usd_cost_estimate_cents integer not null default 0,
  worker_paused boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint simulation_cost_meter_usd_cost_estimate_cents_non_negative
    check (usd_cost_estimate_cents >= 0)
);

alter table public.simulation_cost_meter
  enable row level security;

revoke all on table public.simulation_cost_meter
  from anon, authenticated;

grant all on table public.simulation_cost_meter
  to service_role;

drop policy if exists spec_0015_service_role_all_simulation_cost_meter
  on public.simulation_cost_meter;

create policy spec_0015_service_role_all_simulation_cost_meter
  on public.simulation_cost_meter
  for all
  to service_role
  using (true)
  with check (true);
