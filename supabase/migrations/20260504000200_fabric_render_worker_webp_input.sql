create or replace function public.fabric_render_worker_validate_input_asset(
  asset public.storage_assets,
  label text
)
returns void
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
begin
  if asset.id is null then
    raise exception '% asset is missing', label;
  end if;

  if asset.visibility <> 'private' then
    raise exception '% asset must be private', label;
  end if;

  if asset.lifecycle_state <> 'active' then
    raise exception '% asset must be active', label;
  end if;

  if asset.bucket_id <> 'catalog-private-assets' then
    raise exception '% asset must be in catalog-private-assets', label;
  end if;

  if asset.content_type not in ('image/jpeg', 'image/jpg', 'image/png', 'image/webp') then
    raise exception '% asset content type is unsupported: %',
      label,
      asset.content_type;
  end if;

  if asset.width_px is null or asset.height_px is null then
    raise exception '% width and height are required', label;
  end if;

  if asset.width_px <= 0 or asset.height_px <= 0 then
    raise exception '% width and height must be positive', label;
  end if;

  if not (greatest(asset.width_px, asset.height_px) <= 2048) then
    raise exception '% exceeds 2048 px on the longest edge', label;
  end if;
end;
$$;

grant execute on function public.fabric_render_worker_validate_input_asset(
  public.storage_assets,
  text
) to service_role;
