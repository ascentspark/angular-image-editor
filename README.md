# @ascentspark/angular-image-editor

A standalone, themeable **Angular 22** image editor built from scratch on
**[Fabric.js v7](https://fabricjs.com/) (MIT)** — a free, open-source alternative to
commercial editors (Syncfusion / Pintura / Filerobot). No license keys, no telemetry.

- **Four modes** — `viewer` · `basic` · `advanced` · `full`
- **Editing** — crop (aspect presets), rotate / straighten, flip, zoom / pan, fine-tune
  adjustments (brightness/contrast/saturation/vibrance/hue/blur/…), filter looks
  (B&W/sepia/invert/sharpen), draw / pen, shapes, arrows, text, freehand redaction
  (solid / blur / pixelate), frames, undo / redo history, image picker + upload, and
  export to PNG / JPEG / WEBP / SVG / JSON
- **3-input runtime theming** — `baseColor` + `accentColor` + `themeMode` derive the whole
  palette as scoped `--asp-*` CSS variables, with guaranteed WCAG **AA** contrast
- **Standalone, signals, OnPush, zoneless-compatible.** No `any`. WCAG AA, keyboard
  operable, focus-visible, reduced-motion, Trusted-Types safe.

## Install

```bash
npm install @ascentspark/angular-image-editor fabric
```

- **Peer dependencies:** `@angular/core` and `@angular/common` `^22`.
- **Runtime dependency:** `fabric` `^7.4.0` (declared by the package; install it alongside).
  Fabric is lazy-loaded on demand, so it never weighs down your initial bundle.

## Quick start

`AspImageEditor` is a standalone component — import it directly:

```ts
import { Component } from '@angular/core';
import { AspImageEditor } from '@ascentspark/angular-image-editor';

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

Give the host element a size — the editor fills its container:

```css
asp-image-editor { display: block; height: 640px; }
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
2. **`tools`** (if provided) is an explicit allowlist that *replaces* the mode default,
   in the order you give.
3. **`disabledTools`** is then subtracted from the result.

```html
<!-- advanced, but without filters or stickers -->
<asp-image-editor mode="advanced" [disabledTools]="['filters', 'sticker']" />

<!-- a bespoke rail (order preserved) -->
<asp-image-editor [tools]="['crop', 'rotate', 'text']" />
```

Filters follow the same idea via `filters`: an explicit `AspFilter[]`, the literal
`'all'` (every Fabric filter), or `null` for the mode default.

```html
<asp-image-editor mode="advanced" [filters]="['brightness', 'contrast', 'grayscale']" />
<asp-image-editor mode="advanced" [filters]="'all'" />
```

## Theming

Three inputs derive the **entire** UI palette at runtime — set them and the editor blends
into your brand in light or dark, with WCAG **AA** text contrast guaranteed (AAA for primary
text), no extra config:

- **`baseColor`** — neutral anchor; surfaces, ink, and borders are tinted toward its hue.
- **`accentColor`** — interactive accent; buttons, active tool, focus ring, selection.
- **`themeMode`** — `'light'` or `'dark'`.

The derived values are applied as scoped CSS custom properties on the editor root, so they
never clash with your page. For fine control you can override any individual variable:

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

You can also call the pure helper directly: `deriveTheme(baseColor, accentColor, mode)`
returns the full token map, and `applyTheme(element, tokens)` sets them.
</details>

## Modal dialog

For avatar / quick-edit flows, open the `basic` editor as a modal and await the result:

```ts
import { Component, inject } from '@angular/core';
import { AspImageEditorDialog } from '@ascentspark/angular-image-editor';

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
  mode        = input<AspMode>('advanced');          // 'viewer'|'basic'|'advanced'|'full'
  tools       = input<AspTool[] | null>(null);       // explicit allowlist
  disabledTools = input<AspTool[]>([]);              // subtracted from the resolved set
  filters     = input<AspFilter[] | 'all' | null>(null);
  aspectPresets = input<AspAspectPreset[]>(['free', '1:1', '4:3', '16:9']);
  exportFormats = input<AspExportFormat[]>(['png', 'jpeg', 'webp']);
  exportQuality = input<number>(90);                 // 10–100
  heading     = input<string>('Edit image');         // basic-mode title

  baseColor   = input<string>('#f4f6f9');
  accentColor = input<string>('#1f6feb');
  themeMode   = input<'light' | 'dark'>('light');

  saved    = output<Blob>();    // export / Save
  canceled = output<void>();    // basic Cancel
}
```

For headless use, `EditorEngine` (the Fabric wrapper) and the pure helpers
(`resolveTools`, `resolveFilters`, `deriveTheme`, `EditHistory`) are exported too.

## Accessibility

WCAG AA color contrast (derivation-guaranteed), keyboard-operable controls,
`:focus-visible` rings, `prefers-reduced-motion` honored, and Trusted-Types-safe icon
rendering. Run `axe` against the demo to verify in your own setup.

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

## License

[MIT](./LICENSE) © Ascentspark Software Private Limited
