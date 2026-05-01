# Local Admin Catalog Fixtures

This directory documents the optional local fixture data loaded by:

```bash
pnpm seed:local:admin-fixtures
```

`pnpm supabase:reset` also runs that seed after migrations and `supabase/seed.sql`.

By default, the seed script creates a small catalog with placeholder PNG assets:

- 3 fabrics;
- 2 sofas;
- 2 visual positions per sofa;
- source-photo render cells for the first fabric;
- missing render cells for the other fabrics, so `Generate all` has work to do.

To use real images locally, copy `manifest.example.json` to `manifest.json` and
place the referenced images under `images/`. Both `manifest.json` and `images/`
are ignored by Git so local product images do not get committed accidentally.

The current clean local image layout is:

```text
images/
  fabrics/
    grey-soft/
      swatch.png
      ai-reference.jpg
    beige-dotted/
      swatch.png
      ai-reference.jpg
    beige-textured/
      swatch.png
      ai-reference.jpg
  sofas/
    big-gray-lines/
      right-corner.jpg
      left-corner.jpg
    medium-milky-color-sofa/
      front.jpg
      right.jpg
      left.jpg
```

Use these fixture dimensions and formats:

- fabric swatches: PNG, `256x256`;
- fabric AI references: JPEG, `1536x2048`;
- sofa source photos: JPEG, `1536x2048`.

The fabric render worker accepts PNG and JPEG inputs and requires the largest
image side to be at most `2048px`. Keep WebP files only as raw local sources,
not as manifest inputs for fabric render testing.

Required real fixture inputs:

- at least 3 fabrics;
- for each fabric, a swatch image and an AI reference image;
- at least 2 sofas;
- for each sofa, metadata, assigned fabric slugs, and a source fabric slug;
- for each sofa visual position, a source photo showing that source fabric.

Supported image formats are PNG, JPEG, and WebP.
