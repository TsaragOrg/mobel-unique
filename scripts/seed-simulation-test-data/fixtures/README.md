# Simulation Test Catalog Fixtures

Placeholder location for the prepared-sofa render PNGs the public
simulation wizard needs end-to-end.

The seed migration `20260502000800_seed_simulation_test_catalog.sql`
inserts the catalog rows that point at the following storage paths
in the `catalog-public-assets` bucket:

- `seed/simulation-test/fabric-swatch.png`
- `seed/simulation-test/sofa-straight-render.png`
- `seed/simulation-test/sofa-corner-render.png`

And the following path in the `catalog-private-assets` bucket:

- `seed/simulation-test/fabric-ai-reference.png`

Real placeholder bytes for these objects are uploaded as part of
PLAN-0042's manual production-launch preparation. Until then the
catalog rows reference the storage paths but the bucket objects do
not exist; PLAN-0040's API-level validations only check the
catalog triple is publishable, not the storage object presence.

When PLAN-0042 lands, drop the actual PNGs into this directory and
extend `scripts/seed-simulation-test-data.mjs` with a follow-up
upload step.
