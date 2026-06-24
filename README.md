# @ascentspark/angular-image-editor

A standalone, themeable **Angular 22** image editor built from scratch on
**[Fabric.js v7](https://fabricjs.com/) (MIT)** — a free, open-source alternative to
commercial editors (Syncfusion / Pintura / Filerobot). No license keys, no telemetry.

> **Status:** in active development toward `0.1.0`. This README is filled out phase by
> phase as features land — see `docs/plans/00-master-plan.md` for the build plan and
> progress. Sections marked _(coming)_ are not yet implemented.

## Features (target)

- Four modes: `viewer` · `basic` · `advanced` · `full`
- Crop (aspect presets) · rotate / straighten · flip · zoom / pan
- Fine-tune adjustments (brightness/contrast/saturation/exposure/blur) and filter looks
- Draw / pen · shapes · text annotation · freehand highlight / redact
- Undo / redo history · image picker (samples + upload) · export (PNG/JPEG/WEBP/SVG/JSON)
- 3-input runtime theming (`baseColor` + `accentColor` + `themeMode`) → WCAG AA palette
- WCAG AA, keyboard operable, focus-visible, reduced-motion, Trusted-Types safe

## Install _(coming — published at 0.1.0)_

```bash
npm install @ascentspark/angular-image-editor fabric
```

**Peer dependencies:** `@angular/core` and `@angular/common` `^22`.
**Runtime dependency:** `fabric` `^7.4.0` (installed automatically as a dependency).

## Usage _(coming)_

```html
<asp-image-editor
  [src]="imageUrl"
  mode="advanced"
  [baseColor]="'#f4f6f9'"
  [accentColor]="'#1f6feb'"
  [themeMode]="isDark ? 'dark' : 'light'"
  (saved)="onSaved($event)">
</asp-image-editor>
```

## Theming _(coming)_

Three inputs derive the entire UI palette as scoped `--asp-*` CSS custom properties on the
editor root. Hosts can also override any individual `--asp-*` variable for fine control.
Full token list and examples land with the theming engine.

## API _(coming)_

The full typed input/output contract (`mode`, `tools`, `disabledTools`, `filters`,
`aspectPresets`, `exportFormats`, `exportQuality`, theming inputs, `saved`/`canceled`)
and the `openImageEditor()` dialog service are documented here as they are implemented.

## Local development

This is an Angular CLI multi-project workspace: the library lives in
`projects/angular-image-editor`, with a demo app in `projects/demo`.

```bash
npm install
npm run start          # serve the demo app (http://localhost:4200)
npm run build:lib      # build the publishable library to dist/
npm run build:demo     # build the demo app
npm test               # run unit tests (Vitest)
npm run lint           # lint library + demo
```

## License

[MIT](./LICENSE) © Ascentspark Software Private Limited
