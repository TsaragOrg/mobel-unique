-- SPEC-0011 Admin trusted device state.
--
-- Trusted device rows are authentication state. They store only a hash of the
-- browser-held device secret and remain service-role managed.

create extension if not exists pgcrypto;

create table if not exists public.admin_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  environment text not null,
  device_token_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint admin_trusted_devices_environment_valid check (
    environment in ('local', 'dev', 'prod')
  ),
  constraint admin_trusted_devices_hash_not_blank check (
    length(btrim(device_token_hash)) > 0
  ),
  constraint admin_trusted_devices_seen_after_create check (
    last_seen_at >= created_at
  )
);

create index if not exists admin_trusted_devices_user_environment_idx
  on public.admin_trusted_devices (auth_user_id, environment);

create unique index if not exists admin_trusted_devices_active_hash_unique_idx
  on public.admin_trusted_devices (auth_user_id, environment, device_token_hash)
  where revoked_at is null;

alter table public.admin_trusted_devices enable row level security;

revoke all on table public.admin_trusted_devices from anon;
revoke all on table public.admin_trusted_devices from authenticated;
grant all on table public.admin_trusted_devices to service_role;

drop policy if exists spec_0011_service_role_admin_trusted_devices_all
  on public.admin_trusted_devices;

create policy spec_0011_service_role_admin_trusted_devices_all
on public.admin_trusted_devices
for all
to service_role
using (true)
with check (true);
