-- Local seed file for Supabase CLI `supabase db reset`.
-- These credentials are intentionally local-only and use a `.test` address.

do $$
declare
  local_admin_id uuid := '00000000-0000-4000-8000-000000001011';
  local_admin_email text := 'admin.local@mobel-unique.test';
  local_admin_password text := 'mobel-unique-local-admin-password';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    local_admin_id,
    'authenticated',
    'authenticated',
    local_admin_email,
    crypt(local_admin_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider',
      'email',
      'providers',
      jsonb_build_array('email'),
      'mobel_unique',
      jsonb_build_object('role', 'admin')
    ),
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    local_admin_id::text,
    local_admin_id,
    jsonb_build_object(
      'sub',
      local_admin_id::text,
      'email',
      local_admin_email,
      'email_verified',
      true,
      'phone_verified',
      false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do update
  set
    identity_data = excluded.identity_data,
    updated_at = now(),
    user_id = excluded.user_id;
end $$;
