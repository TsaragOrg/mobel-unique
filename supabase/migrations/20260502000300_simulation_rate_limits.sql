-- SPEC-0015 PLAN-0039: simulation_rate_limits table.
--
-- Per-IP and per-email rolling-24-hour counters used by the public
-- upload endpoint (PLAN-0040) to enforce the SPEC-0015 anti-abuse
-- limits (3 simulations per IP per day, 2 simulations per verified
-- email per day). The actual rate-limit logic lives in the API
-- layer; this table is the persistence surface only.
--
-- Subject values are hashed before storage so the database never
-- holds raw IPs or emails. The composite primary key on
-- (subject_kind, subject_value_hash, window_start) lets the API
-- upsert with `on conflict do update set count = count + 1`.
--
-- The purge function extension truncates windows older than 48
-- hours during routine maintenance.

create table if not exists public.simulation_rate_limits (
  subject_kind text not null,
  subject_value_hash text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint simulation_rate_limits_subject_kind_check
    check (subject_kind in ('ip', 'email')),
  constraint simulation_rate_limits_count_non_negative
    check (count >= 0),
  primary key (subject_kind, subject_value_hash, window_start)
);

create index if not exists simulation_rate_limits_window_start_idx
  on public.simulation_rate_limits (window_start);

alter table public.simulation_rate_limits
  enable row level security;

revoke all on table public.simulation_rate_limits
  from anon, authenticated;

grant all on table public.simulation_rate_limits
  to service_role;

drop policy if exists spec_0015_service_role_all_simulation_rate_limits
  on public.simulation_rate_limits;

create policy spec_0015_service_role_all_simulation_rate_limits
  on public.simulation_rate_limits
  for all
  to service_role
  using (true)
  with check (true);
