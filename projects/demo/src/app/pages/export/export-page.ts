import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AspImageEditor } from '@ascentsparksoftware/angular-image-editor';

import { DocExample, type ExampleSource } from '../../shared/doc-example';
import { DocPage, type PageSection } from '../../shared/doc-page';

@Component({
  selector: 'demo-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPage, DocExample, AspImageEditor],
  template: `
    <demo-doc-page
      heading="Export"
      lead="Choose which formats the Export menu offers, and the editor produces the corresponding Blob. PNG, JPEG, WEBP, a font-embedded SVG, a PDF, or a re-editable JSON scene."
      [sections]="sections"
    >
      <demo-example
        anchor="formats"
        title="Formats & quality"
        description="exportFormats lists the offered formats; exportQuality (10–100) sets raster quality. The Export menu downloads the result and emits it via (exported) / (saved)."
        [sources]="formatSources"
      >
        @defer (on viewport) {
          <asp-image-editor
            mode="advanced"
            [exportFormats]="['png', 'jpeg', 'webp', 'svg', 'pdf', 'json']"
            [exportQuality]="90"
            height="500px"
            (exported)="onExported($event)"
          />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
        @if (result()) {
          <p class="note">{{ result() }}</p>
        }
      </demo-example>

      <demo-example
        anchor="svg"
        title="SVG with embedded fonts"
        description="SVG export inlines the web fonts used by text as base64 @font-face rules, so the file renders the true typeface in any viewer — self-contained, with text kept as real, selectable text."
        [sources]="svgSources"
      >
        <p class="prose">
          Add <code>'svg'</code> to <code>exportFormats</code> and export — the downloaded
          <code>.svg</code> carries the font data, no network needed to render it correctly.
        </p>
      </demo-example>

      <demo-example
        anchor="pdf"
        title="PDF"
        description="PDF export lazily loads jsPDF and produces a single-page document sized to the artboard (or crop region) — handy for printable proofs."
        [sources]="pdfSources"
      ></demo-example>

      <demo-example
        anchor="json"
        title="JSON scene & exact-pixel export"
        description="The json format serializes the full re-editable scene. With an artboard or crop region set, raster/PDF export render at exactly that pixel size — the same machinery the crop tool uses."
        [sources]="jsonSources"
      ></demo-example>
    </demo-doc-page>
  `,
})
export class ExportPage {
  protected readonly result = signal('');

  protected readonly sections: PageSection[] = [
    { id: 'formats', label: 'Formats & quality' },
    { id: 'svg', label: 'SVG fonts' },
    { id: 'pdf', label: 'PDF' },
    { id: 'json', label: 'JSON & exact-pixel' },
  ];

  protected onExported(blob: Blob): void {
    this.result.set(`exported ${blob.type} — ${blob.size} bytes`);
  }

  protected readonly formatSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<asp-image-editor
  [exportFormats]="['png', 'jpeg', 'webp', 'svg', 'pdf', 'json']"
  [exportQuality]="90"
  (exported)="onExported($event)"
/>`,
    },
    {
      label: 'TS',
      lang: 'ts',
      code: `onExported(blob: Blob): void {
  // download it, upload it, or preview it
  console.log(blob.type, blob.size);
}`,
    },
  ];

  protected readonly svgSources: ExampleSource[] = [
    { label: 'HTML', lang: 'html', code: `<asp-image-editor [exportFormats]="['png', 'svg']" />` },
  ];

  protected readonly pdfSources: ExampleSource[] = [
    { label: 'HTML', lang: 'html', code: `<asp-image-editor [exportFormats]="['png', 'pdf']" />` },
  ];

  protected readonly jsonSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<asp-image-editor [exportFormats]="['png', 'json']" />`,
    },
  ];
}
