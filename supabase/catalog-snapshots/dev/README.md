# DEV Catalog Snapshots

This directory holds committed SQL snapshots generated from the local Supabase
catalog data. GitHub Actions cannot read a developer machine directly, so a DEV
catalog refresh is a two-step process:

1. Run `pnpm catalog:snapshot:export` locally and inspect
   `supabase/catalog-snapshots/dev/catalog-data.sql`.
2. Commit the snapshot, merge it to `dev`, then manually run the
   `Supabase DEV Catalog Snapshot` workflow from GitHub.

The snapshot is intentionally limited to sofas, fabrics, public tags, visual
matrix columns, source photos, render cells, render jobs, render candidates,
render exports, and catalog `storage_assets` metadata.

It does not include auth accounts, trusted admin devices, visitor email or
simulation data, worker event logs, storage bucket metadata, or storage object
bytes. If the referenced files are missing from DEV Storage, the database rows
will exist but images may not render until storage objects are synchronized.
