import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
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
  AspImageEditorDialog,
  aspectOption,
  type AspAspectOption,
  type AspAspectPreset,
  type AspChrome,
  type AspExportFormat,
  type AspExportTarget,
  type AspFitMode,
  type AspMode,
  type AspThemeMode,
  type AspTool,
  type OpenImageEditorConfig,
} from '@ascentsparksoftware/angular-image-editor';

const MODES: readonly AspMode[] = ['viewer', 'basic', 'advanced', 'full'];
const CHROMES: readonly AspChrome[] = ['dialog', 'workspace', 'viewer'];
const ALL_FORMATS: readonly AspExportFormat[] = ['png', 'jpeg', 'webp', 'svg', 'json', 'pdf'];

/**
 * Build a deterministic test image: white with a black grid and a diagonal.
 * Gridlines are 1 source pixel wide, so an export that truly carries source
 * pixels stays high-contrast while an upscaled one visibly blurs — which is
 * what {@link measureSharpness} measures. Non-square sizes model a wordmark.
 */
function gridImageDataUrl(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d context unavailable');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  const step = Math.max(4, Math.round(Math.max(width, height) / 24));
  for (let x = 0; x < width; x += step) {
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += step) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

/**
 * Mean absolute horizontal luminance gradient across the bitmap, 0–255. A
 * bitmap that still holds 1px gridlines scores far higher than the same image
 * upscaled from a screen-sized raster, so the tests can tell real source pixels
 * from a blur.
 */
function measureSharpness(data: Uint8ClampedArray, width: number, height: number): number {
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

/** Parse `1000x1000` into a size; `null` when the param is absent or malformed. */
function parseSize(raw: string | null): { width: number; height: number } | null {
  const m = /^(\d+)x(\d+)$/i.exec(raw ?? '');
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

interface BlobFacts {
  readonly size: string;
  readonly sharpness: string;
  /** `r,g,b,a` of the top-left pixel — the letterbox band in a contain crop. */
  readonly corner: string;
}

/**
 * Hidden deterministic surface for the Playwright suite (not in the nav).
 * `/e2e?mode=basic&aspect=1:1&source=2400&shell=640&target=1000x1000` renders
 * one editor in a fixed-width shell over a generated grid image, plus
 * instrumentation readouts the tests assert on — including the decoded pixel
 * size, sharpness and corner colour of the saved blob, and counters for file
 * downloads (`a[download]` clicks) and object URLs so "writes no file" is a
 * checkable claim. `dialog=1` adds a button that opens the packaged modal with
 * the same configuration.
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
      @if (openDialog()) {
        <button type="button" data-testid="open-dialog" (click)="launchDialog()">Open dialog</button>
      } @else {
        <div class="shell" [style.width.px]="shellWidth()">
          <asp-image-editor
            [src]="source()"
            [mode]="mode()"
            [chrome]="chrome()"
            [tools]="tools()"
            [themeMode]="themeMode()"
            [initialAspect]="initialAspect()"
            [aspectRatios]="aspectRatios()"
            [fitMode]="fitMode()"
            [exportBackground]="exportBackground()"
            [exportTarget]="exportTarget()"
            [exportFormats]="exportFormats()"
            [commitLabel]="commitLabel()"
            [showDownload]="showDownload()"
            (saved)="onSaved($event)"
            (exported)="onExported($event)"
            (imageLoaded)="loaded.set(loaded() + 1)"
            (canceled)="canceled.set(canceled() + 1)"
            (errorOccurred)="lastError.set($event.code)"
          />
        </div>
      }
      <dl class="stats">
        <dt>loaded</dt>
        <dd data-testid="stat-loaded">{{ loaded() }}</dd>
        <dt>saved</dt>
        <dd data-testid="stat-saved">{{ savedInfo() }}</dd>
        <dt>saved-size</dt>
        <dd data-testid="stat-saved-size">{{ savedSize() }}</dd>
        <dt>saved-sharpness</dt>
        <dd data-testid="stat-saved-sharpness">{{ savedSharpness() }}</dd>
        <dt>saved-corner</dt>
        <dd data-testid="stat-saved-corner">{{ savedCorner() }}</dd>
        <dt>exported</dt>
        <dd data-testid="stat-exported">{{ exportedInfo() }}</dd>
        <dt>exported-size</dt>
        <dd data-testid="stat-exported-size">{{ exportedSize() }}</dd>
        <dt>exported-sharpness</dt>
        <dd data-testid="stat-exported-sharpness">{{ exportedSharpness() }}</dd>
        <dt>downloads</dt>
        <dd data-testid="stat-downloads">{{ downloads() }}</dd>
        <dt>object-urls</dt>
        <dd data-testid="stat-object-urls">{{ objectUrls() }}</dd>
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
export class E2eHarness implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(AspImageEditorDialog);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly mode = computed<AspMode>(() => {
    const raw = this.params().get('mode');
    return MODES.includes(raw as AspMode) ? (raw as AspMode) : 'advanced';
  });
  /** `chrome=workspace` overrides the mode's default chrome. */
  protected readonly chrome = computed<AspChrome | null>(() => {
    const raw = this.params().get('chrome');
    return CHROMES.includes(raw as AspChrome) ? (raw as AspChrome) : null;
  });
  /** `tools=crop,rotate` pins an explicit tool set. */
  protected readonly tools = computed<AspTool[] | null>(() => {
    const raw = this.params().get('tools');
    return raw ? (raw.split(',') as AspTool[]) : null;
  });
  protected readonly themeMode = computed<AspThemeMode>(() =>
    this.params().get('theme') === 'dark' ? 'dark' : 'light',
  );
  protected readonly initialAspect = computed<AspAspectPreset | null>(() =>
    this.params().get('aspect') === '1:1' ? '1:1' : null,
  );
  /** `fit=contain` opens the fixed-frame crop at the whole-image fit (logo crop). */
  protected readonly fitMode = computed<AspFitMode>(() =>
    this.params().get('fit') === 'contain' ? 'contain' : 'cover',
  );
  /** `bg=ff0000` composites that colour under unpainted export pixels. */
  protected readonly exportBackground = computed<string | null>(() => {
    const raw = this.params().get('bg');
    return raw && /^[0-9a-f]{6}$/i.test(raw) ? `#${raw}` : null;
  });
  /** `commit=Use%20this%20logo` relabels the commit action. */
  protected readonly commitLabel = computed<string | null>(() => this.params().get('commit'));
  /** `download=0` hides the Download action in the Export menu. */
  protected readonly showDownload = computed<boolean>(() => this.params().get('download') !== '0');
  /** `dialog=1` renders a launcher for the packaged modal instead of an inline editor. */
  protected readonly openDialog = computed<boolean>(() => this.params().get('dialog') === '1');
  protected readonly shellWidth = computed<number>(() => {
    const raw = Number(this.params().get('shell'));
    return Number.isFinite(raw) && raw > 0 ? raw : 1200;
  });
  protected readonly exportTarget = computed<AspExportTarget | null>(() =>
    parseSize(this.params().get('target')),
  );
  /** `format=jpeg` puts that format first, which is what the commit action uses. */
  protected readonly exportFormats = computed<AspExportFormat[]>(() => {
    const first = this.params().get('format') as AspExportFormat | null;
    return first && ALL_FORMATS.includes(first)
      ? [first, ...ALL_FORMATS.filter((f) => f !== first)]
      : [...ALL_FORMATS];
  });
  /** `chip=1000x1000` publishes a custom aspect chip carrying real dimensions. */
  protected readonly aspectRatios = computed<AspAspectOption[]>(() => {
    const chip = parseSize(this.params().get('chip'));
    return chip ? [aspectOption(chip.width, chip.height)] : [];
  });
  /** `source=2400` generates a 2400×2400 grid; `source=2282x832` a wordmark-shaped one (1200² by default). */
  protected readonly source = computed<string | null>(() => {
    if (!this.isBrowser) {
      return null; // the prerenderer has no canvas to draw the fixture on
    }
    const raw = this.params().get('source');
    const rect = parseSize(raw);
    if (rect) {
      return gridImageDataUrl(rect.width, rect.height);
    }
    const square = Number(raw);
    const size = Number.isFinite(square) && square > 0 ? square : 1200;
    return gridImageDataUrl(size, size);
  });

  protected readonly loaded = signal(0);
  protected readonly canceled = signal(0);
  protected readonly lastError = signal('');
  protected readonly savedInfo = signal('-');
  protected readonly savedSize = signal('-');
  protected readonly savedSharpness = signal('-');
  protected readonly savedCorner = signal('-');
  protected readonly exportedInfo = signal('-');
  protected readonly exportedSize = signal('-');
  protected readonly exportedSharpness = signal('-');
  protected readonly downloads = signal(0);
  protected readonly objectUrls = signal(0);

  private readonly nativeCreateObjectURL = this.isBrowser ? URL.createObjectURL : null;
  /** Count clicks on download anchors (capture phase, so the editor's synthetic click is seen). */
  private readonly onDocumentClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('a[download]')) {
      this.downloads.update((n) => n + 1);
    }
  };

  constructor() {
    if (this.isBrowser) {
      document.addEventListener('click', this.onDocumentClick, true);
      const native = URL.createObjectURL;
      URL.createObjectURL = (object: Blob | MediaSource): string => {
        this.objectUrls.update((n) => n + 1);
        return native.call(URL, object);
      };
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      document.removeEventListener('click', this.onDocumentClick, true);
      if (this.nativeCreateObjectURL) {
        URL.createObjectURL = this.nativeCreateObjectURL;
      }
    }
  }

  /** Open the packaged modal with the same configuration as the inline editor. */
  protected launchDialog(): void {
    const config: OpenImageEditorConfig = {
      src: this.source(),
      mode: this.mode(),
      chrome: this.chrome(),
      tools: this.tools(),
      themeMode: this.themeMode(),
      initialAspect: this.initialAspect() ?? undefined,
      aspectRatios: this.aspectRatios(),
      fitMode: this.fitMode(),
      exportBackground: this.exportBackground(),
      exportTarget: this.exportTarget(),
      exportFormats: this.exportFormats(),
      commitLabel: this.commitLabel(),
      showDownload: this.showDownload(),
    };
    void this.dialog.open(config).then((blob) => {
      if (blob) {
        this.onSaved(blob);
      } else {
        this.canceled.update((n) => n + 1);
      }
    });
  }

  protected onSaved(blob: Blob): void {
    this.savedInfo.set(`${blob.type}:${blob.size}`);
    void this.describe(blob).then((facts) => {
      this.savedSize.set(facts.size);
      this.savedSharpness.set(facts.sharpness);
      this.savedCorner.set(facts.corner);
    });
  }

  protected onExported(blob: Blob): void {
    this.exportedInfo.set(`${blob.type}:${blob.size}`);
    void this.describe(blob).then((facts) => {
      this.exportedSize.set(facts.size);
      this.exportedSharpness.set(facts.sharpness);
    });
  }

  /** Decode a blob to its pixel size, sharpness and corner colour (PDFs report page size). */
  private async describe(blob: Blob): Promise<BlobFacts> {
    if (blob.type === 'application/pdf') {
      // The page is sized from the engine's reported output size, so the
      // MediaBox is how a host would see that number.
      const box = /MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(await blob.text());
      return {
        size: box ? `${Math.round(Number(box[1]))}x${Math.round(Number(box[2]))}` : 'no-mediabox',
        sharpness: 'n/a',
        corner: 'n/a',
      };
    }
    if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml') {
      return { size: 'n/a', sharpness: 'n/a', corner: 'n/a' };
    }
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { size: 'no-context', sharpness: 'no-context', corner: 'no-context' };
      }
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const result = {
        size: `${bitmap.width}x${bitmap.height}`,
        sharpness: measureSharpness(data, bitmap.width, bitmap.height).toFixed(2),
        corner: `${data[0]},${data[1]},${data[2]},${data[3]}`,
      };
      bitmap.close();
      return result;
    } catch {
      return { size: 'decode-failed', sharpness: 'decode-failed', corner: 'decode-failed' };
    }
  }
}
