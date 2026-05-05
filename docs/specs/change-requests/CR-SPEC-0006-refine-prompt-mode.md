# CR-SPEC-0006 Refine Prompt Mode

Target spec id: SPEC-0006
Related spec ids: SPEC-0010
Status: accepted

## Reason For Change

`SPEC-0006 Fabric Render Worker` currently defines `refine` mode as another
fabric render generation request that still uses the target sofa image, the
fabric AI reference image, the selected refinement source render, and the fixed
`v007` prompt.

The intended refine behavior is different from a second fabric transfer
generation. Refine mode is a follow-up edit of the existing `output.png`. It
does not use the fixed `v007` prompt, does not send `fabric_ref.jpg`, and does
not send `target_sofa.jpg` to the provider. It sends only the current output
image, the administrator-provided refine prompt, and a short role label that
identifies the image as the current output to edit.

The accepted spec should define that refine contract directly before the
TypeScript worker, admin API, and admin UI refine workflow are adjusted.

## Proposed Change

Update `SPEC-0006` so that `initial` and `refine` are separate provider input
contracts:

- `initial` mode remains the fabric transfer generation path.
- `initial` mode uses the target sofa image, the fabric AI reference image, the
  fixed `v007` prompt, and an optional prompt note appended to `v007`.
- `refine` mode is a follow-up edit path for an existing generated or selected
  render artifact.
- `refine` mode must send only the selected refinement source render image, the
  administrator-provided refine prompt text, and a short provider role label or
  equivalent instruction that identifies the image as the current output to
  edit.
- `refine` mode must not send the fabric AI reference image to the provider.
- `refine` mode must not send the target sofa image to the provider.
- `refine` mode must not assemble or send the fixed `v007` fabric transfer
  prompt.
- `refine` mode must require a non-empty refine prompt.
- The refine prompt is not a prompt note. It is the main edit instruction for
  the refine attempt.
- `prompt_note` remains an `initial` mode concept and must not be accepted for
  refine requests.
- The implementation may keep a refine prompt version or wrapper version for
  traceability, but `v007` must not be treated as the active prompt content for
  refine provider calls.
- `refine` mode must preserve or restore the previous refinement source output
  if the provider call fails before a new successful output is persisted.

Update the scratch contract for `refine` mode:

- `initial` mode uses `fabric_ref.jpg`, `target_sofa.jpg`, `output.png`, and
  `error.txt`.
- `refine` mode uses the selected current output as the refine source input and
  writes the new result to `output.png`.
- `refine` mode does not require `fabric_ref.jpg` or `target_sofa.jpg` as
  provider inputs.
- `error.txt` remains the human-readable failure artifact.

Update the provider input order:

- for `initial`: fabric AI reference image, target sofa image, assembled `v007`
  prompt;
- for `refine`: current output image, refine prompt text with a short current
  output role label.

Update API contracts so that admin refine job creation accepts a dedicated
`refine_prompt` value instead of treating the text as `prompt_note`.

## Impact

- Spec: `SPEC-0006` must be updated before implementation work changes the
  TypeScript worker behavior.
- API: `SPEC-0010` admin fabric render job creation must distinguish
  `prompt_note` for `initial` requests from `refine_prompt` for `refine`
  requests.
- Data model: implementation planning must decide whether to add a dedicated
  `refine_prompt` column or store generation-mode-specific prompt text in a
  clearly named field. It must not overload refine instructions as an appended
  `v007` prompt note.
- Worker: `fabric-render-worker` must change its refine branch so Gemini
  receives only the refinement source image and refine prompt, not
  `fabric_ref`, `target_sofa`, or the `v007` assembled prompt.
- Tests: provider request tests must assert that refine requests contain one
  image input and the refine prompt text, while initial requests continue to
  use the fabric reference, target sofa, and fixed `v007` prompt.
- Plans: any follow-up implementation plan for `SPEC-0006` or `SPEC-0010` must
  reference this change request before changing refine behavior.

## Approval Note

Accepted after local real-photo smoke testing showed that the current
TypeScript `refine` path followed the accepted `SPEC-0006` text but did not
match the intended follow-up edit behavior for refine prompts.
