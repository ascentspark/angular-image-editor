# `@ascentspark/angular-image-editor` — Master Implementation Plan

> **For agentic workers:** This is the master/architecture plan. Each phase has its own
> detailed bite-sized TDD plan in `docs/plans/NN-phase-*.md`, written just-in-time so
> that all Fabric.js v7 API code is verified against the installed version (never guessed).
> Steps in phase plans use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, publishable Angular 22 image-editor library built from scratch on
Fabric.js v7 (MIT) — a free, original open-source competitor to Syncfusion/Pintura/Filerobot,
with a `viewer`/`basic`/`advanced`/`full` mode model, 3-input runtime theming, full a11y, and
a pixel-faithful UI matching the delivered design reference.

**Architecture:** A clean Angular library (`projects/angular-image-editor`, ng-packagr) plus a
self-contained demo app (`projects/demo`). Layered: (1) **pure logic** — color/theme derivation
and tool/filter registry, no DOM, fully unit-testable; (2) **engine** — `EditorEngine` wrapping a
Fabric.js `Canvas`, the only place that touches Fabric; (3) **UI** — standalone, OnPush, signal-driven
components (rail / canvas column / options panel / modal) that read the registry + theme and call the
engine. `simple`/`basic` mode pulls a minimal bundle; `advanced`/`full` chrome + heavy filter set are
lazy-loaded. SSR-safe (no Fabric import at module top level), zoneless-compatible.

**Tech Stack:** Angular 22 (standalone, signals, `input()`/`output()`/`model()`, OnPush, zoneless),
TypeScript 6, Fabric.js `^7.4.0` (runtime dep), ng-packagr, the workspace's default unit-test runner,
Playwright (visual verification), axe-core (a11y), Lucide icons (inline SVG, bundle-light).

## Global Constraints

Copied verbatim from `editor_handoff.md`; every task inherits these.

- **Angular 22**, standalone components, signals, `input()`/`output()`/`model()`, OnPush, zoneless-compatible.
- **No `any` / `@ts-ignore` / `as any` / non-null `!`.** `unknown` + narrowing at boundaries only.
- Library built with the Angular library builder (`ng-packagr`); a clean publishable artifact.
- **Folder:** top-level `angular-image-editor/` — its own `package.json`, project config, `src/public-api.ts`,
  `README.md`, semver. Self-contained with its own demo app; not nested inside another project.
- **Package name:** `@ascentspark/angular-image-editor` (public npm, scope `@ascentspark`).
  Peer deps: `@angular/core`/`@angular/common` `^22`. Runtime dep: **`fabric` `^7.4.0`** (Fabric.js v7, MIT).
  Everything open-source / permissively licensed; **no commercial SDK, no license key, no telemetry.**
- **Bundle strategy:** import only the shapes/filters used; lazy-load `advanced` mode + heavier filter set.
  Target: `simple` ≤ ~60KB gzip incl. engine; advanced loaded on demand.
- WCAG **AA**, keyboard operable, focus-visible, reduced-motion. **Trusted-Types safe.**
- **3-input theming:** `baseColor` + `accentColor` + `themeMode` derive the full `--asp-*` token set at
  runtime (AA contrast, light+dark), scoped to the editor root; any `--asp-*` var also host-overridable.
- Deliverables: lib builds to clean dist; `npm pack` valid tarball; demo shows all modes + custom `tools` +
  `disabledTools`, light+dark, desktop+mobile; pixel-match the mockup; unit tests for tool-set resolution,
  export config, undo/redo gating, palette derivation; axe a11y pass; README; publish `0.1.0`+.

## Design reference (pixel source of truth)

The delivered HTML/CSS mockup is the pixel source of truth (NOT a screenshot — read the source):
`../customizable-theme-system-design/project/Nascent System.dc.html`.
- **Advanced workspace:** lines ~1379–1524 (markup) + ~4283–4344 (view-model: tools, adjusters, filters,
  crop presets, history, export, responsive grid `84px minmax(0,1fr) 268px`).
- **Simple modal:** lines ~2423–2459 (markup) + ~4345–4360 (view-model).
The mockup's design tokens (`--primary`, `--primary-ink`, `--primary-soft`, `--primary-soft-text`,
`--primary-hover`, `--surface`, `--surface-2`, `--surface-sunk`, `--ink-900/700/500/300`, `--line`,
`--line-strong`, `--ring`, `--scrim`, `--r-sm/md/lg/pill`, `--ctl-h`, `--ctl-h-sm`, `--font-mono`) map
1:1 onto our namespaced `--asp-*` tokens (Phase 1 derives them from the 3 inputs). Reproduce spacing,
sizing, font-sizes, radii, and states faithfully.

### Design → `--asp-*` token map (authoritative naming)

| mockup token        | `--asp-*` token            | role |
|---------------------|----------------------------|------|
| `--bg`              | `--asp-bg`                 | app/scrim backdrop base |
| `--surface`         | `--asp-surface`            | card/panel surface |
| `--surface-2`       | `--asp-surface-2`          | inset surface (inputs) |
| `--surface-sunk`    | `--asp-surface-sunk`       | sunk/hover wells, checkerboard dark cell |
| `--ink-900`         | `--asp-ink`                | primary text |
| `--ink-700`         | `--asp-ink-700`            | secondary text/icons |
| `--ink-500`         | `--asp-ink-muted`          | muted labels |
| `--ink-300`         | `--asp-ink-faint`          | disabled/faint |
| `--line`            | `--asp-line`               | hairline borders |
| `--line-strong`     | `--asp-line-strong`        | control borders |
| `--primary`         | `--asp-accent`             | accent fill |
| `--primary-ink`     | `--asp-accent-ink`         | on-accent text (AA) |
| `--primary-hover`   | `--asp-accent-hover`       | accent hover |
| `--primary-soft`    | `--asp-accent-soft`        | active tool bg |
| `--primary-soft-text`| `--asp-accent-soft-ink`   | active tool text (AA on soft) |
| `--ring`            | `--asp-ring`               | focus ring (accent @ alpha) |
| `--scrim`           | `--asp-scrim`              | modal scrim |
| `--r-sm/md/lg/pill` | `--asp-radius-sm/md/lg/pill`| radii |
| `--ctl-h`,`--ctl-h-sm`| `--asp-ctl-h`,`--asp-ctl-h-sm`| control heights |
| `--font-mono`       | `--asp-font-mono`          | numeric readouts |
| (semantic) success/warning/error | `--asp-success`/`--asp-warning`/`--asp-error` | status |

## File Structure

```
angular-image-editor/
  package.json                      # workspace root (Angular CLI multi-project)
  angular.json                      # lib + demo projects
  tsconfig.json / tsconfig.base     # strict; no any/ts-ignore
  README.md                         # install, peer deps, theming, API, examples
  LICENSE                           # MIT (present)
  docs/plans/*.md                   # this plan + phase plans
  projects/
    angular-image-editor/           # THE LIBRARY
      ng-package.json
      package.json                  # name @ascentspark/angular-image-editor, peer/runtime deps
      src/
        public-api.ts               # exports: component(s), dialog service, all public types
        lib/
          types/
            editor.types.ts         # AspMode, AspTool, AspFilter, AspExportFormat, AspAspectPreset, configs
          theme/
            color.ts                # pure: parse/convert/contrast/scale helpers (no DOM)
            derive-theme.ts         # pure: (base,accent,mode) -> Record<--asp-*, string>
            theme.spec.ts
          registry/
            tool-registry.ts        # tool + filter catalog metadata (data-driven)
            resolve-tools.ts        # pure: mode/tools/disabledTools -> AspTool[]; filters resolution
            resolve-tools.spec.ts
          engine/
            editor-engine.ts        # Fabric Canvas wrapper (load/zoom/rotate/flip/crop/filters/draw/export/undo)
            history.ts              # undo/redo stack over toJSON snapshots (pure-ish, testable)
            export.ts               # export config + toDataURL/toBlob/toSVG/toJSON helpers
            fabric-loader.ts        # dynamic import('fabric') — SSR-safe, lazy
            *.spec.ts
          ui/
            image-editor.ts/.html/.css      # <asp-image-editor> root: inputs/outputs, theme apply, mode switch
            rail/tool-rail.ts/.html/.css
            canvas-stage/canvas-stage.ts/...# canvas host + crop/annotation overlays + topbar
            options-panel/options-panel.ts/...# per-tool panels (adjust/filters/crop/rotate/annotate/frame)
            controls/                       # slider, swatch, icon-button, segmented, menu primitives
            history-list/history-list.ts/...
            modal/image-editor-dialog.ts    # basic-mode modal shell
          icons/lucide.ts            # inline SVG paths for the icon set used
          dialog/open-image-editor.ts # openImageEditor(config): Promise<Blob|null>
  projects/demo/                     # DEMO APP (visual verification, a11y target)
    src/app/...                      # routes: viewer/basic/advanced/full/custom-tools/disabled-tools, light+dark
  e2e/                               # Playwright visual + a11y specs
```

## Phase Decomposition

Each phase produces working, independently testable software and ends with a commit. After every phase,
the veteran self-check runs: *"Is this honestly, fully done and usable for its real purpose?"* — if not,
revisit before advancing. Phases may be paused to fix a discovered dependency, then resumed; nothing is
declared finished until every deferred item is closed with the same rigor.

- **Phase 0 — Scaffold.** Angular CLI workspace; library + demo projects; fabric `^7.4.0`; strict TS, lint,
  test runner, public-api; README skeleton. Gate: `ng build angular-image-editor` clean, `npm pack` valid,
  demo serves, `npm audit` baseline clean (no high/critical in shipped deps). → `docs/plans/01-phase0-scaffold.md`
- **Phase 1 — Theming engine.** Pure `deriveTheme(base, accent, mode)` → `--asp-*` map with AA contrast
  (auto-pick accent-ink, lift/clamp steps), light+dark; applied as scoped CSS vars on root; host override.
  Heavy unit tests incl. several base/accent pairs. → `02-phase1-theming.md`
- **Phase 2 — Registry + resolution.** Tool/filter catalog; `resolveTools(mode, tools, disabledTools)` and
  `resolveFilters(...)`; default sets per mode (viewer/basic/advanced/full). Unit-tested truth tables.
  → `03-phase2-registry.md`
- **Phase 3 — Engine.** `EditorEngine` over Fabric `Canvas`, SSR-safe lazy loader. load/zoom/pan/rotate/
  flip/straighten/crop, adjustments+filters, shapes/text/freehand/redact, undo/redo (snapshot history with
  gating), export (png/jpeg/webp/svg/json incl. quality). Logic unit-tested; engine smoke-tested in demo.
  → `04-phase3-engine.md`
- **Phase 4 — Advanced UI.** Rail + canvas column + options panel + history, wired to engine; responsive
  bottom-sheets; pixel-match advanced mockup; Playwright screenshots (light/dark, desktop/mobile) eyeballed.
  → `05-phase4-advanced-ui.md`
- **Phase 5 — Basic modal + viewer/full + dialog service.** `basic` modal (crop/rotate/flip/zoom/reset/
  Save/Cancel), `viewer` (pan/zoom/export), `full` (all tools/filters), `openImageEditor()` + dialog shell,
  `saved`/`canceled`. Pixel-match simple-modal mockup. → `06-phase5-modal-modes.md`
- **Phase 6 — a11y, demo, docs, publish.** Full demo routes; axe pass; keyboard/focus/reduced-motion/
  Trusted-Types; README; `npm pack`; publish `0.1.0` (or documented local registry). Final pixel + visual QA
  across base/accent pairs. → `07-phase6-finalize.md`

## Cross-cutting verification protocol (per user directive)

- **Visual truth, not DOM truth.** UI behavior is verified by Playwright *navigation + clicks + screenshots*,
  then eyeballed against the mockup. DOM presence proves nothing; a screenshot that looks right does.
- **Use the UI like a human.** Prefer clicking through the demo over calling engine APIs directly in tests.
- **Build + lint + audit are gates, not afterthoughts** at the start and end of every phase.
- **Fix the source, never the symptom.** Generated/derived values wrong → fix the util/template.
- **Per-phase honesty check** before advancing; deferred work is tracked and finished before "done."

## Open decisions (resolved)

- Fabric major: **v7** (`^7.4.0`) — confirmed with user 2026-06-24 (v7 is current stable; spec said v6).
- Scaffold tooling: **Angular CLI multi-project workspace** (lib + demo) — standalone & publishable, matches
  "not nested inside another project"; Nx not needed for a single self-contained package.
- Publish: build + `npm pack` valid tarball always; actual `npm publish 0.1.0` performed if org/auth ready,
  else documented (local verdaccio path) — does not block the build deliverable.
