<div align="center">

<a href="https://github.com/ascentspark/angular-image-editor"><img src="image-editor-logo.png" alt="Angular Image Editor" height="120"></a>

# @ascentsparksoftware/angular-image-editor

A standalone, themeable **Angular 22** image editor — crop, filter, draw, redact, layers and
**in-browser AI background removal** — built from scratch on **Fabric.js v7**.

by&nbsp;<a href="https://ascentspark.com" target="_blank" rel="noopener"><img src="https://cdn.ascentspark.com/assets/images/asc-logo-full.svg" alt="Ascentspark" height="22" valign="middle"></a>

[![npm version](https://img.shields.io/npm/v/@ascentsparksoftware/angular-image-editor.svg?color=dd0031)](https://www.npmjs.com/package/@ascentsparksoftware/angular-image-editor)
[![downloads](https://img.shields.io/npm/dm/@ascentsparksoftware/angular-image-editor.svg)](https://www.npmjs.com/package/@ascentsparksoftware/angular-image-editor)
[![Angular 22](https://img.shields.io/badge/Angular-22-dd0031.svg)](https://angular.dev)
[![license MIT](https://img.shields.io/github/license/ascentspark/angular-image-editor?color=3b82f6)](https://github.com/ascentspark/angular-image-editor/blob/main/LICENSE)

### **[🚀 Live demo &amp; docs →](https://angular-image-editor.ascentspark.com)**

**[✨ Features](#features)** &nbsp;·&nbsp;
**[🎨 Theming](#theming)** &nbsp;·&nbsp;
**[🧩 API](#api)** &nbsp;·&nbsp;
**[🔒 Security](#security)** &nbsp;·&nbsp;
**[🗺️ Roadmap](#-roadmap)**

</div>

---

A full image editor you drop into an Angular app as a standalone component: crop, rotate, filters,
draw, text, shapes, freehand redaction, layers, and export to PNG / JPEG / WEBP / SVG / PDF / JSON.
Put `<asp-image-editor>` on the page, bind your image and options as signal inputs, and read results
back as a `Blob`. It targets **Angular 22**, is signal-driven, standalone, `OnPush` and
zoneless-compatible.

It is built from scratch on **[Fabric.js v7](https://fabricjs.com/) (MIT)** — a free, open-source
alternative to commercial editors such as Syncfusion, Pintura and Filerobot. No license keys, no
telemetry, no per-seat pricing. Fabric is the only runtime dependency and it is lazy-loaded, so it
never weighs down your initial bundle.

> ## 🆓 In-browser AI background removal, free
>
> One-click background removal is a paid feature in most commercial editors. Here it runs **on-device
> for free** (MIT): the **Remove background** and **Cut out subject** tools run an ONNX model
> entirely in the browser — no image ever leaves the page, no API key, no per-call cost.
> The heavy model packages live **in your app, not in this library** — you opt in by installing them
> and registering a loader (`provideAspBackgroundRemoval(() => import('@imgly/background-removal'))`).
> If you don't, the rest of the editor is unaffected and the AI tools simply don't appear. There's
> also a dependency-free **Magic wand** (flood-fill erase) for clearing flat color regions by click.
> See [Optional heavy features](#optional-heavy-features-ai--heic).

## Features

- **Four modes** — `viewer` · `basic` · `advanced` · `full`, each with sensible default chrome and
  tools.
- **Editing** — crop (preset + custom CMS aspect ratios), rotate / straighten, flip, zoom / **pan**,
  fine-tune adjustments (brightness / contrast / saturation / vibrance / hue / blur / …), filter
  looks (B&W / sepia / invert / sharpen / tint), draw / pen, highlighter, **eraser**, shapes, arrows,
  **text with web fonts**, freehand **redaction** (solid / blur / pixelate), frames, **background
  color / gradient**, and undo / redo history.
- **Smart & AI tools** — **Magic wand** flood-fill erase (no dependencies), plus in-browser AI
  **Remove background** and **Cut out subject**.
- **Layers panel** (persistent companion) — drag-to-reorder z-order, per-layer **lock**, show / hide,
  **opacity**, inline **rename**, plus the object-ops on the selection: **group / ungroup**,
  **align**, **duplicate**, delete, and multi-select (shift / ⌘ / ctrl). Available regardless of the
  active tool.
- **Multiple images** — replace the canvas image or **add an image as its own layer** to composite.
- **Precision** — optional **rulers** with draggable, snapping **guides**, **snapping + alignment
  guides** (magnet toggle), and an **artboard / output size** (presets + custom W×H) for exact-pixel
  raster and PDF export.
- **Export** — PNG / JPEG / WEBP / SVG / **PDF** (lazy `jspdf`) / JSON, plus engine
  `exportScene` / `loadScene` for save-and-reload templates.
- **Usage-based UI** — a grouped, Photoshop-style **flyout toolbar** (tools double as modes), a tool
  **Options** panel that adapts to the selection, and top-bar **actions** (undo / redo, zoom, fit,
  history, image, export).
- **Color anywhere** — preset swatches **plus a custom color picker** for fill, draw, text, shapes,
  frame and background.
- **Web fonts** — a curated Google-font list plus an "add any Google font" search.
- **Correct compositing** — the highlighter is genuinely translucent; **redact** bakes the
  *composited* pixels under the region, concealing everything beneath, not just the base image.
- **Responsive** — the editor adapts to **its own width** via CSS container queries (single column on
  narrow hosts), so it works in a sidebar, a modal or full-page without horizontal overflow.
- **3-input runtime theming** — `baseColor` + `accentColor` + `themeMode` derive the whole palette as
  scoped `--asp-*` CSS variables, with guaranteed WCAG **AA** contrast.
- **Robust & accessible** — oversized imports auto-downscale; recoverable failures surface via an
  `errorOccurred` event instead of throwing; keyboard-operable, `:focus-visible` rings,
  `prefers-reduced-motion`, Trusted-Types-safe. No `any` anywhere.

## Install

```bash
# Angular 22 (latest)
npm install @ascentsparksoftware/angular-image-editor fabric

# Angular 21 → npm i @ascentsparksoftware/angular-image-editor@ng21 fabric
# Angular 20 → npm i @ascentsparksoftware/angular-image-editor@ng20 fabric
```

One package major per Angular major (see [Versions](#versions)). Pick the line that matches your app.

- **Peer dependencies:** `@angular/core` and `@angular/common` (`^22` on the latest line, `^21` / `^20`
  on the maintenance lines).
- **Runtime dependency:** `fabric` `^7.4.0` (declared by the package; install it alongside). Fabric is
  lazy-loaded on demand, so it never weighs down your initial bundle.
- **No WASM/ML in the default install.** The core editor's import graph contains only plain‑JS
  dynamic imports (`fabric`, `jspdf`), so it loads cleanly in any bundler/dev server out of the box —
  no `optimizeDeps` config, no cache dance. The AI / HEIC features are **opt‑in** and live in your app
  (see [Optional heavy features](#optional-heavy-features-ai--heic)). Without them, **Remove
  background**, **Cut out subject**, and HEIC import are simply unavailable; everything else works.

## Quick start

`AspImageEditor` is a standalone component — import it directly:

```ts
import { Component } from '@angular/core';
import { AspImageEditor } from '@ascentsparksoftware/angular-image-editor';

@Component({
  selector: 'app-photo',
  imports: [AspImageEditor],
  template: `
    <asp-image-editor
      [src]="imageUrl"
      mode="advanced"
      [baseColor]="'#f4f6f9'"
      [accentColor]="'#02375e'"
      [themeMode]="isDark ? 'dark' : 'light'"
      (saved)="onSaved($event)">
    </asp-image-editor>
  `,
})
export class PhotoComponent {
  imageUrl = 'https://example.com/photo.jpg';
  isDark = false;
  onSaved(blob: Blob): void {
    /* upload or preview the edited image */
  }
}
```

Give the host a size — the editor fills its container. Either set the `width` / `height` inputs, or
size the host in CSS:

```css
asp-image-editor { display: block; height: 640px; }
```

```html
<!-- inputs accept px, %, vh, or any CSS length / calc() -->
<asp-image-editor [src]="url" width="100%" height="70vh"></asp-image-editor>
```

## Modes

`mode` sets the chrome and a sensible default tool set:

| mode | chrome | default tools |
| --- | --- | --- |
| `viewer` | minimal: zoom + export | none (read-only) |
| `basic` | a compact card (also openable as a modal) | crop, rotate, flip, zoom |
| `advanced` *(default)* | full 3-column workspace | curated everyday set |
| `full` | full workspace | every tool + every filter |

```html
<asp-image-editor mode="viewer" [src]="url"></asp-image-editor>
<asp-image-editor mode="full" [src]="url"></asp-image-editor>
```

## Tool configuration

Resolution order, from easiest to most precise:

1. **`mode`** sets the default tool set.
2. **`tools`** (if provided) is an explicit allowlist that *replaces* the mode default, in the order
   you give.
3. **`disabledTools`** is then subtracted from the result.

```html
<!-- advanced, but without filters or stickers -->
<asp-image-editor mode="advanced" [disabledTools]="['filters', 'sticker']" />

<!-- a bespoke rail (order preserved) -->
<asp-image-editor [tools]="['crop', 'rotate', 'text']" />
```

Filters follow the same idea via `filters`: an explicit `AspFilter[]`, the literal `'all'` (every
Fabric filter), or `null` for the mode default.

```html
<asp-image-editor mode="advanced" [filters]="['brightness', 'contrast', 'grayscale']" />
<asp-image-editor mode="advanced" [filters]="'all'" />
```

## Smart & AI tools

| Tool | What it does | Dependency |
| --- | --- | --- |
| **Magic wand** (`magicwand`) | Click a flat color region to erase it to transparency; tolerance slider. | none |
| **Remove background** (`removebg`) | In-browser AI that replaces the base image's background with transparency. | optional |
| **Cut out subject** (`selectsubject`) | In-browser AI that extracts the subject onto its own layer. | optional |

The magic wand has no dependencies and works everywhere. The two **AI** tools run
`@imgly/background-removal` (an ONNX model, on-device — no image data leaves the browser); HEIC/HEIF
import uses `heic2any`. Both are opt-in — see below.

### Optional heavy features (AI + HEIC)

`@imgly/background-removal` (with `onnxruntime-web`) and `heic2any` ship **WASM, web workers and deep
CJS graphs** that dev-server bundlers — Vite's dependency optimizer in particular — cannot pre-bundle
reliably. If those packages lived inside this library's import graph, **every** consumer's bundler
would have to deal with them the moment the editor opened, whether or not they used the feature — which
is exactly what caused intermittent `Failed to fetch dynamically imported module` / `504 (Outdated
Optimize Dep)` errors and blank canvases in earlier versions.

So the core editor **does not import them**. Instead you opt in by installing the package you want and
registering a loader. The heavy `import()` then lives in **your** bundle, where you own the config:

```bash
# only if you want these features
npm install @imgly/background-removal onnxruntime-web   # AI background removal / cut-out
npm install heic2any                                    # HEIC/HEIF import
```

```ts
// app.config.ts
import {
  provideAspBackgroundRemoval,
  provideAspHeicDecoder,
} from '@ascentsparksoftware/angular-image-editor';

export const appConfig: ApplicationConfig = {
  providers: [
    // …
    provideAspBackgroundRemoval(() => import('@imgly/background-removal')),
    provideAspHeicDecoder(() => import('heic2any')),
  ],
};
```

- Provide **only what you need** — register just `provideAspHeicDecoder` and the AI tools stay hidden,
  or neither and you get the lean default editor.
- When a loader is absent, the matching tool is **removed from the rail** (and HEIC import throws a
  clear, catchable error) — nothing breaks.
- A progress bar and busy cursor show while the model loads on first AI use.

> **Migrating from ≤ 22.0.2 / 21.0.2 / 20.0.2:** these packages used to be `optionalDependencies` that
> the library `import()`ed for you. They no longer are. If you use the AI/HEIC tools, add the two
> `provide…` calls above (and keep the packages in your `dependencies`). If you don't, just remove the
> packages — your install gets smaller and the editor loads with zero WASM. This is a behavioural
> change shipped as a **patch** because the public type/component API is unchanged; see
> [Versions](#versions).

## Theming

Three inputs derive the **entire** UI palette at runtime — set them and the editor blends into your
brand in light or dark, with WCAG **AA** text contrast guaranteed (AAA for primary text), no extra
config:

- **`baseColor`** — neutral anchor; surfaces, ink and borders are tinted toward its hue.
- **`accentColor`** — interactive accent; buttons, active tool, focus ring, selection.
- **`themeMode`** — `'light'` or `'dark'`.

The derived values are applied as scoped CSS custom properties on the editor root, so they never
clash with your page. For fine control you can override any individual variable:

```css
asp-image-editor {
  --asp-radius-md: 12px;
  --asp-accent: #ff5a5f;
}
```

<details><summary>All <code>--asp-*</code> tokens</summary>

| token | role |
| --- | --- |
| `--asp-bg` | app/backdrop base |
| `--asp-surface` | card / panel surface |
| `--asp-surface-2` | inset surface (inputs) |
| `--asp-surface-sunk` | sunk wells / hover, checkerboard cell |
| `--asp-ink` | primary text |
| `--asp-ink-700` | secondary text / icons |
| `--asp-ink-muted` | muted labels |
| `--asp-ink-faint` | disabled / faint |
| `--asp-line` | hairline borders |
| `--asp-line-strong` | control borders |
| `--asp-accent` | accent fill |
| `--asp-accent-ink` | on-accent text (AA) |
| `--asp-accent-hover` | accent hover |
| `--asp-accent-soft` | active-tool background |
| `--asp-accent-soft-ink` | text on soft accent (AA) |
| `--asp-ring` | focus ring |
| `--asp-scrim` | modal scrim |
| `--asp-success` / `--asp-warning` / `--asp-error` | status colors |
| `--asp-radius-sm` / `-md` / `-lg` / `-pill` | radii |
| `--asp-ctl-h` / `--asp-ctl-h-sm` | control heights |
| `--asp-font-mono` | numeric readouts |

You can also call the pure helper directly: `deriveTheme(baseColor, accentColor, mode)` returns the
full token map, and `applyTheme(element, tokens)` sets them.
</details>

## Modal dialog

For avatar / quick-edit flows, open the `basic` editor as a modal and await the result:

```ts
import { Component, inject } from '@angular/core';
import { AspImageEditorDialog } from '@ascentsparksoftware/angular-image-editor';

@Component({ /* ... */ })
export class AvatarComponent {
  private readonly editor = inject(AspImageEditorDialog);

  async edit(src: string): Promise<void> {
    const blob = await this.editor.open({
      src,
      heading: 'Update profile photo',
      aspectPresets: ['1:1', '4:3', 'free'],
    });
    if (blob) {
      /* user saved — upload `blob` */
    } // else: user cancelled (close, scrim click, or Escape)
  }
}
```

## API

```ts
@Component({ selector: 'asp-image-editor', standalone: true })
class AspImageEditor {
  src         = input<string | Blob | null>(null);
  mode        = input<AspMode>('advanced');           // 'viewer'|'basic'|'advanced'|'full'
  width       = input<AspSize | null>(null);          // px | % | vh | any CSS length / calc()
  height      = input<AspSize | null>(null);
  tools       = input<AspTool[] | null>(null);        // explicit allowlist
  disabledTools = input<AspTool[]>([]);               // subtracted from the resolved set
  filters     = input<AspFilter[] | 'all' | null>(null);
  aspectPresets = input<AspAspectPreset[]>(['free', '1:1', '4:3', '16:9']);
  aspectRatios  = input<AspAspectOption[]>([]);       // custom CMS targets, e.g. aspectOption(1200,630)
  exportFormats = input<AspExportFormat[]>(['png', 'jpeg', 'webp']); // + 'svg' | 'pdf' | 'json'
  exportQuality = input<number>(90);                  // 10–100
  heading     = input<string>('Edit image');          // basic-mode title
  showHistory = input<boolean>(true);                 // show the history panel
  keyboardEnabled = input<boolean>(true);             // editor keyboard shortcuts
  fonts       = input<FontOption[]>(DEFAULT_FONTS);   // text font choices

  baseColor   = input<string>('#f4f6f9');
  accentColor = input<string>('#1f6feb');
  themeMode   = input<'light' | 'dark'>('light');

  saved        = output<Blob>();            // export / Save
  canceled     = output<void>();            // basic Cancel
  imageLoaded  = output<void>();            // an image finished loading
  exported     = output<Blob>();            // Export download produced a Blob
  errorOccurred = output<AspEditorError>(); // recoverable load/export/init error
}
```

### Keyboard shortcuts

While the pointer is over the editor (and not typing in a field): **Ctrl/Cmd+Z** undo,
**Ctrl/Cmd+Shift+Z / Ctrl+Y** redo, **Delete/Backspace** remove selection, **Ctrl/Cmd+C / V / D**
copy / paste / duplicate, **Ctrl/Cmd+A** select all, **Esc** deselect (or cancel the basic modal),
**Space** (hold) to pan. Disable with `[keyboardEnabled]="false"`.

### Headless engine

For headless or advanced use, `EditorEngine` (the Fabric wrapper) and the pure helpers
(`resolveTools`, `resolveFilters`, `deriveTheme`, `applyTheme`, `EditHistory`, `DeltaHistory`) are all
exported. `EditorEngine` exposes scene save/load (`exportScene` / `loadScene`), layers, guides,
artboard sizing and the AI/magic operations directly.

## Accessibility

WCAG AA color contrast (derivation-guaranteed), keyboard-operable controls, `:focus-visible` rings,
`prefers-reduced-motion` honored, and Trusted-Types-safe icon rendering. Run `axe` against the demo
to verify in your own setup.

## Security

This library renders consumer-supplied images and SVGs onto an HTML canvas; SVGs are rasterized
through a sandboxed `<img>` element, so scripts inside an SVG do not execute. Still treat
user-uploaded files as untrusted: validate type and size at your upload boundary, and sanitize any
text you overlay from untrusted sources. Exported blobs and PDFs reflect exactly what was drawn. The
optional AI tools download a model at runtime but never send your image data anywhere. Full policy and
private reporting: [SECURITY.md](https://github.com/ascentspark/angular-image-editor/blob/main/SECURITY.md).

## Versions

One package major per Angular major. Install the line that matches your app.

| Package | Angular | npm tag |
| ------- | ------- | ------- |
| `22.x`  | 22      | `latest` |
| `21.x`  | 21      | `ng21`  |
| `20.x`  | 20      | `ng20`  |

Each line is built and published against its own Angular major (separate `NN.x` branches), with the
matching `peerDependencies` range. Cross-cutting fixes land on `main` first and are cherry-picked to
the older lines, so the **same fix** ships across all supported Angular versions on the same day.

**How to read the version number.** The **major** is the Angular major it targets — `22.x` is for
Angular 22, `21.x` for Angular 21, `20.x` for Angular 20. Within a line we follow semver: the
**patch** (`22.0.2 → 22.0.3`) is a backward-compatible fix, the **minor** (`22.0.x → 22.1.0`) adds
backward-compatible features. There is no independent "library 1.x / 2.x" track to reconcile against
your Angular version — the major *is* the Angular version, so picking the right line is unambiguous and
`npm update` within a line is always safe.

**Why a fix can change behaviour in a patch.** Semver is about the **public API contract**
(components, inputs/outputs, exported types, DI tokens), not internal mechanics. A release that leaves
that contract untouched is a patch even if it changes *how* something works under the hood — e.g.
`22.0.3` moved the optional AI/HEIC packages out of the core import graph (see
[Optional heavy features](#optional-heavy-features-ai--heic)). No exported symbol changed, so it is a
patch; the only action needed is for apps that used those tools to register a loader. Pin or range
your dependency the usual way (`^22.0.0` to take patches/minors automatically); read the release notes
when a patch's notes call out a migration step like this one.

## 🗺️ Roadmap

> 🚧 **Work in progress for upcoming releases.** Everything below is built on **free** Fabric.js v7 —
> no paid SDKs, no commercial extensions — there are no firm dates yet, and pull requests are very
> welcome. The north star is the essential Photoshop / Photopea toolset, delivered the modern-Angular
> way (signals, standalone, zoneless) and free.

**Selection & masking**

| | Tool | What's coming |
| :-: | --- | --- |
| 🟦 | **Marquee & lasso selection** | Rectangular, elliptical and freehand selections that become a reusable mask — fill it, delete it, or confine a filter / adjustment to just the selected pixels. Complements the existing flood-fill magic wand. |
| 🎭 | **Layer masks** | Non-destructive per-layer masking (Fabric `clipPath`), painted with a brush or a gradient, so you can hide and reveal without touching the pixels underneath. |

**Retouch & paint**

| | Tool | What's coming |
| :-: | --- | --- |
| 🩹 | **Clone stamp & healing brush** | Sample pixels from one area and paint them over another to remove blemishes, objects or backgrounds; spot-heal blends the surrounding texture automatically. |
| 🪣 | **Paint bucket & eyedropper** | Flood-fill a region with a solid color or pattern, and sample any on-canvas color into the active swatch. |
| 🌗 | **Dodge, burn & smudge** | Brush-based local retouching — lighten, darken, saturate, or push pixels around for quick corrections. |

**Color & tone**

| | Tool | What's coming |
| :-: | --- | --- |
| 📈 | **Curves & levels** | Histogram-driven tonal control with per-channel curves and black / white / gamma points, alongside today's slider adjustments. |
| 🧪 | **Blend modes** | Per-layer compositing (multiply, screen, overlay, soft-light, …) via canvas composite operations, for the standard layer-stack looks. |
| 🧱 | **Adjustment layers** | Stackable, re-editable color and tone adjustments that affect the layers beneath them, instead of baking changes into a single image. |

**Vector, type & transform**

| | Tool | What's coming |
| :-: | --- | --- |
| ✒️ | **Bézier pen & boolean shapes** | A true vector pen with editable nodes for precise paths, plus union / subtract / intersect on shapes to build compound vectors. |
| 🔤 | **Text on a path & rich type** | Curve text along a path, with letter-spacing, line-height and OpenType controls on top of the current web-font picker. |
| 🔲 | **Free transform** | Skew, distort, perspective and warp, on top of the existing move / scale / rotate. |
| 🙂 | **Sticker & emoji library** | Finish the declared `sticker` tool with a searchable emoji / shape / badge library you can drop onto the canvas. |

Following the same approach as the AI tools and magic wand already in the box: modern Angular, and
free alternatives to capabilities that are otherwise paid in commercial editors.

## Documentation

A live playground and full docs for every tool, theming, the complete API and more:
**[angular-image-editor.ascentspark.com](https://angular-image-editor.ascentspark.com)**.

## Local development

Angular CLI multi-project workspace — library in `projects/angular-image-editor`, demo in
`projects/demo`:

```bash
npm install
npm start          # serve the demo (http://localhost:4200)
npm run build:lib  # build the publishable library to dist/
npm test           # unit tests (Vitest)
npm run lint
npm run pack:lib   # build + npm pack a tarball
```

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Help keep it healthy

We genuinely try to keep this library current, bug-free and secure, and the best way to get there is
together. If something breaks, please
[open an issue](https://github.com/ascentspark/angular-image-editor/issues) with a minimal
reproduction; if you can fix a bug or add something useful, pull requests are very welcome, big or
small. An open-source library stays dependable only when people use it, tell us what's broken, and
pitch in now and then — so thank you in advance for anything you send our way. 💛

## License

[MIT](./LICENSE), by [Ascentspark](https://ascentspark.com).
