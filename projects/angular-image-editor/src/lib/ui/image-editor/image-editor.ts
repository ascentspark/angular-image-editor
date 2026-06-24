import { UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type OnDestroy,
} from '@angular/core';

import { EditorEngine, type ShapeKind } from '../../engine/editor-engine';
import type { HistoryEntry } from '../../engine/history';
import { AspIcon } from '../../icons/asp-icon';
import { FILTER_REGISTRY, TOOL_REGISTRY, type FilterMeta, type ToolMeta } from '../../registry/tool-registry';
import { resolveFilters, resolveTools } from '../../registry/resolve-tools';
import { applyTheme } from '../../theme/apply-theme';
import { deriveTheme, type AspThemeMode } from '../../theme/derive-theme';
import type {
  AspAspectPreset,
  AspExportFormat,
  AspFilter,
  AspMode,
  AspTool,
} from '../../types/editor.types';
import { AspHistoryList } from '../history/history-list';
import {
  ANNOTATION_COLORS,
  AspOptionsPanel,
  FRAME_OPTIONS,
  type AdjustChange,
  type RedactMode,
} from '../options-panel/options-panel';
import { AspToolRail } from '../rail/tool-rail';
import { buildSampleImages, type SampleImage } from './sample-images';

const FALLBACK_BASE = '#f4f6f9';
const FALLBACK_ACCENT = '#1f6feb';
const ZOOM_STEP = 25;

/**
 * `<asp-image-editor>` — the editor's root/container component.
 *
 * Owns the {@link EditorEngine}, the resolved tool/filter sets, theming, and all
 * workspace state. Presentational children (rail, options panel, history) render
 * data and emit intent; this container is the only place that drives the engine.
 *
 * Phase 4 implements the `advanced`/`full` workspace; `basic`/`viewer` layouts
 * arrive in Phase 5.
 */
@Component({
  selector: 'asp-image-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe, AspIcon, AspToolRail, AspOptionsPanel, AspHistoryList],
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.css',
})
export class AspImageEditor implements OnDestroy {
  // ---- public API ----------------------------------------------------------
  readonly src = input<string | Blob | null>(null);
  readonly mode = input<AspMode>('advanced');
  readonly tools = input<AspTool[] | null>(null);
  readonly disabledTools = input<AspTool[]>([]);
  readonly filters = input<AspFilter[] | 'all' | null>(null);
  readonly aspectPresets = input<AspAspectPreset[]>(['free', '1:1', '4:3', '16:9']);
  readonly exportFormats = input<AspExportFormat[]>(['png', 'jpeg', 'webp']);
  readonly exportQuality = input<number>(90);

  readonly baseColor = input<string>(FALLBACK_BASE);
  readonly accentColor = input<string>(FALLBACK_ACCENT);
  readonly themeMode = input<AspThemeMode>('light');

  readonly saved = output<Blob>();
  readonly canceled = output<void>();

  // ---- view refs -----------------------------------------------------------
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stageEl');

  // ---- engine + readiness --------------------------------------------------
  private engine: EditorEngine | null = null;
  private resizeObserver: ResizeObserver | null = null;
  protected readonly engineReady = signal(false);

  // ---- resolved configuration ----------------------------------------------
  protected readonly resolvedTools = computed<ToolMeta[]>(() =>
    resolveTools(this.mode(), this.tools(), this.disabledTools()).map((t) => TOOL_REGISTRY[t]),
  );
  protected readonly resolvedFilters = computed<AspFilter[]>(() =>
    resolveFilters(this.mode(), this.filters()),
  );
  protected readonly adjustmentDefs = computed<FilterMeta[]>(() =>
    this.resolvedFilters()
      .map((f) => FILTER_REGISTRY[f])
      .filter((m) => m.kind === 'adjustment'),
  );
  protected readonly lookDefs = computed<FilterMeta[]>(() =>
    this.resolvedFilters()
      .map((f) => FILTER_REGISTRY[f])
      .filter((m) => m.kind === 'look'),
  );

  protected readonly frameOptions = FRAME_OPTIONS;

  // ---- workspace state -----------------------------------------------------
  protected readonly activeTool = signal<AspTool | null>(null);
  protected readonly zoomPct = signal(100);
  protected readonly canUndo = signal(false);
  protected readonly canRedo = signal(false);
  protected readonly historyEntries = signal<readonly HistoryEntry<string>[]>([]);
  protected readonly historyIndex = signal(0);

  protected readonly adjustments = signal<Record<string, number>>(defaultAdjustmentValues());
  protected readonly activeLook = signal<AspFilter | null>(null);
  protected readonly activeCrop = signal<AspAspectPreset>('free');
  protected readonly straighten = signal(0);
  protected readonly annotationColor = signal(ANNOTATION_COLORS[0]);
  protected readonly annotationWidth = signal(4);
  protected readonly activeFrame = signal('none');

  protected readonly pickerOpen = signal(false);
  protected readonly exportOpen = signal(false);
  protected readonly exportFormat = signal<AspExportFormat>('png');
  protected readonly exportQ = signal(90);
  protected readonly samples = signal<SampleImage[]>([]);

  protected readonly activeToolMeta = computed<ToolMeta | null>(() => {
    const tool = this.activeTool();
    return tool ? TOOL_REGISTRY[tool] : null;
  });
  protected readonly toolTitle = computed(() => this.activeToolMeta()?.label ?? '');
  protected readonly zoomLabel = computed(() => `${this.zoomPct()}%`);
  protected readonly isWorkspaceMode = computed(
    () => this.mode() === 'advanced' || this.mode() === 'full',
  );

  constructor() {
    // Apply the derived theme to the host element whenever inputs change.
    effect(() => applyTheme(this.host.nativeElement, this.theme()));

    // Default the active tool to the first resolved tool (and keep it valid).
    effect(() => {
      const tools = this.resolvedTools();
      const current = untracked(this.activeTool);
      if (tools.length === 0) {
        if (current !== null) {
          this.activeTool.set(null);
        }
      } else if (current === null || !tools.some((t) => t.key === current)) {
        this.activeTool.set(tools[0].key);
      }
    });

    // Sync export defaults from inputs.
    effect(() => {
      this.exportQ.set(this.exportQuality());
      const formats = this.exportFormats();
      if (formats.length > 0 && !formats.includes(untracked(this.exportFormat))) {
        this.exportFormat.set(formats[0]);
      }
    });

    afterNextRender(() => {
      this.samples.set(buildSampleImages());
      void this.initEngine();
    });

    // (Re)load when the src input changes and the engine is ready.
    effect(() => {
      const src = this.src();
      if (!this.engineReady()) {
        return;
      }
      void untracked(() => this.loadCurrent(src));
    });

    // Free-draw follows the active tool + current brush settings.
    effect(() => {
      const tool = this.activeTool();
      const color = this.annotationColor();
      const width = this.annotationWidth();
      if (!this.engineReady() || !this.engine) {
        return;
      }
      const drawing = tool === 'pen' || tool === 'highlighter' || tool === 'eraser';
      this.engine.setFreeDraw(drawing, { color, strokeWidth: width });
    });
  }

  private readonly theme = computed(() => {
    try {
      return deriveTheme(this.baseColor(), this.accentColor(), this.themeMode());
    } catch (error) {
      console.warn('[asp-image-editor] invalid theme color, using defaults:', error);
      return deriveTheme(FALLBACK_BASE, FALLBACK_ACCENT, this.themeMode());
    }
  });

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    void this.engine?.destroy();
  }

  // ---- engine lifecycle ----------------------------------------------------
  private async initEngine(): Promise<void> {
    const canvas = this.canvasRef()?.nativeElement;
    const stage = this.stageRef()?.nativeElement;
    if (!canvas || !stage) {
      return;
    }
    try {
      const { width, height } = stageSize(stage);
      this.engine = await EditorEngine.create(canvas, { width, height });
      this.engineReady.set(true);
      this.observeResize(stage);
    } catch (error) {
      // No 2D/WebGL context (e.g. SSR or a headless test environment) — the
      // editor chrome still renders; engine-backed actions are simply inert.
      console.warn('[asp-image-editor] could not initialize the canvas engine:', error);
    }
  }

  private observeResize(stage: HTMLElement): void {
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = stageSize(stage);
      this.engine?.setSize(width, height);
    });
    this.resizeObserver.observe(stage);
  }

  private async loadCurrent(src: string | Blob | null): Promise<void> {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const source = src ?? this.samples()[0]?.dataUrl ?? null;
    if (source === null) {
      return;
    }
    await engine.loadImage(source);
    this.resetUiState();
    this.sync();
  }

  private resetUiState(): void {
    this.adjustments.set(defaultAdjustmentValues());
    this.activeLook.set(null);
    this.activeCrop.set('free');
    this.straighten.set(0);
    this.activeFrame.set('none');
  }

  private sync(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    this.canUndo.set(engine.canUndo);
    this.canRedo.set(engine.canRedo);
    this.historyEntries.set(engine.historyEntries);
    this.historyIndex.set(engine.historyIndex);
    this.zoomPct.set(engine.zoom);
  }

  // ---- top bar -------------------------------------------------------------
  protected selectTool(tool: AspTool): void {
    this.activeTool.set(tool);
  }

  protected async undo(): Promise<void> {
    await this.engine?.undo();
    this.sync();
  }

  protected async redo(): Promise<void> {
    await this.engine?.redo();
    this.sync();
  }

  protected zoomIn(): void {
    this.engine?.zoomBy(ZOOM_STEP);
    this.sync();
  }

  protected zoomOut(): void {
    this.engine?.zoomBy(-ZOOM_STEP);
    this.sync();
  }

  protected togglePicker(): void {
    this.pickerOpen.update((v) => !v);
    this.exportOpen.set(false);
  }

  protected toggleExport(): void {
    this.exportOpen.update((v) => !v);
    this.pickerOpen.set(false);
  }

  protected async pickSample(sample: SampleImage): Promise<void> {
    this.pickerOpen.set(false);
    await this.engine?.loadImage(sample.dataUrl);
    this.resetUiState();
    this.sync();
  }

  protected async onUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.pickerOpen.set(false);
      await this.engine?.loadImage(file);
      this.resetUiState();
      this.sync();
    }
    input.value = '';
  }

  protected setExportFormat(format: AspExportFormat): void {
    this.exportFormat.set(format);
  }

  protected onExportQuality(event: Event): void {
    this.exportQ.set(Number((event.target as HTMLInputElement).value));
  }

  protected async download(): Promise<void> {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const blob = await engine.exportImage(this.exportFormat(), this.exportQ(), this.exportFormats());
    this.exportOpen.set(false);
    this.saved.emit(blob);
    triggerDownload(blob, `image.${extensionFor(this.exportFormat())}`);
  }

  // ---- options panel handlers ----------------------------------------------
  protected reset(): void {
    void this.engine?.reset().then(() => {
      this.resetUiState();
      this.sync();
    });
  }

  protected onAdjustInput(change: AdjustChange): void {
    this.adjustments.update((a) => ({ ...a, [change.key]: change.value }));
    this.engine?.setAdjustments({ [change.key]: change.value });
  }

  protected onAdjustCommit(change: AdjustChange): void {
    this.adjustments.update((a) => ({ ...a, [change.key]: change.value }));
    this.engine?.setAdjustments({ [change.key]: change.value }, true);
    this.sync();
  }

  protected selectLook(look: AspFilter | null): void {
    const current = this.activeLook();
    // Toggle: clear the previous look, then apply the new one (single-select UI).
    if (current && current !== look) {
      this.engine?.toggleLook(current);
    }
    if (look === null) {
      if (current) {
        this.engine?.toggleLook(current);
      }
      this.activeLook.set(null);
    } else if (current === look) {
      this.engine?.toggleLook(look);
      this.activeLook.set(null);
    } else {
      this.engine?.toggleLook(look);
      this.activeLook.set(look);
    }
    this.sync();
  }

  protected selectCrop(preset: AspAspectPreset): void {
    this.activeCrop.set(preset);
    this.engine?.applyCrop(preset);
    this.sync();
  }

  protected rotate(deg: number): void {
    this.engine?.rotateBy(deg);
    this.sync();
  }

  protected flip(axis: 'h' | 'v'): void {
    this.engine?.flip(axis);
    this.sync();
  }

  protected onStraightenInput(value: number): void {
    this.straighten.set(value);
    this.engine?.setStraighten(value);
  }

  protected onStraightenCommit(value: number): void {
    this.straighten.set(value);
    this.engine?.setStraighten(value, true);
    this.sync();
  }

  protected addShape(kind: ShapeKind): void {
    this.engine?.addShape(kind, { color: this.annotationColor(), strokeWidth: this.annotationWidth() });
    this.sync();
  }

  protected addText(text: string): void {
    this.engine?.addText(text, { color: this.annotationColor(), fontSize: Math.max(12, this.annotationWidth() * 6) });
    this.sync();
  }

  protected addRedaction(mode: RedactMode): void {
    void this.engine?.addRedaction(mode).then(() => this.sync());
  }

  protected setAnnotationColor(color: string): void {
    this.annotationColor.set(color);
  }

  protected setAnnotationWidth(width: number): void {
    this.annotationWidth.set(width);
  }

  protected selectFrame(frame: string): void {
    this.activeFrame.set(frame);
    this.engine?.applyFrame(frame, this.annotationColor());
    this.sync();
  }

  protected deleteSelection(): void {
    this.engine?.deleteActive();
    this.sync();
  }
}

function defaultAdjustmentValues(): Record<string, number> {
  const values: Record<string, number> = {};
  for (const meta of Object.values(FILTER_REGISTRY)) {
    if (meta.kind === 'adjustment') {
      values[meta.key] = meta.defaultValue ?? 0;
    }
  }
  return values;
}

function stageSize(stage: HTMLElement): { width: number; height: number } {
  const rect = stage.getBoundingClientRect();
  return {
    width: Math.max(120, Math.floor(rect.width)),
    height: Math.max(120, Math.floor(rect.height)),
  };
}

function extensionFor(format: AspExportFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
