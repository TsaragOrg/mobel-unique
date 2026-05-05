-- SPEC-0015 PLAN-0039: simulation_idempotency_keys table.
--
-- Stores hashed Idempotency-Key values that the public simulation
-- upload endpoint (PLAN-0040) sends with `POST /api/public/simulations`.
-- A duplicate Idempotency-Key returns the previously created
-- simulation job rather than allocating a new one. Rows expire 24
-- hours after creation, matching the SPEC-0007 retention window.
--
-- The purge function extension (next migration) deletes rows whose
-- `expires_at` has passed.

create table if not exists public.simulation_idempotency_keys (
  key_hash text primary key,
  simulation_job_id uuid references public.in_home_simulation_jobs (id)
    on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index if not exists simulation_idempotency_keys_expires_at_idx
  on public.simulation_idempotency_keys (expires_at);

create index if not exists simulation_idempotency_keys_simulation_job_id_idx
  on public.simulation_idempotency_keys (simulation_job_id);

alter table public.simulation_idempotency_keys
  enable row level security;

revoke all on table public.simulation_idempotency_keys
  from anon, authenticated;

grant all on table public.simulation_idempotency_keys
  to service_role;

drop policy if exists spec_0015_service_role_all_simulation_idempotency_keys
  on public.simulation_idempotency_keys;

create policy spec_0015_service_role_all_simulation_idempotency_keys
  on public.simulation_idempotency_keys
  for all
  to service_role
  using (true)
  with check (true);
