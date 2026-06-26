import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AspImageEditorDialog } from '@ascentsparksoftware/angular-image-editor';

import { DocExample, type ExampleSource } from '../../shared/doc-example';
import { DocPage, type PageSection } from '../../shared/doc-page';

@Component({
  selector: 'demo-reference',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPage, DocExample],
  template: `
    <demo-doc-page
      heading="Integration & API"
      lead="Use the editor as a modal, drive it headlessly, listen to its events, and reference the full input/output surface."
      [sections]="sections"
    >
      <demo-example
        anchor="dialog"
        title="Modal dialog"
        description="For avatar / quick-edit flows, inject AspImageEditorDialog and await a Blob (or null on cancel). Opens the basic editor as a modal."
        [sources]="dialogSources"
      >
        <button type="button" class="brandbtn" (click)="edit()">Edit a photo…</button>
        @if (result()) {
          <p class="note">{{ result() }}</p>
        }
      </demo-example>

      <demo-example
        anchor="engine"
        title="Headless engine"
        description="The Fabric-backed EditorEngine and the pure helpers are exported for headless or advanced use — scene save/load, layers, guides, artboard, and the AI/magic operations directly."
        [sources]="engineSources"
      >
        <p class="prose">
          Also exported: <code>resolveTools</code>, <code>resolveFilters</code>,
          <code>deriveTheme</code>, <code>applyTheme</code>, <code>EditHistory</code> and
          <code>DeltaHistory</code>.
        </p>
      </demo-example>

      <demo-example
        anchor="events"
        title="Events"
        description="Outputs you can bind on the component."
      >
        <table class="api-table">
          <thead>
            <tr><th>Output</th><th>Payload</th><th>Fires</th></tr>
          </thead>
          <tbody>
            <tr><td><code>saved</code></td><td><code>Blob</code></td><td>Export / Save</td></tr>
            <tr><td><code>canceled</code></td><td><code>void</code></td><td>Basic-mode Cancel</td></tr>
            <tr><td><code>imageLoaded</code></td><td><code>void</code></td><td>An image finished loading</td></tr>
            <tr><td><code>exported</code></td><td><code>Blob</code></td><td>Export download produced a Blob</td></tr>
            <tr><td><code>errorOccurred</code></td><td><code>AspEditorError</code></td><td>Recoverable load/export/init error</td></tr>
          </tbody>
        </table>
      </demo-example>

      <demo-example
        anchor="api"
        title="API reference"
        description="The AspImageEditor component inputs."
      >
        <table class="api-table">
          <thead>
            <tr><th>Input</th><th>Type</th><th>Default</th></tr>
          </thead>
          <tbody>
            <tr><td><code>src</code></td><td><code>string | Blob | null</code></td><td><code>null</code></td></tr>
            <tr><td><code>mode</code></td><td><code>AspMode</code></td><td><code>'advanced'</code></td></tr>
            <tr><td><code>width</code> / <code>height</code></td><td><code>AspSize | null</code></td><td><code>null</code></td></tr>
            <tr><td><code>tools</code></td><td><code>AspTool[] | null</code></td><td><code>null</code></td></tr>
            <tr><td><code>disabledTools</code></td><td><code>AspTool[]</code></td><td><code>[]</code></td></tr>
            <tr><td><code>filters</code></td><td><code>AspFilter[] | 'all' | null</code></td><td><code>null</code></td></tr>
            <tr><td><code>aspectPresets</code></td><td><code>AspAspectPreset[]</code></td><td><code>['free','1:1','4:3','16:9']</code></td></tr>
            <tr><td><code>aspectRatios</code></td><td><code>AspAspectOption[]</code></td><td><code>[]</code></td></tr>
            <tr><td><code>exportFormats</code></td><td><code>AspExportFormat[]</code></td><td><code>['png','jpeg','webp']</code></td></tr>
            <tr><td><code>exportQuality</code></td><td><code>number</code></td><td><code>90</code></td></tr>
            <tr><td><code>heading</code></td><td><code>string</code></td><td><code>'Edit image'</code></td></tr>
            <tr><td><code>showHistory</code></td><td><code>boolean</code></td><td><code>true</code></td></tr>
            <tr><td><code>keyboardEnabled</code></td><td><code>boolean</code></td><td><code>true</code></td></tr>
            <tr><td><code>fonts</code></td><td><code>FontOption[]</code></td><td><code>DEFAULT_FONTS</code></td></tr>
            <tr><td><code>baseColor</code></td><td><code>string</code></td><td><code>'#f4f6f9'</code></td></tr>
            <tr><td><code>accentColor</code></td><td><code>string</code></td><td><code>'#1f6feb'</code></td></tr>
            <tr><td><code>themeMode</code></td><td><code>'light' | 'dark'</code></td><td><code>'light'</code></td></tr>
          </tbody>
        </table>
      </demo-example>

      <demo-example
        anchor="accessibility"
        title="Accessibility"
        description="WCAG AA color contrast (derivation-guaranteed), keyboard-operable controls, :focus-visible rings, prefers-reduced-motion honored, and Trusted-Types-safe icon rendering."
      ></demo-example>

      <demo-example
        anchor="security"
        title="Security"
        description="The editor renders consumer-supplied images and SVGs onto a canvas; SVGs are rasterized through a sandboxed <img>, so scripts inside an SVG do not execute. Validate uploads at your boundary; the optional AI model is fetched at runtime but no image data leaves the browser."
      >
        <p class="prose">
          Full policy and private reporting:
          <a href="https://github.com/ascentspark/angular-image-editor/blob/main/SECURITY.md" target="_blank" rel="noopener">SECURITY.md</a>.
        </p>
      </demo-example>
    </demo-doc-page>
  `,
  styles: `
    .brandbtn {
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #fff;
      border-radius: 10px;
      font: inherit;
      font-weight: 600;
      padding: 0.55rem 1.2rem;
      cursor: pointer;
    }
  `,
})
export class Reference {
  private readonly dialog = inject(AspImageEditorDialog);
  protected readonly result = signal('');

  protected readonly sections: PageSection[] = [
    { id: 'dialog', label: 'Modal dialog' },
    { id: 'engine', label: 'Headless engine' },
    { id: 'events', label: 'Events' },
    { id: 'api', label: 'API reference' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'security', label: 'Security' },
  ];

  protected async edit(): Promise<void> {
    const blob = await this.dialog.open({
      heading: 'Update profile photo',
      aspectPresets: ['1:1', '4:3', 'free'],
    });
    this.result.set(blob ? `saved ${blob.type} — ${blob.size} bytes` : 'canceled');
  }

  protected readonly dialogSources: ExampleSource[] = [
    {
      label: 'TS',
      lang: 'ts',
      code: `import { inject } from '@angular/core';
import { AspImageEditorDialog } from '@ascentsparksoftware/angular-image-editor';

private readonly editor = inject(AspImageEditorDialog);

async edit(src: string): Promise<void> {
  const blob = await this.editor.open({
    src,
    heading: 'Update profile photo',
    aspectPresets: ['1:1', '4:3', 'free'],
  });
  if (blob) { /* user saved — upload blob */ }
}`,
    },
  ];

  protected readonly engineSources: ExampleSource[] = [
    {
      label: 'TS',
      lang: 'ts',
      code: `import { EditorEngine, deriveTheme } from '@ascentsparksoftware/angular-image-editor';

// derive the full --asp-* token map from three inputs
const tokens = deriveTheme('#f4f6f9', '#1f6feb', 'light');`,
    },
  ];
}
