# CR-SPEC-0001-SPEC-0003 Supabase-Only Backend

Target spec ids: SPEC-0001, SPEC-0003
Status: accepted

## Reason For Change

The repository foundation and business-context specs still reference Railway as
a deployment target for the API and image worker.

The current technical decision is to use a Supabase-based backend for the MVP:
Supabase Postgres, Supabase Storage, Supabase Queues, and Supabase Edge
Functions for server-side API and worker behavior. Vercel remains the hosting
target for the Next.js web frontend.

Railway is no longer a target platform for the project.

## Proposed Change

Update accepted specs so that:

- `SPEC-0001` no longer names Railway as a production deployment platform;
- `SPEC-0003` lists the environment and deployment follow-up area as covering
  Vercel and Supabase settings only;
- future API and worker implementation specs treat Supabase Edge Functions as
  the production backend runtime;
- DEV and PROD environment separation is expressed as Vercel DEV plus Supabase
  DEV, and Vercel PROD plus Supabase PROD.

## Impact

- Specs: accepted specs are updated to remove Railway as a target.
- API: production API contracts should target Supabase Edge Functions.
- Worker: production worker jobs should target Supabase Edge Functions and
  Supabase Queues.
- Database and storage: Supabase remains the only backend data and artifact
  platform.
- Documentation: repository guidance and roadmap wording should be updated so
  future agents do not assume Railway deployment.
- Code: existing Node package foundations may remain until a later plan removes
  or repurposes them, but they are not the production deployment target.

## Approval Note

Accepted during technical specification drafting to align the repository with
the Supabase-only backend decision for the MVP.
