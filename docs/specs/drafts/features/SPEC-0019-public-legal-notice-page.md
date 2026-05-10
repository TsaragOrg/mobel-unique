# SPEC-0019 Public Legal Notice Page

Spec: SPEC-0019
Status: draft
Layer: cross-cutting
Parent Spec: SPEC-0012
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0012
Areas: web
Implementation Plans: none yet

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
  pages, and footer-link need.

External legal baseline used for this draft:

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

This draft must not be accepted until MOBEL UNIQUE confirms the exact legal
publisher details and approves the final hosting-provider contact details.

## Goal

Add a short public legal notice page for visitors who need to identify the
publisher and hosting provider of the MOBEL UNIQUE visualization site.

The page must be useful but not broad. It should provide only the legal identity
and contact information normally expected from a French professional website,
while leaving privacy details to the separate privacy policy spec and leaving
commerce terms to Shopify.

## Scope

This spec includes:

- a public legal notice route;
- footer links from public pages to that route;
- required legal notice content for a French company profile;
- a short intellectual-property note;
- a short personal-data pointer to the future privacy policy page;
- implementation acceptance criteria and future test expectations.

## Out Of Scope

This spec does not require:

- changing database schema, storage buckets, RLS policies, API contracts, worker
  behavior, email behavior, or environment variables;
- adding terms of sale, general terms of use, cart terms, checkout terms,
  mediation wording, subscription cancellation wording, or payment terms;
- adding a cookie banner, analytics consent, or Google Consent Mode;
- replacing or duplicating the future privacy policy page;
- changing Shopify pages, Shopify checkout, Shopify legal pages, pricing, cart,
  payment, order handling, stock, or customer accounts;
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
   - confirmed legal company name;
   - confirmed legal form;
   - confirmed registered office address;
   - confirmed share capital;
   - confirmed RCS registration and SIREN or SIRET number;
   - confirmed VAT number when applicable;
   - confirmed public email address;
   - confirmed public phone number.
3. Publication director section:
   - confirmed publication director name or approved public role.
4. Hosting provider section:
   - hosting provider legal name;
   - hosting provider postal address;
   - hosting provider phone number or an approved public support/contact method
     if the provider does not publish a phone number;
   - Vercel is the expected provider because `apps/web` is deployed to Vercel,
     but the final provider details must be rechecked before acceptance.
5. Intellectual property section:
   - a short note that the site text, visuals, brand marks, catalog assets, and
     generated public-facing presentation belong to MOBEL UNIQUE or are used
     with authorization;
   - no broad licensing text.
6. Personal data section:
   - one short sentence saying personal-data handling is explained separately;
   - link to `/politique-de-confidentialite` only after the privacy policy spec
     is accepted and implemented;
   - if the privacy route is not implemented yet, use a neutral temporary note
     without a broken link.

## Required Exclusions From Page Copy

The legal notice page must not:

- invent company registration, VAT, address, capital, phone, or director data;
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

- A draft legal notice page route is defined as `/mentions-legales`.
- The footer link label is defined as `Mentions legales`.
- The footer link is required on home and shared public-shell pages.
- The page content is French, concise, and focused on identifying the site
  publisher and hosting provider.
- The page uses the French company profile selected for this draft.
- The page requires confirmed publisher details before acceptance.
- The page requires confirmed hosting-provider details before acceptance.
- The page includes only a short personal-data pointer and does not duplicate the
  privacy policy.
- The page does not describe Shopify checkout, payments, customer accounts, or
  sales terms as if they were owned by this application.
- The page avoids private implementation details and secrets.
- No database, API, worker, environment, analytics, cookie-banner, or Shopify
  changes are approved by this spec.
- Future implementation tests must cover route rendering, footer navigation,
  required legal notice topics, and absence of private technical details.

## Open Questions

- What are the confirmed legal company name, legal form, registered office
  address, share capital, RCS registration, SIREN or SIRET number, VAT number,
  public email, and public phone number for the site publisher?
- Who is the confirmed publication director, or what public role should be
  listed if a name should not be shown?
- What exact Vercel hosting address, phone number, and public contact method
  should be used at acceptance time?
- Should the legal notice link to `/politique-de-confidentialite` immediately
  after `SPEC-0018` is implemented, or should both pages be accepted and shipped
  together?
