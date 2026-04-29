# CR-SPEC-0006 Fabric Render Output Normalization

Target spec id: SPEC-0006
Related spec ids: SPEC-0010
Status: accepted

## Reason For Change

`SPEC-0006 Fabric Render Worker` currently requires the worker to request exact
pixel dimensions from the provider and then save the provider output without any
post-processing. That rule does not match the proven local Python worker
behavior used for fabric render testing.

Gemini image generation supports a fixed set of output aspect ratios, not
arbitrary exact pixel dimensions such as `1478x2048`. The worker therefore
cannot reliably obtain exact target dimensions only by writing the dimensions in
prompt text. The local Python worker handles this by sending the closest
Gemini-supported aspect ratio through provider configuration, then normalizing
the returned image canvas to the exact source dimensions.

The accepted spec should define this behavior directly so the TypeScript worker
can match the local Python worker rather than depending on provider output size
alone.

## Proposed Change

Update `SPEC-0006` so that fabric render provider sizing uses provider aspect
ratio configuration plus deterministic output normalization.

For `initial` mode:

- The target sofa image is the output dimension authority.
- The worker must read the target sofa dimensions after EXIF orientation is
  applied.
- The worker must calculate the target sofa aspect ratio from those dimensions.
- The worker must choose the closest aspect ratio supported by the active Gemini
  image model.
- The worker must send that closest supported aspect ratio through the Gemini
  provider request, using `generationConfig.imageConfig.aspectRatio` for REST
  requests or the SDK-equivalent field for SDK requests.
- The worker must not put an exact pixel dimension instruction such as
  `1478x2048` in the fabric transfer prompt.

For `refine` mode:

- The selected current output image is the output dimension authority.
- The worker must read the refinement source image dimensions after EXIF
  orientation is applied.
- The worker must calculate the refinement source aspect ratio from those
  dimensions.
- The worker must choose the closest aspect ratio supported by the active Gemini
  image model.
- The worker must send that closest supported aspect ratio through the Gemini
  provider request.
- The worker must not put an exact pixel dimension instruction in the refine
  prompt wrapper.

After a successful provider response, the worker must normalize the returned
image to the authority dimensions for the generation mode:

- `initial` output must be normalized to the target sofa dimensions.
- `refine` output must be normalized to the selected current output image
  dimensions.
- If the provider output already has the exact authority dimensions, the worker
  may keep the image without crop or resize other than format canonicalization.
- If the provider output aspect ratio differs from the authority aspect ratio,
  the worker must use a centered crop of the full image canvas.
- The crop must be a simple canvas crop. It must not detect the sofa, compute a
  sofa bounding box, segment the foreground, or perform any other smart crop.
- After the optional centered crop, the worker must resize the image to the
  exact authority width and height.
- The normalized artifact must be saved as `output.png`.
- Stored output metadata must describe the normalized `output.png`, including
  the final normalized width, height, byte size, and content type.

The worker may record raw provider output dimensions for diagnostics if a later
plan adds a place to store them, but raw dimensions are not the authoritative
candidate output dimensions.

## Impact

- Spec: `SPEC-0006` must replace the current no-post-processing output rule with
  the aspect-ratio request plus deterministic normalization rule.
- Worker: `fabric-render-worker` must add provider output normalization after
  Gemini returns image bytes and before uploading `output.png`.
- Worker: the provider request helper must keep calculating and sending the
  closest supported Gemini aspect ratio from the authority image dimensions.
- Worker: the prompt builders must not include exact pixel dimension text as an
  output-size instruction.
- Storage metadata: generated candidate asset metadata must store the normalized
  output dimensions, not the raw provider output dimensions.
- Tests: provider request tests must assert that Gemini receives
  `imageConfig.aspectRatio`; prompt tests must assert that exact pixel dimension
  text is not included; image processing tests must cover centered crop, resize,
  and no-op behavior when dimensions already match.
- Plans: the follow-up implementation plan must reference this change request
  before adding crop and resize behavior.

## Approval Note

Accepted to match the local Python worker behavior used in `C:\dev\worker`.
That worker sends Gemini the closest supported aspect ratio, then applies a
plain centered crop and resize so the final `output.png` has the same dimensions
as the target sofa for `initial` mode or the current output for `refine` mode.
