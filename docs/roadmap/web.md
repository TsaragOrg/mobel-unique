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

## Next

- Implement PLAN-0044 admin interface visual system and harmonize protected admin pages in phases: shell, login/dashboard, lists, forms, sofa edit workflow, drawers, and render matrix.
  Progress: shared admin shell now covers login, dashboard, and protected catalog pages; sofa, fabric, and tag list headers use the shared page header pattern.
  Form progress: sofa create, fabric create, and fabric edit pages now use the shared header and form spacing pattern while preserving existing mutation and upload behavior.
  Sofa edit progress: the sofa edit workflow now uses the shared admin header while preserving workflow tabs and readiness signals.
  Panel progress: sofa edit tabs, readiness chips, panel borders, render matrix controls, fabric cards, and drawer/dialog surfaces now use admin design tokens.
  Overlay progress: admin drawers, confirmation dialogs, image previews, lightboxes, compare dialogs, desktop render matrix, and mobile render sheets now share the same neutral token system.
- Build public catalog and sofa detail pages on top of the public catalog read API.
- Build admin export workflows on top of the authenticated admin boundary.
- Build the public simulation wizard after the storefront read path.
