# SPEC-0019 Public Legal Notice Page

Spec: SPEC-0019
Status: accepted
Layer: cross-cutting
Parent Spec: SPEC-0012
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0012, SPEC-0018
Areas: web
Implementation Plans: PLAN-0078

## Traceability

`SPEC-0012 Public Frontend Experience And Page Flows` defines the public shell
and says final public footer legal links are deferred to later privacy and
operations specs. This spec supplies the concise public legal notice page and
footer link for that deferred public-site requirement.

This spec follows:

- `SPEC-0001`, which defines `apps/web` as the Next.js frontend deployed to
  Vercel;
- `SPEC-0003`, which defines the visualization tool as separate from Shopify
  commerce;
- `SPEC-0004`, which requires a simple French public customer experience and
  clear privacy messaging before simulation;
- `SPEC-0012`, which defines the public route map, public shell, SEO-safe public
  pages, and footer-link need;
- `SPEC-0018`, which defines and implements the public privacy policy route that
  this legal notice page links to for personal-data details.

External legal baseline used for this spec:

- French public guidance says professional websites must make mandatory legal
  notices easy to access and identify the company, registration, contact, VAT
  number when applicable, and hosting provider:
  https://entreprendre.service-public.gouv.fr/vosdroits/F37351
- French economy ministry guidance says the legal notice page must include
  hosting information even when hosting is free, including host name, legal
  identity, address, and phone number:
  https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter
- CNIL guidance for online communication says a showcase site should include a
  rights contact, legal notices identifying the site publisher, and appropriate
  personal-data information:
  https://www.cnil.fr/fr/rgpd-en-pratique-communiquer-en-ligne
- Current Vercel public legal contact information is listed by Vercel at:
  https://vercel.com/legal/privacy-policy
- The current separate Shopify storefront legal notice was confirmed by MOBEL
  UNIQUE as the approved source for publisher identity, publisher contact, and
  publication director details:
  https://www.mobelunique.fr/pages/les-mentions-legales

This spec is accepted with these legal notice decisions:

- The publisher legal company name is `SARL MOBILIER & ART`.
- The public trading name is `MOBEL UNIQUE`.
- The legal form is `SARL`.
- The registered office address is `8 Rue Danielle Casanova, 95100 Argenteuil,
  France`.
- The share capital is `1000 euros`.
- The registration is `RCS Pontoise 943 675 579`.
- The SIREN is `943 675 579`; no SIRET is approved for display by this spec.
- No VAT number is approved for display by this spec because the confirmed
  Shopify storefront legal notice does not publish one. A later change request
  must add it if MOBEL UNIQUE confirms that it is required.
- The public legal contact email is `aide.mobelunique@gmail.com`.
- The public phone number is `+33 6 58 93 61 06`.
- The publication director is `Abdul Dzhabrailov`.
- The privacy pointer must link to `/politique-de-confidentialite`, because
  `SPEC-0018` is accepted and `PLAN-0077` implemented that route.
- The Shopify storefront legal notice lists `Automattic Inc.` as the storefront
  host for `mobelunique.fr`. This value must not be copied as the hosting
  provider for this application while `SPEC-0001` defines `apps/web` as deployed
  to Vercel.
- The hosting provider for this application is `Vercel Inc.` with public address
  `440 N Barranca Avenue #4133, Covina, CA 91723, United States`.
- The approved Vercel public contact method is `https://vercel.com/contact`, and
  `privacy@vercel.com` may be used only as Vercel's public privacy/legal contact
  if the implementation plan decides a visible email is needed.

## Goal

Add a short public legal notice page for visitors who need to identify the
publisher and hosting provider of the MOBEL UNIQUE visualization site.

The page must be useful but not broad. It should provide only the legal identity
and contact information normally expected from a French professional website,
while leaving privacy details to the separate privacy policy spec and leaving
commerce terms to the separate Shopify storefront.

## Scope

This spec includes:

- a public legal notice route;
- footer links from public pages to that route;
- required legal notice content for a French company profile;
- a short intellectual-property note;
- a short personal-data pointer to the public privacy policy page;
- implementation acceptance criteria and future test expectations.

## Out Of Scope

This spec does not require:

- changing database schema, storage buckets, RLS policies, API contracts, worker
  behavior, email behavior, or environment variables;
- adding terms of sale, general terms of use, cart terms, checkout terms,
  mediation wording, subscription cancellation wording, or payment terms;
- adding a cookie banner, analytics consent, or Google Consent Mode;
- replacing or duplicating the public privacy policy page;
- changing Shopify pages, Shopify checkout, Shopify legal pages, pricing, cart,
  payment, order handling, stock, customer accounts, or the existing Shopify
  storefront legal notice;
- adding admin-managed CMS behavior for legal content.

Those topics require separate specs or change requests when they are ready.

## Users And Permissions

### Public Visitor

A public visitor can open the legal notice page without authentication.

The page must not require email verification, a simulation access token, a
customer account, or any admin permission.

The page must not expose:

- private storage paths;
- signed URLs;
- simulation access tokens;
- visitor email addresses;
- internal IDs;
- worker errors;
- Supabase keys, bucket names, or table names;
- admin links;
- checkout, cart, order, or account surfaces owned by Shopify.

### Administrator

Administrators do not manage legal notice content in the MVP. The page is
repository-authored content until a later accepted spec adds CMS behavior.

## Public Route And Footer Link

The MVP public site must expose:

| Route | Route Type | Indexing | Purpose |
| --- | --- | --- | --- |
| `/mentions-legales` | Public legal information page | Indexable | Identify the site publisher and hosting provider. |

The footer must include a link labelled `Mentions legales` on:

- the home page footer;
- the shared public shell footer used by catalog, sofa detail, email gate,
  simulation upload, and simulation continuation contexts.

If the implementation uses accented French UI labels, the visible label should
be `Mentions legales` with the final accenting reviewed in the implementation
plan to avoid changing repository spec-language guard behavior.

The footer link must be visually quiet, keyboard-accessible, readable on mobile,
and must not compete with the simulation CTA.

## Page Content Requirements

The visible page content must be in French for visitors. Repository identifiers,
tests, code comments outside `.tsx` rule exceptions, and this spec remain
English.

The page should use short sections, plain wording, and no dense legal prose.

Required visible content:

1. Page title: `Mentions legales`.
2. Site publisher section:
   - legal company name `SARL MOBILIER & ART`;
   - public trading name `MOBEL UNIQUE`;
   - legal form `SARL`;
   - registered office address `8 Rue Danielle Casanova, 95100 Argenteuil,
     France`;
   - share capital `1000 euros`;
   - RCS registration `RCS Pontoise 943 675 579`;
   - SIREN `943 675 579`;
   - public email address `aide.mobelunique@gmail.com`;
   - public phone number `+33 6 58 93 61 06`;
   - no VAT number unless a later accepted change request approves one.
3. Publication director section:
   - publication director `Abdul Dzhabrailov`.
4. Hosting provider section:
   - hosting provider legal name `Vercel Inc.`;
   - hosting provider postal address `440 N Barranca Avenue #4133, Covina, CA
     91723, United States`;
   - public contact method `https://vercel.com/contact`;
   - optional Vercel privacy/legal contact email `privacy@vercel.com` only if
     the implementation plan decides that a visible email is needed;
   - no Shopify storefront host, Automattic host, or Shopify checkout provider
     details for this separate application.
5. Intellectual property section:
   - a short note that the site text, visuals, brand marks, catalog assets, and
     generated public-facing presentation belong to MOBEL UNIQUE or are used
     with authorization;
   - no broad licensing text.
6. Personal data section:
   - one short sentence saying personal-data handling is explained separately;
   - link to `/politique-de-confidentialite`.

## Required Exclusions From Page Copy

The legal notice page must not:

- invent company registration, VAT, address, capital, phone, or director data;
- copy the Shopify storefront hosting provider as the hosting provider for this
  separate application;
- duplicate the full privacy policy;
- promise legal outcomes beyond the confirmed legal notice content;
- describe Shopify checkout privacy or Shopify sales terms as if they were owned
  by this application;
- add CGV, CGU, mediation, subscription cancellation, or payment terms;
- mention private technical systems, private storage paths, signed URLs, queue
  names, provider prompts, service-role credentials, API internals, or worker
  internals;
- expose admin pages or private operational information.

## Data Model

No database changes are required by this spec.

The legal notice content is static repository-authored page content for the MVP.
Any future admin-managed legal CMS or environment-driven legal identity requires
a separate accepted spec or change request.

## API

No API changes are required by this spec.

The page is static or server-rendered public content. It must not call private
simulation status endpoints, admin endpoints, worker functions, Supabase tables,
or Shopify APIs.

## Worker Jobs

No worker behavior changes are required by this spec.

## Environment Variables

No new environment variables are required.

If a later implementation injects legal identity or host information from
environment configuration, that behavior must be specified in the implementation
plan and must preserve DEV and PROD separation.

## Implementation Guidance

Recommended implementation shape:

- create `apps/web/src/app/mentions-legales/page.tsx`;
- keep the page content static and concise;
- use the existing public visual system from `apps/web/src/app/globals.css`;
- add the footer link to both `apps/web/src/app/page.tsx` and
  `apps/web/src/app/PublicShell.tsx`, or extract a tiny shared footer helper if
  the implementation plan chooses to reduce duplication;
- update `.tsx` file comment blocks according to repository rules whenever a
  `.tsx` file is touched;
- add focused tests for the route and footer link before implementation.

The route should have metadata with a French title and description, but metadata
must not include private values, signed URLs, internal IDs, visitor email
addresses, or environment-specific secrets.

## Testing Requirements

A future implementation plan must include focused tests for:

- the home page footer includes a `Mentions legales` link to
  `/mentions-legales`;
- the shared public shell footer includes the same link on catalog and sofa
  detail contexts;
- `/mentions-legales` renders the page title and required concise sections;
- the legal notice page does not render fake placeholder legal data after
  acceptance;
- the legal notice page does not expose admin links, checkout/cart/account UI,
  private paths, signed URLs, Supabase keys, API internals, or worker internals;
- legal notice metadata does not contain private values;
- footer layout remains usable on mobile and keyboard-accessible.

Recommended checks after implementation:

```bash
pnpm --filter @mobel-unique/web test -- page catalog/page sofas/[slug]/page mentions-legales
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

## Acceptance Criteria

- A legal notice page route is defined as `/mentions-legales`.
- The footer link label is defined as `Mentions legales`.
- The footer link is required on home and shared public-shell pages.
- The page content is French, concise, and focused on identifying the site
  publisher and hosting provider.
- The page uses the accepted publisher identity, publisher contact, publication
  director, and Vercel hosting-provider details from this spec.
- The page treats the existing Shopify storefront legal notice as a source for
  business identity details only, not as the application hosting provider.
- The page includes only a short personal-data pointer to
  `/politique-de-confidentialite` and does not duplicate the privacy policy.
- The page does not describe Shopify checkout, payments, customer accounts, or
  sales terms as if they were owned by this application.
- The page avoids private implementation details and secrets.
- No database, API, worker, environment, analytics, cookie-banner, or Shopify
  changes are approved by this spec.
- Future implementation tests must cover route rendering, footer navigation,
  required legal notice topics, and absence of private technical details.

## Open Questions

- None.
