# Simulation Test Catalog Fixtures

Reference notes for the four storage objects the public simulation
wizard's test catalog references.

The seed migration `20260502000800_seed_simulation_test_catalog.sql`
inserts catalog rows that point at the following storage paths in the
`catalog-public-assets` bucket:

- `seed/simulation-test/fabric-swatch.png`
- `seed/simulation-test/sofa-straight-render.png`
- `seed/simulation-test/sofa-corner-render.png`

And the following path in the `catalog-private-assets` bucket:

- `seed/simulation-test/fabric-ai-reference.png`

## Populating these objects (PLAN-0051)

`scripts/seed-simulation-test-data.mjs` accepts four optional flags
that copy bytes from existing dev catalog assets into these target
paths:

```
pnpm seed:simulation-test -- \
  --source-straight-render-path sofas/<sofa-slug>/<file>.png \
  --source-corner-render-path   sofas/<sofa-slug>/<file>.png \
  --source-fabric-swatch-path   fabrics/<fabric-slug>/swatch.png \
  --source-fabric-ai-reference-path fabrics/<fabric-slug>/ai-reference.png
```

Source paths are resolved against `catalog-public-assets` (renders,
swatch) and `catalog-private-assets` (AI reference). Each upload is
idempotent (`upsert: true`). Flags that are omitted are skipped with
a warning so the script remains safe to run with no flags against an
empty local bucket.

The script requires `SUPABASE_SERVICE_ROLE_KEY` and refuses to talk
to a non-local Supabase URL unless
`SIMULATION_TEST_SEED_ALLOW_NON_LOCAL=1` is set.

This directory no longer needs to hold local PNG bytes; the four
target objects are populated by copying from existing dev catalog
storage paths via the flags above.
