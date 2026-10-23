import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  AspImageEditor,
  aspectOption,
  type AspAspectOption,
  type AspThemeMode,
} from '@ascentsparksoftware/angular-image-editor';

import { DocExample, type ExampleSource } from '../../shared/doc-example';
import { DocPage, type PageSection } from '../../shared/doc-page';

@Component({
  selector: 'demo-configuration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPage, DocExample, AspImageEditor],
  template: `
    <demo-doc-page
      heading="Configuration"
      lead="Shape the editor with inputs: choose which tools and filters appear, theme the whole UI from three colors, and control the canvas size — all without forking the component."
      [sections]="sections"
    >
      <demo-example
        anchor="tools"
        title="Tools & filters"
        description="Resolution order, easiest to most precise: mode sets the default set, tools (if given) replaces it as an explicit allowlist in your order, then disabledTools is subtracted."
        [sources]="toolSources"
      >
        @defer (on viewport) {
          <asp-image-editor
            mode="advanced"
            [tools]="['crop', 'rotate', 'text', 'shapes']"
            height="480px"
          />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
        <p class="prose">
          Filters follow the same idea via <code>filters</code>: an explicit
          <code>AspFilter[]</code>, the literal <code>'all'</code> (every Fabric filter), or
          <code>null</code> for the mode default.
        </p>
      </demo-example>

      <demo-example
        anchor="chrome"
        title="Chrome vs. tools"
        description="mode picks a default tool set AND a default chrome; chrome overrides the second half on its own. Below: the basic tool set inside the full workspace. The commit button (commitLabel) hands the result back through (saved) and never writes a file; showDownload removes the Export menu's download for hosts that only want the Blob."
        [sources]="chromeSources"
      >
        @defer (on viewport) {
          <asp-image-editor
            mode="basic"
            chrome="workspace"
            commitLabel="Use this image"
            [showDownload]="false"
            height="480px"
            (saved)="onCommitted($event)"
          />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
        @if (committed()) {
          <p class="note">{{ committed() }}</p>
        }
        <p class="prose">
          The three chromes: <code>dialog</code> (compact card; fixed crop frame by default — the
          image pans and zooms under it), <code>workspace</code> (rail, options and layers; movable
          crop frame by default) and <code>viewer</code> (zoom + export only). Defaults:
          <code>basic → dialog</code>, <code>viewer → viewer</code>, <code>advanced</code> /
          <code>full → workspace</code>. The crop frame itself is a third, independent switch — see
          <a href="#crop-frame">Crop frame &amp; opening aspect</a>.
        </p>
      </demo-example>

      <demo-example
        anchor="crop-frame"
        title="Crop frame & opening aspect"
        description="cropFrame picks the crop model independently of the chrome: 'fixed' is the slot crop (the frame stays put, the image pans and zooms under it, and it persists while other tools are used), 'movable' the editing crop with Apply. Below: the advanced tool set with a fixed-slot contain crop that opens at a custom 1200×630 'Social' ratio — initialAspect takes an AspAspectOption, not only a preset."
        [sources]="cropFrameSources"
      >
        @defer (on viewport) {
          <asp-image-editor
            mode="advanced"
            src="asc-logo-full.svg"
            cropFrame="fixed"
            fitMode="contain"
            [aspectPresets]="['1:1']"
            [aspectRatios]="socialRatios"
            [initialAspect]="socialRatios[0]"
            exportBackground="#ffffff"
            [exportFormats]="['png']"
            commitLabel="Use this banner"
            [showDownload]="false"
            height="520px"
            (saved)="onCommitted($event)"
          />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
        <p class="prose">
          Defaults are unchanged: <code>cropFrame</code> is <code>null</code>, which means
          <code>fixed</code> in the <code>dialog</code> chrome and <code>movable</code> elsewhere.
          With a fixed frame the options panel drops Apply / Cancel — the chips are the whole control
          (<em>Free</em> removes the frame) and the commit button exports the slot. A sole constrained
          chip offered without <em>Free</em> — preset or custom — is auto-selected as the opening frame.
        </p>
      </demo-example>

      <demo-example
        anchor="theming"
        title="Theming"
        description="Three inputs derive the entire UI palette at runtime, with guaranteed WCAG AA text contrast. Set them to match your brand in light or dark — no extra config."
        [sources]="themeSources"
      >
        <div class="ctl">
          <label>Base <input type="color" [value]="base()" (input)="setBase($event)" /></label>
          <label
            >Accent <input type="color" [value]="accent()" (input)="setAccent($event)"
          /></label>
          <button type="button" (click)="toggleMode()">{{ mode() }}</button>
        </div>
        @defer (on viewport) {
          <asp-image-editor
            mode="advanced"
            [baseColor]="base()"
            [accentColor]="accent()"
            [themeMode]="mode()"
            height="480px"
          />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
        <p class="prose">
          The derived values are scoped CSS custom properties on the editor root. Override any
          single token in your own CSS — e.g. set <code>--asp-radius-md</code> or
          <code>--asp-accent</code> on the <code>asp-image-editor</code> selector. See the override
          tab for the exact syntax.
        </p>
      </demo-example>

      <demo-example
        anchor="sizing"
        title="Canvas size & responsive"
        description="width and height accept px, %, vh or any CSS length / calc(). A per-mode minimum is always enforced so the toolbars never collapse, and the editor adapts to its own width via container queries."
        [sources]="sizeSources"
      >
        @defer (on viewport) {
          <asp-image-editor mode="advanced" width="100%" height="70vh" />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
      </demo-example>
    </demo-doc-page>
  `,
  styles: `
    .ctl {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
    }
    .ctl label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted);
    }
    .ctl input[type='color'] {
      width: 30px;
      height: 26px;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0;
      background: none;
      cursor: pointer;
    }
    .ctl button {
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--ink);
      border-radius: 8px;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: capitalize;
      padding: 0.35rem 0.85rem;
      cursor: pointer;
    }
  `,
})
export class Configuration {
  protected readonly base = signal('#f4f6f9');
  protected readonly accent = signal('#1f6feb');
  protected readonly mode = signal<AspThemeMode>('light');

  protected readonly committed = signal('');

  protected readonly sections: PageSection[] = [
    { id: 'tools', label: 'Tools & filters' },
    { id: 'chrome', label: 'Chrome vs. tools' },
    { id: 'crop-frame', label: 'Crop frame & opening aspect' },
    { id: 'theming', label: 'Theming' },
    { id: 'sizing', label: 'Canvas size' },
  ];

  protected setBase(e: Event): void {
    this.base.set((e.target as HTMLInputElement).value);
  }
  protected setAccent(e: Event): void {
    this.accent.set((e.target as HTMLInputElement).value);
  }
  protected toggleMode(): void {
    this.mode.update((m) => (m === 'light' ? 'dark' : 'light'));
  }

  protected readonly toolSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<!-- 1. mode default, minus filters and sticker -->
<asp-image-editor mode="advanced" [disabledTools]="['filters', 'sticker']" />

<!-- 2. a bespoke rail (order preserved) -->
<asp-image-editor [tools]="['crop', 'rotate', 'text', 'shapes']" />

<!-- filters: explicit list, 'all', or null for the mode default -->
<asp-image-editor mode="advanced" [filters]="['brightness', 'contrast', 'grayscale']" />
<asp-image-editor mode="advanced" [filters]="'all'" />`,
    },
  ];

  protected onCommitted(blob: Blob): void {
    this.committed.set(`committed ${blob.type} — ${blob.size} bytes, nothing downloaded`);
  }

  protected readonly chromeSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<!-- the basic tool set, but in the full workspace -->
<asp-image-editor mode="basic" chrome="workspace" />

<!-- the advanced tool set, inside the compact dialog card -->
<asp-image-editor mode="advanced" chrome="dialog" initialAspect="1:1" />

<!-- commit-only hosting: the host wants the Blob, never a file in Downloads -->
<asp-image-editor
  mode="advanced"
  commitLabel="Use this image"
  [showDownload]="false"
  (saved)="onCommitted($event)"
/>`,
    },
    {
      label: 'TS',
      lang: 'ts',
      code: `// (saved) fires from the commit button in EVERY chrome and never from a download.
// (exported) fires from Export → Download only. Listen to both if you want both.
onCommitted(blob: Blob): void {
  upload(blob);
}`,
    },
  ];

  /** A CMS target with real pixel dimensions; the chip label and the export size come from it. */
  protected readonly socialRatios: AspAspectOption[] = [aspectOption(1200, 630, 'Social')];

  protected readonly cropFrameSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<!-- advanced tool set + fixed-slot contain crop, opening at a custom ratio -->
<asp-image-editor
  mode="advanced"
  cropFrame="fixed"
  fitMode="contain"
  [aspectPresets]="['1:1']"
  [aspectRatios]="socialRatios"
  [initialAspect]="socialRatios[0]"
  exportBackground="#ffffff"
  commitLabel="Use this banner"
  (saved)="onCommitted($event)"
/>

<!-- the editing (movable) crop inside the compact dialog card -->
<asp-image-editor mode="basic" cropFrame="movable" initialAspect="1:1" />`,
    },
    {
      label: 'TS',
      lang: 'ts',
      code: `import { aspectOption, type AspAspectOption } from '@ascentsparksoftware/angular-image-editor';

// initialAspect accepts a preset ('1:1', '16:9', …) OR an AspAspectOption.
// List the same option in aspectRatios to show it as a chip; the constraint
// (and its 1200×630 export size) applies either way.
socialRatios: AspAspectOption[] = [aspectOption(1200, 630, 'Social')];

// Same thing through the dialog:
const banner = await this.editor.open({
  src,
  mode: 'advanced',
  cropFrame: 'fixed',
  fitMode: 'contain',
  aspectRatios: this.socialRatios,
  initialAspect: this.socialRatios[0],
  commitLabel: 'Use this banner',
});`,
    },
  ];

  protected readonly themeSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<asp-image-editor
  baseColor="#f4f6f9"
  accentColor="#1f6feb"
  themeMode="light"
/>`,
    },
    {
      label: 'Override',
      lang: 'scss',
      code: `asp-image-editor {
  --asp-radius-md: 12px;
  --asp-accent: #ff5a5f;
}`,
    },
  ];

  protected readonly sizeSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<!-- px | % | vh | calc() — a per-mode minimum is always enforced -->
<asp-image-editor width="100%" height="70vh" />
<asp-image-editor height="calc(100vh - 120px)" />`,
    },
  ];
}
