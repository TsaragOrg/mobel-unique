alter table public.sofas
  add column if not exists price_cents integer,
  add column if not exists price_currency text not null default 'EUR';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sofas_positive_price_cents'
      and conrelid = 'public.sofas'::regclass
  ) then
    alter table public.sofas
      add constraint sofas_positive_price_cents
      check (price_cents is null or price_cents > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sofas_price_currency_eur'
      and conrelid = 'public.sofas'::regclass
  ) then
    alter table public.sofas
      add constraint sofas_price_currency_eur
      check (price_currency = 'EUR');
  end if;
end;
$$;

create or replace view public.public_catalog_sofas
with (security_barrier = true)
as
select
  s.id,
  s.public_name,
  s.public_slug,
  s.shopify_order_url,
  s.public_description,
  s.length_cm,
  s.depth_cm,
  s.height_cm,
  s.footprint_type,
  s.footprint_measurements,
  s.manual_public_order,
  s.created_at,
  s.price_cents,
  s.price_currency
from public.sofas s
where s.lifecycle_state = 'published';
