import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AspImageEditor, type AspMode } from '@ascentsparksoftware/angular-image-editor';

import { DocExample, type ExampleSource } from '../../shared/doc-example';
import { DocPage, type PageSection } from '../../shared/doc-page';
import { SeoService } from '../../shared/seo.service';

@Component({
  selector: 'demo-getting-started',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPage, DocExample, AspImageEditor],
  template: `
    <demo-doc-page
      heading="Getting started"
      lead="Install the package, drop the standalone component into a template, and pick a mode. The editor is signal-driven, standalone, OnPush and zoneless-compatible."
      [sections]="sections"
    >
      <demo-example
        anchor="install"
        title="Installation"
        description="The library ships ESM only. Fabric.js is a runtime dependency you install alongside it; Angular is a peer dependency."
        [sources]="installSources"
      >
        <p class="prose">
          Optional add-ons, only if you use the matching feature:
          <code>&#64;imgly/background-removal</code> + <code>onnxruntime-web</code> for the AI
          background tools, and <code>heic2any</code> for HEIC/HEIF import. Without them those
          features simply don't appear.
        </p>
      </demo-example>

      <demo-example
        anchor="quick-start"
        title="Quick start"
        description="Import AspImageEditor, give the host a size, and listen for the saved Blob. That's the whole integration."
        [sources]="quickStartSources"
      >
        @defer (on viewport) {
          <asp-image-editor mode="advanced" height="520px" (saved)="onSaved($event)" />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
        @if (result()) {
          <p class="note">{{ result() }}</p>
        }
      </demo-example>

      <demo-example
        anchor="modes"
        title="Modes"
        description="One input switches the whole experience: viewer (read-only), basic (compact card / modal), advanced (full workspace, curated tools) and full (every tool + filter)."
        [sources]="modeSources"
      >
        <div class="seg">
          @for (m of modes; track m) {
            <button
              type="button"
              [class.seg--on]="mode() === m"
              (click)="mode.set(m)"
            >
              {{ m }}
            </button>
          }
        </div>
        @defer (on viewport) {
          <asp-image-editor [mode]="mode()" height="520px" />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
      </demo-example>
    </demo-doc-page>
  `,
  styles: `
    .seg {
      display: inline-flex;
      gap: 4px;
      margin-bottom: 0.9rem;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
    }
    .seg button {
      border: 0;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: capitalize;
      padding: 0.3rem 0.85rem;
      border-radius: 7px;
      cursor: pointer;
    }
    .seg button.seg--on {
      background: var(--surface);
      color: var(--accent);
      box-shadow: var(--shadow-xs);
    }
  `,
})
export class GettingStarted {
  private readonly seo = inject(SeoService);

  protected readonly modes: readonly AspMode[] = ['viewer', 'basic', 'advanced', 'full'];
  protected readonly mode = signal<AspMode>('advanced');
  protected readonly result = signal('');

  protected readonly sections: PageSection[] = [
    { id: 'install', label: 'Installation' },
    { id: 'quick-start', label: 'Quick start' },
    { id: 'modes', label: 'Modes' },
  ];

  protected readonly installSources: ExampleSource[] = [
    {
      label: 'npm',
      lang: 'bash',
      code: `npm i @ascentsparksoftware/angular-image-editor fabric

# optional — AI background tools
npm i @imgly/background-removal onnxruntime-web
# optional — HEIC / HEIF import
npm i heic2any`,
    },
  ];

  protected readonly quickStartSources: ExampleSource[] = [
    {
      label: 'TS',
      lang: 'ts',
      code: `import { Component } from '@angular/core';
import { AspImageEditor } from '@ascentsparksoftware/angular-image-editor';

@Component({
  selector: 'app-photo',
  imports: [AspImageEditor],
  template: \`
    <asp-image-editor mode="advanced" height="520px" (saved)="onSaved($event)" />
  \`,
})
export class PhotoComponent {
  onSaved(blob: Blob): void {
    // upload or preview the edited image
  }
}`,
    },
    {
      label: 'Host CSS',
      lang: 'scss',
      code: `/* Or size the host element instead of the height input */
asp-image-editor { display: block; height: 640px; }`,
    },
  ];

  protected readonly modeSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<asp-image-editor mode="viewer" [src]="url" />
<asp-image-editor mode="basic" [src]="url" />
<asp-image-editor mode="advanced" [src]="url" />
<asp-image-editor mode="full" [src]="url" />`,
    },
  ];

  constructor() {
    this.seo.setFaq([
      {
        q: 'Is the Angular Image Editor free?',
        a: 'Yes. It is free and open-source under the MIT license, built on Fabric.js v7 (also MIT). No license keys, no telemetry, no per-seat pricing.',
      },
      {
        q: 'Does it need a backend?',
        a: 'No. The editor runs entirely in the browser. It emits the edited image as a Blob via the (saved) output; you decide whether to upload it, preview it, or store it.',
      },
      {
        q: 'Which Angular version does it support?',
        a: 'Angular 22. The component is standalone, signal-based, OnPush and zoneless-compatible, with @angular/core and @angular/common ^22 as peer dependencies.',
      },
      {
        q: 'Does it support HEIC images?',
        a: 'Yes, with the optional heic2any dependency installed. HEIC/HEIF files are decoded (and EXIF-oriented) on import; large JPEGs are downscaled automatically.',
      },
      {
        q: 'Can it export PDF and SVG?',
        a: 'Yes. Export formats include PNG, JPEG, WEBP, SVG (with the used web fonts embedded), PDF (via a lazily-loaded jsPDF), and a re-editable JSON scene.',
      },
    ]);
  }

  protected onSaved(blob: Blob): void {
    this.result.set(`saved ${blob.type} — ${blob.size} bytes`);
  }
}
