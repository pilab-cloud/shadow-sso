# Release checklist

## Prerequisites

- npm user with publish access to the `@pilab` scope
- `pnpm` 10.19.0 or compatible
- Clean working tree on `main`

## Local release

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm pack              # inspect the tarball
```

Log in to npm and publish:

```bash
npm login              # use the npm user with @pilab access
pnpm publish --access public
```

`prepublishOnly` runs the tests and build automatically before publishing.

## Versioning

```bash
pnpm version patch    # or minor / major
git push --follow-tags
pnpm publish --access public
```

## GitHub Actions release

The repository includes `.github/workflows/publish.yml`. It runs on a published
GitHub release or manual dispatch.

1. Add the npm automation token as the `NPM_TOKEN` repository secret:
   **Settings → Secrets and variables → Actions → New repository secret**.
2. Create a release/tag for the version, or run the **Publish** workflow
   manually from the Actions tab.
3. The workflow runs tests, builds, and publishes with npm provenance.

Never commit an npm token to the repository.

## npm scope

The package is published as:

```
@pilab/shadow-sso
```

The authenticated npm user must have publish rights to the `@pilab` scope.
