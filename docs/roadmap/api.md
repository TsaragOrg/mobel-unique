# API Roadmap

## Current

| Status | Spec      | Plan      | Work                                                                                                                        |
| ------ | --------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Done   | SPEC-0006 | PLAN-0074 | Admin fabric render resume now accepts a selected `render_cell_id`, returns the preferred job details, rejects cells without queued work, and reports same-sofa processing conflicts with a visible admin-safe error. |
| Active | SPEC-0007 | PLAN-0068 | Remaining public simulation API work is to validate delayed-dispatch responses, Realtime fallback behavior, and recovery-edge cases without exposing dispatch ids or worker internals. |
| Done   | SPEC-0007 | PLAN-0068 | Public simulation create, dimensions, and regeneration handlers now call dispatch-outbox RPCs and no longer invoke the in-home worker from the request path; web environment documentation no longer requires in-home worker URL, invoke secret, or pump timeout variables. |
| Done   | SPEC-0007 | PLAN-0068 | Public simulation create, dimensions, and regeneration handlers now use checkpoint-pump RPCs and invoke the in-home worker pump as best effort after durable state is persisted; legacy pgmq enqueue is no longer part of the public create path. |
| Done   | SPEC-0007 | PLAN-0068 | Public simulation Realtime token endpoint issues short-lived Supabase Realtime JWTs only after the simulation access token is authorized for the requested job, keeping progress subscriptions scoped to one job/session pair. |
| Done   | SPEC-0001 | PLAN-0001 | Minimal Express API foundation and health endpoint.                                                                         |
| Done   | SPEC-0008 | PLAN-0008 | Local API environment examples align with local Supabase worker development.                                                |
| Done   | SPEC-0011 | PLAN-0011 | First-party Next.js admin API facade for session validation with canonical admin claim and trusted device checks.           |
| Done   | SPEC-0010 | PLAN-0016 | Authenticated admin catalog API foundation for draft sofas, tags, and publication readiness through the first-party facade. |
| Done   | SPEC-0013 | PLAN-0018 | Admin fabric upload, fabric CRUD/archive, and sofa fabric assignment endpoints through the first-party facade.              |
| Done   | SPEC-0013 | PLAN-0019 | Admin visual matrix, source photo upload, render coverage, and initial fabric render job endpoints.                         |
| Done   | SPEC-0013 | PLAN-0021 | Admin candidate listing, current render selection, and manual render attachment endpoints.                                  |
| Done   | SPEC-0013 | PLAN-0023 | Source photo upload completion synchronizes the matching render cell and blocks redundant initial generation.               |
| Done   | SPEC-0010 | PLAN-0024 | Public catalog, public tags, and public sofa detail read endpoints for published public-usable sofas.                       |
| Done   | SPEC-0010 | PLAN-0029 | Authenticated admin publication and unpublication endpoints create and clear public render asset references.                |
| Done   | SPEC-0006 | PLAN-0030 | Admin fabric render job creation accepts initial prompt notes and validated refine jobs from private candidates.            |
| Done | SPEC-0006 | PLAN-0031 | Manual fabric render pump invocation endpoints, generate-all, resume, and shared `request_id` orchestration.                |
| Done | SPEC-0014 | PLAN-0035 | Admin fabric and source photo responses expose safe preview URLs without storage object paths.                            |
| Done | SPEC-0010 | PLAN-0051 | Authenticated admin render export endpoints create private ZIP artifacts and return short-lived signed download URLs.      |

## Next

- Finish authenticated admin export endpoint implementations behind the established admin boundary.
- Build the public simulation email verification and job-creation API after the storefront read path.
- Define remaining server-to-server authorization for internal and worker-only APIs.
