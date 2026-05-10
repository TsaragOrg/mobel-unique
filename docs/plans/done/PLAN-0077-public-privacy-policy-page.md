# PLAN-0077 Public Privacy Policy Page

Plan: PLAN-0077
Spec: SPEC-0018
Status: done
Owner area: web
Depends on: SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0015
Affected packages:

- `apps/web/src/app/public-legal-links.ts` (new)
- `apps/web/src/app/PublicShell.tsx`
- `apps/web/src/app/PublicShell.test.tsx` (new)
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- `apps/web/src/app/politique-de-confidentialite/page.tsx` (new)
- `apps/web/src/app/politique-de-confidentialite/page.test.tsx` (new)
- `apps/web/src/app/catalog/page.test.tsx`
- `apps/web/src/app/sofas/[slug]/page.test.tsx`
- `apps/web/src/app/globals.css`
- `docs/roadmap/web.md`

## Goal

Add the public French privacy policy page at
`/politique-de-confidentialite` and expose a quiet footer link to it from the
home page and the shared public shell used by catalog, sofa detail, simulation
gate, simulation wizard, and simulation continuation screens.

The implementation must keep the page static, indexable, concise, and focused
on the MVP visualization flow. It must not add database, API, worker,
environment, analytics, consent-banner, account, gallery, or Shopify checkout
privacy behavior.

## Architecture

Use a small shared legal-link constant so the footer href and label stay
identical in the home footer and `PublicShell`. Implement the privacy page as a
server-rendered static route that reuses the existing public visual system in
`globals.css` and calls no private endpoints.

Keep privacy text repository-authored for the MVP. The visible page copy is
French because `SPEC-0018` requires French visitor copy; tests, identifiers,
plan text, and roadmap text remain English.

## File Map

- Create `apps/web/src/app/public-legal-links.ts` for:
  - `PUBLIC_PRIVACY_POLICY_HREF = "/politique-de-confidentialite"`;
  - `PUBLIC_PRIVACY_POLICY_LABEL = "Politique de confidentialité"`.
- Create `apps/web/src/app/PublicShell.test.tsx` to assert that the shared
  public footer includes the privacy policy link and does not expose admin,
  account, cart, checkout, gallery, signed URL, Supabase, bucket, or API
  internals.
- Modify `apps/web/src/app/PublicShell.tsx` to use the shared legal-link
  constant in the footer. Refresh the required Russian/French `.tsx` comments
  at the top and before the footer section.
- Modify `apps/web/src/app/page.tsx` to add the same footer link to the home
  footer through the shared legal-link constant. Refresh the required
  Russian/French `.tsx` comments before the footer section.
- Modify `apps/web/src/app/page.test.tsx` to assert that the home footer links
  to `/politique-de-confidentialite`.
- Modify `apps/web/src/app/catalog/page.test.tsx` and
  `apps/web/src/app/sofas/[slug]/page.test.tsx` to assert that catalog and sofa
  detail contexts expose the shared privacy policy footer link.
- Create `apps/web/src/app/politique-de-confidentialite/page.tsx` with static
  French content and metadata.
- Create `apps/web/src/app/politique-de-confidentialite/page.test.tsx` for the
  route content, metadata, required privacy topics, and forbidden private
  implementation details.
- Modify `apps/web/src/app/globals.css` to style:
  - quiet footer legal links for `.home-footer` and `.public-footer`;
  - the privacy page sections, lists, contact link, and mobile spacing.
- Update `docs/roadmap/web.md` after implementation and verification pass.

## Tasks

- [ ] Create the feature branch with:

```bash
pnpm branch:create -- --type feature --area web --work "Public privacy policy page" --spec SPEC-0018 --plan PLAN-0077
```

- [ ] Add failing route tests in
      `apps/web/src/app/politique-de-confidentialite/page.test.tsx`.
      Cover:
  - the page title `Politique de confidentialité`;
  - the route content says the site helps visitors visualize a MÖBEL UNIQUE
    sofa at home and uses personal data only for that limited experience;
  - browsing data mentions basic technical loading data, no active analytics,
    no persistent public catalog interaction tracking, and no customer account
    for browsing;
  - simulation data mentions email verification, required email-use consent,
    optional commercial contact consent, uploaded room photo, generated guide
    image, generated simulation result, temporary access browser state, selected
    sofa, selected fabric, selected visual position, job status, timestamps,
    failure state, and usage counters;
  - purpose copy covers requested visualization, showing the result, abuse
    limits, troubleshooting, and commercial contact only with optional consent;
  - legal-basis copy distinguishes visitor-requested visualization,
    legitimate interest for operational and anti-abuse data, and consent for
    optional commercial contact;
  - retention copy states private room photos, intermediate images, guide
    images, and generated results are deleted no later than 24 hours after
    creation;
  - access copy states private simulation images are not catalog assets, there
    is no public gallery, no public sharing link, and no customer account;
  - provider copy stays generic and identifies MÖBEL UNIQUE as the site owner
    with the privacy contact;
  - rights copy lists access, correction, deletion, objection, restriction, and
    portability, and shows `mobel.unique.it@gmail.com`;
  - metadata has a French title and description without the privacy email,
    private values, signed URLs, internal IDs, or environment-specific values;
  - forbidden copy does not include admin links, private storage paths, signed
    URLs, Supabase keys, bucket names, queue names, service-role text, raw
    provider prompts, API internals, cart, checkout, account UI, or customer
    gallery promises.

- [ ] Add failing footer tests:
  - `apps/web/src/app/page.test.tsx` asserts the home footer has a link named
    `Politique de confidentialité` with href `/politique-de-confidentialite`;
  - `apps/web/src/app/PublicShell.test.tsx` asserts the shared public shell
    footer has the same link and keeps private/admin/ecommerce surfaces absent;
  - `apps/web/src/app/catalog/page.test.tsx` asserts the catalog route exposes
    the shared footer link;
  - `apps/web/src/app/sofas/[slug]/page.test.tsx` asserts the sofa detail route
    exposes the shared footer link.

- [ ] Run the focused tests and confirm the new assertions fail before
      implementation:

```bash
pnpm --filter @mobel-unique/web test -- src/app/politique-de-confidentialite/page.test.tsx src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
```

Expected: failure because the privacy route and footer link do not exist yet.

- [ ] Create `apps/web/src/app/public-legal-links.ts` with the shared href and
      label constants.

- [ ] Create `apps/web/src/app/politique-de-confidentialite/page.tsx`.
      Required implementation details:
  - export `metadata` with French title and description;
  - return static content only;
  - use `PublicShell`;
  - include short French sections for introduction, browsing data, simulation
    data, purposes, legal basis, retention, access and sharing, technical
    providers, rights, and contact;
  - include `mobel.unique.it@gmail.com` as the visible privacy contact;
  - do not mention a data protection officer;
  - do not call `fetch`, Supabase helpers, simulation status endpoints, admin
    endpoints, worker functions, or private tables.

- [ ] Add or refresh required `.tsx` comments in every touched `.tsx` file.
      The comments must use `RU:` first and `FR:` second, explain why the file
      exists, what the visitor sees, and what the visitor can do, and avoid the
      forbidden comment words from `AGENTS.md`.

- [ ] Update `apps/web/src/app/PublicShell.tsx` footer to render the shared
      privacy link after the existing brand/assurance text. Keep the link quiet
      and keyboard-accessible.

- [ ] Update `apps/web/src/app/page.tsx` footer to render the shared privacy
      link without adding right-side top navigation or competing with the
      catalog CTA.

- [ ] Update `apps/web/src/app/globals.css`:
  - add link styles under `.home-footer a` and `.public-footer a`;
  - preserve existing focus-visible behavior;
  - add privacy page spacing classes that fit mobile without overlapping text;
  - keep the page unframed and avoid nested cards.

- [ ] Run the focused tests again:

```bash
pnpm --filter @mobel-unique/web test -- src/app/politique-de-confidentialite/page.test.tsx src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
```

Expected: pass.

- [ ] Run the web typecheck:

```bash
pnpm --filter @mobel-unique/web typecheck
```

- [ ] Update `docs/roadmap/web.md` with a `Done` entry for `SPEC-0018` and
      `PLAN-0077` after the route, footer link, tests, and typecheck pass.

- [ ] Run the specification guard:

```bash
pnpm spec:check
```

- [ ] If CSS changes affect broad public layout, also run the full web test
      suite:

```bash
pnpm --filter @mobel-unique/web test
```

- [ ] Move this plan from `docs/plans/active` to `docs/plans/done` only after
      implementation, roadmap update, and verification pass.

## Tests

Focused tests:

```bash
pnpm --filter @mobel-unique/web test -- src/app/politique-de-confidentialite/page.test.tsx
pnpm --filter @mobel-unique/web test -- src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
```

Combined focused test:

```bash
pnpm --filter @mobel-unique/web test -- src/app/politique-de-confidentialite/page.test.tsx src/app/page.test.tsx src/app/PublicShell.test.tsx src/app/catalog/page.test.tsx src/app/sofas/[slug]/page.test.tsx
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

The roadmap entry should claim only the public privacy policy page, footer link,
focused tests, and metadata safety. It must not claim database, API, worker,
analytics, consent-banner, account, gallery, or Shopify checkout privacy work.

## Notes

- No database, API, worker, storage, queue, environment, analytics, consent
  banner, admin, account, public gallery, public sharing, or Shopify checkout
  changes are approved by `SPEC-0018`.
- The page may describe trusted technical providers generically, but must not
  list secrets, private endpoints, bucket names, queue names, provider prompts,
  raw configuration, internal IDs, signed URLs, Supabase keys, or service-role
  credentials.
- The page must not describe analytics as active in the MVP.
- The page must not claim private images train AI models.
- The page must not claim screenshots or browser extraction are impossible.
- The page must use a generic privacy contact role and must not claim a data
  protection officer.
- Do not commit automatically unless the user asks for a commit.

## Closure Note

Implemented the public privacy policy route, shared footer legal link, focused
route/footer coverage, web typecheck, specification guard, full web test suite,
and roadmap update for `SPEC-0018` / `PLAN-0077`.
