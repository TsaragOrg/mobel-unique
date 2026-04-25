# CR-SPEC-0003 Visual Matrix And Render Publication Alignment

Target spec id: SPEC-0003
Status: accepted

## Reason For Change

`SPEC-0003` uses the older terms `public view`, `approved public render`, and administrator render validation as business-level language.

During `SPEC-0005 Admin Catalog and Fabric Management` drafting, the product decision changed and clarified the intended MVP behavior:

- administrators prepare sofa visuals through a visual matrix;
- the public UI exposes those matrix columns as selectable visual positions or image options;
- visitors must not see the internal term `visual matrix column`;
- render coverage completeness matters, but the MVP does not need a separate per-render validation state;
- publishing a sofa is the administrator's acceptance that the current visual matrix is customer-ready;
- if a generated render is not good enough, the administrator regenerates that cell or replaces it with a manual upload before publishing.

## Proposed Change

Update `SPEC-0003` terminology and business rules so that:

- `public view` is treated as the visitor-facing name for an admin-managed visual matrix column;
- follow-up specs may use `visual position` publicly and `visual matrix column` internally;
- complete render coverage means every public fabric has a public-usable render for every required visual position;
- manual uploads and AI-generated renders are both valid ways to complete render coverage;
- manual uploads do not need a separate validation step;
- AI-generated renders do not need a separate persistent validation status in the MVP;
- publishing a sofa accepts the current complete visual matrix as customer-ready;
- the MVP does not require `rejected render` status; administrators regenerate or manually replace unsatisfactory generated cells;
- admin ZIP export of sofa render sets remains in MVP;
- archived sofa URL behavior is not changed by this request.

## Impact

- Public specs should use `visual position` for customer-facing image selection.
- Admin specs should use `visual matrix column` for the matrix managed by administrators.
- Render specs should orient the matrix with visual matrix columns as columns and fabrics as rows.
- Data model specs should avoid a mandatory render validation status field for MVP.
- API specs should support upload, generation, regeneration, publication readiness, and ZIP export without requiring approve/reject render endpoints for MVP.
- `SPEC-0003` remains the parent business-context spec; this change request narrows and clarifies terminology without changing Shopify separation, privacy, result email delivery, or archived sofa URL behavior.

## Approval Note

Accepted during `SPEC-0005` drafting to align the parent business-context spec with the visual matrix and publication-as-acceptance model.
