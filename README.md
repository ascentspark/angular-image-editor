<div align="center">

# @ascentsparksoftware/angular-image-editor

A standalone, themeable image editor for Angular, by
<a href="https://ascentspark.com" target="_blank" rel="noopener">Ascentspark</a>

<a href="https://ascentspark.com" target="_blank" rel="noopener"><img src="https://cdn.ascentspark.com/assets/images/asc-logo-full.svg" alt="Ascentspark" height="40"></a>

### Crop, filter, draw, redact, layers and in-browser AI background removal — built from scratch on Fabric.js v7

[![npm version](https://img.shields.io/npm/v/@ascentsparksoftware/angular-image-editor.svg?color=dd0031)](https://www.npmjs.com/package/@ascentsparksoftware/angular-image-editor)
[![downloads](https://img.shields.io/npm/dm/@ascentsparksoftware/angular-image-editor.svg)](https://www.npmjs.com/package/@ascentsparksoftware/angular-image-editor)
[![Angular 22](https://img.shields.io/badge/Angular-22-dd0031.svg)](https://angular.dev)
[![license MIT](https://img.shields.io/github/license/ascentspark/angular-image-editor?color=3b82f6)](https://github.com/ascentspark/angular-image-editor/blob/main/LICENSE)

**[✨ Features](#features)** &nbsp;·&nbsp;
**[🎨 Theming](#theming)** &nbsp;·&nbsp;
**[🧩 API](#api)** &nbsp;·&nbsp;
**[🔒 Security](#security)**

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
> for free** (MIT): the **Remove background** and **Cut out subject** tools lazy-load an ONNX model
> and run it entirely in the browser — no image ever leaves the page, no API key, no per-call cost.
> The model packages are `optionalDependencies`, so if you don't install them the rest of the editor
> is unaffected and the AI tools simply don't appear. There's also a dependency-free **Magic wand**
> (flood-fill erase) for clearing flat color regions by click. See [Smart & AI tools](#smart--ai-tools).

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
npm install @ascentsparksoftware/angular-image-editor fabric
```

- **Peer dependencies:** `@angular/core` and `@angular/common` `^22`.
- **Runtime dependency:** `fabric` `^7.4.0` (declared by the package; install it alongside). Fabric is
  lazy-loaded on demand, so it never weighs down your initial bundle.
- **Optional** (only if you want the AI tools): `@imgly/background-removal` and `onnxruntime-web`.
  Without them, **Remove background** and **Cut out subject** are simply not shown.

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

The AI tools lazy-load `@imgly/background-removal`, which fetches and caches an ONNX model at runtime
and runs it on-device — no image data leaves the browser. A progress bar and busy cursor show while
the model loads. Install the optional dependencies to enable them; omit them to ship a smaller bundle
without these two tools. The magic wand has no dependencies and works everywhere.

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
