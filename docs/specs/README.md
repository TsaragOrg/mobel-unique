# Specs

This directory is the working space for future Mobel Unique app specifications.

## Structure

- `drafts`: specs that can still change.
- `accepted`: specs approved for implementation. These are frozen by default.
- `change-requests`: explicit requests to change accepted specs.
- `manifest.json`: registry of accepted specs.

## Recommended Flow

1. Start with a draft spec.
2. Move the spec to `accepted` only when it is approved.
3. Register accepted specs in `manifest.json`.
4. Create an execution plan under `docs/plans/active`.
5. Use a change request before editing an accepted spec.

Use `_template.md` as the starting point for new specs.
