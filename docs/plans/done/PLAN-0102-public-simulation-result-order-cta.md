# PLAN-0102 Public Simulation Result Order CTA

Plan: PLAN-0102
Spec: SPEC-0015
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `docs/specs`
- `docs/roadmap`

## Goal

Add a conditional order CTA to the successful public in-home simulation result
screen so visitors can continue directly to the same Shopify purchase URL shown
on the sofa detail page.

## Tasks

- [x] Write a failing `Screen5Result` component test proving a valid order URL
      shows a `Commander` link with `public-secondary-link`.
- [x] Write a failing `Screen5Result` component test proving a missing or
      invalid order URL does not show the order CTA.
- [x] Write a failing continuation test proving the result page passes the
      session-scoped order URL from the simulation context into Screen 5.
- [x] Write a failing wizard-entry test proving job context stashes the loaded
      sofa's `shopify_order_url` after job creation.
- [x] Extend `SimulationJobContext` with an optional `shopifyOrderUrl` field
      while keeping existing stored contexts readable.
- [x] Stash `detail.sofa.shopify_order_url` when Screen 1 creates a job.
- [x] Pass `context.shopifyOrderUrl` from the continuation route to Screen 5.
- [x] Render the `Commander` link in Screen 5 only for valid `http` or `https`
      URLs.
- [x] Keep the existing regeneration, download, and back-to-sofa actions
      unchanged.
- [x] Add the required RU/FR beginner comments to any touched `.tsx` files.
- [x] Update `docs/roadmap/web.md` when implementation is complete.
- [x] Run focused web tests for Screen 5, wizard entry, continuation, and job
      context behavior.
- [x] Run `pnpm --filter @mobel-unique/web typecheck`.
- [x] Run `pnpm spec:check`.

## Tests

- `pnpm --filter @mobel-unique/web test -- src/components/simulation/__tests__/Screen5Result.test.tsx`
- `pnpm --filter @mobel-unique/web test -- "src/app/sofas/[slug]/simulate/PublicSimulationWizardEntry.test.tsx"`
- `pnpm --filter @mobel-unique/web test -- "src/app/simulations/[simulation_job_id]/PublicSimulationContinuation.test.tsx"`
- `pnpm --filter @mobel-unique/web typecheck`
- `pnpm spec:check`

## Roadmap

- `docs/roadmap/web.md`

## Notes

- No API, database, Supabase function, worker, cart, checkout, payment, or
  analytics changes are part of this plan.
- The URL is public product data already returned to the sofa detail page.
  It remains browser-scoped display context and is not written to simulation
  job records.

## Closure Notes

Screen 5 now shows `Commander` as a `public-secondary-link` after a successful
simulation when the session-scoped job context contains a valid `http` or
`https` Shopify order URL. The wizard entry stashes the sofa detail
`shopify_order_url` with the job display context, the continuation page passes
it to the result screen, invalid URLs remain hidden, and the existing
regeneration, download, and back-to-sofa actions remain in place.
