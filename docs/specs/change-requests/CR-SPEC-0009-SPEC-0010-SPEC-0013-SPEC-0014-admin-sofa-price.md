# CR-SPEC-0009-SPEC-0010-SPEC-0013-SPEC-0014 Admin Sofa Price

Target specs: SPEC-0009, SPEC-0010, SPEC-0013, SPEC-0014
Status: accepted
Layer: feature
Parent Spec: SPEC-0014
Depends On: SPEC-0005, SPEC-0009, SPEC-0010, SPEC-0011, SPEC-0013, SPEC-0014
Areas: web, supabase
Implementation Plans: PLAN-0065

## Reason

Administrators need to record a sofa price during the Sofa basics step. The
price must travel with the sofa through the admin API and public read model so
published sofa detail pages can show the same whole-euro price used on the
client's storefront.

## Proposed Change

- Add optional sofa price storage as positive integer cents with fixed `EUR`
  currency.
- Let admins enter only whole euro values in Sofa basics.
- Show the price on the protected admin sofa list when present, or `Price not
  entered` when absent.
- Expose public price as `{ amount_cents, currency } | null` from public catalog
  and sofa detail APIs.
- Show the public sofa detail price as whole euros, for example `1 299 €`.
- Do not block publication when price is absent; the missing-price message is
  informational admin copy only.

## Impact

- Database: `public.sofas` gains price columns and the public catalog sofa view
  exposes them.
- Admin API: sofa create, update, list, and get responses accept and return the
  new price fields.
- Public API: catalog and sofa detail responses include `price`.
- Admin UI: Sofa basics and sofa list show price information.
- Public UI: sofa detail page shows the formatted price when available.
- Worker behavior, storage buckets, auth boundaries, and render publication
  asset behavior are unchanged.

## Approval Note

Accepted for PLAN-0065 after product discussion confirmed that the customer
storefront uses whole-euro prices, while internal storage should remain safe for
money and future integrations.
