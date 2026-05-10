# PLAN-0076 Admin French Localization

Plan: PLAN-0076
Spec: SPEC-0017
Status: done
Owner area: web
Depends on: SPEC-0001, SPEC-0003, SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0014, SPEC-0016
Affected packages:

- `apps/web`
- `docs/roadmap/web.md`

## Goal

Make the protected admin experience French for administrators while preserving
admin authentication, catalog editing, upload, render preparation, publication,
archive, restore, and ZIP export behavior.

## Architecture

Use a small explicit admin copy layer in `apps/web/src/app/admin` so static
admin UI text, status labels, blocker labels, and expected error mappings are
easy to audit. Keep route paths, API field names, enum values, database values,
and stable uppercase error codes unchanged. Prefer code-based French mappings
over raw server messages, and replace unexpected technical failures with one
generic French admin error.

Do not add a full i18n framework in this plan. The admin locale is fixed to
`fr-FR`.

## Scope

Included:

- Admin shell, navigation, route metadata, login, dashboard, sofas, fabrics,
  tags, sofa create, sofa edit, fabric create, and fabric edit copy.
- Admin form labels, helper text, placeholders, validation feedback, buttons,
  links, tabs, filters, badges, status labels, empty states, loading states,
  success messages, failure messages, confirmations, and accessibility text.
- Admin upload, cropper, render coverage, source image, candidate review,
  generation, retry, resume, manual upload, publication, archive, restore, and
  ZIP export copy.
- Frontend mappings for admin error codes, publication blockers, render-cell
  blockers, lifecycle labels, readiness labels, job status labels, source type
  labels, and upload preparation messages.
- Expected browser-facing `/api/admin/*` error messages returned by the web
  admin route handlers and catalog store helpers.
- Focused tests proving French copy appears and technical identifiers are not
  shown as user-facing admin messages.

Excluded:

- Public visitor pages.
- Route path localization.
- Multi-language switching or language detection.
- Database schema changes.
- Supabase migration changes.
- Worker behavior changes.
- Translation of administrator-entered catalog content.

## File Map

- Create `apps/web/src/app/admin/admin-copy.ts` for fixed admin locale,
  reusable static copy, label dictionaries, and generic messages.
- Create `apps/web/src/app/admin/admin-copy.test.ts` for the copy catalog,
  required keys, stable locale, and technical-code hiding expectations.
- Modify `apps/web/src/app/admin/admin-error-messages.ts` and
  `apps/web/src/app/admin/admin-error-messages.test.ts` so known admin codes
  map to French messages and unknown technical codes map to a generic French
  failure.
- Modify `apps/web/src/app/admin/AdminShell.tsx` for French shell navigation
  and accessibility names.
- Modify `apps/web/src/app/admin/AdminDashboard.tsx` and
  `apps/web/src/app/admin/AdminDashboard.test.tsx` for French dashboard copy
  while preserving access checks and sign-out behavior.
- Modify `apps/web/src/app/admin/login/page.tsx`,
  `apps/web/src/app/admin/login/AdminLoginForm.tsx`, and
  `apps/web/src/app/admin/login/page.test.tsx` for French login copy and auth
  failures.
- Modify admin route metadata files under `apps/web/src/app/admin/**/page.tsx`
  so browser titles are French where they are admin-facing.
- Modify `apps/web/src/app/admin/AdminCatalogPages.tsx` and
  `apps/web/src/app/admin/AdminCatalogPages.test.tsx` for catalog, fabric, tag,
  upload, cropper, render, publication, archive, restore, and ZIP export copy.
- Modify `apps/web/src/lib/admin-image-upload.ts` and
  `apps/web/src/lib/admin-image-upload.test.ts` for French preparation messages
  shown after crop, resize, or WebP conversion.
- Modify `apps/web/src/lib/admin-auth.ts`,
  `apps/web/src/lib/admin-route-handlers.ts`,
  `apps/web/src/lib/admin-route-handlers.test.ts`,
  `apps/web/src/lib/admin-catalog.ts`,
  `apps/web/src/lib/admin-catalog.test.ts`,
  `apps/web/src/lib/admin-catalog-route-handlers.ts`,
  `apps/web/src/lib/admin-catalog-route-handlers.test.ts`,
  `apps/web/src/lib/admin-catalog-store-upload.test.ts`, and
  `apps/web/src/lib/admin-catalog-store-variants.test.ts` only where expected
  admin-facing messages are returned or asserted.
- Update `docs/roadmap/web.md` after implementation and verification pass.

## Tasks

- [ ] Add failing `admin-copy` tests.
      Cover `fr-FR`, shell nav keys, dashboard action keys, login keys, sofa
      lifecycle labels, readiness labels, render cell status labels, source type
      labels, upload preparation messages, publication blocker labels,
      render-cell blocker labels, known error-code messages, and the generic
      fallback for unknown technical codes.
- [ ] Run the new copy test and confirm it fails before implementation:

```bash
pnpm --filter @mobel-unique/web test -- admin-copy
```

- [ ] Create `apps/web/src/app/admin/admin-copy.ts` with the fixed admin copy
      catalog and exported formatting helpers used by the admin UI.
- [ ] Re-run the copy test and confirm it passes:

```bash
pnpm --filter @mobel-unique/web test -- admin-copy
```

- [ ] Update `admin-error-messages` tests to expect French messages for known
      codes, unknown technical-code fallback, publication blocker labels, and
      render-cell blocker labels.
- [ ] Update `admin-error-messages.ts` to use the copy catalog and keep stable
      uppercase codes hidden from the UI.
- [ ] Run the error-message test:

```bash
pnpm --filter @mobel-unique/web test -- admin-error-messages
```

- [ ] Update shell, dashboard, login, and route metadata tests to expect French
      admin-facing copy while keeping route hrefs and access redirects
      unchanged.
- [ ] Update `AdminShell.tsx`, `AdminDashboard.tsx`, `login/page.tsx`,
      `login/AdminLoginForm.tsx`, and the admin route metadata files to use the
      copy catalog. Add or refresh the required Russian/French `.tsx` comment
      blocks when those files are touched.
- [ ] Run the shell/dashboard/login tests:

```bash
pnpm --filter @mobel-unique/web test -- AdminDashboard login/page
```

- [ ] Update `AdminCatalogPages.test.tsx` in focused groups for sofas, sofa
      create, sofa edit basics, fabric lines, view columns, renders,
      publication, fabrics, fabric create/edit, tags, uploads, cropper, archive,
      restore, and ZIP export. Assert French visible copy and accessible names,
      and keep behavior assertions unchanged.
- [ ] Update `AdminCatalogPages.tsx` to use the copy catalog for admin-visible
      strings, label dictionaries, status formatters, confirmation text,
      loading states, empty states, upload messages, alt text, dialog labels,
      and screen-reader labels.
- [ ] Run the admin catalog page test:

```bash
pnpm --filter @mobel-unique/web test -- AdminCatalogPages
```

- [ ] Update `admin-image-upload` tests to expect French browser-facing upload
      preparation messages.
- [ ] Update `admin-image-upload.ts` to return French upload preparation
      messages without changing image conversion, crop, resize, or upload
      behavior.
- [ ] Run the upload helper test:

```bash
pnpm --filter @mobel-unique/web test -- admin-image-upload
```

- [ ] Update admin auth, route-handler, catalog, catalog route-handler, upload
      store, and variant tests to expect French browser-facing messages while
      keeping `error.code` values unchanged.
- [ ] Update `admin-auth.ts`, `admin-route-handlers.ts`,
      `admin-catalog.ts`, and `admin-catalog-route-handlers.ts` so expected
      readable admin messages are French and unexpected technical failures stay
      generic.
- [ ] Run focused admin API and catalog tests:

```bash
pnpm --filter @mobel-unique/web test -- admin-auth admin-route-handlers admin-catalog admin-catalog-route-handlers admin-catalog-store-upload admin-catalog-store-variants
```

- [ ] Search for remaining English admin UI literals and decide each hit:
      translate if it is administrator-facing, keep if it is a route path,
      API field, enum, test name, fixture identifier, developer-only message, or
      public visitor copy.

```bash
rg -n "\"[A-Z][^\"]*[a-z][^\"]*\"|'[A-Z][^']*[a-z][^']*'" apps/web/src/app/admin apps/web/src/lib/admin-*.ts
```

- [ ] Run the combined focused web tests:

```bash
pnpm --filter @mobel-unique/web test -- admin-copy admin-error-messages AdminDashboard login/page AdminCatalogPages admin-image-upload admin-auth admin-route-handlers admin-catalog admin-catalog-route-handlers admin-catalog-store-upload admin-catalog-store-variants
```

- [ ] Run the web typecheck:

```bash
pnpm --filter @mobel-unique/web typecheck
```

- [ ] Update `docs/roadmap/web.md` with a `Done` entry for PLAN-0076 after the
      code and tests pass.
- [ ] Run the spec guard:

```bash
pnpm spec:check
```

- [ ] Move this plan from `docs/plans/active` to `docs/plans/done` only after
      implementation, roadmap update, and verification pass.

## Tests

Focused tests:

```bash
pnpm --filter @mobel-unique/web test -- admin-copy
pnpm --filter @mobel-unique/web test -- admin-error-messages
pnpm --filter @mobel-unique/web test -- AdminDashboard login/page
pnpm --filter @mobel-unique/web test -- AdminCatalogPages
pnpm --filter @mobel-unique/web test -- admin-image-upload
pnpm --filter @mobel-unique/web test -- admin-auth admin-route-handlers admin-catalog admin-catalog-route-handlers admin-catalog-store-upload admin-catalog-store-variants
```

Combined focused test:

```bash
pnpm --filter @mobel-unique/web test -- admin-copy admin-error-messages AdminDashboard login/page AdminCatalogPages admin-image-upload admin-auth admin-route-handlers admin-catalog admin-catalog-route-handlers admin-catalog-store-upload admin-catalog-store-variants
```

Quality checks:

```bash
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

If shared admin behavior changes beyond the planned files, also run:

```bash
pnpm --filter @mobel-unique/web test
```

## Roadmap

Update:

- `docs/roadmap/web.md`

## Notes

This is a fixed-locale admin localization pass. It should not alter admin
permissions, session validation, API response shapes, upload preparation,
catalog mutations, render job orchestration, publication rules, archive rules,
restore rules, or ZIP export mechanics.

When touching `.tsx` files, keep the required Russian/French explanatory
comments current and simple. The product UI copy should be French, but
repository documentation, test names, identifiers, route paths, API fields, and
stable error codes remain English.

## Closure

Completed on 2026-05-09 after focused admin tests, web typecheck, roadmap
update, and specification guard passed.
