# Public Simulation Launch Runbook

Plan: PLAN-0042
Spec: SPEC-0015
Last reviewed: 2026-05-11

## Scope

This runbook is the launch checklist for the public in-home simulation flow. It
tracks the final manual validation before first public exposure:

- Supabase Auth email OTP uses a numeric six-digit code, not a magic link.
- The public wizard can complete back-wall and corner simulations in PROD.
- Production worker output remains within tolerance of the validated terminal
  harness output for the same room photo.
- Defensive paths for rate limits, idempotency, regeneration limits, cost cap,
  expiration, and bad room input are verified.
- Rollback steps are known before launch.

Do not store real secrets, email addresses, phone numbers, room photos, signed
URLs, Supabase service-role keys, OpenAI keys, SMTP credentials, or access
tokens in this file.

## Environment Separation

DEV and PROD must stay isolated. Never use DEV Supabase credentials with PROD
Vercel, or PROD Supabase credentials with DEV Vercel.

### Vercel PROD

Required public browser variables:

- `NEXT_PUBLIC_APP_ENV=prod`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Required server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SIMULATION_ACCESS_TOKEN_SECRET`
- `SIMULATION_EMAIL_ENCRYPTION_SECRET`
- `SIMULATION_EMAIL_HASH_SECRET`
- `SIMULATION_RATE_LIMIT_SUBJECT_SALT`
- `SIMULATION_RATE_LIMIT_IP_PER_DAY=3`
- `SIMULATION_RATE_LIMIT_EMAIL_PER_DAY=2`
- `SIMULATION_CORNER_TAG_SLUG`
- `SIMULATION_RETENTION_HOURS=24`
- `IN_HOME_SIMULATION_WORKER_FUNCTION_URL`
- `IN_HOME_SIMULATION_WORKER_INVOKE_SECRET`
- `IN_HOME_SIMULATION_DISPATCH_TRIGGER_TIMEOUT_MS=5000`

### Supabase PROD Edge Functions

The `in-home-simulation-worker` function must be deployed with:

- `APP_ENV=prod`
- `IN_HOME_SIMULATION_PROVIDER_MODE=live`
- `IN_HOME_SIMULATION_WORKER_INVOKE_SECRET`
- `SIMULATION_DAILY_COST_CAP_USD=50`
- `SIMULATION_RETENTION_HOURS=24`
- `OPENAI_FETCH_TIMEOUT_MS=130000`
- `OPENAI_API_KEY`

The `in-home-simulation-purge` function must be deployed with:

- `APP_ENV=prod`
- `IN_HOME_SIMULATION_PURGE_INVOKE_SECRET`
- `PUBLIC_SIMULATION_EMAIL_HANDOFF_PURGE_BATCH_SIZE=500`

Supabase Auth PROD dashboard settings:

- Site URL must be the stable PROD Vercel or custom domain.
- Email OTP length must be 6.
- Email template must use the numeric OTP token, not a magic link.
- SMTP must be configured in PROD separately from DEV.

## Catalog Owner Contract

Corner-mode detection is driven by `SIMULATION_CORNER_TAG_SLUG`. The catalog
owner must confirm the exact public tag slug before launch.

Current placeholder:

- `corner`

Decision record:

| Field | Value |
| ----- | ----- |
| Confirmed slug | Pending catalog-owner confirmation |
| Confirmed by | Pending |
| Decision date | Pending |
| SPEC-0015 Open Questions updated | No |
| Seed re-run against PROD catalog | Pending |

After confirmation:

1. Set `SIMULATION_CORNER_TAG_SLUG` in Vercel PROD.
2. Re-run the simulation test seed with the confirmed slug if test catalog data
   is used.
3. Update SPEC-0015 Open Questions through the accepted-spec change workflow.

Seed command shape:

```bash
SIMULATION_TEST_SEED_ALLOW_NON_LOCAL=1 \
SUPABASE_URL="https://<prod-project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<prod-service-role-key>" \
pnpm seed:simulation-test -- --corner-tag "<confirmed-corner-tag-slug>"
```

## Manual Happy Paths

Record screenshots or links to private launch evidence outside the repository.
Do not commit customer photos or signed URLs.

### Back-Wall Path

| Step | Evidence | Result |
| ---- | -------- | ------ |
| Request OTP and verify email | Pending | Pending |
| Upload real iPhone back-wall room photo | Pending | Pending |
| Confirm room preparation reaches dimensions | Pending | Pending |
| Enter wall width, wall height, and room depth | Pending | Pending |
| Confirm first placement result | Pending | Pending |
| Request one regeneration | Pending | Pending |
| Confirm second result remains visible | Pending | Pending |
| Confirm no signed URL is visible in page text | Pending | Pending |

### Corner Path

| Step | Evidence | Result |
| ---- | -------- | ------ |
| Request OTP and verify email | Pending | Pending |
| Upload real iPhone corner room photo | Pending | Pending |
| Confirm room preparation reaches corner dimensions | Pending | Pending |
| Enter left wall, right wall, room height, and room depth | Pending | Pending |
| Confirm placement result | Pending | Pending |
| Confirm L-shape guidance was visible before upload | Pending | Pending |

## Worker Parity Gate

Production worker output for the same source photo must match the validated
terminal harness output within tolerance. If parity drifts, launch is blocked.

Ahmed runs the live terminal harness. Do not automate these commands from Codex.

Capture package:

- Source room photo identifier stored outside the repository.
- Terminal-harness stage 1 dots image.
- Production worker stage 1 dots image.
- Terminal-harness dimension guide image.
- Production worker dimension guide image.
- Terminal-harness placement output.
- Production worker placement output.
- Notes on acceptable or blocking differences.

Terminal harness command family:

```bash
OPENAI_API_KEY="<openai-key>" \
pnpm sim:live:validate -- --in "<room-photo>" --out "<private-capture-dir>"

OPENAI_API_KEY="<openai-key>" \
pnpm sim:live:clean -- --in "<room-photo>" --out "<private-capture-dir>"

OPENAI_API_KEY="<openai-key>" \
pnpm sim:live:corners -- --in "<clean-room-photo>" --out "<private-capture-dir>"

OPENAI_API_KEY="<openai-key>" \
pnpm sim:live:place -- \
  --room "<clean-room-photo>" \
  --sofa "<prepared-sofa-image>" \
  --out "<private-capture-dir>"
```

Parity result:

| Flow | Evidence location | Result | Reviewer | Date |
| ---- | ----------------- | ------ | -------- | ---- |
| Back wall | Pending | Pending | Pending | Pending |
| Corner | Pending | Pending | Pending | Pending |

## Defensive Tests

### Rate Limits

Defaults:

- Per IP: `SIMULATION_RATE_LIMIT_IP_PER_DAY=3`
- Per verified email: `SIMULATION_RATE_LIMIT_EMAIL_PER_DAY=2`

Checks:

| Case | Expected | Evidence | Result |
| ---- | -------- | -------- | ------ |
| Fourth upload from one IP within 24 hours | Safe rate-limit message, no new job | Pending | Pending |
| Third upload under one verified email within 24 hours | Safe rate-limit message, no new job | Pending | Pending |

### Idempotency

Use the same `Idempotency-Key` for two `POST /api/public/simulations` attempts.

Expected:

- Same `simulation_job_id` is returned.
- Exactly one storage object exists under `simulations/{job_id}/inputs/`.

Result:

| Evidence | Result |
| -------- | ------ |
| Pending | Pending |

### Regeneration Limit

Expected:

- A job can have at most three successful result images.
- The fourth regeneration request is rejected.
- The previous successful result remains visible.

Result:

| Evidence | Result |
| -------- | ------ |
| Pending | Pending |

### Expiration And Purge

Staging-only setting change:

- Temporarily shorten `SIMULATION_RETENTION_HOURS`.
- Restore it to `24` immediately after the test.

Expected:

- Expired screen renders without a Restart action.
- Purge removes artifacts under the job prefix.
- Purge removes matching `simulation_idempotency_keys` rows.

Result:

| Evidence | Restored `SIMULATION_RETENTION_HOURS=24` | Result |
| -------- | --------------------------------------- | ------ |
| Pending | Pending | Pending |

### Cost Cap

Staging-only setting change:

- Temporarily lower `SIMULATION_DAILY_COST_CAP_USD`.
- Restore it to `50` immediately after the test.

Expected:

- `simulation_cost_meter.worker_paused = true`.
- Subsequent checkpoint claims return zero rows while paused.
- Existing work remains recoverable, not failed.

Result:

| Evidence | Restored `SIMULATION_DAILY_COST_CAP_USD=50` | Result |
| -------- | ------------------------------------------ | ------ |
| Pending | Pending | Pending |

### Bad Input

Expected:

- Non-room photo fails into the safe error screen.
- Restart is available without re-verifying email.
- A subsequent valid room photo completes the flow.

Result:

| Evidence | Result |
| -------- | ------ |
| Pending | Pending |

## Operational Queries

Use these only with environment-appropriate credentials. Replace placeholders
outside the repository.

Check a job:

```sql
select
  id,
  status,
  room_geometry_mode,
  current_checkpoint,
  current_checkpoint_status,
  generated_output_count,
  retention_deadline,
  last_error_code,
  last_error_message
from public.in_home_simulation_jobs
where id = '<job-id>';
```

Check public progress:

```sql
select
  simulation_job_id,
  status,
  progress_step_key,
  progress_step_ordinal,
  progress_total_steps,
  visitor_action_required,
  guide_available,
  latest_result_available,
  regeneration_available,
  retention_deadline,
  updated_at
from public.simulation_public_progress
where simulation_job_id = '<job-id>';
```

Check cost meter:

```sql
select *
from public.simulation_cost_meter
order by usage_date desc
limit 5;
```

## Rollback

Use the smallest rollback that stops public exposure while preserving private
diagnostics.

1. Disable the public entry point in Vercel by hiding or removing the simulation
   CTA from public sofa pages.
2. Keep existing job status routes available so in-flight visitors can land on
   terminal or expired screens.
3. If worker spend or quality is the incident, set the in-home worker provider
   mode away from live or lower capacity through environment configuration, then
   redeploy the worker.
4. If identity or email delivery is the incident, disable the public simulation
   email gate route in Vercel and leave Supabase Auth settings unchanged until
   evidence is captured.
5. Preserve Supabase worker events, checkpoint rows, and storage artifacts until
   the incident notes are complete. Run purge only after evidence is captured.

Rollback record:

| Field | Value |
| ----- | ----- |
| Trigger | Pending |
| Action taken | Pending |
| Time | Pending |
| Owner | Pending |
| Follow-up issue | Pending |

## Launch Sign-Off

| Gate | Required result | Status |
| ---- | --------------- | ------ |
| OTP email in PROD | Six-digit numeric code, no localhost link | Confirmed manually on 2026-05-11 |
| Catalog image variants | Existing sofas and fabrics render in admin and public views | Confirmed manually on 2026-05-11 |
| Back-wall happy path | Pending | Pending |
| Corner happy path | Pending | Pending |
| Worker parity gate | Pending | Pending |
| Rate limits | Pending | Pending |
| Idempotency | Pending | Pending |
| Regeneration limit | Pending | Pending |
| Expiration and purge | Pending | Pending |
| Cost cap restore | Pending | Pending |
| Bad input path | Pending | Pending |
| Final Ahmed sign-off | Pending | Pending |
