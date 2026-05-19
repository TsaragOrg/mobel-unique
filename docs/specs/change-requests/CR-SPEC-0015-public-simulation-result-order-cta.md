# CR-SPEC-0015 Public Simulation Result Order CTA

Target spec ids: SPEC-0015
Related spec ids: SPEC-0012
Status: accepted
Implementation Plans: PLAN-0102

## Reason For Change

After a visitor completes an in-home simulation, the result screen should let
them continue directly to purchase for the simulated sofa when the public sofa
has a valid Shopify order URL. The existing `SPEC-0015` result screen only
returns the visitor to the sofa detail page, which adds an unnecessary step
after the visitor has already confirmed interest through the simulation.

## Proposed Change

Screen 5 may include a secondary "Commander" order CTA that links to the same
valid Shopify order URL used by the public sofa detail page. The CTA must use
the public secondary link styling and must only appear when the current
simulation context includes a valid `http` or `https` order URL. If no valid
order URL is available, the result screen keeps the existing regeneration,
download, and back-to-sofa actions.

The simulation status API, database, Supabase worker, and private artifact
handling do not change. The order URL is carried in the browser's
session-scoped simulation display context that is already created after the
visitor starts a job from the sofa detail flow.

## Acceptance Criteria

- Screen 5 shows a `Commander` CTA after a successful simulation when the
  simulated sofa has a valid Shopify order URL.
- The CTA uses the `public-secondary-link` class.
- The CTA points to the same order URL that appears on the public sofa detail
  page.
- Screen 5 does not show the order CTA when the URL is missing or invalid.
- Existing result actions remain available: regeneration when permitted,
  controlled image download, and back-to-sofa navigation.
- No signed simulation URL, private storage path, token, checkout state, cart
  state, or payment state is exposed or added.

## Impact

- UI: Screen 5 gains one conditional secondary link.
- Client storage: the session-scoped simulation display context may include the
  public Shopify order URL.
- API/database/worker: no change.
- Tests: component and continuation coverage must prove the CTA appears only
  for a valid order URL and uses the expected class.
- Roadmap: web roadmap records the shipped result-screen order CTA.

## Approval Note

Accepted from the direct product request on 2026-05-18 to reduce friction after
successful in-home simulation.
