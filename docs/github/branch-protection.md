# GitHub Branch Protection

After the first push, configure branch protection for `dev` and `main`.

## `dev`

Recommended settings:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Required check: `Quality Gate`.
- Require conversation resolution before merging.
- Require review from CODEOWNERS for spec changes.

## `main`

Recommended settings:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Required check: `Quality Gate`.
- Require conversation resolution before merging.
- Require review from CODEOWNERS.
- Restrict direct pushes.

## Notes

Before enabling CODEOWNERS enforcement, replace the placeholder owner in `.github/CODEOWNERS` with the real GitHub user or team.

