# AI Branching Workflow

Developers and AI coding agents must use the repository branch command instead of inventing branch names.

## Command

```bash
pnpm branch:create -- --type feature --area web --work "Admin catalogue upload" --spec SPEC-0002 --plan PLAN-0002
```

The command defaults to `dev` as the base branch and creates a local branch only.

## Format

```text
type/area/spec-0000-plan-0000-work-slug
```

If there is no accepted spec yet, use `--type spec` and omit `--spec` and `--plan`:

```bash
pnpm branch:create -- --type spec --area web --work "Storefront catalogue specification"
```

## Allowed Values

Types:

- `feature`
- `fix`
- `chore`
- `docs`
- `refactor`
- `test`
- `spec`
- `hotfix`

Areas:

- `web`
- `api`
- `image-worker`
- `shared`
- `supabase`
- `workflow`
- `repo`

## Agent Instruction

When a developer asks an AI assistant to start work, the assistant should:

1. Run `pnpm branch:create -- --dry-run ...` if it needs to preview the branch name.
2. Run `pnpm branch:create -- ...` before editing files.
3. Continue with the spec, plan, tests, implementation, and roadmap workflow.

The command rejects invalid metadata and branch names longer than 120 characters.
