# CR-SPEC-0011 Tighten Admin Auth Dependencies

Target spec id: SPEC-0011
Status: accepted

## Reason For Change

`SPEC-0011 Admin Authentication And Authorization` was accepted with `SPEC-0006` and `SPEC-0007` listed in `Depends On`.

Those specs are relevant background because admin authorization protects render and worker-facing workflows, but the direct admin auth contract depends on those workflows through `SPEC-0010 API Contracts And Edge Functions`.

`Depends On` should represent direct normative dependencies, not every indirectly related spec.

## Proposed Change

Update `SPEC-0011` and `docs/specs/manifest.json` so that `SPEC-0011` depends directly on:

- `SPEC-0001`;
- `SPEC-0003`;
- `SPEC-0005`;
- `SPEC-0008`;
- `SPEC-0009`;
- `SPEC-0010`.

Remove direct `Depends On` entries for:

- `SPEC-0006`;
- `SPEC-0007`.

Keep worker and simulation background traceable through `SPEC-0010`.

## Impact

- Specs: metadata and traceability cleanup only.
- API: no behavior change.
- Database: no behavior change.
- Worker: no behavior change.
- UI: no behavior change.
- Plans and tests: no behavior change.

## Approval Note

Accepted during dependency metadata review after `SPEC-0011` acceptance.
