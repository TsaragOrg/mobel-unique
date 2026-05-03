# PLAN-0053 Admin Render Empty Cell Placeholders

Plan: PLAN-0053
Spec: SPEC-0014
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/roadmap`

## Goal

Replace the empty left side of the sofa edit render cell sheet for Missing and
Blocked render cells with a clear visual placeholder that explains that the
render is not available yet, and keep the Source detail from implying that an
AI-generated source already exists for those empty cells.

## Scope

- Add a CSS-only placeholder inside the existing render cell preview pane when
  the selected render cell has no current preview image.
- Keep Ready render cells unchanged: they continue showing the Current render
  image and large preview action.
- Keep Missing and Blocked actions unchanged, including Generate and Go to
  Visual matrix.
- Show `No source yet` in the Source detail for Missing and Blocked cells.
- Use a compact placeholder layout on mobile so the sheet does not gain
  unnecessary height.

## Tasks

- [x] Add failing tests for Missing and Blocked render cell sheets.
- [x] Implement the placeholder in `apps/web/src/app/admin/AdminCatalogPages.tsx`.
- [x] Add desktop and mobile placeholder styles in `apps/web/src/app/globals.css`.
- [x] Replace misleading Source detail copy for Missing and Blocked cells.
- [x] Update `docs/roadmap/web.md`.
- [x] Run the focused admin UI test and web typecheck.

## Tests

- Missing render cell sheet shows `Render missing` and explanatory copy.
- Blocked render cell sheet shows `Render blocked`, explanatory copy, and still
  links to the Visual matrix tab.
- Missing and Blocked render cell sheets show `No source yet` instead of
  `AI generated`.
- Ready render cell behavior remains covered by existing Current render tests.

## Roadmap

- Update `docs/roadmap/web.md` with the completed admin render placeholder work.

## Notes

- This is a UI-only fix under `SPEC-0014`; no API, Supabase, storage, or worker
  behavior changes are expected.
- UI copy stays in English to match repository language rules.
