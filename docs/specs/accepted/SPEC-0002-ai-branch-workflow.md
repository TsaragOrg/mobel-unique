# SPEC-0002 AI Branch Workflow

Spec: SPEC-0002
Status: accepted

## Goal

Provide a repository-owned command that developers and AI coding agents use to create Git branches with consistent names and workflow metadata.

## Scope

- Add a branch creation command exposed through `pnpm`.
- Generate branch names from explicit work intent instead of free-form agent output.
- Validate branch type, owner area, optional spec id, optional plan id, and work description.
- Default new work to branch from `dev`.
- Document the command for developers and AI agents.

## Out Of Scope

- GitHub branch protection management.
- Pull request creation.
- Remote pushes.
- Issue tracker integration.

## Users And Permissions

Repository contributors and AI coding agents may run the command locally.

The command must not bypass branch protections or push to remote branches automatically.

## User Flow

Developers ask their AI assistant to create a branch by running the repository command with the intended work.

The command validates inputs, switches to the base branch, creates the new branch, and prints the resulting name.

## Data Model

No application data model changes.

## API

No application API changes.

## Worker Jobs

No worker job changes.

## Environment Variables

No new environment variables.

## Acceptance Criteria

- A `pnpm` command exists to create workflow-compliant branches.
- Branch names follow `type/area/metadata-slug`.
- The command supports dry-run validation.
- The command rejects unknown types, unknown areas, invalid spec ids, invalid plan ids, and missing work descriptions.
- The command is covered by tests.
- Agent instructions document that AI assistants must use the command instead of manually naming branches.

## Open Questions

- Whether future issue tracker ids should be included once an issue tracker is selected.
