# Publishing `@ascentsparksoftware/angular-image-editor`

The library is published from the **built** artifact in `dist/`, never from source.

## Pre-flight

```bash
npm ci
npm run lint
npm test
npm run build:lib            # ng-packagr → dist/angular-image-editor
npm audit --omit=dev         # must be clean (no high/critical in shipped deps)
```

Verify the tarball before publishing:

```bash
cd dist/angular-image-editor
npm pack --dry-run           # inspect file list + size
```

Expected contents: `package.json`, `README.md`, `fesm2022/*.mjs(+map)`, `types/*.d.ts`.
`fabric` is declared as a runtime dependency (not bundled) and is lazy-loaded by consumers.

## Publish (public npm, scope `@ascentsparksoftware`)

> **Status:** deferred — the npm org/package is not provisioned yet. Do not run `npm publish`
> until the `@ascentsparksoftware` org exists and you are authenticated with publish rights. Bump the
> version in `projects/angular-image-editor/package.json` per semver first.

```bash
cd dist/angular-image-editor
npm publish --access public
```

## Local / verdaccio (until npm is ready)

To consume it in another project before the public release:

```bash
# in this repo
npm run pack:lib
# → dist/angular-image-editor/ascentspark-angular-image-editor-<version>.tgz

# in the consuming project
npm install /path/to/ascentspark-angular-image-editor-<version>.tgz fabric
```

Or run a local registry:

```bash
npx verdaccio &                       # http://localhost:4873
cd dist/angular-image-editor
npm publish --registry http://localhost:4873
```
