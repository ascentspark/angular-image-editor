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

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow';

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

  private constructor(fabric: FabricModule, canvas: Fabric.Canvas) {
    this.fabric = fabric;
    this.canvas = canvas;
    this.history = new EditHistory<string>('Opened editor', this.snapshot());
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
    const url = typeof src === 'string' ? src : await blobToDataUrl(src);
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
    const ratio = aspectRatioValue(preset, naturalW, naturalH);
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
      default:
        return;
    }
    this.canvas.add(object);
    this.canvas.setActiveObject(object);
    this.canvas.requestRenderAll();
    this.commit('Add shape');
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
    this.canvas.add(textbox);
    this.canvas.setActiveObject(textbox);
    this.canvas.requestRenderAll();
    this.commit('Add text');
  }

  /**
   * Add a redaction over the canvas center. `solid` lays an opaque box; `blur`
   * and `pixelate` overlay a filtered copy of the underlying image clipped to
   * the region, so the concealed content is genuinely destroyed in the export.
   */
  async addRedaction(mode: RedactMode): Promise<void> {
    const cx = this.canvas.getWidth() / 2;
    const cy = this.canvas.getHeight() / 2;
    const width = 180;
    const height = 80;

    if (mode === 'solid' || !this.baseImage) {
      const rect = new this.fabric.Rect({
        left: cx,
        top: cy,
        originX: 'center',
        originY: 'center',
        width,
        height,
        fill: '#0b0f1a',
      });
      this.canvas.add(rect);
      this.canvas.setActiveObject(rect);
      this.canvas.requestRenderAll();
      this.commit('Redact');
      return;
    }

    const overlay = await this.baseImage.clone();
    overlay.set({ selectable: false, evented: false });
    overlay.set('aspRole', 'redaction');
    overlay.filters = [
      mode === 'blur'
        ? new this.fabric.filters.Blur({ blur: 0.35 })
        : new this.fabric.filters.Pixelate({ blocksize: 14 }),
    ];
    overlay.applyFilters();
    overlay.clipPath = new this.fabric.Rect({
      left: cx,
      top: cy,
      originX: 'center',
      originY: 'center',
      width,
      height,
      absolutePositioned: true,
    });
    this.canvas.add(overlay);
    this.canvas.requestRenderAll();
    this.commit('Redact');
  }

  /** Backwards-compatible solid redaction helper. */
  addRedactionBox(): void {
    void this.addRedaction('solid');
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
      this.canvas.add(rect);
    }
    this.canvas.requestRenderAll();
    this.commit('Frame');
  }

  /** Remove every canvas object tagged with the given `aspRole`. */
  private removeTagged(role: string): void {
    const tagged = this.canvas.getObjects().filter((o) => o.get('aspRole') === role);
    if (tagged.length > 0) {
      this.canvas.remove(...tagged);
    }
  }

  /** Enable or disable freehand drawing. */
  setFreeDraw(enabled: boolean, style: AnnotationStyle): void {
    this.canvas.isDrawingMode = enabled;
    if (enabled) {
      const brush = new this.fabric.PencilBrush(this.canvas);
      brush.color = style.color;
      brush.width = style.strokeWidth;
      this.canvas.freeDrawingBrush = brush;
    }
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
      json: this.canvas.toObject(['aspRole']),
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
    this.canvas.requestRenderAll();
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
