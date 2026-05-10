# SPEC-0018 Public Privacy Policy Page

Spec: SPEC-0018
Status: accepted
Layer: cross-cutting
Parent Spec: SPEC-0003
Depends On: SPEC-0003, SPEC-0004, SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0015
Areas: web
Implementation Plans: PLAN-0077

## Traceability

`SPEC-0003 Business Context - AI Sofa Visualization` defines privacy by
default, temporary retention for visitor room photos and generated simulation
outputs, and the need for a future privacy, retention, and abuse protection
spec.

`SPEC-0012 Public Frontend Experience And Page Flows` defines the public shell
and explicitly defers final footer legal links to privacy and operations specs.
This spec supplies the public privacy policy page and footer link needed for
that deferred public-site requirement.

This spec follows:

- `SPEC-0004`, which requires French public visitor copy, privacy messaging
  before simulation, and conservative analytics consent behavior;
- `SPEC-0007`, which defines private in-home simulation artifacts, the
  24-hour retention maximum, and purge behavior;
- `SPEC-0009`, which defines private/public storage boundaries, consent
  records, verification data, simulation sessions, and operational metadata;
- `SPEC-0010`, which defines public API contracts, signed URL boundaries,
  email verification, consent capture, and cleanup responsibilities;
- `SPEC-0015`, which defines the launch-test simulation flow, stub email
  verification state, 24-hour access token lifetime, download behavior, and
  visitor-safe private artifact handling.

External legal baseline used for this spec:

- CNIL guidance says privacy information should cover the data controller,
  purposes, legal basis, required or optional data, recipients, retention,
  security, transfers or automated decisions when relevant, and user rights:
  https://www.cnil.fr/fr/donnees-personnelles
- CNIL guidance says personal data cannot be kept indefinitely and the
  retention duration must be tied to the purpose of collection:
  https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- CNIL rights guidance lists information, objection, access, rectification,
  erasure, portability, human intervention, and restriction rights:
  https://www.cnil.fr/fr/mes-demarches/les-droits-pour-maitriser-vos-donnees-personnelles

This spec is accepted with these privacy decisions:

- the public privacy contact is `mobel.unique.it@gmail.com`;
- the privacy page uses a generic privacy contact role and does not claim a
  data protection officer;
- analytics tracking is not part of the MVP and must not be described as active;
- required simulation data is used only to provide the visitor-requested
  visualization experience and protect access to the result;
- lightweight operational metadata and anti-abuse data are used under MÖBEL
  UNIQUE's legitimate interest to run, secure, and troubleshoot the MVP service;
- optional commercial contact is based only on the visitor's consent.

## Goal

Add a concise public privacy policy page for visitors who browse the MÖBEL
UNIQUE visualization site or run an in-home sofa simulation.

The page must make the privacy posture understandable without becoming a long
legal document. It should explain only what a visitor needs to know for the MVP:
what is collected, why it is used, how long private simulation images are kept,
who can access them, how optional contact differs from required verification,
and how the visitor can exercise their rights.

## Scope

This spec includes:

- a new public privacy route;
- a footer link from public pages to that route;
- required content topics for the privacy page;
- public/private data boundary messaging;
- retention messaging for room photos, intermediate files, and generated
  simulation outputs;
- the approved public privacy contact and legal-basis wording;
- implementation acceptance criteria and future test expectations.

## Out Of Scope

This spec does not require:

- changing database schema, storage buckets, RLS policies, cleanup jobs, API
  contracts, worker behavior, or email provider behavior;
- adding a consent banner;
- adding Google Analytics, Google Consent Mode, or analytics persistence;
- adding a self-service deletion request form;
- adding customer accounts, saved galleries, public sharing links, or long-term
  customer history;
- changing admin pages;
- changing Shopify pages or Shopify checkout;
- writing a full legal notice, terms of sale, cookie policy, or company imprint
  page.

Those topics require separate specs or change requests when they are ready.

## Users And Permissions

### Public Visitor

A public visitor can open the privacy policy page without authentication.

The page must not require email verification, a simulation access token, a
customer account, or any admin permission.

The page must not expose:

- private storage paths;
- signed URLs;
- simulation access tokens;
- visitor or customer email addresses other than the approved public privacy
  contact;
- internal IDs;
- provider names or prompts beyond already public product-level AI messaging;
- worker errors;
- Supabase keys or bucket names;
- admin links.

### Administrator

Administrators do not manage the privacy policy content in the MVP. The page is
repository-authored content until a later accepted spec adds CMS behavior.

## Public Route And Footer Link

The MVP public site must expose:

| Route | Route Type | Indexing | Purpose |
| --- | --- | --- | --- |
| `/politique-de-confidentialite` | Public legal information page | Indexable | Explain the MVP privacy handling for browsing and in-home simulation. |

The footer must include a link labelled `Politique de confidentialité` on:

- the home page footer;
- the shared public shell footer used by catalog, sofa detail, email gate,
  simulation upload, and simulation continuation contexts.

The footer link must be visually quiet and must not compete with the simulation
CTA. It must remain keyboard-accessible and readable on mobile.

## Page Content Requirements

The page must be in French for visitors. Repository identifiers, tests, and this
spec remain English.

The page should use short sections, plain wording, and no dense legal prose.
The implementation should avoid long paragraphs and avoid explaining internal
systems that visitors do not need to know.

Required visible content:

1. Page title: `Politique de confidentialité`.
2. A short introduction saying the site helps visitors visualize a MÖBEL UNIQUE
   sofa at home and uses personal data only for this limited experience.
3. Data collected while browsing:
   - basic technical data needed to load the site;
   - no analytics tracking or persistent public catalog interaction tracking in
     the MVP;
   - no customer account is required for browsing.
4. Data collected for simulation:
   - email address for simulation verification, anti-abuse, and operational
     follow-up;
   - required email-use consent;
   - optional commercial contact consent, only when the visitor accepts it;
   - uploaded room photo;
   - generated guide image and generated simulation result;
   - temporary simulation access cookie or equivalent browser session;
   - minimal operational metadata such as selected sofa, selected fabric,
     selected visual position, job status, timestamps, failure state, and usage
     counters.
5. Purpose:
   - run the requested in-home simulation;
   - show the generated result in the visitor's browser;
   - limit abuse and repeated generation;
   - keep enough operational metadata to troubleshoot the MVP service;
   - contact the visitor commercially only when optional consent is granted.
6. Legal basis wording:
   - required email verification, uploaded room photo handling, generated guide
     image handling, and generated result handling must be described as needed
     to provide the visualization requested by the visitor and to protect access
     to the result;
   - lightweight operational metadata, troubleshooting data, and anti-abuse data
     must be described as needed for MÖBEL UNIQUE's legitimate interest in
     running, securing, and improving the MVP service;
   - optional commercial contact must be described as based only on the
     visitor's consent and optional for running the simulation.
7. Retention:
   - room photos, intermediate images, guide images, and generated results are
     private and deleted no later than 24 hours after creation;
   - abandoned simulations are also purged at the retention deadline;
   - after purge, the system may keep lightweight operational metadata without
     usable private image paths or image content;
   - temporary access cookies or equivalent browser state expire within the
     simulation retention window.
8. Access and sharing:
   - private simulation images are not public catalog assets;
   - the MVP has no public gallery, public sharing link, or customer account;
   - generated result access is limited to the current verified visitor session
     while the result is retained;
   - administrators may use operational metadata, but the MVP must not create a
     default gallery of visitor interiors.
9. Service providers:
   - the page may state that trusted technical providers process data only to
     host the site, store private simulation artifacts, send verification
     emails when real email delivery is implemented, and generate the requested
     AI visualization;
   - the page must identify MÖBEL UNIQUE in plain language as the site owner
     responsible for the visitor experience and privacy contact;
   - the page must not list secrets, internal bucket names, private endpoints,
     or raw provider configuration.
10. Visitor rights and contact:
   - visitors can ask about their data and exercise applicable rights such as
     access, correction, deletion, objection, restriction, and portability;
   - the page must show `mobel.unique.it@gmail.com` as the public privacy
     contact;
   - the page must use a generic privacy contact role and must not mention a
     data protection officer unless a later accepted spec confirms one;
   - the page may mention that visitors can contact the French data protection
     authority if applicable after MÖBEL UNIQUE confirms final legal wording.

## Required Exclusions From Page Copy

The privacy page must not:

- promise that screenshots or browser-level extraction are impossible;
- promise long-term storage, personal galleries, or future marketing reuse;
- claim that private images are used to train models unless a later accepted
  spec explicitly approves and documents that behavior;
- describe Shopify checkout privacy, because Shopify remains a separate
  commercial destination;
- expose private storage paths, signed URLs, object prefixes, queue names,
  provider prompts, service-role credentials, API internals, or worker internals;
- add broad legal text unrelated to the MVP visualization flow.

## Data Model

No database changes are required by this spec.

The privacy page must describe existing and already-specified MVP data classes:

- email verification requests;
- consent records;
- simulation sessions;
- in-home simulation jobs;
- private simulation artifacts;
- generated output metadata;
- rate-limit counters;
- lightweight operational metadata.

Any future change to consent storage, analytics consent persistence, deletion
request tracking, or longer retention requires a separate accepted spec or
change request.

## API

No API changes are required by this spec.

The page is static or server-rendered public content. It must not call private
simulation status endpoints, admin endpoints, worker functions, or Supabase
tables.

## Worker Jobs

No worker behavior changes are required by this spec.

The page must reflect the accepted worker behavior that private room photos,
intermediate artifacts, guide images, and generated results are purged no later
than the 24-hour MVP retention deadline.

## Environment Variables

No new environment variables are required.

The approved public privacy contact, `mobel.unique.it@gmail.com`, should be
repository-authored page copy for the MVP. If a later implementation chooses to
inject the public privacy contact from environment configuration, that must be
specified in the implementation plan and kept separate between DEV and PROD.

## Implementation Guidance

Recommended implementation shape:

- create `apps/web/src/app/politique-de-confidentialite/page.tsx`;
- keep the page content static and concise;
- use the existing public visual system from `apps/web/src/app/globals.css`;
- add the footer link to both `apps/web/src/app/page.tsx` and
  `apps/web/src/app/PublicShell.tsx`, or extract a tiny shared footer helper if
  the implementation plan chooses to reduce duplication;
- update `.tsx` file comment blocks according to repository rules whenever a
  `.tsx` file is touched;
- add focused tests for the route and footer link before implementation.

The route should have metadata with French title and description, but metadata
must not include private values, signed URLs, internal IDs, email addresses, or
environment-specific secrets.

## Testing Requirements

A future implementation plan must include focused tests for:

- the home page footer includes a `Politique de confidentialité` link to
  `/politique-de-confidentialite`;
- the shared public shell footer includes the same link on catalog and sofa
  detail contexts;
- `/politique-de-confidentialite` renders the page title and the concise
  required sections;
- the privacy page states the 24-hour retention maximum for private simulation
  images;
- the privacy page distinguishes required email verification from optional
  commercial contact;
- the privacy page does not expose admin links, private paths, signed URLs,
  Supabase keys, API internals, cart, checkout, account UI, or customer gallery
  promises;
- privacy page metadata does not contain private values;
- footer layout remains usable on mobile and keyboard-accessible.

Recommended checks after implementation:

```bash
pnpm --filter @mobel-unique/web test -- page catalog/page sofas/[slug]/page politique-de-confidentialite
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

## Acceptance Criteria

- A privacy page route is defined as `/politique-de-confidentialite`.
- The footer link label is defined as `Politique de confidentialité`.
- The footer link is required on home and shared public-shell pages.
- The page content is French, concise, and focused on the MVP visualization
  flow.
- The page explains browsing data at a high level without implying customer
  accounts, active analytics, or ecommerce tracking.
- The page explains simulation data: email, required consent, optional
  commercial contact consent, room photo, generated guide/result, temporary
  access state, and operational metadata.
- The page includes the approved public privacy contact:
  `mobel.unique.it@gmail.com`.
- The page uses a generic privacy contact role and does not claim a data
  protection officer.
- The page uses the approved legal-basis wording: visitor-requested
  visualization for required simulation processing, legitimate interest for
  operational metadata and anti-abuse, and consent for optional commercial
  contact.
- The page states that private simulation images are deleted no later than
  24 hours after creation.
- The page states that generated simulation images remain private and are not
  public catalog assets.
- The page states that the MVP has no public gallery, public sharing link, or
  customer account.
- The page avoids private implementation details and secrets.
- The page does not describe analytics as active in the MVP.
- The page does not describe Shopify checkout privacy as if Shopify were owned
  by this application.
- No database, API, worker, environment, analytics, or consent-banner changes
  are approved by this spec.
- Future implementation tests must cover route rendering, footer navigation,
  required privacy topics, and absence of private technical details.

## Open Questions

- None.
