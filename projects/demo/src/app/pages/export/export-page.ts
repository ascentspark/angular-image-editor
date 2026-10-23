import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
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
        description="exportFormats lists the offered formats; exportQuality (10–100) sets raster quality. Export → Download writes a file and emits it via (exported); the commit button hands the Blob to (saved) and writes nothing."
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
        anchor="commit"
        title="Commit vs. download"
        description="Two events for two intents. (saved) means the user committed — the commit button in every chrome fires it with the Blob and no file is written. (exported) means a file was written from the Export menu. A download never fires (saved), so a host collecting the result is never also left with a copy in the user's Downloads folder."
        [sources]="commitSources"
      >
        <p class="prose">
          Relabel the commit button with <code>commitLabel</code> ("Use this logo"), hide the
          download with <code>[showDownload]="false"</code>, or hide the commit in a workspace with
          <code>[showCommit]="false"</code>. The dialog chrome always has a commit button.
        </p>
      </demo-example>

      <demo-example
        anchor="background"
        title="Letterboxed crops & export background"
        description="A contain-fit crop (fitMode='contain') lets an image of any aspect zoom OUT to fit the frame — a wide wordmark in a square slot. The area it leaves uncovered is filled with exportBackground at export; without one, PNG/WebP stay transparent and JPEG is filled white, never black."
        [sources]="backgroundSources"
      >
        @defer (on viewport) {
          <asp-image-editor
            mode="basic"
            src="asc-logo-full.svg"
            heading="Place the logo"
            [aspectPresets]="['1:1', '16:9']"
            initialAspect="1:1"
            fitMode="contain"
            exportBackground="#ffffff"
            [exportFormats]="['png']"
            commitLabel="Use this logo"
            (saved)="onLogo($event)"
          />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
        @if (logoPreview(); as preview) {
          <p class="note">
            <img class="thumb" [src]="preview" alt="Committed logo" /> {{ logoResult() }}
          </p>
        }
      </demo-example>

      <demo-example
        anchor="resolution"
        title="Export resolution"
        description="A cropped export carries the source image's real pixels, never the on-screen size of the crop frame. Set exportTarget for an exact size, or give an aspect option real dimensions so the selected chip decides. Either way the export is capped at the source's own resolution — the editor never upscales."
        [sources]="resolutionSources"
      >
        <p class="prose">
          Without a target, a crop exports at full source fidelity. With one, it is exactly that
          size unless the photo does not hold that many pixels.
        </p>
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
export class ExportPage implements OnDestroy {
  protected readonly result = signal('');
  protected readonly logoResult = signal('');
  protected readonly logoPreview = signal<string | null>(null);

  protected readonly sections: PageSection[] = [
    { id: 'formats', label: 'Formats & quality' },
    { id: 'commit', label: 'Commit vs. download' },
    { id: 'background', label: 'Letterbox & background' },
    { id: 'resolution', label: 'Export resolution' },
    { id: 'svg', label: 'SVG fonts' },
    { id: 'pdf', label: 'PDF' },
    { id: 'json', label: 'JSON & exact-pixel' },
  ];

  protected onExported(blob: Blob): void {
    this.result.set(`exported ${blob.type} — ${blob.size} bytes`);
  }

  protected onLogo(blob: Blob): void {
    const previous = this.logoPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.logoPreview.set(URL.createObjectURL(blob));
    this.logoResult.set(`committed ${blob.type} — ${blob.size} bytes (square, white letterbox)`);
  }

  ngOnDestroy(): void {
    const previous = this.logoPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
  }

  protected readonly commitSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<asp-image-editor
  mode="advanced"
  commitLabel="Use this image"
  [showDownload]="false"
  (saved)="onCommitted($event)"
  (exported)="onDownloaded($event)"
/>`,
    },
    {
      label: 'TS',
      lang: 'ts',
      code: `onCommitted(blob: Blob): void {
  // the commit button: the result, and nothing written to disk
  upload(blob);
}
onDownloaded(blob: Blob): void {
  // Export → Download: a file was written; (saved) did NOT fire
}`,
    },
  ];

  protected readonly backgroundSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<asp-image-editor
  mode="basic"
  [src]="logoFile"
  initialAspect="1:1"
  fitMode="contain"
  exportBackground="#ffffff"
  [exportFormats]="['png']"
  commitLabel="Use this logo"
  (saved)="onLogo($event)"
/>`,
    },
    {
      label: 'Dialog',
      lang: 'ts',
      code: `const blob = await this.editor.open({
  src: logoFile,
  heading: 'Place the logo',
  initialAspect: '1:1',
  fitMode: 'contain',        // zoom floor = whole-image fit (default 'cover' is unchanged)
  exportBackground: '#ffffff', // under the letterbox; omit for a transparent PNG
  commitLabel: 'Use this logo',
});`,
    },
  ];

  protected readonly resolutionSources: ExampleSource[] = [
    {
      label: 'HTML',
      lang: 'html',
      code: `<!-- An exact pixel size for every crop -->
<asp-image-editor [exportTarget]="{ width: 1000, height: 1000 }" />

<!-- …or let the selected aspect chip decide -->
<asp-image-editor [aspectRatios]="cmsTargets" />`,
    },
    {
      label: 'TS',
      lang: 'ts',
      code: `import { aspectOption } from '@ascentsparksoftware/angular-image-editor';

// Each option carries real dimensions, so picking one sets the export size.
cmsTargets = [aspectOption(1200, 630, 'Social'), aspectOption(1000, 1000, 'Avatar')];`,
    },
  ];

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
