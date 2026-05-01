# SPEC-0008 Local Supabase Worker Development

Spec: SPEC-0008
Status: accepted
Layer: technical
Parent Spec: SPEC-0001
Depends On: SPEC-0001, SPEC-0003
Areas: api, supabase, workflow
Implementation Plans: PLAN-0008

## Traceability

This spec defines the local development foundation needed before implementing
the Supabase-hosted image workers described by `SPEC-0006 Fabric Render Worker`
and `SPEC-0007 In-Home Simulation Worker`.

It follows `SPEC-0001 Repo Foundation`, which created the monorepo shape,
environment separation rules, Supabase migration directory, and worker
boundary.

It follows `SPEC-0003 Business Context - AI Sofa Visualization`, which requires
worker jobs, private storage, queue processing, retention behavior, and
DEV/PROD separation.

It supports the draft worker specs `SPEC-0006` and `SPEC-0007` by giving
developers a repeatable local Supabase stack for developing and testing Edge
Functions, queues, migrations, storage buckets, and worker-facing database
state.

This spec does not implement the production worker behavior by itself. It
creates the local foundation that worker implementation plans can rely on.

## Goal

Enable developers to run and test the worker foundation locally without using
DEV or PROD Supabase resources.

After this spec is implemented, a developer should be able to:

- start a local Supabase stack;
- apply local migrations;
- run Supabase Edge Functions locally;
- enqueue a test worker message;
- have a local worker function claim and update a test job;
- inspect local database, queue, storage, and function logs;
- stop or reset the local stack safely.

## Scope

This spec includes:

- Supabase CLI setup for the repository;
- Docker-compatible local runtime requirement;
- local Supabase project configuration;
- repository scripts for common local Supabase commands;
- local migration foundation for worker development;
- local queue foundation for worker messages;
- local private storage bucket foundation for worker artifacts;
- local Edge Function serving workflow;
- local environment variable examples;
- local test strategy for worker infrastructure;
- local, DEV, and PROD environment separation rules.

The local foundation must support both worker families:

- fabric render generation from `SPEC-0006`;
- in-home simulation from `SPEC-0007`.

## Out Of Scope

This spec does not define:

- full `SPEC-0006` worker implementation;
- full `SPEC-0007` worker implementation;
- final production database schema for all application domains;
- final production API routes;
- final AI provider prompts or model validation;
- production deployment automation;
- production monitoring dashboards;
- production cost tracking;
- a custom Docker Compose stack outside Supabase CLI unless Supabase CLI proves
  insufficient.

## Users And Permissions

### Developer

A developer can start, stop, reset, and inspect the local Supabase stack.

A developer can run local Edge Functions and local worker infrastructure tests.

A developer must not point local development scripts at DEV or PROD Supabase
resources.

### API Service

The local API service may connect to the local Supabase project by using local
Supabase URL and service credentials from local environment files.

The API service must not require DEV or PROD credentials for local worker
development.

### Edge Function Worker

Local worker Edge Functions run with local server-side Supabase credentials and
local provider configuration.

The local worker may run with mocked AI providers by default. Real provider
calls must be opt-in through explicit local environment variables.

## Developer Flow

The local worker development flow should be:

1. The developer installs a Docker-compatible runtime such as Docker Desktop,
   OrbStack, Rancher Desktop, Podman, or another compatible runtime.
2. The developer installs project dependencies with `pnpm install`.
3. The developer starts the local Supabase stack through a repository script.
4. The developer copies local environment examples into local-only `.env` files.
5. The developer applies or resets local migrations through a repository script.
6. The developer serves local Edge Functions through a repository script.
7. The developer runs a worker infrastructure smoke test.
8. The smoke test creates or seeds a local test job, enqueues a local queue
   message, invokes or waits for the local worker function, and verifies that
   the job state changed as expected.
9. The developer stops the local Supabase stack when finished.

Normal local admin `Generate`, `Generate all`, and `Refine` workflows must
start fabric render worker processing through the same service-side admin API
path used by DEV and PROD. Developers should not need to run a separate manual
`curl` invocation for the product workflow after local Supabase and Edge
Functions are running. Direct local worker invocation may remain available for
smoke tests and diagnostics only.

## Repository Tooling

The repository must include Supabase CLI as a root development dependency.

The root `package.json` should expose scripts for common local Supabase tasks:

- `supabase:start`: start the local Supabase stack;
- `supabase:stop`: stop the local Supabase stack;
- `supabase:reset`: reset the local database, reapply migrations, and load
  local admin catalog fixtures;
- `supabase:reset:db-only`: reset the local database and reapply migrations
  without loading optional local admin catalog fixtures;
- `supabase:status`: print local Supabase URLs and keys;
- `supabase:functions:serve`: serve local Edge Functions;
- `seed:local:admin-fixtures`: load local admin catalog fixture data and
  fixture images into the local Supabase database and Storage;
- `test:workers:local`: run local worker infrastructure smoke tests.

The exact script commands may be refined during implementation, but they must
wrap Supabase CLI rather than requiring developers to remember raw commands for
normal local work.

The local admin fixture seed must remain local-only by default. It must refuse
non-local Supabase URLs unless explicitly overridden. It should create enough
catalog data for repeated admin testing without manual recreation, including at
least three fabrics, at least two sofas, source photos, sofa-fabric
assignments, visual positions, and render cells eligible for fabric rendering.
When no local fixture manifest exists, the script may fall back to placeholder
images so the reset command remains usable.

The repository should not require a custom `docker-compose.yml` for the MVP
local worker foundation. Supabase CLI owns the local Docker stack.

## Supabase Local Configuration

The repository must include a committed Supabase local configuration under the
existing `supabase/` directory.

The configuration must be generated or maintained through Supabase CLI and must
be safe to commit.

Local Supabase services must bind to local development ports only. Developers
must not expose the local stack publicly.

The local stack must provide at least:

- local Postgres;
- local Auth when required by later API tests;
- local Storage;
- local Edge Function runtime;
- local database extensions needed by worker queues.

## Data Model

This spec does not define the final production application schema.

It does require local migrations that create the minimum worker foundation
needed for infrastructure smoke tests:

- enable the queue extension required by Supabase Queues;
- create local queue resources for fabric render jobs;
- create local queue resources for in-home simulation jobs;
- create the minimum local job tables or test tables required for smoke tests;
- create indexes needed by local claim and status update tests when relevant.

The local foundation migration must not pretend to be the final data model for
`SPEC-0006` or `SPEC-0007`. Later data model specs may replace, expand, or
formalize these tables.

## Storage

The local Supabase stack must include private storage buckets or bucket
configuration needed for worker infrastructure tests.

The MVP local foundation should include buckets or equivalent local storage
configuration for:

- worker input artifacts;
- worker generated output artifacts;
- simulation private artifacts.

All local worker buckets must be private by default.

Public bucket behavior belongs to later data model and public asset specs.

## Queues

The local stack must support queue behavior close enough to production for
worker development.

The local queue foundation must support:

- creating a fabric render queue;
- creating an in-home simulation queue;
- inserting a test message;
- reading or claiming a test message with a visibility timeout;
- marking a message processed or archiving/deleting it after successful test
  handling.

Queue names must come from environment variables so local, DEV, and PROD remain
separate.

## Edge Functions

The repository must support local Supabase Edge Function development under
`supabase/functions`.

The initial local foundation should include at least one minimal worker-facing
Edge Function or smoke-test function that proves:

- the function can run locally;
- it can read local environment variables;
- it can connect to local Supabase with server-side credentials;
- it can read a queue message or test job;
- it can update local database state.

The smoke function may use mocked worker behavior. It must not call real AI
providers by default.

The final function layout for `SPEC-0006` and `SPEC-0007` belongs to their
implementation plans.

## API

This spec does not define public or admin API endpoint contracts.

The API may need local configuration so it can connect to local Supabase during
worker infrastructure tests.

Any API helper added by this spec must remain local-development oriented and
must not hard-code DEV or PROD Supabase URLs or credentials.

## AI Providers

Local worker infrastructure tests must default to mocked provider behavior.

Real provider calls are allowed only when a developer explicitly provides local
provider keys and opts into a real-provider test command.

The local foundation must not require `GEMINI_API_KEY` or `OPENAI_API_KEY` for
basic smoke tests.

## Environment Variables

The repository must update relevant `.env.example` files with local worker
foundation variables.

The local worker foundation must document at least:

- `APP_ENV=local`;
- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY` when needed by local frontend tests;
- `SUPABASE_SERVICE_ROLE_KEY` for local server-side services only;
- `FABRIC_RENDER_QUEUE_NAME`;
- `FABRIC_RENDER_MAX_CONCURRENT_JOBS`, with local Gemini testing documented as
  sequential by default unless a developer explicitly opts into higher
  concurrency;
- `FABRIC_RENDER_CLAIM_TTL_SECONDS`;
- `IN_HOME_SIMULATION_QUEUE_NAME`;
- `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS`;
- `SIMULATION_RETENTION_HOURS`;
- provider keys such as `GEMINI_API_KEY` and `OPENAI_API_KEY` as optional
  variables for real-provider tests only.

No real DEV or PROD secrets may be committed.

Frontend environment examples must not include service-role credentials.

## Tests

The implementation plan for this spec must add local worker infrastructure
tests.

The minimum smoke test should verify that:

- local Supabase can start in the expected configuration;
- migrations apply cleanly;
- required queue resources exist;
- required private storage buckets exist;
- a local Edge Function can be served or invoked;
- a test job can move from a queued state to a processed test state;
- tests pass without real AI provider keys.

The smoke test may be skipped automatically when the local Supabase stack is not
running, but the skip must be explicit and readable.

## Documentation

The repository must include concise local worker development instructions.

The instructions must explain:

- required developer prerequisites;
- how to start and stop local Supabase;
- how to reset local Supabase;
- how to serve local Edge Functions;
- how to run worker smoke tests;
- how to opt into real provider calls;
- how to avoid mixing local, DEV, and PROD resources.

The documentation can live in a dedicated developer guide or in an appropriate
README, as decided during implementation.

## Acceptance Criteria

- Supabase CLI is available through repository tooling.
- A Docker-compatible runtime is documented as a prerequisite.
- The repository contains committed Supabase local configuration.
- Root scripts exist for starting, stopping, resetting, and inspecting local
  Supabase.
- A root script exists for serving local Supabase Edge Functions.
- A root script exists for local worker infrastructure smoke tests.
- Local migrations create the minimum queue foundation required for smoke
  tests.
- Local migrations create or configure private storage resources required for
  smoke tests.
- Queue names are environment-driven and do not mix local, DEV, or PROD.
- At least one local Edge Function smoke path proves local function execution
  and local Supabase access.
- Basic worker infrastructure tests pass without real AI provider keys.
- Real AI provider tests are opt-in and require explicit local provider keys.
- `.env.example` files document local worker foundation variables without
  committing secrets.
- Local, DEV, and PROD Supabase URLs, keys, buckets, and queues remain
  separated.
- The implementation does not add a custom Docker Compose stack unless the
  implementation plan documents why Supabase CLI is insufficient.
- The spec does not implement full `SPEC-0006` or `SPEC-0007` worker behavior.

## Open Questions

- Should the local smoke test invoke Edge Functions through HTTP, through
  Supabase CLI, or through a direct test harness?
- Should this foundation introduce final worker job table names, or use
  temporary smoke-test tables until the data model spec is accepted?
