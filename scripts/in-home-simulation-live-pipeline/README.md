# In-Home Simulation Live Pipeline (Local Harness)

Local Node CLIs that run the SPEC-0007 in-home simulation Stage 1 and
Stage 2 sub-steps directly against OpenAI, bypassing the Supabase Edge
Function. The harness exists because `supabase functions serve` enforces
a tight CPU time limit on each isolate; gpt-image-2 image edits exceed
that limit locally even though they run cleanly on deployed Edge
Functions. This harness lets a developer review every artifact a real
visitor would see, one stage at a time, on a real photo.

The harness is not a runtime dependency. It does not replace the Edge
Function. It is purely a developer-facing verification tool.

## Pipeline (canonical)

The validated end-to-end flow. Production worker mirrors this exact
ordering.

1. **validate** — GPT-5 vision JSON `{ok, confidence, failure_reason}`.
2. **clean** — gpt-image-2 removes movable items. Prompt is strict
   "do not add anything that is not already in the input".
3. **scene** — GPT-5 vision JSON `{mode: back_wall|corner, confidence,
   reason}`. Dedicated classifier step. `gpt-image-2` is not reliable
   at deciding 4 vs 6 dots on its own.
4. **corners** — gpt-image-2 places yellow architectural-corner dots
   on the cleaned room according to the chosen mode (4 dots for
   `back_wall`, 6 dots for `corner`).
5. **lines** — pure local code. Detects yellow clusters with strict
   thresholds, classifies them, draws three lines (back_wall) or four
   lines (corner) plus Russian labels (Ширина / Высота / Глубина or
   Лев. стена / Прав. стена / Высота / Глубина).
6. **place** — gpt-image-2 places the sofa using the cleaned room +
   sofa photo + dimensions. Supports `back_wall` and `corner` modes
   (`--mode corner` requires `--wall-left`, `--wall-right`,
   `--sofa-left`, `--sofa-right`).

Sofa depth is intentionally NOT used by `place.mjs`.

## Setup

The scripts read `OPENAI_API_KEY` from `supabase/.env.local` via the
`pnpm sim:live:*` aliases (Node `--env-file` is wired in `package.json`).
The keys must be the same ones used by the Edge Function in `live` mode.

Input compression to 720 px on the longest edge happens automatically
in `validate.mjs`, `clean.mjs`, `scene.mjs`, `corners.mjs`, and
`place.mjs` before any image is sent to OpenAI. This is controlled by
`IN_HOME_SIMULATION_MAX_EDGE_PX` (default 720). gpt-image-2 still
returns ≥1024 px output regardless of input size; that is an OpenAI
constraint.

## Per-step CLIs

```bash
# Validate that a photo is a usable interior room.
pnpm sim:live:validate -- --photo /path/to/room.jpg

# Remove furniture (gpt-image-2 image edit). Saves room_cleaned.png.
pnpm sim:live:clean -- --photo /path/to/room.jpg

# Classify back_wall vs corner. Saves scene.json.
pnpm sim:live:scene -- --photo /path/to/room_cleaned.png

# Place yellow architectural-corner dots on the cleaned room.
# --mode auto lets the dot model decide; --mode back_wall or
# --mode corner forces a count (4 or 6).
pnpm sim:live:corners -- \
  --photo /path/to/room_cleaned.png \
  --mode back_wall

# Draw width/height/depth lines from the dots in room_corners.png.
# Auto-detects 4 vs 6 dots.
pnpm sim:live:lines -- --photo /path/to/room_corners.png

# Place a prepared sofa into the cleaned room (back_wall mode).
pnpm sim:live:place -- \
  --room /path/to/room_cleaned.png \
  --sofa /path/to/sofa.jpg \
  --wall-width 4.2 --wall-height 2.6 --room-depth 4.5 \
  --sofa-width 2.0 --sofa-height 0.9

# Place an L-shaped sofa in the inner corner (corner mode).
pnpm sim:live:place -- \
  --room /path/to/room_cleaned.png \
  --sofa /path/to/sofa.jpg \
  --mode corner \
  --wall-left 3 --wall-right 3 --wall-height 2.9 --room-depth 4 \
  --sofa-left 3 --sofa-right 2.7 --sofa-height 1.3
```

Each command prints the artifact path. Output lands in
`tmp/sim-live/<timestamp>-<step>/` by default. Override with `--out`.

## Full Stage 1 + Stage 2 in one go

```bash
# Stage 1 only — let scene-classifier choose mode automatically.
pnpm sim:live:run -- --photo /path/to/room.jpg

# Stage 1 + Stage 2 (back_wall).
pnpm sim:live:run -- \
  --photo /path/to/room.jpg \
  --sofa /path/to/sofa.jpg \
  --wall-width 4.2 --wall-height 2.6 --room-depth 4.5 \
  --sofa-width 2.0 --sofa-height 0.9

# Stage 1 + Stage 2 (corner) — force the corner mode.
pnpm sim:live:run -- \
  --photo /path/to/room.jpg \
  --mode corner \
  --sofa /path/to/sofa.jpg \
  --wall-left 3 --wall-right 3 --wall-height 2.9 --room-depth 4 \
  --sofa-left 3 --sofa-right 2.7 --sofa-height 1.3
```

## Notes

- Default models: `gpt-5` for vision/JSON steps (validate, scene),
  `gpt-image-2` for image-edit steps (clean, corners, place). Override
  with `--model NAME` per step.
- The harness does not touch the local Supabase database or storage.
  It is purely a file-on-disk pipeline review tool.
- Live API calls cost real money. A full Stage 1 run is roughly
  $0.05–0.15 depending on input size; placement adds another
  $0.05–0.15.
- Output artifacts live under the gitignored `tmp/` directory.

## HEIC inputs

`gpt-image-2` and the OpenAI vision endpoint do not accept HEIC. Convert
HEIC inputs first:

```bash
sips -s format jpeg /path/to/input.HEIC --out /path/to/input.jpg
```

Then run the pipeline against the JPEG.
