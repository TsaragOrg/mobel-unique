# CR-SPEC-0006 Fabric Render WebP Input And Resolve Failure Persistence

Target spec ids: SPEC-0006, SPEC-0009, SPEC-0010, SPEC-0013
Status: accepted
Implementation Plans: PLAN-0060

## Reason For Change

The admin upload flow accepts `image/webp` for private fabric AI reference
images, source photos, and manual render inputs. The storage policy also allows
`image/webp` in the catalog private bucket.

During local admin render generation, the fabric render worker rejected a valid
fabric AI reference asset before provider execution:

```text
fabric reference asset content type is unsupported: image/webp
```

That failure happened inside `fabric_render_worker_resolve_inputs`, before the
Edge Function entered the job-processing `try/catch`. As a result, the claimed
job stayed in `processing` until `claim_expires_at` instead of immediately
persisting the real failure reason in `fabric_render_jobs.last_error_message`.

## Proposed Change

- Fabric render worker input validation must accept `image/webp` for private
  input assets alongside JPEG and PNG.
- Any error after a job is successfully claimed, including input-resolution
  errors before provider execution, must call `fabric_render_worker_fail` so the
  job records the real error message and frees capacity for the next queued job.
- The pump chain must continue after a claimed job fails during input
  resolution.

## Impact

- Database: update the worker input validation helper to allow WebP.
- Worker: move input resolution into the claimed-job failure boundary.
- Admin UI: no direct UI contract change, but failed cells will receive a real
  `last_error_message` instead of a later generic claim-expired message.
- Public frontend: no impact.

## Approval Note

Accepted after local admin generation showed a WebP fabric reference failing
before the worker could persist the real failure reason.
