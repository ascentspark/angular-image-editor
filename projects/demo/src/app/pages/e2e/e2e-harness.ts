import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AspImageEditor,
  aspectOption,
  type AspAspectOption,
  type AspAspectPreset,
  type AspExportFormat,
  type AspExportTarget,
  type AspMode,
  type AspThemeMode,
} from '@ascentsparksoftware/angular-image-editor';

const MODES: readonly AspMode[] = ['viewer', 'basic', 'advanced', 'full'];

/**
 * Build a deterministic test image: white with a black grid and a diagonal.
 * Gridlines are 1 source pixel wide, so an export that truly carries source
 * pixels stays high-contrast while an upscaled one visibly blurs — which is
 * what {@link measureSharpness} measures.
 */
function gridImageDataUrl(size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d context unavailable');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  const step = Math.max(4, Math.round(size / 24));
  for (let x = 0; x < size; x += step) {
    ctx.fillRect(x, 0, 1, size);
  }
  for (let y = 0; y < size; y += step) {
    ctx.fillRect(0, y, size, 1);
  }
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

/**
 * Mean absolute horizontal luminance gradient across the bitmap, 0–255. A
 * bitmap that still holds 1px gridlines scores far higher than the same image
 * upscaled from a screen-sized raster, so the tests can tell real source pixels
 * from a blur.
 */
function measureSharpness(image: ImageBitmap): number {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return 0;
  }
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, image.width, image.height);
  let total = 0;
  let samples = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const p = (y * width + x) * 4;
      total += Math.abs(data[p] - data[p - 4]);
      samples += 1;
    }
  }
  return samples === 0 ? 0 : total / samples;
}

/** Parse a `1000x1000` query param into an export target. */
function parseTarget(raw: string | null): AspExportTarget | null {
  const m = /^(\d+)x(\d+)$/i.exec(raw ?? '');
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/**
 * Hidden deterministic surface for the Playwright suite (not in the nav).
 * `/e2e?mode=basic&aspect=1:1&source=2400&shell=640&target=1000x1000` renders
 * one editor in a fixed-width shell over a generated grid image, plus
 * instrumentation readouts the tests assert on — including the decoded pixel
 * size and sharpness of the saved blob, which is how export resolution is
 * verified end to end.
 */
@Component({
  selector: 'demo-e2e-harness',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspImageEditor],
  template: `
    <div
      data-testid="e2e-harness"
      class="e2e"
      [style.background]="themeMode() === 'dark' ? '#0e1116' : '#f6f7f9'"
    >
      <div class="shell" [style.width.px]="shellWidth()">
        <asp-image-editor
          [src]="source()"
          [mode]="mode()"
          [themeMode]="themeMode()"
          [initialAspect]="initialAspect()"
          [aspectRatios]="aspectRatios()"
          [exportTarget]="exportTarget()"
          [exportFormats]="exportFormats()"
          (saved)="onSaved($event)"
          (exported)="onExported($event)"
          (imageLoaded)="loaded.set(loaded() + 1)"
          (canceled)="canceled.set(canceled() + 1)"
          (errorOccurred)="lastError.set($event.code)"
        />
      </div>
      <dl class="stats">
        <dt>loaded</dt>
        <dd data-testid="stat-loaded">{{ loaded() }}</dd>
        <dt>saved</dt>
        <dd data-testid="stat-saved">{{ savedInfo() }}</dd>
        <dt>saved-size</dt>
        <dd data-testid="stat-saved-size">{{ savedSize() }}</dd>
        <dt>saved-sharpness</dt>
        <dd data-testid="stat-saved-sharpness">{{ savedSharpness() }}</dd>
        <dt>exported-size</dt>
        <dd data-testid="stat-exported-size">{{ exportedSize() }}</dd>
        <dt>exported-sharpness</dt>
        <dd data-testid="stat-exported-sharpness">{{ exportedSharpness() }}</dd>
        <dt>canceled</dt>
        <dd data-testid="stat-canceled">{{ canceled() }}</dd>
        <dt>error</dt>
        <dd data-testid="stat-error">{{ lastError() || '-' }}</dd>
      </dl>
    </div>
  `,
  styles: [
    `
      .e2e {
        position: fixed;
        inset: 0;
        z-index: 50;
        overflow: auto;
        padding: 16px;
      }
      .shell {
        max-width: 100%;
        height: 640px;
      }
      .stats {
        font-family: monospace;
        font-size: 12px;
      }
    `,
  ],
})
export class E2eHarness {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly mode = computed<AspMode>(() => {
    const raw = this.params().get('mode');
    return MODES.includes(raw as AspMode) ? (raw as AspMode) : 'advanced';
  });
  protected readonly themeMode = computed<AspThemeMode>(() =>
    this.params().get('theme') === 'dark' ? 'dark' : 'light',
  );
  protected readonly initialAspect = computed<AspAspectPreset | null>(() =>
    this.params().get('aspect') === '1:1' ? '1:1' : null,
  );
  protected readonly shellWidth = computed<number>(() => {
    const raw = Number(this.params().get('shell'));
    return Number.isFinite(raw) && raw > 0 ? raw : 1200;
  });
  protected readonly exportTarget = computed<AspExportTarget | null>(() =>
    parseTarget(this.params().get('target')),
  );
  /** `format=jpeg` puts that format first, which is what basic-mode Save uses. */
  protected readonly exportFormats = computed<AspExportFormat[]>(() => {
    const all: AspExportFormat[] = ['png', 'jpeg', 'webp', 'svg', 'json', 'pdf'];
    const first = this.params().get('format') as AspExportFormat | null;
    return first && all.includes(first) ? [first, ...all.filter((f) => f !== first)] : all;
  });
  /** `chip=1000x1000` publishes a custom aspect chip carrying real dimensions. */
  protected readonly aspectRatios = computed<AspAspectOption[]>(() => {
    const chip = parseTarget(this.params().get('chip'));
    return chip ? [aspectOption(chip.width, chip.height)] : [];
  });
  /** `source=2400` generates a 2400×2400 grid image (1200 by default). */
  protected readonly source = computed<string | null>(() => {
    if (!this.isBrowser) {
      return null; // the prerenderer has no canvas to draw the fixture on
    }
    const raw = Number(this.params().get('source'));
    return gridImageDataUrl(Number.isFinite(raw) && raw > 0 ? raw : 1200);
  });

  protected readonly loaded = signal(0);
  protected readonly canceled = signal(0);
  protected readonly lastError = signal('');
  protected readonly savedInfo = signal('-');
  protected readonly savedSize = signal('-');
  protected readonly savedSharpness = signal('-');
  protected readonly exportedSize = signal('-');
  protected readonly exportedSharpness = signal('-');

  protected onSaved(blob: Blob): void {
    this.savedInfo.set(`${blob.type}:${blob.size}`);
    void this.describe(blob).then(({ size, sharpness }) => {
      this.savedSize.set(size);
      this.savedSharpness.set(sharpness);
    });
  }

  protected onExported(blob: Blob): void {
    void this.describe(blob).then(({ size, sharpness }) => {
      this.exportedSize.set(size);
      this.exportedSharpness.set(sharpness);
    });
  }

  /** Decode a blob to its pixel size and sharpness score (PDFs report page size). */
  private async describe(blob: Blob): Promise<{ size: string; sharpness: string }> {
    if (blob.type === 'application/pdf') {
      // The page is sized from the engine's reported output size, so the
      // MediaBox is how a host would see that number.
      const box = /MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(await blob.text());
      return {
        size: box ? `${Math.round(Number(box[1]))}x${Math.round(Number(box[2]))}` : 'no-mediabox',
        sharpness: 'n/a',
      };
    }
    if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml') {
      return { size: 'n/a', sharpness: 'n/a' };
    }
    try {
      const bitmap = await createImageBitmap(blob);
      const result = {
        size: `${bitmap.width}x${bitmap.height}`,
        sharpness: measureSharpness(bitmap).toFixed(2),
      };
      bitmap.close();
      return result;
    } catch {
      return { size: 'decode-failed', sharpness: 'decode-failed' };
    }
  }
}
