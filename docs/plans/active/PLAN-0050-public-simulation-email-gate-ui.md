# PLAN-0050 Public Simulation Email Gate UI

Plan: PLAN-0050
Spec: SPEC-0015
Status: active
Owner area: web
Affected packages:

- `apps/web/src/app/sofas/[slug]/simulate/start/page.tsx` (new)
- `apps/web/src/app/sofas/[slug]/simulate/start/PublicSimulationEmailGate.tsx` (new)
- `apps/web/src/components/simulation/EmailGateForm.tsx` (new)
- `apps/web/src/components/simulation/__tests__/EmailGateForm.test.tsx` (new)
- `apps/web/src/lib/simulation-client/auth.ts` (new — request/verify helpers)
- `apps/web/src/lib/simulation-client/auth.test.ts` (new)
- `apps/web/src/lib/simulation-client/locale.ts` (extend with screen0EmailGate copy)
- `apps/web/src/app/sofas/[slug]/PublicSofaDetailPage.tsx` (rewire CTA to /start)
- `docs/roadmap/web.md`

## Goal

Ship the customer-facing email gate at `/sofas/[slug]/simulate/start`
so visitors can mint the `simulation_access_token` cookie via the
SPEC-0015 email-verification stub before reaching the wizard. After
this plan, the existing wizard from PLAN-0041 is reachable end to end
from a fresh browser session.

The plan does not change the stub backend behavior. It consumes the
`POST /api/public/simulation/email-verifications` and
`POST /api/public/simulation/email-verifications/{id}/verify`
endpoints already shipped in PLAN-0040. The catalog owner replaces
the stub bodies with real verification later; this UI stays.

## Tasks

### Locale

- [ ] Extend `simulation-client/locale.ts` with a `screen0EmailGate`
      block: title, instruction, email field label, consent checkbox
      labels (with `// TODO: FR native review` markers — these carry
      legal weight), submit button copy, code-step instruction, code
      field label, verify button copy, error wording for invalid
      payload, expired verification, and rate-limited responses.

### Client helpers

- [ ] Add `simulation-client/auth.ts` with two helpers:
      `requestSimulationVerification({ email, consentEmailUse,
      consentMarketing })` and
      `verifySimulationCode({ verificationRequestId, code })`. Both
      use `fetch` with `credentials: "include"`, return a typed
      success/failure outcome, and surface server error codes.
- [ ] Unit tests for both helpers covering success, server error
      codes, and network failure.

### Form component

- [ ] Add `EmailGateForm.tsx` two-step component: step 1 collects
      email + consent checkboxes, step 2 collects 6-digit code. Uses
      injected helpers so tests can drive deterministic outcomes.
- [ ] Component tests cover: step 1 disables Continue until email is
      valid and `consent_email_use` is checked, step 1 surfaces
      server errors inline, step 2 disables Verify until 6 digits are
      entered, step 2 surfaces server errors inline (invalid,
      expired, rate-limited), success notifies the parent with the
      verified email so the parent can redirect.

### Route

- [ ] Add `/sofas/[slug]/simulate/start/page.tsx` Server Component
      awaiting params, handing off to a Client Component that wraps
      `EmailGateForm` in `PublicShell`, owns the redirect to
      `/sofas/[slug]/simulate` on success, and shows a "Retour au
      canapé" link.
- [ ] Update `PublicSofaDetailPage.tsx` so the "Lancer ma simulation"
      CTA points at `/sofas/[slug]/simulate/start` instead of
      `/sofas/[slug]/simulate`.

### Cross-cutting

- [ ] Update `docs/roadmap/web.md`.
- [ ] Run `pnpm typecheck`, `pnpm test`, `pnpm spec:check`,
      `pnpm build`.

## Tests

- Unit tests for `auth.ts` helpers.
- Component tests for `EmailGateForm`.
- Wizard route tests already exist (PLAN-0041) and remain untouched.

## Follow-up fixes

- 2026-05-03 — `auth.ts` was parsing the verification responses as if
  `verification_request_id` and `simulation_access_token` sat at the
  top level, but every public simulation route handler wraps success
  payloads in a `{ data: ... }` envelope. The mismatch made both
  helpers return `INTERNAL_ERROR` even when the server returned 200,
  surfacing in the EmailGateForm as the generic
  "La vérification n'a pas abouti" wording. Helpers now read
  `envelope.data.<field>`; unit tests were updated to pass the
  wrapped payload so the fix cannot regress.

## Roadmap

- `docs/roadmap/web.md`

## Notes

- All visible copy is French with `// TODO: FR native review` markers
  on consent and on error wording that quotes legal terms (consent,
  retention reference if any). No new strings are introduced outside
  the locale module.
- The HTTP-only cookie set by the verify endpoint is invisible to JS,
  so the gate cannot detect whether the visitor is already verified
  on mount. The first launch always routes through the gate; PLAN-0042
  may revisit this with a small "is_verified" companion cookie if UX
  feedback requires it.
- The CTA on the public sofa detail page changes from `/simulate` to
  `/simulate/start`. Visitors who deep-link directly to `/simulate`
  still reach Screen 1 — Screen 1 will fail the upload with the
  AUTH_REQUIRED error code from the API, which Screen 6 already
  surfaces gracefully. PLAN-0042 may add an inline "verify first"
  hint to the wizard entry if telemetry shows direct hits there.
- This plan does not touch the production worker or migrations.
