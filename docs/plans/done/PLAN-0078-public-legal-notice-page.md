# PLAN-0078 Public Legal Notice Page

Plan: PLAN-0078
Spec: SPEC-0019
Status: done
Owner area: web
Depends on: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0012, SPEC-0018
Affected packages:

- `apps/web/src/app/public-legal-links.ts`
- `apps/web/src/app/PublicShell.tsx`
- `apps/web/src/app/PublicShell.test.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- `apps/web/src/app/mentions-legales/page.tsx`
- `apps/web/src/app/mentions-legales/page.test.tsx`
- `apps/web/src/app/catalog/page.test.tsx`
- `apps/web/src/app/sofas/[slug]/page.test.tsx`
- `apps/web/src/app/globals.css`
- `docs/roadmap/web.md`

## Goal

Add a concise French public legal notice page at `/mentions-legales` and expose
a quiet footer link from the home page and shared public shell pages.

The implementation must stay static and repository-authored. It must not add
database, API, worker, environment, analytics, cookie banner, Shopify checkout,
account, cart, payment, or CMS behavior.

## Architecture

Extend the existing `public-legal-links.ts` constants so both legal footer links
use one shared source of truth. Implement `/mentions-legales` as a static
Next.js route that reuses `PublicShell` and the existing privacy-page visual
system with small legal-notice CSS extensions.

The legal notice copy is French visitor copy. Tests, identifiers, plan text,
roadmap text, and non-`.tsx` comments remain English.

## File Map

- Modify `apps/web/src/app/public-legal-links.ts` to add:
  - `PUBLIC_LEGAL_NOTICE_HREF = "/mentions-legales"`;
  - `PUBLIC_LEGAL_NOTICE_LABEL = "Mentions legales"`;
  - `PUBLIC_LEGAL_LINKS` with privacy and legal notice links in one array.
- Modify `apps/web/src/app/PublicShell.tsx` to render the shared legal links in
  the public footer and refresh required Russian/French comments.
- Modify `apps/web/src/app/page.tsx` to render the shared legal links in the
  home footer and refresh required Russian/French comments.
- Create `apps/web/src/app/mentions-legales/page.tsx` with static French legal
  notice copy and safe metadata.
- Create `apps/web/src/app/mentions-legales/page.test.tsx` for required visible
  copy, metadata safety, and forbidden private or Shopify-owned surfaces.
- Modify `apps/web/src/app/page.test.tsx`, `apps/web/src/app/PublicShell.test.tsx`,
  `apps/web/src/app/catalog/page.test.tsx`, and
  `apps/web/src/app/sofas/[slug]/page.test.tsx` to require the legal notice
  footer link.
- Modify `apps/web/src/app/globals.css` only where needed for footer legal link
  grouping and legal notice page spacing.
- Update `docs/roadmap/web.md` after implementation and verification.

## Tasks

- [x] Create the feature branch with:

```bash
pnpm branch:create -- --allow-dirty --base feature/web/spec-0018-plan-0077-public-privacy-policy-page --type feature --area web --work "Public legal notice page" --spec SPEC-0019 --plan PLAN-0078
```

- [x] Add failing route tests in
      `apps/web/src/app/mentions-legales/page.test.tsx`. Cover:
  - heading `Mentions legales`;
  - publisher details: `SARL MOBILIER & ART`, `MOBEL UNIQUE`, `SARL`,
    `8 Rue Danielle Casanova, 95100 Argenteuil, France`, `1000 euros`,
    `RCS Pontoise 943 675 579`, `943 675 579`,
    `aide.mobelunique@gmail.com`, and `+33 6 58 93 61 06`;
  - no VAT number;
  - publication director `Abdul Dzhabrailov`;
  - host details: `Vercel Inc.`,
    `440 N Barranca Avenue #4133, Covina, CA 91723, United States`, and
    `https://vercel.com/contact`;
  - no Shopify, Automattic, checkout, cart, account, sales terms, or payment
    ownership copy;
  - short intellectual-property note;
  - short personal-data pointer with a link to `/politique-de-confidentialite`;
  - metadata has a French title and description without private values.

- [x] Add failing footer tests:
  - `apps/web/src/app/page.test.tsx` asserts the home footer has a link named
    `Mentions legales` with href `/mentions-legales`;
  - `apps/web/src/app/PublicShell.test.tsx` asserts the shared public shell
    footer has the same link;
  - `apps/web/src/app/catalog/page.test.tsx` asserts the catalog route exposes
    the shared footer link;
  - `apps/web/src/app/sofas/[slug]/page.test.tsx` asserts the sofa detail route
    exposes the shared footer link.

- [x] Run the focused tests and confirm the new assertions fail before
      implementation:

```bash
pnpm --filter @mobel-unique/web test -- src/app/mentions-legales/page.test.tsx src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
```

Expected: failure because the legal notice route and footer link do not exist
yet.

- [x] Update `apps/web/src/app/public-legal-links.ts` with shared legal notice
      constants and a `PUBLIC_LEGAL_LINKS` array.

- [x] Create `apps/web/src/app/mentions-legales/page.tsx`. Required
      implementation details:
  - export `metadata` with French title and description;
  - return static content only;
  - use `PublicShell`;
  - include short French sections for publisher, publication director, hosting,
    intellectual property, and personal data;
  - include the accepted publisher and Vercel host details from `SPEC-0019`;
  - link the personal-data pointer to `/politique-de-confidentialite`;
  - do not call `fetch`, Supabase helpers, simulation status endpoints, admin
    endpoints, worker functions, Shopify APIs, or private tables.

- [x] Add or refresh required `.tsx` comments in every touched `.tsx` file.
      The comments must use `RU:` first and `FR:` second, explain why the file
      exists, what the visitor sees, and what the visitor can do, and avoid the
      forbidden comment words from `AGENTS.md`.

- [x] Update `apps/web/src/app/PublicShell.tsx` footer to render both public
      legal links after the existing brand and assurance text.

- [x] Update `apps/web/src/app/page.tsx` footer to render both public legal
      links without adding top navigation or competing with the catalog CTA.

- [x] Update `apps/web/src/app/globals.css`:
  - add a small footer legal link group for `.home-footer` and `.public-footer`;
  - preserve focus-visible behavior;
  - add legal notice page spacing classes that fit mobile without overlapping
    text;
  - keep the page unframed and avoid nested cards.

- [x] Run the focused tests again:

```bash
pnpm --filter @mobel-unique/web test -- src/app/mentions-legales/page.test.tsx src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
```

Expected: pass.

- [x] Run the web typecheck:

```bash
pnpm --filter @mobel-unique/web typecheck
```

- [x] Update `docs/roadmap/web.md` with a `Done` entry for `SPEC-0019` and
      `PLAN-0078` after route, footer, tests, and typecheck pass.

- [x] Run the specification guard:

```bash
pnpm spec:check
```

- [x] If CSS changes affect broad public layout, also run the full web test
      suite:

```bash
pnpm --filter @mobel-unique/web test
```

- [x] Move this plan from `docs/plans/active` to `docs/plans/done` only after
      implementation, roadmap update, and verification pass.

## Tests

Focused tests:

```bash
pnpm --filter @mobel-unique/web test -- src/app/mentions-legales/page.test.tsx
pnpm --filter @mobel-unique/web test -- src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
```

Combined focused test:

```bash
pnpm --filter @mobel-unique/web test -- src/app/mentions-legales/page.test.tsx src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
```

Quality checks:

```bash
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

Broader check when public CSS or shell behavior changes more than expected:

```bash
pnpm --filter @mobel-unique/web test
```

## Roadmap

Update:

- `docs/roadmap/web.md`

The roadmap entry should claim only the public legal notice page, footer link,
focused tests, and metadata safety. It must not claim database, API, worker,
analytics, cookie-banner, account, gallery, checkout, payment, or Shopify legal
page changes.

## Notes

- No database, API, worker, storage, queue, environment, analytics, consent
  banner, admin, account, cart, checkout, payment, public gallery, public
  sharing, or Shopify page changes are approved by `SPEC-0019`.
- The page must identify Vercel as this application's host and must not copy
  the Shopify storefront host or Automattic host into this route.
- The page must not display a VAT number until an accepted change request adds
  one.
- The page must not list secrets, private endpoints, bucket names, queue names,
  provider prompts, raw configuration, internal IDs, signed URLs, Supabase keys,
  or service-role credentials.
- Do not commit automatically unless the user asks for a commit.

## Closure Note

Implemented the public legal notice route, shared footer legal links, focused
route/footer coverage, web typecheck, specification guard, full web test suite,
and roadmap update for `SPEC-0019` / `PLAN-0078`.
