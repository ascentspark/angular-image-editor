# Contributing

Thanks for your interest in improving **@ascentsparksoftware/angular-image-editor**. This document
covers how to file issues, set up the project, and open a pull request.

## Filing issues

- **Bugs** → open a [Bug report](https://github.com/ascentspark/angular-image-editor/issues/new/choose).
  A **minimal reproduction is required** — a StackBlitz, a small repo, or an exact sequence of steps.
  "It doesn't work" without a repro will be closed.
- **Features** → open a Feature request and **discuss the API first**. For a UI library the public
  surface (component inputs/outputs, engine methods, tool/filter registry) is a semver contract;
  agreeing on the shape before code saves everyone a rewrite.
- **Security** → **do not** open a public issue. Follow [`SECURITY.md`](SECURITY.md).

## Project layout

This is an Angular CLI multi-project workspace:

| Path | What it is |
|------|------------|
| `projects/angular-image-editor/` | The publishable library (`<PKG>` = `angular-image-editor`) |
| `projects/demo/` | The demo app used for manual/visual testing |

## Setup & commands

```bash
npm install                              # install deps
npm run build        # or: npx ng build angular-image-editor   — build the library
npx ng serve demo                        # run the demo at http://localhost:4200
npm test             # or: npx ng test angular-image-editor    — run unit tests
npx ng lint                              # lint library + demo
```

The test runner is **Vitest** (Angular 21+ default, not Karma). Run a single test with:

```bash
npx ng test angular-image-editor -- -t "name of the test"
```

## Coding conventions

- **No `any`, no `@ts-ignore` / `@ts-expect-error`.** ESLint enforces this and the build will fail.
  Use real types, generics, or `unknown` + narrowing at boundaries.
- **Standalone, signal-first, `OnPush`.** New components are standalone with `ChangeDetectionStrategy.OnPush`
  and use signal inputs/outputs (`input()`, `output()`, `model()`); the library is **zoneless-safe**.
- **Fabric.js is lazy-loaded.** Don't add top-level `import 'fabric'` to anything that ships in the
  initial bundle — load it through the engine's existing lazy path so consumers who never open the
  editor don't pay for it.
- **Theming is 3 inputs.** The `--asp-*` palette is derived from accent/surface/mode via the OKLCH
  theme pipeline; don't hard-code colors in component CSS — use the tokens.
- **Heavy/optional deps are `optionalDependencies`** (e.g. the AI background-removal model). Guard
  their use behind a lazy `import()` and degrade gracefully when absent.
- Match the style of the surrounding code; keep files focused (one clear responsibility).

## Pull requests

Before opening a PR, make sure:

- [ ] `npx ng test angular-image-editor --watch=false` passes
- [ ] `npx ng lint` passes
- [ ] `npx ng build angular-image-editor` succeeds
- [ ] New behavior has tests
- [ ] Public API changes are reflected in `public-api.ts` and the `README.md`
- [ ] No `any` / `@ts-ignore`; no top-level Fabric import in the initial bundle

Keep PRs focused — one logical change per PR. Reference the issue it closes (`Closes #123`).
