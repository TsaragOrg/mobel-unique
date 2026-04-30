# API Roadmap

## Current

| Status | Spec      | Plan      | Work                                                                                                                        |
| ------ | --------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
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

## Next

- Add authenticated admin export endpoint implementations behind the established admin boundary.
- Build the public simulation email verification and job-creation API after the storefront read path.
- Define remaining server-to-server authorization for internal and worker-only APIs.
