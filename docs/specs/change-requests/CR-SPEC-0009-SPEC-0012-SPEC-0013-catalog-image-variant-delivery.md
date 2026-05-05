# CR-SPEC-0009 SPEC-0012 SPEC-0013 Catalog Image Variant Delivery

Target spec ids: SPEC-0009, SPEC-0012, SPEC-0013
Related spec ids: SPEC-0005, SPEC-0006, SPEC-0010, SPEC-0011, SPEC-0014
Status: draft

## Reason For Change

The admin render workflow and the public catalog can display many render images
at once. The current behavior can force small previews to load the same large
image bytes that are needed only for detailed inspection. This makes admin
render review feel slow, especially in the Renders workflow where each matrix
cell, candidate row, comparison dialog, and large preview can point at the same
full-size private render asset.

The public catalog has the same performance risk. Catalog cards should not load
the full product-detail render when a medium preview is enough. A sofa detail
page should still be allowed to load the accepted original render because the
visitor is inspecting one selected sofa rather than scanning a grid.

The accepted specs already separate private catalog assets from public catalog
assets and already define upload limits and render input normalization. This
change does not replace those rules. It adds explicit image delivery variants so
each screen uses image bytes that match the visible size.

## Definitions

`original` means the canonical stored image accepted by the existing upload,
generation, validation, limit, and compression rules. It is not necessarily the
raw file selected by an administrator before browser-side preparation. For
example, a sofa source photo that is resized to the current 2048 px longest-edge
limit before upload completion is still the `original` for this feature.

`small` means a lightweight preview intended for dense admin surfaces such as
render matrix cells and candidate rows.

`medium` means a larger preview intended for admin dialogs and public catalog
cards where image quality matters but full-size inspection is not needed.

`stored variant` means a separate Supabase Storage object and `storage_assets`
row derived from an `original` asset.

`transformed variant` means an image produced by Supabase Storage Image
Transformations from an existing object. A transformed variant may be used as a
generation mechanism or fallback, but UI code must not build ad hoc transform
URLs itself.

## Proposed Change

### Image Variant Model

Update `SPEC-0009` so catalog render images support explicit delivery variants:

- every catalog render image that can appear in admin render review or public
  catalog UI must have `original`, `small`, and `medium` delivery semantics;
- `original` is the existing canonical `storage_assets` row for the accepted
  private or public render asset;
- `small` and `medium` should be represented as durable variant records tied to
  the original asset, unless an implementation plan explicitly chooses a
  Supabase transformed URL adapter for a specific public read path;
- stored variants must have their own `storage_assets` rows, dimensions, byte
  size, content type, visibility, lifecycle state, and object paths;
- variant relationships must be queryable from the original asset id without
  guessing object paths in browser code;
- variant generation must be idempotent, with a uniqueness rule for
  `(original_asset_id, variant_kind)`;
- variants must keep the same privacy boundary as their original asset unless
  publication creates a separate public copy;
- private variants must remain in `catalog-private-assets`;
- public variants must remain in `catalog-public-assets`;
- deleting, deactivating, unpublishing, or purging an original asset must not
  leave active variants that are still exposed through public or admin read
  paths.

Recommended variant presets:

- `small`: longest edge no larger than 320 px, aspect ratio preserved, no crop,
  quality tuned for thumbnails;
- `medium`: longest edge no larger than 1280 px, aspect ratio preserved, no
  crop, quality tuned for catalog cards and modal previews;
- `original`: no extra resizing beyond the already accepted project rules for
  that asset kind.

The exact encoder, quality value, and output content type may be chosen during
implementation, but the implementation should prefer a modern browser-friendly
format for generated preview variants when doing so does not break supported
clients.

### Supabase Image Transformation Usage

Supabase Storage Image Transformations may be used as part of this feature, but
they must sit behind a server-side adapter:

- the implementation may use Supabase transformations to create `small` and
  `medium` bytes from an original object, then store those bytes as durable
  variants;
- the implementation may use Supabase transformed public URLs for a public read
  path only if the implementation plan confirms DEV and PROD plan support,
  billing expectations, cache behavior, and local test behavior;
- browser code must not assemble raw Supabase transformation URLs from private
  paths;
- private admin preview delivery must continue to use a first-party protected
  admin API boundary unless a later accepted change request replaces that
  boundary;
- if Supabase transformations are unavailable in local development, tests and
  local fixture setup must use an implementation-approved local adapter or
  deterministic fixture variant generator.

### Variant Creation Points

Update `SPEC-0010` API behavior and `SPEC-0006` worker behavior so variants are
created when a catalog image becomes usable:

- after a successful admin upload completion for source photos and manual
  renders, the server-side completion flow must create required variants before
  the asset is returned as usable for render review;
- after a fabric render worker creates a generated candidate original, the
  worker or a service-side helper must create required variants before the
  candidate is considered preview-ready;
- when a render candidate or manual render becomes the current private render,
  the current render state must be able to resolve `small`, `medium`, and
  `original` variants from the current private asset id;
- when publication creates public render copies, it must also create the public
  variants required by public catalog and sofa detail reads;
- publication must fail safely and remove partial public copies if public
  variant creation fails;
- existing catalog images must be backfilled by an idempotent script or plan
  task before the UI depends on variants in production.

This change does not require retaining raw oversized upload files when existing
accepted rules already resize or reject them.

### Admin Frontend Behavior

Update `SPEC-0013` so the Renders workflow requests the right delivery size for
each visual use:

- render matrix cells must use `small`;
- candidate rows must use `small`;
- the selected current-render sheet preview must use `medium`;
- source and candidate comparison dialogs must use `medium`;
- large image lightboxes opened from admin dialogs must use `original`;
- admin image preview loading must continue to avoid exposing raw private object
  paths, service-role keys, signed storage URLs, provider secrets, or stack
  traces;
- the admin preview API may accept a variant selector such as
  `variant=small|medium|original`, or it may expose equivalent first-party
  endpoints;
- if a requested `small` or `medium` variant is missing during migration or
  local fixture work, the UI may show a safe placeholder or the API may use a
  bounded server-side fallback, but dense matrix screens must not silently fetch
  full originals when variants exist.

The admin UI should keep existing explicit review behavior: opening a cell,
reviewing candidates, selecting current render, generating new candidates, and
opening a large preview remain separate administrator actions.

### Public Frontend Behavior

Update `SPEC-0012` public catalog behavior:

- `/catalog` card images must use `medium` render delivery;
- catalog fabric swatches may keep their existing swatch-specific behavior;
- `/sofas/{slug}` detail image for the selected sofa, fabric, and visual
  position must use `original` render delivery;
- public API responses must make the intended image size clear through distinct
  response fields or through endpoint-specific URL builders;
- public browser code must not guess storage paths or variant paths;
- public image URLs should remain cache-friendly and should include immutable
  asset or version components so stale browser and CDN cache issues are avoided.

### Data And API Shape

Implementation plans should define the exact schema, but the accepted contract
must support:

- looking up a variant by original `storage_assets.id` and variant kind;
- knowing whether a variant is stored or transformed;
- preserving dimensions and content type for each returned image URL;
- returning admin preview bytes by `(asset_id, variant_kind)` through an
  authorized first-party admin route;
- returning public catalog medium render URLs separately from public sofa detail
  original render URLs;
- backfilling variants for already existing private render candidates, current
  private renders, source photos used in admin review, and public render copies.

### Error Handling

- Variant generation failures must produce safe user-facing errors.
- Upload completion must not mark a source photo or manual render usable for
  review if required preview variants fail to generate.
- Worker success must not hide a variant generation failure. If the generated
  original exists but required variants cannot be created, the job or candidate
  must be left in a safe failed or non-preview-ready state according to the
  implementation plan.
- Public publication must be atomic from the user's point of view: a sofa must
  not publish with missing required public render variants.
- Missing variant rows during backfill must not expose private paths or service
  credentials.

### Out Of Scope

- Keeping raw oversized files beyond current accepted upload preparation,
  compression, and validation rules.
- Changing customer simulation room-photo retention or simulation output
  retention.
- Making `catalog-private-assets` public.
- Replacing the existing admin authentication and trusted-device boundary.
- Changing the AI provider prompt or generation quality.
- Reworking fabric swatch crop behavior beyond what public catalog image
  delivery needs.
- Adding a new product page workflow unrelated to image delivery size.

## Impact

- Data model: a durable asset variant relationship is needed, or an equivalent
  server-side variant adapter with the same behavior must be specified.
- Supabase Storage: private and public variant object paths need deterministic,
  cleanup-friendly conventions.
- API: admin preview routes need variant-aware reads; public catalog routes need
  medium catalog URLs and original detail URLs.
- Worker: generated candidate success needs variant creation or a follow-up
  service step before the candidate is preview-ready.
- Publication: public render copy creation needs public variant creation and
  cleanup on failure.
- Web UI: admin Renders workflow and public catalog/detail pages must request
  the proper image size for each surface.
- Local fixtures: seeded catalog images need matching variants or deterministic
  fallback generation.
- Tests: follow-up plans must cover variant schema, upload completion,
  generated candidate variants, publication variants, admin preview variant
  selection, public catalog medium URLs, public detail original URLs, and
  backfill behavior.
- Roadmaps: follow-up plans should update `web`, `supabase`, and
  `image-worker` roadmaps.

## Acceptance Criteria

- Admin render matrix cells load `small` image bytes, not full original image
  bytes, when a small variant exists.
- Admin current-render and comparison dialogs load `medium` image bytes.
- Admin large image preview loads `original` image bytes.
- Public catalog cards load `medium` render images.
- Public sofa detail pages load `original` render images.
- Existing upload and render input limits remain authoritative.
- Private storage paths and service credentials are never exposed to the
  browser.
- Public catalog image URLs are generated from database state or an approved
  server-side URL builder, not guessed in client code.
- Variant generation is idempotent and safe to retry.
- Existing assets can be backfilled without replacing accepted originals.
- Publication cannot make a sofa visible with missing required public render
  variants.

## Approval Note

Pending review. The selected direction is a hybrid model: stored variants are
the main product contract for predictable admin and public delivery, while
Supabase Storage Image Transformations may be used behind server-side adapters
to generate or serve variants when the implementation plan confirms plan,
billing, cache, and local-development behavior.
