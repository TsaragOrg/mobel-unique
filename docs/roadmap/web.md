# Web Roadmap

## Current

| Status | Spec      | Plan      | Work                                                                                                                 |
| ------ | --------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| Done   | SPEC-0001 | PLAN-0001 | Minimal Next.js frontend foundation.                                                                                 |
| Done   | SPEC-0008 | PLAN-0008 | Local web environment examples align with local Supabase worker development.                                         |
| Done   | SPEC-0011 | PLAN-0011 | Admin Supabase Auth login, protected dashboard, trusted device state, logout, and first-party admin session facade.  |
| Done   | SPEC-0010 | PLAN-0016 | First-party admin catalog API routes for draft sofas, tags, and publication readiness.                               |
| Done   | SPEC-0013 | PLAN-0017 | Minimal protected admin catalog UI for tags, draft sofa creation, sofa list, metadata edit, and readiness review.    |
| Done   | SPEC-0013 | PLAN-0018 | Protected admin fabric list/create/edit/archive UI and sofa fabric assignment controls.                              |
| Done   | SPEC-0013 | PLAN-0019 | Sofa edit render preparation UI for visual matrix columns, source photos, coverage review, and initial job queueing. |
| Done   | SPEC-0013 | PLAN-0021 | Sofa edit render coverage UI for private candidate review, current render selection, and manual render upload.       |
| Done   | SPEC-0013 | PLAN-0022 | Temporary sofa edit page cleanup for manual testing clarity before final admin design work.                          |
| Done   | SPEC-0013 | PLAN-0023 | Sofa edit render coverage shows source-photo-complete cells and avoids redundant initial generation actions.         |
| Done   | SPEC-0010 | PLAN-0024 | First-party public catalog and sofa detail API routes are available for the public storefront flow.                  |
| Done   | SPEC-0006 | PLAN-0025 | Sofa edit render coverage polls generated job status after Generate so cron-driven worker output appears in admin.   |
| Done   | SPEC-0006 | PLAN-0026 | Admin render job creation no longer owns provider or model selection.                                                |
| Done   | SPEC-0013 | PLAN-0028 | Admin render input uploads resize oversized AI references and source photos before signed upload.                    |
| Done   | SPEC-0010 | PLAN-0029 | Sofa edit publication actions publish selected private render coverage as public catalog assets and unpublish safely. |
| Done   | SPEC-0006 | PLAN-0030 | Sofa edit render coverage sends prompt notes and queues refine jobs from reviewed private candidates.                |
| Done   | SPEC-0012 | PLAN-0025 | Public home page with landscape video hero, minimal public shell, process copy, and catalog CTA.                     |
| Done | SPEC-0012 | PLAN-0043 | Public home page redesigned with a product-first optimized transformation hero, mobile-first layout, upload cue, and benefit strip. |
| Done | SPEC-0006 | PLAN-0031 | Sofa edit render coverage observes request-scoped fabric render jobs through Realtime, fails expired claims, and exposes manual resume. |
| Done | SPEC-0014 | PLAN-0035 | Sofa edit workflow tabs, fabric cards, render coverage matrix, source-photo candidate comparison, on-demand refine controls, large image preview, responsive cell sheet, and Publish-only publication actions. |
| Done | SPEC-0013 | PLAN-0044 | Protected admin interface visual system harmonizes login, dashboard, catalog lists/forms, sofa edit workflow, drawers, render matrix, responsive states, and authenticated visual QA. |
| Done | SPEC-0014 | PLAN-0035 | Sofa edit refreshes publication blockers after render and visual matrix changes without a page reload. |
| Done | SPEC-0014 | PLAN-0045 | Candidate render cells open candidate review directly from the Renders matrix. |
| Done | SPEC-0014 | PLAN-0046 | Candidate photos open source-photo comparison directly without a separate Compare button. |
| Done | SPEC-0014 | PLAN-0047 | Sofa edit prompt notes sit inside the matching Generate candidate action blocks. |
| Active | SPEC-0015 | PLAN-0040 | Public simulation API foundation under `apps/web/src/lib`: `simulation-access-token.ts` (stateless HMAC stub token, HttpOnly+SameSite=Lax cookie, 24h TTL, Authorization-vs-cookie parsing), `simulation-rate-limit.ts` (per-IP and per-email caps with HMAC-salted subject hashing and UTC-midnight window alignment), `simulation-idempotency.ts` (acquire/finalize split for duplicate Idempotency-Key handling), and `simulation-public-api.ts` shared types from SPEC-0015. |
| Active | SPEC-0015 | PLAN-0040 | Public simulation email-verification stub endpoints: `POST /api/public/simulation/email-verifications` and `POST /api/public/simulation/email-verifications/{verification_request_id}/verify` route handlers with the testable `simulation-public-route-handlers.ts` module and the `simulation-public-server.ts` DI factory. Catalog owner replaces the stub bodies later when real verification ships; the SPEC-0010 wire contract (cookie name, response shape, access-token format) stays locked. |
| Active | SPEC-0015 | PLAN-0040 | `GET /api/public/simulations/{simulation_job_id}` route handler with ownership enforcement via `deriveSimulationSessionTokenHash` (Node-side HMAC parity with the SQL `extensions.digest('access_token:<id>', 'sha256')` derivation), 120-second signed URL minting for the `awaiting_dimensions` overlay and the `succeeded` latest output, status-aware response shape (required dimensions per geometry mode, regeneration availability under the three-result cap, last-error surfacing for failed/canceled/regeneration-error states), and Supabase-backed `SimulationJobReader` + `SimulationStorageSigner` factories that wrap the new RPCs and the `simulation-private-artifacts` storage bucket. |
| Active | SPEC-0015 | PLAN-0040 | `POST /api/public/simulations/{simulation_job_id}/dimensions` and `POST /api/public/simulations/{simulation_job_id}/regenerations` route handlers. Dimensions handler ports the worker's `lib/dimensions.ts` validator into a web-side `simulation-dimensions.ts` helper (back_wall and corner shapes, `room_depth` required in both per CR-SPEC-0012, [0.5, 20] m range), enforces ownership + status='awaiting_dimensions', and delegates the atomic transition + pgmq enqueue to the existing `submit_in_home_simulation_dimensions` SQL RPC. Regenerations handler enforces ownership + status='succeeded' + the three-result cap before delegating to the existing `request_in_home_simulation_regeneration` RPC. Both expose a `SIMULATION_QUEUE_NAME`-driven queue for prod parity with the worker. |
| Done | SPEC-0012 | PLAN-0048 | Public catalog and sofa detail pages browse published sofas, filter by public tags, show always-visible catalog fabric controls, contain product imagery without cropping, preserve internal selections, and continue toward the simulation wizard. |

## Next

- Build admin export workflows on top of the authenticated admin boundary.
- Build the public simulation wizard after the storefront read path.
