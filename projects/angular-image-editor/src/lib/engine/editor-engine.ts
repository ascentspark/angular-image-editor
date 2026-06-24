/**
 * EditorEngine — the only component that talks to Fabric.js directly.
 *
 * It owns a Fabric `Canvas` holding one base `FabricImage` (the photo) plus
 * annotation objects on top, and exposes high-level editor operations: load,
 * zoom/pan, rotate/flip/straighten, crop, adjustments/filters, shapes/text/
 * free-draw, undo/redo (serialized-scene snapshots), and export. UI components
 * call these methods and never import Fabric themselves.
 *
 * Not unit-tested in jsdom (Fabric needs a real canvas/WebGL); verified through
 * the demo with Playwright screenshots, per the project's visual-truth rule.
 */

import type * as Fabric from 'fabric';

import { parseHex, withAlpha } from '../theme/color';
import { centeredCropRect, aspectRatioValue } from './crop';
import { buildFabricFilters, LOOK_FILTERS } from './fabric-filters';
import { loadFabric, type FabricModule } from './fabric-loader';
import { resolveExport } from './export-config';
import { EditHistory, type HistoryEntry } from './history';
import { FILTER_REGISTRY } from '../registry/tool-registry';
import { ALL_FILTERS, type AspAspectPreset, type AspExportFormat, type AspFilter } from '../types/editor.types';

export interface EngineOptions {
  readonly width: number;
  readonly height: number;
}

export type ShapeKind =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star';

export type RedactMode = 'blur' | 'pixelate' | 'solid';

export interface AnnotationStyle {
  readonly color: string;
  readonly strokeWidth: number;
}

export interface TextStyle {
  readonly color: string;
  readonly fontSize: number;
  readonly fontFamily?: string;
}

/** Rich-text attributes of the selected text, for the Text panel toggles. */
export interface TextStyleInfo {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strike: boolean;
  readonly align: string;
}

/** Editable style of the current selection, surfaced to the host UI. */
export interface SelectionStyleInfo {
  /** `'text'` → color is fill + size is fontSize; `'stroke'` → color is stroke + size is strokeWidth. */
  readonly kind: 'text' | 'stroke';
  readonly color: string;
  readonly size: number;
  /** Present when a single text object is selected. */
  readonly textStyle?: TextStyleInfo;
}

/** One entry in the layers panel (top of the z-stack first). */
export interface LayerInfo {
  readonly id: string;
  readonly label: string;
  readonly locked: boolean;
  readonly visible: boolean;
  readonly selected: boolean;
  /** Object opacity, 0–1. */
  readonly opacity: number;
  /** False for the base image, which should not be deletable. */
  readonly removable: boolean;
}

/** Full serialized editor state stored in each history entry. */
interface EditorSnapshot {
  json: Record<string, unknown>;
  rotation: number;
  straighten: number;
  adjustments: Record<AspFilter, number>;
  looks: AspFilter[];
  frame: string;
}

const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const FIT_PADDING = 0.92;
/** Imported images larger than this (longest edge, px) are downscaled to cap memory. */
const MAX_IMPORT_DIM = 4096;

const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Default adjustment values (the registry default for each adjustment filter). */
function defaultAdjustments(): Record<AspFilter, number> {
  const values = {} as Record<AspFilter, number>;
  for (const key of ALL_FILTERS) {
    const meta = FILTER_REGISTRY[key];
    values[key] = meta.kind === 'adjustment' ? (meta.defaultValue ?? 0) : 0;
  }
  return values;
}

export class EditorEngine {
  private readonly canvas: Fabric.Canvas;
  private readonly fabric: FabricModule;
  private readonly history: EditHistory<string>;

  private baseImage: Fabric.FabricImage | null = null;
  private rotation = 0; // 0/90/180/270, in degrees
  private straighten = 0; // -45..45
  private zoomPct = 100;
  private adjustments: Record<AspFilter, number> = defaultAdjustments();
  private looks = new Set<AspFilter>();
  private frame = 'none';
  private idCounter = 0;
  private clipboard: Fabric.FabricObject[] = [];
  private panMode = false;
  private panLast: { x: number; y: number } | null = null;
  private selectionListener: ((info: SelectionStyleInfo | null) => void) | null = null;
  private layersListener: (() => void) | null = null;

  private constructor(fabric: FabricModule, canvas: Fabric.Canvas) {
    this.fabric = fabric;
    this.canvas = canvas;
    this.history = new EditHistory<string>('Opened editor', this.snapshot());
    const notify = (): void => {
      this.notifySelection();
      this.notifyLayers();
    };
    this.canvas.on('selection:created', notify);
    this.canvas.on('selection:updated', notify);
    this.canvas.on('selection:cleared', notify);
    // Space-drag panning (only touches the viewport transform).
    this.canvas.on('mouse:down', (opt) => {
      if (this.panMode) {
        this.panLast = { x: opt.viewportPoint.x, y: opt.viewportPoint.y };
        this.canvas.setCursor('grabbing');
      }
    });
    this.canvas.on('mouse:move', (opt) => {
      if (this.panMode && this.panLast) {
        const p = opt.viewportPoint;
        this.canvas.relativePan(new this.fabric.Point(p.x - this.panLast.x, p.y - this.panLast.y));
        this.panLast = { x: p.x, y: p.y };
      }
    });
    this.canvas.on('mouse:up', () => {
      if (this.panMode) {
        this.panLast = null;
        this.canvas.setCursor('grab');
      }
    });
    // A freehand stroke becomes a Path on mouse-up — tag it, record it, and
    // surface it as a layer (otherwise drawings would not be undoable).
    this.canvas.on('path:created', (event) => {
      const path = (event as { path?: Fabric.FabricObject }).path;
      if (path) {
        path.set('aspId', this.nextId());
      }
      this.commit('Draw');
      this.notifyLayers();
    });
  }

  private nextId(): string {
    this.idCounter += 1;
    return `o${this.idCounter}`;
  }

  /** Register a callback fired when the active selection (and its style) changes. */
  setSelectionListener(cb: (info: SelectionStyleInfo | null) => void): void {
    this.selectionListener = cb;
  }

  /** Register a callback fired when the layer set or its state changes. */
  setLayersListener(cb: () => void): void {
    this.layersListener = cb;
  }

  private notifyLayers(): void {
    this.layersListener?.();
  }

  private notifySelection(): void {
    const active = this.canvas.getActiveObject();
    this.selectionListener?.(active ? this.describeSelection(active) : null);
  }

  private describeSelection(object: Fabric.FabricObject): SelectionStyleInfo {
    if (object.isType('textbox', 'i-text', 'text')) {
      const fill = object.get('fill');
      const fontSize = object.get('fontSize');
      const weight = object.get('fontWeight');
      const align = object.get('textAlign');
      return {
        kind: 'text',
        color: typeof fill === 'string' ? fill : '#000000',
        size: typeof fontSize === 'number' ? fontSize : 24,
        textStyle: {
          bold: weight === 'bold' || weight === 700,
          italic: object.get('fontStyle') === 'italic',
          underline: object.get('underline') === true,
          strike: object.get('linethrough') === true,
          align: typeof align === 'string' ? align : 'left',
        },
      };
    }
    let target = object;
    if (object.isType('group', 'activeselection')) {
      const children = (object as Fabric.Group).getObjects();
      target = children.find((c) => typeof c.get('stroke') === 'string') ?? children[0] ?? object;
    }
    const stroke = target.get('stroke');
    const fill = target.get('fill');
    const strokeWidth = target.get('strokeWidth');
    return {
      kind: 'stroke',
      color: typeof stroke === 'string' ? stroke : typeof fill === 'string' ? fill : '#000000',
      size: typeof strokeWidth === 'number' ? strokeWidth : 4,
    };
  }

  /**
   * Apply a color and/or size to the currently selected object(s), routing by
   * object type (text → fill/fontSize, shapes & paths → stroke/strokeWidth, and
   * recursing into groups such as arrows). Returns false if nothing is selected.
   * Pass `commit: false` for live slider drags; commit once on release.
   */
  styleActiveObject(
    style: { color?: string; size?: number; fontFamily?: string },
    commit = true,
  ): boolean {
    const active = this.canvas.getActiveObject();
    if (!active) {
      return false;
    }
    this.styleOne(active, style);
    this.canvas.requestRenderAll();
    if (commit) {
      this.commit('Restyle');
    }
    this.notifySelection();
    return true;
  }

  private styleOne(
    object: Fabric.FabricObject,
    style: { color?: string; size?: number; fontFamily?: string },
  ): void {
    if (object.isType('group', 'activeselection')) {
      for (const child of (object as Fabric.Group).getObjects()) {
        this.styleOne(child, style);
      }
      return;
    }
    const isText = object.isType('textbox', 'i-text', 'text');
    if (style.color !== undefined) {
      if (isText || typeof object.get('stroke') !== 'string') {
        object.set('fill', style.color);
      } else {
        object.set('stroke', style.color);
      }
    }
    if (style.size !== undefined) {
      if (isText) {
        object.set('fontSize', Math.max(6, style.size));
      } else {
        object.set('strokeWidth', style.size);
      }
    }
    if (style.fontFamily !== undefined && isText) {
      object.set('fontFamily', style.fontFamily);
    }
    object.setCoords();
  }

  /** Create an engine bound to a `<canvas>` element. */
  static async create(canvasEl: HTMLCanvasElement, options: EngineOptions): Promise<EditorEngine> {
    const fabric = await loadFabric();
    const canvas = new fabric.Canvas(canvasEl, {
      width: options.width,
      height: options.height,
      preserveObjectStacking: true,
      backgroundColor: undefined,
      selection: true,
    });
    return new EditorEngine(fabric, canvas);
  }

  // ---- image loading -------------------------------------------------------

  /**
   * Load an image from a URL or Blob, fit it to the canvas, and reset history.
   *
   * A Blob is first read into a data URL so the image's serialized `src` survives
   * in history snapshots (a transient object URL would be revoked and break undo).
   */
  async loadImage(src: string | Blob): Promise<void> {
    const raw = typeof src === 'string' ? src : await blobToDataUrl(src);
    // Downscale large same-origin (data URL) imports; remote URLs are left to
    // Fabric (canvas-resampling a cross-origin image would taint it).
    const url = raw.startsWith('data:') ? await downscaleDataUrl(raw, MAX_IMPORT_DIM) : raw;
    const loadOptions = typeof src === 'string' ? { crossOrigin: 'anonymous' as const } : {};
    const image = await this.fabric.FabricImage.fromURL(url, loadOptions, {});
    this.canvas.remove(...this.canvas.getObjects());
    this.baseImage = image;
    this.rotation = 0;
    this.straighten = 0;
    this.zoomPct = 100;
    this.adjustments = defaultAdjustments();
    this.looks.clear();
    this.frame = 'none';
    image.set({ selectable: false, evented: false, hasControls: false });
    image.set('aspId', 'base');
    this.fitBaseImage();
    this.canvas.add(image);
    this.canvas.setZoom(1);
    this.canvas.requestRenderAll();
    this.history.reset('Opened image', this.snapshot());
  }

  get hasImage(): boolean {
    return this.baseImage !== null;
  }

  private fitBaseImage(): void {
    const image = this.baseImage;
    if (!image) {
      return;
    }
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const iw = image.width ?? 1;
    const ih = image.height ?? 1;
    const scale = Math.min(cw / iw, ch / ih) * FIT_PADDING;
    image.set({
      originX: 'center',
      originY: 'center',
      left: cw / 2,
      top: ch / 2,
      scaleX: scale,
      scaleY: scale,
      angle: this.rotation + this.straighten,
    });
    image.setCoords();
  }

  // ---- transforms ----------------------------------------------------------

  /** Rotate the image by a signed multiple of 90°. */
  rotateBy(deg: number): void {
    this.rotation = (((this.rotation + deg) % 360) + 360) % 360;
    this.applyAngle();
    this.commit(deg > 0 ? 'Rotate right' : 'Rotate left');
  }

  /** Fine straighten angle, −45..45°. */
  setStraighten(deg: number, commit = false): void {
    this.straighten = clamp(deg, -45, 45);
    this.applyAngle();
    if (commit) {
      this.commit('Straighten');
    }
  }

  private applyAngle(): void {
    this.baseImage?.set({ angle: this.rotation + this.straighten });
    this.baseImage?.setCoords();
    this.canvas.requestRenderAll();
  }

  /** Flip the image horizontally or vertically. */
  flip(axis: 'h' | 'v'): void {
    const image = this.baseImage;
    if (!image) {
      return;
    }
    if (axis === 'h') {
      image.set({ flipX: !image.flipX });
    } else {
      image.set({ flipY: !image.flipY });
    }
    this.canvas.requestRenderAll();
    this.commit(`Flip ${axis.toUpperCase()}`);
  }

  // ---- zoom ----------------------------------------------------------------

  get zoom(): number {
    return this.zoomPct;
  }

  setZoom(pct: number): void {
    this.zoomPct = clamp(Math.round(pct), ZOOM_MIN, ZOOM_MAX);
    const center = new this.fabric.Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2);
    this.canvas.zoomToPoint(center, this.zoomPct / 100);
    this.canvas.requestRenderAll();
  }

  zoomBy(deltaPct: number): void {
    this.setZoom(this.zoomPct + deltaPct);
  }

  resetView(): void {
    this.zoomPct = 100;
    this.canvas.setZoom(1);
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.requestRenderAll();
  }

  // ---- crop ----------------------------------------------------------------

  /** Crop the base image to a centered rectangle of the given aspect preset. */
  applyCrop(preset: AspAspectPreset): void {
    const image = this.baseImage;
    if (!image) {
      return;
    }
    const naturalW = (image.width ?? 0) + (image.cropX ?? 0);
    const naturalH = (image.height ?? 0) + (image.cropY ?? 0);
    this.applyCropRatio(aspectRatioValue(preset, naturalW, naturalH));
  }

  /**
   * Crop the base image to a centered rectangle of an arbitrary width/height
   * ratio (`null` = full image). Use this for host-defined / CMS aspect targets.
   */
  applyCropRatio(ratio: number | null): void {
    const image = this.baseImage;
    if (!image) {
      return;
    }
    const naturalW = (image.width ?? 0) + (image.cropX ?? 0);
    const naturalH = (image.height ?? 0) + (image.cropY ?? 0);
    const rect = centeredCropRect(naturalW, naturalH, ratio);
    image.set({ cropX: rect.left, cropY: rect.top, width: rect.width, height: rect.height });
    this.fitBaseImage();
    this.canvas.requestRenderAll();
    this.commit('Crop');
  }

  // ---- color: adjustments + looks -----------------------------------------

  /** Merge adjustment values and re-render. Pass `commit` on slider release. */
  setAdjustments(values: Partial<Record<AspFilter, number>>, commit = false): void {
    this.adjustments = { ...this.adjustments, ...values };
    this.rebuildFilters();
    if (commit) {
      this.commit('Adjust');
    }
  }

  /** Toggle a one-tap look filter (grayscale/sepia/invert/sharpen). */
  toggleLook(look: AspFilter): void {
    if (!LOOK_FILTERS.includes(look)) {
      return;
    }
    if (this.looks.has(look)) {
      this.looks.delete(look);
    } else {
      this.looks.add(look);
    }
    this.rebuildFilters();
    this.commit(`Filter: ${FILTER_REGISTRY[look].label}`);
  }

  isLookActive(look: AspFilter): boolean {
    return this.looks.has(look);
  }

  getAdjustment(key: AspFilter): number {
    return this.adjustments[key];
  }

  private rebuildFilters(): void {
    const image = this.baseImage;
    if (!image) {
      return;
    }
    image.filters = buildFabricFilters(this.fabric, this.adjustments, this.looks);
    image.applyFilters();
    this.canvas.requestRenderAll();
  }

  // ---- annotations ---------------------------------------------------------

  /** Add a shape at the canvas center. */
  addShape(kind: ShapeKind, style: AnnotationStyle): void {
    const cx = this.canvas.getWidth() / 2;
    const cy = this.canvas.getHeight() / 2;
    const common = {
      left: cx,
      top: cy,
      originX: 'center' as const,
      originY: 'center' as const,
      stroke: style.color,
      strokeWidth: style.strokeWidth,
      fill: 'transparent',
    };
    let object: Fabric.FabricObject;
    switch (kind) {
      case 'rect':
        object = new this.fabric.Rect({ ...common, width: 160, height: 110, rx: 6, ry: 6 });
        break;
      case 'ellipse':
        object = new this.fabric.Ellipse({ ...common, rx: 90, ry: 60 });
        break;
      case 'line':
        object = new this.fabric.Line([cx - 90, cy, cx + 90, cy], {
          stroke: style.color,
          strokeWidth: style.strokeWidth,
          originX: 'center',
          originY: 'center',
        });
        break;
      case 'arrow':
        object = this.buildArrow(cx, cy, style);
        break;
      case 'triangle':
        object = new this.fabric.Triangle({ ...common, width: 150, height: 130 });
        break;
      case 'diamond':
        object = new this.fabric.Polygon(polygonPoints(4, 80), common);
        break;
      case 'pentagon':
        object = new this.fabric.Polygon(polygonPoints(5, 80), common);
        break;
      case 'hexagon':
        object = new this.fabric.Polygon(polygonPoints(6, 80), common);
        break;
      case 'star':
        object = new this.fabric.Polygon(starPoints(5, 85, 38), common);
        break;
      default:
        return;
    }
    object.set('aspId', this.nextId());
    this.canvas.add(object);
    this.canvas.setActiveObject(object);
    this.canvas.requestRenderAll();
    this.commit('Add shape');
    this.notifySelection();
  }

  private buildArrow(cx: number, cy: number, style: AnnotationStyle): Fabric.FabricObject {
    const line = new this.fabric.Line([-90, 0, 70, 0], {
      stroke: style.color,
      strokeWidth: style.strokeWidth,
    });
    const head = new this.fabric.Triangle({
      left: 70,
      top: 0,
      originX: 'center',
      originY: 'center',
      angle: 90,
      width: style.strokeWidth * 4 + 8,
      height: style.strokeWidth * 4 + 8,
      fill: style.color,
    });
    return new this.fabric.Group([line, head], {
      left: cx,
      top: cy,
      originX: 'center',
      originY: 'center',
    });
  }

  /** Add an editable text box at the canvas center. */
  addText(text: string, style: TextStyle): void {
    const textbox = new this.fabric.Textbox(text, {
      left: this.canvas.getWidth() / 2,
      top: this.canvas.getHeight() / 2,
      originX: 'center',
      originY: 'center',
      fontSize: style.fontSize,
      fill: style.color,
      fontFamily: style.fontFamily ?? 'system-ui, sans-serif',
      width: 220,
      textAlign: 'center',
    });
    textbox.set('aspId', this.nextId());
    this.canvas.add(textbox);
    this.canvas.setActiveObject(textbox);
    this.canvas.requestRenderAll();
    this.commit('Add text');
    this.notifySelection();
  }

  /**
   * Add a movable/resizable redaction marquee the user positions over the area
   * to conceal. Transient (not committed) until {@link applyRedaction} bakes it.
   */
  addRedactionMarquee(): void {
    this.cancelRedaction();
    const w = 220;
    const h = 120;
    const rect = new this.fabric.Rect({
      left: this.canvas.getWidth() / 2 - w / 2,
      top: this.canvas.getHeight() / 2 - h / 2,
      originX: 'left',
      originY: 'top',
      width: w,
      height: h,
      fill: 'rgba(15, 23, 42, 0.18)',
      stroke: '#ffffff',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      strokeUniform: true,
    });
    rect.set('aspRole', 'redact-marquee');
    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
    this.canvas.requestRenderAll();
  }

  /** Remove the redaction marquee without applying it. */
  cancelRedaction(): void {
    this.removeTagged('redact-marquee');
    this.canvas.requestRenderAll();
  }

  /**
   * Bake the redaction: conceal the COMPOSITED content under the marquee. `solid`
   * lays an opaque box; `blur`/`pixelate` sample the rendered pixels in the region
   * (so all underlying layers are hidden) and place a filtered, opaque patch.
   */
  async applyRedaction(mode: RedactMode): Promise<void> {
    const marquee = this.findByRole('redact-marquee');
    if (!marquee) {
      return;
    }
    const region = {
      left: marquee.left ?? 0,
      top: marquee.top ?? 0,
      width: (marquee.width ?? 0) * (marquee.scaleX ?? 1),
      height: (marquee.height ?? 0) * (marquee.scaleY ?? 1),
    };
    this.canvas.remove(marquee);

    if (mode === 'solid') {
      const rect = new this.fabric.Rect({
        left: region.left,
        top: region.top,
        originX: 'left',
        originY: 'top',
        width: region.width,
        height: region.height,
        fill: '#0b0f1a',
      });
      rect.set('aspRole', 'redaction');
      rect.set('aspId', this.nextId());
      this.canvas.add(rect);
      this.canvas.setActiveObject(rect);
      this.canvas.requestRenderAll();
      this.commit('Redact');
      this.notifySelection();
      return;
    }

    // Sample the composited region at identity viewport (so region == pixels).
    const vpt = [...this.canvas.viewportTransform] as Fabric.TMat2D;
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const dataUrl = this.canvas.toDataURL({
      format: 'png',
      left: region.left,
      top: region.top,
      width: region.width,
      height: region.height,
      multiplier: 1,
    });
    this.canvas.setViewportTransform(vpt);
    this.canvas.requestRenderAll();

    const patch = await this.fabric.FabricImage.fromURL(dataUrl, {}, {});
    patch.set({ left: region.left, top: region.top, originX: 'left', originY: 'top' });
    patch.filters = [
      mode === 'blur'
        ? new this.fabric.filters.Blur({ blur: 0.5 })
        : new this.fabric.filters.Pixelate({ blocksize: 16 }),
    ];
    patch.applyFilters();
    patch.set('aspRole', 'redaction');
    patch.set('aspId', this.nextId());
    this.canvas.add(patch);
    this.canvas.setActiveObject(patch);
    this.canvas.requestRenderAll();
    this.commit('Redact');
    this.notifySelection();
  }

  private findByRole(role: string): Fabric.FabricObject | null {
    return this.canvas.getObjects().find((o) => o.get('aspRole') === role) ?? null;
  }

  /**
   * Apply a decorative frame around the image. Each style maps to a distinct,
   * real border rendering (`none` clears it). The frame is a non-interactive
   * rectangle tagged with `aspRole: 'frame'` so it can be re-found and replaced
   * even after a history restore rebuilds every canvas object.
   */
  applyFrame(style: string, color: string): void {
    this.removeTagged('frame');
    this.frame = style;
    const image = this.baseImage;
    if (image && style !== 'none') {
      const width = (image.width ?? 0) * (image.scaleX ?? 1);
      const height = (image.height ?? 0) * (image.scaleY ?? 1);
      const spec = FRAME_STYLES[style] ?? FRAME_STYLES['line'];
      const rect = new this.fabric.Rect({
        left: image.left ?? this.canvas.getWidth() / 2,
        top: image.top ?? this.canvas.getHeight() / 2,
        originX: 'center',
        originY: 'center',
        width: width - spec.strokeWidth,
        height: height - spec.strokeWidth,
        fill: 'transparent',
        stroke: spec.useColor ? color : spec.stroke,
        strokeWidth: spec.strokeWidth,
        strokeDashArray: spec.dash ? [...spec.dash] : null,
        rx: spec.radius,
        ry: spec.radius,
        selectable: false,
        evented: false,
        strokeUniform: true,
      });
      rect.set('aspRole', 'frame');
      rect.set('aspId', this.nextId());
      this.canvas.add(rect);
    }
    this.canvas.requestRenderAll();
    this.commit('Frame');
  }

  /**
   * Set the canvas background to a solid color (`'transparent'` clears it, showing
   * the checkerboard). Fabric serializes `backgroundColor`, so it survives undo.
   */
  setBackground(color: string): void {
    this.canvas.backgroundImage = undefined;
    this.canvas.backgroundColor = color === 'transparent' ? '' : color;
    this.canvas.requestRenderAll();
    this.commit('Background');
  }

  /** Set the canvas background to a linear gradient of the given color stops. */
  setBackgroundGradient(colors: readonly string[]): void {
    const stops = colors.map((color, index) => ({
      offset: colors.length === 1 ? 0 : index / (colors.length - 1),
      color,
    }));
    this.canvas.backgroundImage = undefined;
    this.canvas.backgroundColor = new this.fabric.Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords: { x1: 0, y1: 0, x2: this.canvas.getWidth(), y2: this.canvas.getHeight() },
      colorStops: stops,
    });
    this.canvas.requestRenderAll();
    this.commit('Background');
  }

  /** Set an uploaded image as the canvas background, scaled to cover. */
  async setBackgroundImage(src: string | Blob): Promise<void> {
    const raw = typeof src === 'string' ? src : await blobToDataUrl(src);
    const url = raw.startsWith('data:') ? await downscaleDataUrl(raw, MAX_IMPORT_DIM) : raw;
    const image = await this.fabric.FabricImage.fromURL(url, {}, {});
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const scale = Math.max(cw / (image.width || 1), ch / (image.height || 1));
    image.set({ originX: 'left', originY: 'top', left: 0, top: 0, scaleX: scale, scaleY: scale });
    this.canvas.backgroundImage = image;
    this.canvas.requestRenderAll();
    this.commit('Background image');
  }

  /** Remove every canvas object tagged with the given `aspRole`. */
  private removeTagged(role: string): void {
    const tagged = this.canvas.getObjects().filter((o) => o.get('aspRole') === role);
    if (tagged.length > 0) {
      this.canvas.remove(...tagged);
    }
  }

  /**
   * Enable or disable freehand drawing. When `highlighter` is set, the brush is
   * translucent and wider so strokes read as a highlight over the underlying
   * content rather than an opaque line.
   */
  setFreeDraw(enabled: boolean, style: AnnotationStyle, highlighter = false): void {
    this.canvas.isDrawingMode = enabled;
    if (!enabled) {
      return;
    }
    const brush = new this.fabric.PencilBrush(this.canvas);
    if (highlighter) {
      brush.color = translucent(style.color, 0.35);
      brush.width = style.strokeWidth * 2;
    } else {
      brush.color = style.color;
      brush.width = style.strokeWidth;
    }
    this.canvas.freeDrawingBrush = brush;
  }

  /** Apply rich-text attributes (weight/style/underline/align/spacing/bg) to the active text. */
  applyTextStyle(props: Record<string, string | number | boolean>, commit = true): boolean {
    const active = this.canvas
      .getActiveObjects()
      .filter((o) => o.isType('textbox', 'i-text', 'text'));
    if (active.length === 0) {
      return false;
    }
    for (const object of active) {
      object.set(props);
    }
    this.canvas.requestRenderAll();
    if (commit) {
      this.commit('Text style');
    }
    this.notifySelection();
    return true;
  }

  /** Set the fill of the active non-text object(s) (`'transparent'` clears it). */
  setActiveFill(color: string, commit = true): boolean {
    const active = this.canvas.getActiveObjects();
    if (active.length === 0) {
      return false;
    }
    for (const object of active) {
      if (!object.isType('textbox', 'i-text', 'text')) {
        object.set('fill', color);
      }
    }
    this.canvas.requestRenderAll();
    if (commit) {
      this.commit('Fill');
    }
    return true;
  }

  /** Set opacity (0–1) on the active object(s). Returns false if nothing selected. */
  setOpacity(value: number, commit = true): boolean {
    const active = this.canvas.getActiveObjects();
    if (active.length === 0) {
      return false;
    }
    const opacity = Math.max(0, Math.min(1, value));
    for (const object of active) {
      object.set('opacity', opacity);
    }
    this.canvas.requestRenderAll();
    if (commit) {
      this.commit('Opacity');
    }
    this.notifySelection();
    this.notifyLayers();
    return true;
  }

  /** Set opacity (0–1) on a specific layer. */
  setLayerOpacity(id: string, value: number, commit = false): void {
    const object = this.findById(id);
    if (!object) {
      return;
    }
    object.set('opacity', Math.max(0, Math.min(1, value)));
    this.canvas.requestRenderAll();
    if (commit) {
      this.commit('Opacity');
    }
    this.notifyLayers();
  }

  /** Delete the currently selected object(s). */
  deleteActive(): void {
    const active = this.canvas.getActiveObjects();
    if (active.length === 0) {
      return;
    }
    this.canvas.remove(...active);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.commit('Delete');
    this.notifySelection();
  }

  /** Clear the active selection. */
  discardSelection(): void {
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.notifySelection();
  }

  /** Select all editable (unlocked, non-base) objects. */
  selectAll(): void {
    const objects = this.canvas
      .getObjects()
      .filter((o) => o.selectable !== false && o.get('aspId') !== 'base');
    if (objects.length === 0) {
      return;
    }
    this.canvas.discardActiveObject();
    this.setActive(objects);
    this.canvas.requestRenderAll();
    this.notifySelection();
  }

  /** Copy the current selection to the internal clipboard. */
  async copy(): Promise<void> {
    const active = this.canvas.getActiveObjects();
    this.clipboard = await Promise.all(active.map((o) => o.clone()));
  }

  /** Paste the clipboard contents, offset and selected. */
  async paste(): Promise<void> {
    if (this.clipboard.length === 0) {
      return;
    }
    const clones = await Promise.all(this.clipboard.map((o) => o.clone()));
    this.addClones(clones, 'Paste');
  }

  /** Duplicate the current selection in place (offset). */
  async duplicateActive(): Promise<void> {
    const active = this.canvas.getActiveObjects();
    if (active.length === 0) {
      return;
    }
    const clones = await Promise.all(active.map((o) => o.clone()));
    this.addClones(clones, 'Duplicate');
  }

  private addClones(clones: Fabric.FabricObject[], label: string): void {
    for (const clone of clones) {
      clone.set({ left: (clone.left ?? 0) + 16, top: (clone.top ?? 0) + 16 });
      clone.set('aspId', this.nextId());
      this.canvas.add(clone);
    }
    this.canvas.discardActiveObject();
    this.setActive(clones);
    this.canvas.requestRenderAll();
    this.commit(label);
    this.notifySelection();
  }

  private setActive(objects: Fabric.FabricObject[]): void {
    if (objects.length === 1) {
      this.canvas.setActiveObject(objects[0]);
    } else if (objects.length > 1) {
      this.canvas.setActiveObject(new this.fabric.ActiveSelection(objects, { canvas: this.canvas }));
    }
  }

  /** Group the current multi-selection into a single object. */
  groupActive(): void {
    const active = this.canvas.getActiveObject();
    if (!active || !active.isType('activeselection')) {
      return;
    }
    const objects = (active as Fabric.ActiveSelection).getObjects();
    this.canvas.discardActiveObject();
    this.canvas.remove(...objects);
    const group = new this.fabric.Group(objects);
    group.set('aspId', this.nextId());
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    this.canvas.requestRenderAll();
    this.commit('Group');
    this.notifySelection();
  }

  /** Ungroup the selected group back into individual objects. */
  ungroupActive(): void {
    const active = this.canvas.getActiveObject();
    if (!active || !active.isType('group')) {
      return;
    }
    const group = active as Fabric.Group;
    const objects = group.removeAll();
    this.canvas.remove(group);
    for (const object of objects) {
      object.set('aspId', this.nextId());
      this.canvas.add(object);
    }
    this.canvas.discardActiveObject();
    this.setActive(objects);
    this.canvas.requestRenderAll();
    this.commit('Ungroup');
    this.notifySelection();
  }

  /** Align the active object/selection to an edge or center of the canvas. */
  alignActive(mode: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'): void {
    const active = this.canvas.getActiveObject();
    if (!active) {
      return;
    }
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const box = active.getBoundingRect();
    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left':
        dx = -box.left;
        break;
      case 'center-h':
        dx = (cw - box.width) / 2 - box.left;
        break;
      case 'right':
        dx = cw - box.width - box.left;
        break;
      case 'top':
        dy = -box.top;
        break;
      case 'center-v':
        dy = (ch - box.height) / 2 - box.top;
        break;
      case 'bottom':
        dy = ch - box.height - box.top;
        break;
      default:
        break;
    }
    active.set({ left: (active.left ?? 0) + dx, top: (active.top ?? 0) + dy });
    active.setCoords();
    this.canvas.requestRenderAll();
    this.commit('Align');
  }

  /** Enable/disable space-drag panning (disables selection while active). */
  setPanMode(enabled: boolean): void {
    if (this.panMode === enabled) {
      return;
    }
    this.panMode = enabled;
    this.canvas.selection = !enabled;
    this.canvas.defaultCursor = enabled ? 'grab' : 'default';
    this.canvas.setCursor(enabled ? 'grab' : 'default');
    if (!enabled) {
      this.panLast = null;
    }
  }

  // ---- history -------------------------------------------------------------

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get historyEntries(): readonly HistoryEntry<string>[] {
    return this.history.entries;
  }

  get historyIndex(): number {
    return this.history.index;
  }

  async undo(): Promise<void> {
    const entry = this.history.undo();
    if (entry) {
      await this.restore(entry.state);
    }
  }

  async redo(): Promise<void> {
    const entry = this.history.redo();
    if (entry) {
      await this.restore(entry.state);
    }
  }

  /**
   * Serialize the full editor state — the Fabric scene PLUS the engine's own
   * transform/adjustment/look/frame state — so a restore puts both back in sync
   * (the canvas alone does not capture rotation buckets, slider values, etc).
   */
  private snapshot(): string {
    const composite: EditorSnapshot = {
      json: this.canvas.toObject(['aspRole', 'aspId', 'aspLocked']),
      rotation: this.rotation,
      straighten: this.straighten,
      adjustments: { ...this.adjustments },
      looks: [...this.looks],
      frame: this.frame,
    };
    return JSON.stringify(composite);
  }

  private commit(label: string): void {
    this.history.push(label, this.snapshot());
    this.notifyLayers();
  }

  private async restore(state: string): Promise<void> {
    const composite = JSON.parse(state) as EditorSnapshot;
    await this.canvas.loadFromJSON(composite.json);
    this.baseImage = this.findBaseImage();
    this.rotation = composite.rotation;
    this.straighten = composite.straighten;
    this.adjustments = { ...defaultAdjustments(), ...composite.adjustments };
    this.looks = new Set(composite.looks);
    this.frame = composite.frame;
    // Re-apply per-object lock state (serialized via aspLocked).
    for (const object of this.canvas.getObjects()) {
      if (object.get('aspLocked') === true) {
        this.setLocked(object, true);
      }
    }
    this.canvas.requestRenderAll();
    this.notifyLayers();
  }

  private findBaseImage(): Fabric.FabricImage | null {
    for (const object of this.canvas.getObjects()) {
      if (object.isType('image') && object.get('aspRole') !== 'redaction') {
        return object as Fabric.FabricImage;
      }
    }
    return null;
  }

  /** Reset all edits back to the freshly-loaded image. */
  async reset(): Promise<void> {
    const first = this.history.entries[0];
    this.history.reset(first.label, first.state);
    this.resetView();
    await this.restore(first.state);
  }

  // ---- state accessors (for the host UI to resync after undo/redo/reset) ----

  get rotationAngle(): number {
    return this.rotation;
  }

  get straightenAngle(): number {
    return this.straighten;
  }

  /** A copy of the current adjustment values. */
  getAdjustments(): Record<AspFilter, number> {
    return { ...this.adjustments };
  }

  /** The single active look (UI is single-select), or null. */
  get activeLook(): AspFilter | null {
    return this.looks.size === 1 ? [...this.looks][0] : null;
  }

  get activeFrame(): string {
    return this.frame;
  }

  // ---- layers --------------------------------------------------------------

  /** The layer stack, top of the z-order first (matching visual stacking). */
  getLayers(): LayerInfo[] {
    const active = this.canvas.getActiveObjects();
    const layers = this.canvas.getObjects().map((object): LayerInfo => {
      const id = typeof object.get('aspId') === 'string' ? (object.get('aspId') as string) : '';
      const isBase = id === 'base';
      return {
        id,
        label: layerLabel(object),
        locked: object.get('aspLocked') === true,
        visible: object.visible !== false,
        selected: active.includes(object),
        opacity: typeof object.opacity === 'number' ? object.opacity : 1,
        removable: !isBase,
      };
    });
    return layers.filter((l) => l.id !== '').reverse();
  }

  private findById(id: string): Fabric.FabricObject | null {
    return this.canvas.getObjects().find((o) => o.get('aspId') === id) ?? null;
  }

  /** Select a layer by id (no-op if it is locked or missing). */
  selectLayer(id: string): void {
    const object = this.findById(id);
    if (!object || object.get('aspLocked') === true || object.selectable === false) {
      return;
    }
    this.canvas.setActiveObject(object);
    this.canvas.requestRenderAll();
    this.notifySelection();
    this.notifyLayers();
  }

  /** Lock/unlock a layer. Locked layers are not selectable, so clicks pass through. */
  toggleLayerLock(id: string): void {
    const object = this.findById(id);
    if (!object) {
      return;
    }
    const locked = object.get('aspLocked') !== true;
    this.setLocked(object, locked);
    if (locked && this.canvas.getActiveObjects().includes(object)) {
      this.canvas.discardActiveObject();
    }
    this.canvas.requestRenderAll();
    this.commit(locked ? 'Lock layer' : 'Unlock layer');
    this.notifySelection();
  }

  private setLocked(object: Fabric.FabricObject, locked: boolean): void {
    object.set('aspLocked', locked);
    object.set({
      selectable: !locked,
      evented: !locked,
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
    });
  }

  /** Show/hide a layer. */
  toggleLayerVisible(id: string): void {
    const object = this.findById(id);
    if (!object) {
      return;
    }
    object.visible = object.visible === false;
    this.canvas.requestRenderAll();
    this.commit('Toggle visibility');
  }

  /** Move a layer up (forward) or down (backward) in the z-order. */
  moveLayer(id: string, direction: 'up' | 'down'): void {
    const object = this.findById(id);
    if (!object) {
      return;
    }
    if (direction === 'up') {
      this.canvas.bringObjectForward(object);
    } else {
      this.canvas.sendObjectBackwards(object);
    }
    this.canvas.requestRenderAll();
    this.commit('Reorder layer');
  }

  /** Delete a layer (the base image is protected). */
  deleteLayer(id: string): void {
    const object = this.findById(id);
    if (!object || id === 'base') {
      return;
    }
    this.canvas.remove(object);
    this.canvas.requestRenderAll();
    this.commit('Delete layer');
    this.notifySelection();
  }

  // ---- export --------------------------------------------------------------

  /** Export the current scene to a Blob in the requested format. */
  async exportImage(
    format: AspExportFormat,
    qualityPct: number,
    allowedFormats: readonly AspExportFormat[],
  ): Promise<Blob> {
    const cfg = resolveExport(format, qualityPct, allowedFormats);
    if (cfg.kind === 'json') {
      return new Blob([JSON.stringify(this.canvas.toJSON())], { type: cfg.mimeType });
    }
    if (cfg.kind === 'vector') {
      return new Blob([this.canvas.toSVG()], { type: cfg.mimeType });
    }
    const dataUrl = this.canvas.toDataURL({
      format: cfg.format === 'jpeg' ? 'jpeg' : cfg.format === 'webp' ? 'webp' : 'png',
      quality: cfg.quality,
      multiplier: 1,
    });
    return dataUrlToBlob(dataUrl);
  }

  /** Pixel data of the current canvas, or null if no rendering context. */
  getImageData(): ImageData | null {
    const ctx = this.canvas.getContext();
    return ctx ? ctx.getImageData(0, 0, this.canvas.getWidth(), this.canvas.getHeight()) : null;
  }

  // ---- lifecycle -----------------------------------------------------------

  /** Resize the editing surface. */
  setSize(width: number, height: number): void {
    this.canvas.setDimensions({ width, height });
    this.fitBaseImage();
    this.canvas.requestRenderAll();
  }

  /** Tear down the Fabric canvas and release resources. */
  async destroy(): Promise<void> {
    await this.canvas.dispose();
  }
}

interface FrameSpec {
  readonly strokeWidth: number;
  readonly radius: number;
  readonly useColor: boolean;
  readonly stroke: string;
  readonly dash?: readonly number[];
}

/** Distinct, real frame renderings keyed by the panel's frame option. */
const FRAME_STYLES: Record<string, FrameSpec> = {
  line: { strokeWidth: 8, radius: 0, useColor: true, stroke: '#000000' },
  mat: { strokeWidth: 20, radius: 0, useColor: false, stroke: '#ffffff' },
  inset: { strokeWidth: 6, radius: 10, useColor: true, stroke: '#000000' },
  hook: { strokeWidth: 12, radius: 0, useColor: true, stroke: '#000000' },
  bead: { strokeWidth: 7, radius: 0, useColor: true, stroke: '#000000', dash: [2, 7] },
};

/** Vertices of a regular polygon centered at the origin (first vertex pointing up). */
function polygonPoints(sides: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

/** Vertices of an N-point star alternating outer/inner radius. */
function starPoints(points: number, outer: number, inner: number): { x: number; y: number }[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

/** Convert a hex color to an `rgba()` string at the given alpha; passes other values through. */
function translucent(color: string, alpha: number): string {
  try {
    return withAlpha(parseHex(color), alpha);
  } catch {
    return color;
  }
}

/** A human label for a layer row, derived from its role/type. */
function layerLabel(object: Fabric.FabricObject): string {
  const role = object.get('aspRole');
  if (role === 'frame') {
    return 'Frame';
  }
  if (role === 'redaction') {
    return 'Redaction';
  }
  if (object.isType('image')) {
    return object.get('aspId') === 'base' ? 'Background' : 'Image';
  }
  if (object.isType('textbox', 'i-text', 'text')) {
    return 'Text';
  }
  if (object.isType('rect')) {
    return 'Rectangle';
  }
  if (object.isType('ellipse', 'circle')) {
    return 'Ellipse';
  }
  if (object.isType('line')) {
    return 'Line';
  }
  if (object.isType('group', 'activeselection')) {
    return 'Arrow';
  }
  if (object.isType('path')) {
    return 'Drawing';
  }
  return 'Object';
}

/** Load a data URL into an HTMLImageElement. */
function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

/**
 * Downscale a data-URL image so its longest edge is at most `maxDim`, preserving
 * aspect ratio. Returns the original URL when already within bounds or if no 2D
 * context is available. Safe (same-origin data URL never taints the canvas).
 */
async function downscaleDataUrl(dataUrl: string, maxDim: number): Promise<string> {
  const img = await loadHtmlImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const longest = Math.max(w, h);
  if (longest <= maxDim || longest === 0) {
    return dataUrl;
  }
  const scale = maxDim / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return dataUrl;
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Read a Blob into a data URL (so it persists in serialized history). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

/** Convert a data URL to a Blob without a network round-trip. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = /data:([^;]+)/.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
