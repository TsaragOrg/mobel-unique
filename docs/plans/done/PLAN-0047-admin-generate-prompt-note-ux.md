# Admin Generate Prompt Note UX

Plan: PLAN-0047
Spec: SPEC-0014
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Keep the standard Generate action primary in sofa edit render cell popups while
making the extra prompt note clearly optional.

## Tasks

- [x] Keep the Generate and Generate new candidate buttons visible as the main
      action.
- [x] Hide the extra prompt note behind an `Add optional note` control in the
      Missing cell and candidates review flows.
- [x] Send `prompt_note: null` when the optional note is not opened.
- [x] Keep the refine prompt separate inside the candidate refine action.
- [x] Preserve the existing `prompt_note` API payload behavior.
- [x] Update the web roadmap and SPEC-0014 manifest entry.
- [x] Run the focused web test.

## Tests

- Updated `apps/web/src/app/admin/AdminCatalogPages.test.tsx` so Missing and
  candidates review flows keep the generate button visible, hide the optional
  note until `Add optional note` is clicked, and only send `prompt_note` when
  that note is opened and filled.
- Ran `pnpm --filter @mobel-unique/web test -- src/app/admin/AdminCatalogPages.test.tsx`.

## Roadmap

- Updated `docs/roadmap/web.md`.

## Notes

- This is a UI-only change.
- No API, storage, worker, publication, or candidate selection rule changes are
  included.
