-- SPEC-0015 PLAN-0040 atomic idempotency-key acquire.
--
-- The public simulation upload route handler must turn a duplicate
-- `Idempotency-Key` header into the original simulation job id
-- without creating a second job or a second storage object. The
-- acquire RPC inserts a fresh slot keyed by the hash and reports
-- back whether the caller is the first writer; on conflict it
-- returns the existing simulation_job_id (which may be null while
-- the original request is still in flight).
--
-- The finalize RPC is called by the upload route after the
-- simulation job row is committed so subsequent duplicate requests
-- can be answered with the persisted job id. The split keeps the
-- acquire path constant-time while preserving idempotency across
-- a duplicate request that arrives between the original request's
-- acquire and finalize calls.

create or replace function public.acquire_simulation_idempotency_key(
  p_key_hash text
)
returns table (acquired boolean, simulation_job_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inserted_count integer;
  existing_simulation_job_id uuid;
begin
  if p_key_hash is null or length(btrim(p_key_hash)) = 0 then
    raise exception 'p_key_hash is required';
  end if;

  insert into public.simulation_idempotency_keys (key_hash)
  values (p_key_hash)
  on conflict (key_hash) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    acquired := true;
    simulation_job_id := null;
    return next;
    return;
  end if;

  select sik.simulation_job_id into existing_simulation_job_id
  from public.simulation_idempotency_keys sik
  where sik.key_hash = p_key_hash;

  acquired := false;
  simulation_job_id := existing_simulation_job_id;
  return next;
end;
$$;

create or replace function public.finalize_simulation_idempotency_key(
  p_key_hash text,
  p_simulation_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched integer;
begin
  if p_key_hash is null or length(btrim(p_key_hash)) = 0 then
    raise exception 'p_key_hash is required';
  end if;

  if p_simulation_job_id is null then
    raise exception 'p_simulation_job_id is required';
  end if;

  update public.simulation_idempotency_keys
  set simulation_job_id = p_simulation_job_id
  where key_hash = p_key_hash;

  get diagnostics matched = row_count;

  if matched = 0 then
    raise exception 'simulation_idempotency_keys row not found for key_hash %', p_key_hash;
  end if;
end;
$$;

grant execute on function public.acquire_simulation_idempotency_key(text)
  to service_role;
grant execute on function public.finalize_simulation_idempotency_key(text, uuid)
  to service_role;
