import { NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
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

import {
  EditorEngine,
  type ArtboardSize,
  type LayerInfo,
  type RedactMode,
  type SelectionStyleInfo,
  type ShapeKind,
} from '../../engine/editor-engine';
import type { HistoryStep } from '../../engine/delta-history';
import { ASP_BACKGROUND_REMOVAL_LOADER, ASP_HEIC_DECODER_LOADER } from '../../providers';
import { aspectRatioValue } from '../../engine/crop';
import { drawRuler, type RulerColors } from '../../engine/rulers';
import { AspIcon } from '../../icons/asp-icon';
import { FILTER_REGISTRY, TOOL_REGISTRY, type FilterMeta, type ToolMeta } from '../../registry/tool-registry';
import { resolveFilters, resolveTools } from '../../registry/resolve-tools';
import { groupForTool, resolveGroups, type ResolvedGroup } from '../../registry/toolbar-groups';
import { applyTheme } from '../../theme/apply-theme';
import { deriveTheme, type AspThemeMode } from '../../theme/derive-theme';
import type {
  AspAspectOption,
  AspAspectPreset,
  AspEditorError,
  AspExportFormat,
  AspFilter,
  AspMode,
  AspSize,
  AspTool,
} from '../../types/editor.types';
import { AspHistoryList } from '../history/history-list';
import {
  ANNOTATION_COLORS,
  AspOptionsPanel,
  FRAME_OPTIONS,
  type AdjustChange,
} from '../options-panel/options-panel';
import {
  AspLayerList,
  type LayerRenameEvent,
  type LayerSelectEvent,
} from '../layers/layer-list';
import { AspToolRail } from '../rail/tool-rail';
import {
  DEFAULT_FONTS,
  GOOGLE_FONTS,
  ensureFontLoaded,
  isWebFont,
  type FontOption,
} from './fonts';
import { buildSampleImages, type SampleImage } from './sample-images';

type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';

const FALLBACK_BASE = '#f4f6f9';
const FALLBACK_ACCENT = '#1f6feb';
const ZOOM_STEP = 25;

/**
 * Minimum host size per mode, so the chrome (rail, options panel, layers,
 * top bar) always has room to render no matter what size the host requests.
 * `advanced`/`full` carry the rail + canvas + options column; the simpler
 * modes need much less.
 */
const MODE_MIN: Record<AspMode, { width: string; height: string }> = {
  viewer: { width: '240px', height: '200px' },
  basic: { width: '300px', height: '360px' },
  advanced: { width: '640px', height: '460px' },
  full: { width: '640px', height: '460px' },
};

/**
 * Width the `basic` (dialog card) layout hugs by default. MUST stay in sync with
 * `.asp-basic { max-width }` in image-editor.css. `basic` is a self-contained card,
 * so the host sizes to this rather than stretching to fill (and paint) its
 * container — otherwise, mounted in a modal scrim, the host becomes a
 * full-viewport baseColor panel sitting behind the card.
 */
const BASIC_DIALOG_WIDTH = '520px';

/** Resolve a host-supplied size to a CSS length (number → px), or a fallback. */
function toCssSize(value: AspSize | null | undefined, fallback: string): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return typeof value === 'number' ? `${value}px` : value;
}

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
  imports: [
    NgTemplateOutlet,
    UpperCasePipe,
    AspIcon,
    AspToolRail,
    AspOptionsPanel,
    AspHistoryList,
    AspLayerList,
  ],
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.css',
})
export class AspImageEditor implements OnDestroy {
  // ---- public API ----------------------------------------------------------
  readonly src = input<string | Blob | null>(null);
  readonly mode = input<AspMode>('advanced');
  /**
   * Editor width — a number (px) or any CSS length (`'70%'`, `'80vh'`,
   * `'calc(100vw - 320px)'`). Defaults to filling the host's container. A
   * per-mode minimum is always enforced so the chrome stays usable.
   */
  readonly width = input<AspSize | null>(null);
  /** Editor height — same shape as {@link width}. */
  readonly height = input<AspSize | null>(null);
  readonly tools = input<AspTool[] | null>(null);
  readonly disabledTools = input<AspTool[]>([]);
  readonly filters = input<AspFilter[] | 'all' | null>(null);
  readonly aspectPresets = input<AspAspectPreset[]>(['free', '1:1', '4:3', '16:9']);
  /** Host-defined crop aspect targets (e.g. CMS sizes); shown after the presets. */
  readonly aspectRatios = input<AspAspectOption[]>([]);
  readonly exportFormats = input<AspExportFormat[]>(['png', 'jpeg', 'webp']);
  readonly exportQuality = input<number>(90);

  readonly baseColor = input<string>(FALLBACK_BASE);
  readonly accentColor = input<string>(FALLBACK_ACCENT);
  readonly themeMode = input<AspThemeMode>('light');

  /** Heading shown by the `basic` modal layout. */
  readonly heading = input<string>('Edit image');

  /** Show the edit-history panel in the workspace (hosts that don't want it set false). */
  readonly showHistory = input<boolean>(true);

  /** Enable keyboard shortcuts while the pointer is over the editor. */
  readonly keyboardEnabled = input<boolean>(true);

  readonly saved = output<Blob>();
  readonly canceled = output<void>();
  /** Fired after an image successfully loads (initial, picker, or upload). */
  readonly imageLoaded = output<void>();
  /** Fired with the exported Blob when the user downloads from the Export menu. */
  readonly exported = output<Blob>();
  /** Fired on a recoverable error (load/export/engine init) instead of throwing. */
  readonly errorOccurred = output<AspEditorError>();

  // ---- view refs -----------------------------------------------------------
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stageEl');
  private readonly rulerTopRef = viewChild<ElementRef<HTMLCanvasElement>>('rulerTopEl');
  private readonly rulerLeftRef = viewChild<ElementRef<HTMLCanvasElement>>('rulerLeftEl');
  private readonly guidesOverlayRef = viewChild<ElementRef<HTMLCanvasElement>>('guidesOverlayEl');

  // ---- optional heavy-feature loaders (consumer-provided via DI) -----------
  // Null unless the app opts in with provideAspBackgroundRemoval / provideAspHeicDecoder.
  // Keeping these out of the core import graph is what lets the editor load in any
  // consumer's dev server without WASM/worker pre-bundling failures.
  private readonly bgRemovalLoader = inject(ASP_BACKGROUND_REMOVAL_LOADER, { optional: true });
  private readonly heicLoader = inject(ASP_HEIC_DECODER_LOADER, { optional: true });

  // ---- engine + readiness --------------------------------------------------
  private engine: EditorEngine | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private boundCanvas: HTMLCanvasElement | null = null;
  private lastSource: string | Blob | null | undefined = undefined;
  protected readonly engineReady = signal(false);

  // ---- resolved configuration ----------------------------------------------
  protected readonly resolvedToolKeys = computed<AspTool[]>(() => {
    // The AI cut-out tools only work when a background-removal loader is wired,
    // so hide them otherwise — the flood-fill Magic wand needs no dependency and stays.
    const disabled = this.bgRemovalLoader
      ? this.disabledTools()
      : [...this.disabledTools(), 'removebg' as AspTool, 'selectsubject' as AspTool];
    return resolveTools(this.mode(), this.tools(), disabled);
  });
  protected readonly resolvedTools = computed<ToolMeta[]>(() =>
    this.resolvedToolKeys().map((t) => TOOL_REGISTRY[t]),
  );
  protected readonly resolvedGroups = computed<ResolvedGroup[]>(() =>
    resolveGroups(this.resolvedToolKeys()),
  );
  protected readonly activeMembers = signal<Record<string, AspTool>>({});
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
  protected readonly historyEntries = signal<readonly HistoryStep[]>([]);
  protected readonly historyIndex = signal(0);

  protected readonly adjustments = signal<Record<string, number>>(defaultAdjustmentValues());
  protected readonly activeLook = signal<AspFilter | null>(null);
  protected readonly activeCrop = signal<AspAspectPreset>('free');
  protected readonly activeAspectLabel = signal('');
  protected readonly straighten = signal(0);
  /** Available text fonts (host-overridable). */
  readonly fonts = input<FontOption[]>([...DEFAULT_FONTS]);

  protected readonly annotationColor = signal(ANNOTATION_COLORS[0]);
  protected readonly annotationWidth = signal(4);
  protected readonly fontSize = signal(28);
  protected readonly fontFamily = signal(DEFAULT_FONTS[0].value);
  protected readonly textBold = signal(false);
  protected readonly textItalic = signal(false);
  protected readonly textUnderline = signal(false);
  protected readonly textStrike = signal(false);
  protected readonly textAlign = signal('left');
  protected readonly lineHeight = signal(1.16);
  protected readonly letterSpacing = signal(0);
  /** Custom fonts added at runtime, merged after the host-provided list. */
  protected readonly customFonts = signal<FontOption[]>([]);
  protected readonly allFonts = computed<FontOption[]>(() => {
    const base = this.fonts();
    const extra = this.customFonts().filter((c) => !base.some((b) => b.value === c.value));
    return [...base, ...extra];
  });
  /** Google font names offered as autocomplete suggestions in the add-font box. */
  protected readonly googleFonts = GOOGLE_FONTS;
  protected readonly hasSelection = signal(false);
  /** Kind of the current selection, so the panel can reflect it under Select. */
  protected readonly selectionKind = signal<'text' | 'stroke' | null>(null);
  /** True while a web font for the current choice is still loading. */
  protected readonly fontLoading = signal(false);
  /** Transient error message shown as an in-editor toast (null = hidden). */
  protected readonly errorToast = signal<string | null>(null);
  private errorToastTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly activeFrame = signal('none');
  /** Corner radius (px) for the next rectangle, and the selected rectangle. */
  protected readonly shapeRadius = signal(0);
  /** Pill-cap radius driving the corner-radius slider's max. */
  protected readonly shapeRadiusMax = signal(55);
  /** True when the current selection is a single rectangle. */
  protected readonly selectedIsRect = signal(false);
  /**
   * Show the corner-radius slider when defining the next rectangle (Shapes tool,
   * nothing selected) or when a rectangle is selected.
   */
  protected readonly showCornerRadius = computed(
    () => (this.activeTool() === 'shapes' && !this.hasSelection()) || this.selectedIsRect(),
  );
  protected readonly redactMode = signal<RedactMode>('pixelate');
  protected readonly magicTolerance = signal(32);
  protected readonly aiBusy = signal(false);
  protected readonly aiStage = signal('');
  protected readonly aiProgress = signal(0);
  /** True once a crop region has been applied (enables the panel's Reset). */
  protected readonly hasCropRegion = signal(false);
  private redactActive = false;
  protected cropActive = false;

  protected onMagicTolerance(value: number): void {
    this.magicTolerance.set(value);
  }

  /** Run the active AI tool (background removal / subject cut-out) on the image. */
  protected runAi(): void {
    const engine = this.engine;
    if (!engine || this.aiBusy()) {
      return;
    }
    const mode = this.activeTool() === 'selectsubject' ? 'subject' : 'replace';
    this.aiBusy.set(true);
    this.aiProgress.set(0);
    this.aiStage.set('loading');
    void engine
      .removeImageBackground(mode)
      .then((ok) => {
        if (!ok) {
          this.emitError('ai-no-image', new Error('No image to process'));
        }
        this.sync();
      })
      .catch((error) => this.emitError('ai-failed', error))
      .finally(() => this.aiBusy.set(false));
  }

  protected readonly layers = signal<LayerInfo[]>([]);

  protected readonly pickerOpen = signal(false);
  protected readonly exportOpen = signal(false);
  protected readonly historyOpen = signal(false);
  protected readonly snapEnabled = signal(true);
  protected readonly rulersEnabled = signal(false);
  /** Bumped by the engine's viewport listener to re-render rulers on zoom/pan/resize. */
  private readonly rulerVersion = signal(0);
  /** Bumped by the engine's guides listener to repaint the guides overlay. */
  private readonly guidesVersion = signal(0);
  /** Tears down an in-flight ruler→guide drag; also called on destroy. */
  private guideDraftCleanup: (() => void) | null = null;
  protected readonly artboard = signal<ArtboardSize | null>(null);
  protected readonly exportFormat = signal<AspExportFormat>('png');
  protected readonly exportQ = signal(90);
  protected readonly samples = signal<SampleImage[]>([]);

  protected readonly activeToolMeta = computed<ToolMeta | null>(() => {
    const tool = this.activeTool();
    return tool ? TOOL_REGISTRY[tool] : null;
  });
  protected readonly toolTitle = computed(() => {
    // Under the neutral Select tool, title the panel by what's selected.
    if (this.activeTool() === 'select') {
      const kind = this.selectionKind();
      if (kind === 'text') {
        return 'Text';
      }
      if (kind === 'stroke') {
        return 'Object';
      }
    }
    return this.activeToolMeta()?.label ?? '';
  });
  protected readonly zoomLabel = computed(() => `${this.zoomPct()}%`);
  protected readonly layout = computed<'workspace' | 'basic' | 'viewer'>(() => {
    const mode = this.mode();
    if (mode === 'basic') {
      return 'basic';
    }
    if (mode === 'viewer') {
      return 'viewer';
    }
    return 'workspace';
  });

  /**
   * The resolved theme. Invalid hex inputs are a developer error; rather than
   * throwing and breaking the host app, we fall back to the default palette
   * (keeping the requested mode) and warn once. Declared before the constructor
   * so it is initialized before any effect that reads it.
   */
  private readonly theme = computed(() => {
    try {
      return deriveTheme(this.baseColor(), this.accentColor(), this.themeMode());
    } catch (error) {
      console.warn('[asp-image-editor] invalid theme color, using defaults:', error);
      return deriveTheme(FALLBACK_BASE, FALLBACK_ACCENT, this.themeMode());
    }
  });

  /** Serializes engine (re)binding/loading so concurrent effect fires can't race. */
  private opChain: Promise<void> = Promise.resolve();

  constructor() {
    // Apply the derived theme to the host element whenever inputs change.
    effect(() => applyTheme(this.host.nativeElement, this.theme()));

    // Apply the host-requested size, with a per-mode minimum so the chrome
    // always renders. Default fills the container; an explicit width/height
    // (px / % / vh / calc) overrides it. The stage's ResizeObserver picks up
    // the change and resizes the canvas.
    effect(() => {
      const el = this.host.nativeElement;
      const mode = this.mode();
      const min = MODE_MIN[mode];
      // `basic` is a self-contained dialog CARD: it hugs its content (a fixed
      // width, content height) instead of stretching to fill its container. The
      // other modes fill the host so the workspace can use the available space.
      const isBasic = mode === 'basic';
      el.style.width = toCssSize(this.width(), isBasic ? `min(${BASIC_DIALOG_WIDTH}, 100%)` : '100%');
      el.style.height = toCssSize(this.height(), isBasic ? 'auto' : '100%');
      // Cap the min-width to the available space so the editor never forces
      // horizontal overflow on a narrow screen; the layout reflows instead.
      el.style.minWidth = `min(${min.width}, 100%)`;
      // No min-height in `basic`, or a dialog scrim would show a baseColor strip
      // below the card (the host's background extending past the card's content).
      el.style.minHeight = isBasic ? '0px' : min.height;
    });

    // Show a progress cursor over the editor while a web font is fetching.
    effect(() => {
      this.host.nativeElement.style.cursor = this.fontLoading() ? 'progress' : '';
    });

    // Default the active tool to Color (adjust) when available, else the first
    // resolved tool; keep it valid as the resolved set changes.
    effect(() => {
      const keys = this.resolvedToolKeys();
      const current = untracked(this.activeTool);
      if (keys.length === 0) {
        if (current !== null) {
          this.activeTool.set(null);
        }
      } else if (current === null || !keys.includes(current)) {
        this.activeTool.set(keys.includes('adjust') ? 'adjust' : keys[0]);
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

    // Bind the engine to the rendered canvas and (re)load the source. Runs on
    // first render and again whenever the layout swaps the canvas element
    // (mode change) or the `src` input changes.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const stage = this.stageRef()?.nativeElement;
      const src = this.src();
      if (!canvas || !stage) {
        return;
      }
      this.opChain = this.opChain
        .catch(() => undefined)
        .then(() => untracked(() => this.ensureEngineAndLoad(canvas, stage, src)));
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
      this.engine.setFreeDraw(drawing, { color, strokeWidth: width }, tool === 'highlighter');
      // Text tool: click the canvas to drop an editable text box.
      this.engine.setTextMode(tool === 'text');
      // Magic wand: click a region of the image to flood-fill erase it.
      this.engine.setMagicMode(tool === 'magicwand');
    });

    // Re-render the rulers whenever they are toggled on, their canvases appear,
    // or the viewport changes (rulerVersion is bumped by the engine listener).
    effect(() => {
      this.rulerVersion();
      const on = this.rulersEnabled();
      const top = this.rulerTopRef()?.nativeElement;
      const left = this.rulerLeftRef()?.nativeElement;
      if (on && top && left && this.engineReady() && this.engine) {
        this.renderRulers(top, left);
      }
    });

    // Repaint the guides overlay on guide changes or viewport changes.
    effect(() => {
      this.guidesVersion();
      this.rulerVersion();
      const el = this.guidesOverlayRef()?.nativeElement;
      if (this.rulersEnabled() && el && this.engineReady() && this.engine) {
        this.renderGuidesOverlay(el);
      }
    });

    // Crop tool shows an interactive frame; entering begins a session at the
    // current aspect, leaving without Apply discards the frame (the committed
    // region, if any, persists).
    effect(() => {
      const isCrop = this.activeTool() === 'crop' && this.engineReady();
      untracked(() => {
        if (isCrop && !this.cropActive) {
          this.engine?.beginCrop(this.ratioFromPreset(this.activeCrop()));
          this.cropActive = true;
        } else if (!isCrop && this.cropActive) {
          this.engine?.cancelCrop();
          this.cropActive = false;
        }
      });
    });

    // Redact tool shows a positioning marquee; leaving it discards an unapplied
    // one. While active, clicking the canvas places a fresh box (click-to-place).
    effect(() => {
      const isRedact = this.activeTool() === 'redact' && this.engineReady();
      untracked(() => {
        this.engine?.setRedactPlacement(isRedact);
        if (isRedact && !this.redactActive) {
          this.engine?.addRedactionMarquee();
          this.redactActive = true;
        } else if (!isRedact && this.redactActive) {
          this.engine?.cancelRedaction();
          this.redactActive = false;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.guideDraftCleanup?.();
    this.resizeObserver?.disconnect();
    if (this.errorToastTimer !== null) {
      clearTimeout(this.errorToastTimer);
    }
    void this.engine?.destroy();
  }

  // ---- keyboard + pointer scope --------------------------------------------
  private pointerInside = false;

  @HostListener('mouseenter')
  protected onPointerEnter(): void {
    this.pointerInside = true;
  }

  @HostListener('mouseleave')
  protected onPointerLeave(): void {
    this.pointerInside = false;
    this.engine?.setPanMode(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.keyboardEnabled() || !this.pointerInside || isTypingTarget(event.target)) {
      return;
    }
    const meta = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (event.key === ' ') {
      event.preventDefault();
      this.engine?.setPanMode(true);
      return;
    }
    if (key === 'escape') {
      if (this.layout() === 'basic') {
        this.cancel();
      } else {
        this.engine?.discardSelection();
      }
      return;
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      this.deleteSelection();
      return;
    }
    if (!meta) {
      return;
    }
    switch (key) {
      case 'z':
        event.preventDefault();
        void (event.shiftKey ? this.redo() : this.undo());
        break;
      case 'y':
        event.preventDefault();
        void this.redo();
        break;
      case 'c':
        event.preventDefault();
        void this.engine?.copy();
        break;
      // Paste (Ctrl/Cmd+V) is handled by the `paste` event so OS-clipboard
      // images can be detected; do not preventDefault here.
      case 'd':
        event.preventDefault();
        void this.engine?.duplicateActive().then(() => this.sync());
        break;
      case 'a':
        event.preventDefault();
        this.engine?.selectAll();
        break;
      default:
        break;
    }
  }

  @HostListener('document:keyup', ['$event'])
  protected onKeyup(event: KeyboardEvent): void {
    if (event.key === ' ') {
      this.engine?.setPanMode(false);
    }
  }

  @HostListener('document:paste', ['$event'])
  protected onPaste(event: ClipboardEvent): void {
    if (!this.keyboardEnabled() || !this.pointerInside || isTypingTarget(event.target)) {
      return;
    }
    let imageFile: File | null = null;
    const items = event.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          imageFile = item.getAsFile();
          break;
        }
      }
    }
    event.preventDefault();
    if (imageFile) {
      void this.engine?.addImageObject(imageFile).then(() => this.sync());
    } else {
      void this.engine?.paste().then(() => this.sync());
    }
  }

  /** Reset zoom + viewport so the image fits the stage. */
  protected fitToScreen(): void {
    this.engine?.resetView();
    this.sync();
  }

  protected toggleSnap(): void {
    const next = !this.snapEnabled();
    this.snapEnabled.set(next);
    this.engine?.setSnapping(next);
  }

  protected onArtboardChange(size: ArtboardSize | null): void {
    this.artboard.set(size);
    this.engine?.setArtboard(size);
  }

  protected toggleRulers(): void {
    const next = !this.rulersEnabled();
    this.rulersEnabled.set(next);
    this.engine?.setRulersEnabled(next);
  }

  /** Clear all user-placed guides (the ruler corner button). */
  protected clearGuides(): void {
    this.engine?.clearManualGuides();
  }

  /**
   * Begin dragging a new guide out of a ruler. The top ruler pulls a horizontal
   * guide; the left ruler a vertical one. A live preview tracks the pointer;
   * releasing over the canvas commits it, releasing outside cancels.
   */
  protected startGuideDraft(orientation: 'h' | 'v', event: PointerEvent): void {
    const engine = this.engine;
    if (!engine || !this.rulersEnabled()) {
      return;
    }
    event.preventDefault();
    this.guideDraftCleanup?.();

    const scenePosAt = (clientX: number, clientY: number): number => {
      const vp = engine.clientToViewport(clientX, clientY);
      const scene = engine.viewportToScene(vp.x, vp.y);
      return orientation === 'h' ? scene.y : scene.x;
    };
    const onMove = (e: PointerEvent): void => {
      engine.setGuideDraft(orientation, scenePosAt(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent): void => {
      this.guideDraftCleanup?.();
      const vp = engine.clientToViewport(e.clientX, e.clientY);
      const view = engine.getViewport();
      const overCanvas = vp.x >= 0 && vp.y >= 0 && vp.x <= view.width && vp.y <= view.height;
      if (overCanvas) {
        engine.addManualGuide(orientation, scenePosAt(e.clientX, e.clientY));
      } else {
        engine.setGuideDraft(orientation, null);
      }
    };
    this.guideDraftCleanup = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      this.guideDraftCleanup = null;
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    onMove(event);
  }

  /** Paint both ruler strips from the engine's viewport, scaled for the display. */
  private renderRulers(top: HTMLCanvasElement, left: HTMLCanvasElement): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const view = engine.getViewport();
    const styles = getComputedStyle(this.host.nativeElement);
    const colors: RulerColors = {
      bg: styles.getPropertyValue('--asp-surface-sunk').trim() || '#f1f3f6',
      tick: styles.getPropertyValue('--asp-ink-faint').trim() || '#9aa4b2',
      label: styles.getPropertyValue('--asp-ink-muted').trim() || '#6b7280',
    };
    const dpr = window.devicePixelRatio || 1;

    const paint = (el: HTMLCanvasElement, orientation: 'h' | 'v'): void => {
      const cssW = el.clientWidth;
      const cssH = el.clientHeight;
      if (cssW === 0 || cssH === 0) {
        return;
      }
      el.width = Math.round(cssW * dpr);
      el.height = Math.round(cssH * dpr);
      const ctx = el.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (orientation === 'h') {
        drawRuler(ctx, 'h', cssW, cssH, { zoom: view.zoom, pan: view.panX }, colors);
      } else {
        drawRuler(ctx, 'v', cssH, cssW, { zoom: view.zoom, pan: view.panY }, colors);
      }
    };
    paint(top, 'h');
    paint(left, 'v');
  }

  /**
   * Paint the user's guides (and any live draft) onto a dedicated overlay canvas
   * that sits above the Fabric canvas. Drawing here — rather than on Fabric's own
   * overlay context — keeps guides stable, since Fabric clears its overlay on its
   * own schedule (e.g. on mouse-up) without redrawing ours.
   */
  private renderGuidesOverlay(el: HTMLCanvasElement): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const cssW = el.clientWidth;
    const cssH = el.clientHeight;
    if (cssW === 0 || cssH === 0) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(cssW * dpr);
    el.height = Math.round(cssH * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const view = engine.getViewport();
    ctx.lineWidth = 1;
    const paintGuide = (orientation: 'h' | 'v', pos: number, color: string): void => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      if (orientation === 'h') {
        const y = Math.round(pos * view.zoom + view.panY) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(cssW, y);
      } else {
        const x = Math.round(pos * view.zoom + view.panX) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssH);
      }
      ctx.stroke();
    };
    for (const guide of engine.getManualGuides()) {
      paintGuide(guide.orientation, guide.pos, '#12b5cb');
    }
    const draft = engine.getGuideDraft();
    if (draft) {
      paintGuide(draft.orientation, draft.pos, '#0a8aa0');
    }
  }

  protected duplicate(): void {
    void this.engine?.duplicateActive().then(() => this.sync());
  }

  // ---- engine lifecycle ----------------------------------------------------
  private async ensureEngineAndLoad(
    canvas: HTMLCanvasElement,
    stage: HTMLElement,
    src: string | Blob | null,
  ): Promise<void> {
    if (this.samples().length === 0) {
      this.samples.set(buildSampleImages());
    }

    // (Re)create the engine when the canvas element changes (e.g. mode switch).
    if (canvas !== this.boundCanvas) {
      try {
        this.resizeObserver?.disconnect();
        await this.engine?.destroy();
        const { width, height } = stageSize(stage);
        this.engine = await EditorEngine.create(canvas, {
          width,
          height,
          backgroundRemovalLoader: this.bgRemovalLoader,
          heicDecoderLoader: this.heicLoader,
        });
        this.engine.setSelectionListener((info) => this.onSelectionChange(info));
        this.engine.setLayersListener(() => this.refreshLayers());
        this.engine.setViewportListener(() => this.rulerVersion.update((v) => v + 1));
        this.engine.setGuidesListener(() => {
          this.guidesVersion.update((v) => v + 1);
          this.sync();
        });
        this.engine.setTextPlacementListener((point) => {
          this.engine?.addTextAt(point.x, point.y, {
            color: this.annotationColor(),
            fontSize: this.fontSize(),
            fontFamily: this.fontFamily(),
          });
          this.sync();
        });
        // Clicking off a placed text finishes it and returns to the Select tool.
        this.engine.setTextFinishListener(() => {
          this.activeTool.set('select');
          this.sync();
        });
        this.engine.setAiProgressListener((info) => {
          this.aiStage.set(info.stage);
          this.aiProgress.set(info.progress);
        });
        this.engine.setMagicListener((point) => {
          void this.engine
            ?.magicErase(point, this.magicTolerance())
            .then(() => this.sync())
            .catch((error) => this.emitError('magic-erase-failed', error));
        });
        this.engine.setSnapping(this.snapEnabled());
        this.engine.setArtboard(this.artboard());
        this.engine.setRulersEnabled(this.rulersEnabled());
        this.boundCanvas = canvas;
        this.lastSource = undefined;
        this.engineReady.set(true);
        this.observeResize(stage);
      } catch (error) {
        // No 2D/WebGL context (SSR/headless) — chrome still renders; actions inert.
        console.warn('[asp-image-editor] could not initialize the canvas engine:', error);
        this.emitError('engine-init-failed', error);
        return;
      }
    }

    const source = src ?? this.samples()[0]?.dataUrl ?? null;
    if (source === null || source === this.lastSource || !this.engine) {
      return;
    }
    this.lastSource = source;
    await this.loadSource(source);
  }

  /** Load a source into the engine, emitting imageLoaded / errorOccurred. */
  private async loadSource(source: string | Blob): Promise<void> {
    try {
      await this.engine?.loadImage(source);
      this.resetUiState();
      this.sync();
      this.imageLoaded.emit();
    } catch (error) {
      this.emitError('load-failed', error);
    }
  }

  private emitError(code: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.errorOccurred.emit({ code, message });
    // Also show a transient in-editor toast so failures are never silent — the
    // previous behavior on a bad import looked like "nothing happened".
    this.showErrorToast(message);
  }

  /** Surface a dismissible error toast, auto-clearing after a few seconds. */
  private showErrorToast(message: string): void {
    this.errorToast.set(message);
    if (this.errorToastTimer !== null) {
      clearTimeout(this.errorToastTimer);
    }
    this.errorToastTimer = setTimeout(() => {
      this.errorToast.set(null);
      this.errorToastTimer = null;
    }, 6000);
  }

  protected dismissErrorToast(): void {
    if (this.errorToastTimer !== null) {
      clearTimeout(this.errorToastTimer);
      this.errorToastTimer = null;
    }
    this.errorToast.set(null);
  }

  private observeResize(stage: HTMLElement): void {
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = stageSize(stage);
      this.engine?.setSize(width, height);
    });
    this.resizeObserver.observe(stage);
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
    this.zoomPct.set(engine.isImageCropping() ? engine.imageCropZoomPct : engine.zoom);
    this.refreshLayers();
  }

  private refreshLayers(): void {
    this.layers.set(this.engine?.getLayers() ?? []);
  }

  protected onSelectLayer(event: LayerSelectEvent): void {
    this.engine?.selectLayer(event.id, event.additive);
  }
  protected onReorderLayers(orderedIds: readonly string[]): void {
    this.engine?.reorderLayers(orderedIds);
    this.sync();
  }
  protected onRenameLayer(event: LayerRenameEvent): void {
    this.engine?.renameLayer(event.id, event.name);
    this.sync();
  }
  protected onToggleLayerLock(id: string): void {
    this.engine?.toggleLayerLock(id);
    this.sync();
  }
  protected onToggleLayerVisible(id: string): void {
    this.engine?.toggleLayerVisible(id);
    this.sync();
  }
  protected onMoveLayer(id: string, direction: 'up' | 'down'): void {
    this.engine?.moveLayer(id, direction);
    this.sync();
  }
  protected onDeleteLayer(id: string): void {
    this.engine?.deleteLayer(id);
    this.sync();
  }
  protected onLayerOpacityInput(change: { id: string; value: number }): void {
    this.engine?.setLayerOpacity(change.id, change.value, false);
  }
  protected onLayerOpacityCommit(change: { id: string; value: number }): void {
    this.engine?.setLayerOpacity(change.id, change.value, true);
    this.sync();
  }

  // ---- top bar -------------------------------------------------------------
  protected selectTool(tool: AspTool): void {
    this.activeTool.set(tool);
    const group = groupForTool(tool);
    if (group) {
      this.activeMembers.update((members) => ({ ...members, [group.id]: tool }));
    }
  }

  protected async undo(): Promise<void> {
    await this.engine?.undo();
    this.sync();
    this.syncUiFromEngine();
  }

  protected async redo(): Promise<void> {
    await this.engine?.redo();
    this.sync();
    this.syncUiFromEngine();
  }

  /** Pull tool/adjustment/look/frame state from the engine into the panel signals. */
  private syncUiFromEngine(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    this.adjustments.set(engine.getAdjustments());
    this.activeLook.set(engine.activeLook);
    this.straighten.set(engine.straightenAngle);
    this.activeFrame.set(engine.activeFrame);
    // A crop's source aspect is not recoverable from the flattened scene.
    this.activeCrop.set('free');
    this.activeAspectLabel.set('');
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
    this.historyOpen.set(false);
  }

  protected toggleExport(): void {
    this.exportOpen.update((v) => !v);
    this.pickerOpen.set(false);
    this.historyOpen.set(false);
  }

  protected toggleHistory(): void {
    this.historyOpen.update((v) => !v);
    this.pickerOpen.set(false);
    this.exportOpen.set(false);
  }

  protected async pickSample(sample: SampleImage): Promise<void> {
    this.pickerOpen.set(false);
    this.lastSource = sample.dataUrl;
    await this.loadSource(sample.dataUrl);
  }

  protected async onUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.pickerOpen.set(false);
      this.lastSource = file;
      await this.loadSource(file);
    }
    input.value = '';
  }

  /** Add an uploaded image as a new movable layer (composite, not replace). */
  protected async onAddImageLayer(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.pickerOpen.set(false);
    try {
      await this.engine?.addImageObject(file);
      this.sync();
    } catch (error) {
      this.emitError('image-add-failed', error);
    }
  }

  /** Download the current scene as a reusable template (JSON). */
  protected saveTemplate(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    this.pickerOpen.set(false);
    try {
      const json = engine.exportScene();
      triggerDownload(new Blob([json], { type: 'application/json' }), 'template.json');
    } catch (error) {
      this.emitError('template-save-failed', error);
    }
  }

  /** Load a template (JSON) saved by {@link saveTemplate} and sync the UI to it. */
  protected async loadTemplate(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.pickerOpen.set(false);
    try {
      await this.engine?.loadScene(await file.text());
      this.artboard.set(this.engine?.getArtboard() ?? null);
      this.sync();
      this.syncUiFromEngine();
    } catch (error) {
      this.emitError('template-load-failed', error);
    }
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
    this.exportOpen.set(false);
    try {
      const blob = await engine.exportImage(this.exportFormat(), this.exportQ(), this.exportFormats());
      this.exported.emit(blob);
      this.saved.emit(blob);
      triggerDownload(blob, `image.${extensionFor(this.exportFormat())}`);
    } catch (error) {
      this.emitError('export-failed', error);
    }
  }

  // ---- basic / viewer layouts ----------------------------------------------
  /** Save (basic modal): export to a Blob and emit `saved` without downloading. */
  protected async save(): Promise<void> {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const format = this.exportFormats()[0] ?? 'png';
    try {
      // Commit an in-progress crop (basic mode crops on Save) before export.
      if (engine.isImageCropping()) {
        engine.applyImageCrop();
        this.cropActive = false;
        this.hasCropRegion.set(true);
      } else if (engine.isCropping()) {
        engine.applyCropRegion();
        this.cropActive = false;
        this.hasCropRegion.set(true);
      }
      const blob = await engine.exportImage(format, this.exportQ(), this.exportFormats());
      this.saved.emit(blob);
    } catch (error) {
      this.emitError('export-failed', error);
    }
  }

  protected cancel(): void {
    if (this.engine?.isImageCropping()) {
      this.engine.cancelImageCrop();
      this.cropActive = false;
    } else if (this.engine?.isCropping()) {
      this.engine.cancelCrop();
      this.cropActive = false;
    }
    this.canceled.emit();
  }

  protected onZoomSlider(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    // In avatar crop the slider zooms ONLY the image inside the fixed frame
    // (100% = cover floor), never the canvas viewport.
    if (this.engine?.isImageCropping()) {
      this.engine.zoomImageCrop(value);
      this.zoomPct.set(value);
      return;
    }
    this.engine?.setZoom(value);
    this.sync();
  }

  // ---- options panel handlers ----------------------------------------------
  protected reset(): void {
    void this.engine?.reset().then(() => {
      this.sync();
      this.syncUiFromEngine();
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

  /** Resolve a crop preset to an aspect ratio (w/h), or null for a free crop. */
  private ratioFromPreset(preset: AspAspectPreset): number | null {
    return aspectRatioValue(preset);
  }

  /** Start the crop frame if one isn't already active (e.g. from the basic-mode chips). */
  private ensureCropSession(ratio: number | null): void {
    // Basic (dialog/avatar) mode: the crop frame is FIXED; the image pans and
    // zooms underneath it. Advanced mode keeps the movable-frame crop.
    if (this.layout() === 'basic') {
      this.engine?.setImageCropRatio(ratio);
      this.cropActive = this.engine?.isImageCropping() ?? false;
      return;
    }
    if (this.engine && !this.engine.isCropping()) {
      this.engine.beginCrop(ratio);
      this.cropActive = true;
    } else {
      this.engine?.setCropRatio(ratio);
    }
  }

  /** Choose a crop aspect preset — reshapes (or starts) the live crop frame. */
  protected selectCrop(preset: AspAspectPreset): void {
    this.activeCrop.set(preset);
    this.activeAspectLabel.set('');
    this.ensureCropSession(this.ratioFromPreset(preset));
    this.sync();
  }

  /** Choose a custom crop aspect (e.g. a CMS target) — reshapes (or starts) the live frame. */
  protected selectCustomCrop(option: AspAspectOption): void {
    this.activeAspectLabel.set(option.label);
    this.ensureCropSession(option.ratio);
    this.sync();
  }

  /** Commit the crop frame as the output region, then return to Select. */
  protected applyCrop(): void {
    this.engine?.applyCropRegion();
    this.hasCropRegion.set(true);
    this.sync();
    this.selectTool('select');
  }

  /** Discard the in-progress crop frame and return to Select. */
  protected cancelCrop(): void {
    this.engine?.cancelCrop();
    this.cropActive = false;
    this.selectTool('select');
  }

  /** Clear any applied crop region and restart the frame at the current ratio. */
  protected resetCrop(): void {
    this.engine?.clearCropRegion();
    this.hasCropRegion.set(false);
    this.engine?.beginCrop(this.ratioFromPreset(this.activeCrop()));
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
    this.engine?.addShape(kind, {
      color: this.annotationColor(),
      strokeWidth: this.annotationWidth(),
      cornerRadius: kind === 'rect' ? this.shapeRadius() : undefined,
    });
    this.sync();
  }

  /** Live corner-radius drag: update a selected rectangle without committing. */
  protected onCornerRadiusInput(radius: number): void {
    this.shapeRadius.set(radius);
    if (this.selectedIsRect()) {
      this.engine?.setSelectedCornerRadius(radius, false);
    }
  }

  /** Corner-radius release: commit the selected rectangle's radius to history. */
  protected onCornerRadiusCommit(radius: number): void {
    this.shapeRadius.set(radius);
    if (this.selectedIsRect()) {
      this.engine?.setSelectedCornerRadius(radius, true);
    }
    this.sync();
  }

  protected addText(text: string): void {
    this.engine?.addText(text, {
      color: this.annotationColor(),
      fontSize: this.fontSize(),
      fontFamily: this.fontFamily(),
    });
    this.sync();
  }

  protected onFontChange(value: string): void {
    this.fontFamily.set(value);
    // Apply right away so the selection updates immediately; the family may
    // briefly render in a fallback until the web font loads, at which point the
    // engine re-renders (fonts 'loadingdone'). Re-apply once loaded so Fabric
    // re-measures with the real metrics.
    this.engine?.styleActiveObject({ fontFamily: value });
    // Surface a loading state (spinner + progress cursor) for web fonts. Hold it
    // for a brief minimum so a fast load still registers visually; system stacks
    // need no fetch and show nothing.
    const web = isWebFont(value);
    this.fontLoading.set(web);
    this.sync();
    const minVisible = web
      ? new Promise<void>((resolve) => setTimeout(resolve, 300))
      : Promise.resolve();
    void Promise.all([ensureFontLoaded(value), minVisible]).then(() => {
      // Only re-apply if this is still the chosen font — otherwise a slow-loading
      // earlier choice would clobber a newer one (the "2nd change doesn't stick").
      if (this.fontFamily() !== value) {
        return;
      }
      this.engine?.styleActiveObject({ fontFamily: value });
      this.fontLoading.set(false);
      this.sync();
    });
  }

  protected onAddCustomFont(name: string): void {
    if (!this.customFonts().some((f) => f.value === name)) {
      this.customFonts.update((fonts) => [...fonts, { label: name, value: name }]);
    }
    this.onFontChange(name);
  }

  protected groupSelection(): void {
    this.engine?.groupActive();
    this.sync();
  }

  protected ungroupSelection(): void {
    this.engine?.ungroupActive();
    this.sync();
  }

  protected alignSelection(mode: AlignMode): void {
    this.engine?.alignActive(mode);
    this.sync();
  }

  /** Reflect the selected object's editable style into the panel signals. */
  private onSelectionChange(info: SelectionStyleInfo | null): void {
    this.hasSelection.set(info !== null);
    this.selectionKind.set(info ? info.kind : null);
    if (!info) {
      this.selectedIsRect.set(false);
      return;
    }
    this.annotationColor.set(info.color);
    // Reflect a selected rectangle's corner radius into the slider.
    const isRect = info.cornerRadiusMax !== undefined;
    this.selectedIsRect.set(isRect);
    if (isRect) {
      this.shapeRadius.set(Math.round(info.cornerRadius ?? 0));
      this.shapeRadiusMax.set(Math.round(info.cornerRadiusMax ?? 55));
    }
    if (info.kind === 'text') {
      this.fontSize.set(Math.round(info.size));
      if (info.textStyle) {
        this.textBold.set(info.textStyle.bold);
        this.textItalic.set(info.textStyle.italic);
        this.textUnderline.set(info.textStyle.underline);
        this.textStrike.set(info.textStyle.strike);
        this.textAlign.set(info.textStyle.align);
        // Reflect the selected text's font in the panel dropdown.
        if (info.textStyle.fontFamily) {
          this.fontFamily.set(info.textStyle.fontFamily);
        }
      }
    } else {
      this.annotationWidth.set(Math.round(info.size));
    }
  }

  // ---- rich text ----
  protected toggleBold(): void {
    const v = !this.textBold();
    this.textBold.set(v);
    this.engine?.applyTextStyle({ fontWeight: v ? 'bold' : 'normal' });
    this.sync();
  }
  protected toggleItalic(): void {
    const v = !this.textItalic();
    this.textItalic.set(v);
    this.engine?.applyTextStyle({ fontStyle: v ? 'italic' : 'normal' });
    this.sync();
  }
  protected toggleUnderline(): void {
    const v = !this.textUnderline();
    this.textUnderline.set(v);
    this.engine?.applyTextStyle({ underline: v });
    this.sync();
  }
  protected toggleStrike(): void {
    const v = !this.textStrike();
    this.textStrike.set(v);
    this.engine?.applyTextStyle({ linethrough: v });
    this.sync();
  }
  protected setTextAlign(align: string): void {
    this.textAlign.set(align);
    this.engine?.applyTextStyle({ textAlign: align });
    this.sync();
  }
  protected setLineHeight(value: number): void {
    this.lineHeight.set(value);
    this.engine?.applyTextStyle({ lineHeight: value });
    this.sync();
  }
  protected setLetterSpacing(value: number): void {
    this.letterSpacing.set(value);
    this.engine?.applyTextStyle({ charSpacing: value });
    this.sync();
  }
  protected setTextBg(color: string): void {
    this.engine?.applyTextStyle({ textBackgroundColor: color === 'transparent' ? '' : color });
    this.sync();
  }

  protected setRedactMode(mode: RedactMode): void {
    this.redactMode.set(mode);
  }

  protected applyRedaction(): void {
    void this.engine?.applyRedaction(this.redactMode()).then(() => {
      // The marquee is consumed. We deliberately do NOT spawn a new one — that
      // made a box "jump" onto the canvas. To redact again, click the canvas to
      // place a fresh box where you want it.
      this.sync();
    });
  }

  protected setFill(color: string): void {
    if (this.engine?.setActiveFill(color)) {
      this.sync();
    }
  }

  protected setAnnotationColor(color: string): void {
    this.annotationColor.set(color);
    // Apply to the current selection (no-op + no history entry if nothing selected).
    if (this.engine?.styleActiveObject({ color })) {
      this.sync();
    }
  }

  /** Live size drag — apply to the selection without committing each frame. */
  protected onSizeInput(size: number): void {
    if (this.activeTool() === 'text') {
      this.fontSize.set(size);
    } else {
      this.annotationWidth.set(size);
    }
    this.engine?.styleActiveObject({ size }, false);
  }

  /** Size drag released — commit one history entry. */
  protected onSizeCommit(size: number): void {
    if (this.activeTool() === 'text') {
      this.fontSize.set(size);
    } else {
      this.annotationWidth.set(size);
    }
    if (this.engine?.styleActiveObject({ size }, true)) {
      this.sync();
    }
  }

  protected selectFrame(frame: string): void {
    this.activeFrame.set(frame);
    this.engine?.applyFrame(frame, this.annotationColor());
    this.sync();
  }

  protected setBackgroundColor(color: string): void {
    this.engine?.setBackground(color);
    this.sync();
  }

  protected setBackgroundGradient(colors: string[]): void {
    this.engine?.setBackgroundGradient(colors);
    this.sync();
  }

  protected setBackgroundImageFromFile(file: File): void {
    void this.engine?.setBackgroundImage(file).then(() => this.sync());
  }

  protected deleteSelection(): void {
    this.engine?.deleteActive();
    this.sync();
  }
}

/** True if the keyboard event originates from an editable field, so editor shortcuts should yield. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
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
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revoke so browsers that initiate the download asynchronously can read it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
