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
import { DeltaHistory, type HistoryStep } from './delta-history';
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
  /** The text's current font family, so the panel can reflect it on selection. */
  readonly fontFamily: string;
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
  guides?: ManualGuide[];
}

/** A versioned template: a full editor snapshot plus the artboard. */
interface SceneTemplate {
  snapshot: EditorSnapshot;
  artboard: ArtboardSize | null;
}

/** Narrow untrusted parsed JSON to a usable template (only checks the fields we rely on). */
function isSceneTemplate(value: unknown): value is SceneTemplate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  const snapshot = v['snapshot'];
  if (typeof snapshot !== 'object' || snapshot === null) {
    return false;
  }
  const json = (snapshot as Record<string, unknown>)['json'];
  if (typeof json !== 'object' || json === null) {
    return false;
  }
  const artboard = v['artboard'];
  if (artboard !== null && artboard !== undefined) {
    if (typeof artboard !== 'object') {
      return false;
    }
    const a = artboard as Record<string, unknown>;
    if (typeof a['width'] !== 'number' || typeof a['height'] !== 'number') {
      return false;
    }
  }
  return true;
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

/** A target output size in pixels for the artboard / export region. */
export interface ArtboardSize {
  readonly width: number;
  readonly height: number;
}

/** A user-placed guide line at a fixed scene coordinate. */
export interface ManualGuide {
  readonly id: string;
  /** `h` = horizontal line at scene-y `pos`; `v` = vertical line at scene-x `pos`. */
  readonly orientation: 'h' | 'v';
  readonly pos: number;
}

/** The current view transform plus canvas size — everything a ruler needs. */
export interface Viewport {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly width: number;
  readonly height: number;
}

/** A snap guide segment, expressed in scene (canvas) coordinates. */
interface GuideLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Axis-aligned bounding box in scene coordinates, with derived centers. */
interface SceneBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly cx: number;
  readonly cy: number;
}

export class EditorEngine {
  private readonly canvas: Fabric.Canvas;
  private readonly fabric: FabricModule;
  private readonly history: DeltaHistory;

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
  private snapEnabled = true;
  private activeGuides: GuideLine[] = [];
  private artboard: ArtboardSize | null = null;
  private rulersEnabled = false;
  private manualGuides: ManualGuide[] = [];
  /** Live preview of a guide being dragged from a ruler (not yet committed). */
  private guideDraft: ManualGuide | null = null;
  /** Id of an existing manual guide being dragged on the canvas, if any. */
  private draggingGuideId: string | null = null;
  private guideIdCounter = 0;
  private selectionListener: ((info: SelectionStyleInfo | null) => void) | null = null;
  private layersListener: (() => void) | null = null;
  private viewportListener: (() => void) | null = null;
  private guidesListener: (() => void) | null = null;
  private textMode = false;
  private textPlacementListener: ((point: { x: number; y: number }) => void) | null = null;
  private textFinishListener: (() => void) | null = null;
  private pendingFinishText: Fabric.FabricObject | null = null;
  private redactPlacement = false;
  private onFontsLoaded: (() => void) | null = null;
  private lastViewportKey = '';

  /** Snap distance in *screen* pixels; divided by zoom to get a scene threshold. */
  private static readonly SNAP_PX = 7;
  /** Pointer proximity (screen px) for grabbing a manual guide on the canvas. */
  private static readonly GUIDE_GRAB_PX = 6;

  private constructor(fabric: FabricModule, canvas: Fabric.Canvas) {
    this.fabric = fabric;
    this.canvas = canvas;
    this.history = new DeltaHistory('Opened editor', this.snapshot());
    const notify = (): void => {
      this.notifySelection();
      this.notifyLayers();
    };
    this.canvas.on('selection:created', notify);
    this.canvas.on('selection:updated', notify);
    this.canvas.on('selection:cleared', notify);
    // Capture whether an empty-canvas text-mode click lands on an already-active
    // text BEFORE Fabric clears the selection in its own mouse:down handling.
    this.canvas.on('mouse:down:before', (opt) => {
      if (this.textMode && !opt.target) {
        const active = this.canvas.getActiveObject();
        this.pendingFinishText =
          active && active.isType('textbox', 'i-text', 'text') ? active : null;
      } else {
        this.pendingFinishText = null;
      }
    });
    // Space-drag panning (only touches the viewport transform).
    this.canvas.on('mouse:down', (opt) => {
      if (this.panMode) {
        this.panLast = { x: opt.viewportPoint.x, y: opt.viewportPoint.y };
        this.canvas.setCursor('grabbing');
        return;
      }
      // Text tool: click empty canvas. If a text box was already placed/active,
      // this click finishes it and hands control back to Select (intuitive — no
      // surprise second box). Otherwise it drops a new text box at that point.
      // `pendingFinishText` is captured in `mouse:down:before` because Fabric has
      // already cleared the active object by the time this `mouse:down` fires.
      if (this.textMode && !opt.target) {
        if (this.pendingFinishText) {
          const itext = this.pendingFinishText as Fabric.IText;
          if (itext.isEditing) {
            itext.exitEditing();
          }
          this.pendingFinishText = null;
          this.canvas.discardActiveObject();
          this.canvas.requestRenderAll();
          this.textFinishListener?.();
          return;
        }
        this.textPlacementListener?.(opt.scenePoint);
        return;
      }
      // Redact tool: click empty canvas to place a marquee (unless one exists,
      // in which case the click just repositions/selects it).
      if (this.redactPlacement && !opt.target && !this.findByRole('redact-marquee')) {
        this.addRedactionMarqueeAt(opt.scenePoint.x, opt.scenePoint.y);
        return;
      }
      // Grab an existing manual guide when clicking empty canvas near its line.
      if (this.rulersEnabled && !opt.target) {
        const guide = this.guideAtViewport(opt.viewportPoint.x, opt.viewportPoint.y);
        if (guide) {
          this.draggingGuideId = guide.id;
          this.canvas.selection = false;
        }
      }
    });
    // Drop a text box that was left empty (e.g. placed then dismissed without
    // typing), so the canvas never accrues invisible empty layers.
    this.canvas.on('text:editing:exited', (e) => {
      const target = (e as { target?: Fabric.FabricObject }).target;
      if (target && typeof target.get('text') === 'string' && target.get('text').trim() === '') {
        this.canvas.remove(target);
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        this.notifySelection();
        this.notifyLayers();
      } else {
        this.commit('Text');
      }
    });
    this.canvas.on('mouse:move', (opt) => {
      if (this.panMode && this.panLast) {
        const p = opt.viewportPoint;
        this.canvas.relativePan(new this.fabric.Point(p.x - this.panLast.x, p.y - this.panLast.y));
        this.panLast = { x: p.x, y: p.y };
        return;
      }
      if (this.draggingGuideId) {
        this.dragGuideTo(opt.viewportPoint.x, opt.viewportPoint.y);
        return;
      }
      // Resize cursor when hovering a grabbable guide.
      if (this.rulersEnabled && !opt.target) {
        const guide = this.guideAtViewport(opt.viewportPoint.x, opt.viewportPoint.y);
        if (guide) {
          this.canvas.setCursor(guide.orientation === 'h' ? 'row-resize' : 'col-resize');
        }
      }
    });
    this.canvas.on('mouse:up', (opt) => {
      if (this.panMode) {
        this.panLast = null;
        this.canvas.setCursor('grab');
      }
      if (this.draggingGuideId) {
        this.endGuideDrag(opt.viewportPoint.x, opt.viewportPoint.y);
      }
      this.clearGuides();
    });
    // Edge/center snapping with alignment guides while dragging an object.
    this.canvas.on('object:moving', (e) => this.applySnap(e.target));
    this.canvas.on('object:modified', () => this.clearGuides());
    // The artboard mask, manual guides, and snap guides live on the top (overlay)
    // context, redrawn after every render so they survive Fabric clearing the
    // overlay to repaint selection controls. Mask first, then guides on top.
    this.canvas.on('after:render', () => {
      this.drawArtboardMask();
      this.drawGuides();
      this.notifyViewportIfChanged();
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
    // When a web font finishes loading, re-render so any text already set to it
    // updates from its fallback to the real glyphs (font load is async).
    if (typeof document !== 'undefined' && document.fonts) {
      this.onFontsLoaded = (): void => {
        // Drop Fabric's global char-width cache: any metrics measured while the
        // font was still loading were the fallback's and are now wrong. Then
        // recompute each text's bounds so the cursor/selection match the glyphs.
        this.fabric.cache?.clearFontCache?.();
        this.canvas.getObjects().forEach((o) => {
          if (o.isType('textbox', 'i-text', 'text')) {
            (o as Fabric.Textbox).initDimensions?.();
            o.set('dirty', true);
          }
        });
        this.canvas.requestRenderAll();
      };
      document.fonts.addEventListener('loadingdone', this.onFontsLoaded);
    }
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
      const family = object.get('fontFamily');
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
          fontFamily: typeof family === 'string' ? family : '',
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
      // Drop any cached char widths for this family and re-measure, so the
      // change shows even if the family was set before the web font loaded.
      this.fabric.cache?.clearFontCache?.(style.fontFamily);
      const textbox = object as Fabric.Textbox;
      textbox.initDimensions?.();
      object.set('dirty', true);
    }
    object.setCoords();
  }

  // ---- snapping & alignment guides ----------------------------------------

  /** Enable/disable edge & center snapping. Clears any visible guides when off. */
  setSnapping(enabled: boolean): void {
    this.snapEnabled = enabled;
    if (!enabled) {
      this.clearGuides();
    }
  }

  /** Scene-space bounding box of an object from its absolute corner coords. */
  private sceneBox(object: Fabric.FabricObject): SceneBox {
    object.setCoords();
    const c = object.aCoords;
    const xs = [c.tl.x, c.tr.x, c.bl.x, c.br.x];
    const ys = [c.tl.y, c.tr.y, c.bl.y, c.br.y];
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return { left, top, right, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
  }

  /**
   * Nudge a dragged object so a near edge/center aligns to the canvas or another
   * object, and record the guide lines to draw. Snap threshold is constant in
   * *screen* pixels (zoom-aware) so it feels the same at any zoom.
   */
  private applySnap(target?: Fabric.FabricObject): void {
    if (!target || !this.snapEnabled) {
      this.activeGuides = [];
      return;
    }
    const threshold = EditorEngine.SNAP_PX / this.canvas.getZoom();
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const box = this.sceneBox(target);

    // Candidate lines to snap to: canvas edges/center plus every other object's
    // edges/centers. The redaction marquee is transient and never a snap target.
    const xLines = [0, cw / 2, cw];
    const yLines = [0, ch / 2, ch];
    for (const other of this.canvas.getObjects()) {
      if (other === target || other.get('aspRole') === 'redact-marquee') {
        continue;
      }
      const ob = this.sceneBox(other);
      xLines.push(ob.left, ob.cx, ob.right);
      yLines.push(ob.top, ob.cy, ob.bottom);
    }
    // User-placed guides are snap targets too.
    for (const guide of this.manualGuides) {
      (guide.orientation === 'v' ? xLines : yLines).push(guide.pos);
    }

    const snapX = this.bestSnap([box.left, box.cx, box.right], xLines, threshold);
    const snapY = this.bestSnap([box.top, box.cy, box.bottom], yLines, threshold);

    const guides: GuideLine[] = [];
    if (snapX) {
      target.set('left', (target.left ?? 0) + snapX.delta);
      guides.push({ x1: snapX.line, y1: 0, x2: snapX.line, y2: ch });
    }
    if (snapY) {
      target.set('top', (target.top ?? 0) + snapY.delta);
      guides.push({ x1: 0, y1: snapY.line, x2: cw, y2: snapY.line });
    }
    if (snapX || snapY) {
      target.setCoords();
    }
    this.activeGuides = guides;
  }

  /** Pick the smallest within-threshold offset from any anchor to any line. */
  private bestSnap(
    anchors: readonly number[],
    lines: readonly number[],
    threshold: number,
  ): { delta: number; line: number } | null {
    let best: { delta: number; line: number } | null = null;
    for (const anchor of anchors) {
      for (const line of lines) {
        const delta = line - anchor;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, line };
        }
      }
    }
    return best;
  }

  /** Paint active guides onto the overlay context, mapped through the viewport. */
  private drawGuides(): void {
    if (!this.activeGuides.length) {
      return;
    }
    const ctx = this.canvas.contextTop;
    if (!ctx) {
      return;
    }
    const vpt = this.canvas.viewportTransform;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ff2d78';
    ctx.setLineDash([5, 4]);
    for (const g of this.activeGuides) {
      const p1 = this.fabric.util.transformPoint(new this.fabric.Point(g.x1, g.y1), vpt);
      const p2 = this.fabric.util.transformPoint(new this.fabric.Point(g.x2, g.y2), vpt);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Drop the guides and repaint so the overlay is clean. */
  private clearGuides(): void {
    if (!this.activeGuides.length) {
      return;
    }
    this.activeGuides = [];
    this.clearOverlay();
    this.canvas.requestRenderAll();
  }

  /**
   * Erase the overlay (top) context. `contextTop` can be momentarily undefined
   * outside a render cycle, so this guards before touching it; clearing by the
   * backing canvas's pixel size is correct regardless of retina scaling.
   */
  private clearOverlay(): void {
    const ctx = this.canvas.contextTop;
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  // ---- rulers & manual guides ---------------------------------------------

  /** Register a callback fired when the view transform or canvas size changes. */
  setViewportListener(cb: () => void): void {
    this.viewportListener = cb;
  }

  /** Register a callback fired when manual guides (or the live draft) change. */
  setGuidesListener(cb: () => void): void {
    this.guidesListener = cb;
  }

  private notifyGuides(): void {
    this.guidesListener?.();
  }

  /** Current view transform + canvas size, in CSS pixels / scene units. */
  getViewport(): Viewport {
    const vpt = this.canvas.viewportTransform;
    return {
      zoom: vpt[0],
      panX: vpt[4],
      panY: vpt[5],
      width: this.canvas.getWidth(),
      height: this.canvas.getHeight(),
    };
  }

  private notifyViewportIfChanged(): void {
    if (!this.viewportListener) {
      return;
    }
    const v = this.getViewport();
    const key = `${v.zoom}|${v.panX}|${v.panY}|${v.width}|${v.height}`;
    if (key !== this.lastViewportKey) {
      this.lastViewportKey = key;
      this.viewportListener();
    }
  }

  /** Show/hide rulers; when off, an in-progress guide draft is dropped. */
  setRulersEnabled(enabled: boolean): void {
    this.rulersEnabled = enabled;
    if (!enabled) {
      this.guideDraft = null;
    }
    this.notifyGuides();
  }

  isRulersEnabled(): boolean {
    return this.rulersEnabled;
  }

  getManualGuides(): readonly ManualGuide[] {
    return this.manualGuides;
  }

  /** The live guide preview during a ruler drag, or null. */
  getGuideDraft(): ManualGuide | null {
    return this.guideDraft;
  }

  /** Map a viewport (screen, CSS-px) point to scene coordinates. */
  viewportToScene(vx: number, vy: number): { x: number; y: number } {
    const vpt = this.canvas.viewportTransform;
    // vpt = [scaleX, skewY, skewX, scaleY, panX, panY]; divide by the *scale*
    // components (indices 0 and 3), not the skew components (1 and 2).
    return { x: (vx - vpt[4]) / vpt[0], y: (vy - vpt[5]) / vpt[3] };
  }

  /** Map a client (page) point to canvas viewport (CSS-px) coordinates. */
  clientToViewport(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getElement().getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /**
   * Show a live guide preview at a scene position (during a ruler drag).
   * Pass `null` to clear the preview. Does not touch history.
   */
  setGuideDraft(orientation: 'h' | 'v', scenePos: number | null): void {
    this.guideDraft =
      scenePos === null ? null : { id: 'draft', orientation, pos: Math.round(scenePos) };
    this.notifyGuides();
  }

  /** Commit a new manual guide at a scene position and record it in history. */
  addManualGuide(orientation: 'h' | 'v', scenePos: number): void {
    this.guideDraft = null;
    this.guideIdCounter += 1;
    this.manualGuides = [
      ...this.manualGuides,
      { id: `g${this.guideIdCounter}`, orientation, pos: Math.round(scenePos) },
    ];
    this.notifyGuides();
    this.commit('Add guide');
  }

  /** Remove every manual guide and record it in history (no-op if already empty). */
  clearManualGuides(): void {
    if (this.manualGuides.length === 0) {
      return;
    }
    this.manualGuides = [];
    this.notifyGuides();
    this.commit('Clear guides');
  }

  /** The manual guide whose line is within grab range of a screen point, or null. */
  private guideAtViewport(vx: number, vy: number): ManualGuide | null {
    const zoom = this.canvas.getZoom();
    const threshold = EditorEngine.GUIDE_GRAB_PX;
    const scene = this.viewportToScene(vx, vy);
    let best: ManualGuide | null = null;
    let bestDist = threshold;
    for (const guide of this.manualGuides) {
      const distScene = guide.orientation === 'h' ? scene.y - guide.pos : scene.x - guide.pos;
      const distPx = Math.abs(distScene) * zoom;
      if (distPx <= bestDist) {
        bestDist = distPx;
        best = guide;
      }
    }
    return best;
  }

  /** Live-move the guide being dragged to the scene coordinate under the pointer. */
  private dragGuideTo(vx: number, vy: number): void {
    if (!this.draggingGuideId) {
      return;
    }
    const scene = this.viewportToScene(vx, vy);
    this.manualGuides = this.manualGuides.map((g) => {
      if (g.id !== this.draggingGuideId) {
        return g;
      }
      const pos = Math.round(g.orientation === 'h' ? scene.y : scene.x);
      return { ...g, pos };
    });
    this.canvas.setCursor('grabbing');
    this.notifyGuides();
  }

  /**
   * Finish a guide drag. Dropping the line outside the canvas removes it;
   * otherwise the move is committed to history. Restores object selection.
   */
  private endGuideDrag(vx: number, vy: number): void {
    const id = this.draggingGuideId;
    this.draggingGuideId = null;
    this.canvas.selection = true;
    if (!id) {
      return;
    }
    const outside = vx < 0 || vy < 0 || vx > this.canvas.getWidth() || vy > this.canvas.getHeight();
    if (outside) {
      this.manualGuides = this.manualGuides.filter((g) => g.id !== id);
      this.notifyGuides();
      this.commit('Remove guide');
    } else {
      this.notifyGuides();
      this.commit('Move guide');
    }
  }

  // ---- artboard / output size ---------------------------------------------

  /**
   * Set (or clear) the artboard — a fixed output region. Content outside the
   * region is dimmed on screen and excluded from raster/PDF export, which is
   * rendered at exactly the artboard's pixel dimensions. `null` exports the
   * whole canvas (the default).
   */
  setArtboard(size: ArtboardSize | null): void {
    this.artboard = size && size.width > 0 && size.height > 0 ? size : null;
    this.clearOverlay();
    // Render synchronously so the overlay (top) context is realized this frame
    // and the mask repaints immediately, rather than on a later deferred render.
    this.canvas.renderAll();
  }

  getArtboard(): ArtboardSize | null {
    return this.artboard;
  }

  /**
   * The artboard's on-canvas rectangle in scene coordinates: the largest
   * centered rectangle of the artboard's aspect ratio that fits the canvas.
   * Returns null when no artboard is set.
   */
  private artboardRect(): { left: number; top: number; width: number; height: number } | null {
    if (!this.artboard) {
      return null;
    }
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const ar = this.artboard.width / this.artboard.height;
    let width = cw;
    let height = cw / ar;
    if (height > ch) {
      height = ch;
      width = ch * ar;
    }
    return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
  }

  /** Render the artboard region to a data URL at exactly the artboard pixel size. */
  private artboardDataUrl(format: 'png' | 'jpeg' | 'webp', quality: number): string {
    const rect = this.artboardRect();
    if (!rect || !this.artboard) {
      return this.canvas.toDataURL({ format, quality, multiplier: 1 });
    }
    return this.canvas.toDataURL({
      format,
      quality,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      multiplier: this.artboard.width / rect.width,
    });
  }

  /** Dim the canvas outside the artboard and outline it, on the overlay context. */
  private drawArtboardMask(): void {
    const rect = this.artboardRect();
    if (!rect) {
      return;
    }
    const ctx = this.canvas.contextTop;
    if (!ctx) {
      return;
    }
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const vpt = this.canvas.viewportTransform;
    const tl = this.fabric.util.transformPoint(new this.fabric.Point(rect.left, rect.top), vpt);
    const br = this.fabric.util.transformPoint(
      new this.fabric.Point(rect.left + rect.width, rect.top + rect.height),
      vpt,
    );
    const x = tl.x;
    const y = tl.y;
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    ctx.save();
    // Dim the four bands around the artboard (not a composite punch-through, so
    // it is independent of any prior overlay content).
    ctx.fillStyle = 'rgba(17, 21, 30, 0.46)';
    ctx.fillRect(0, 0, cw, y);
    ctx.fillRect(0, y + h, cw, ch - (y + h));
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, cw - (x + w), h);
    // Two-tone outline reads on any background.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.setLineDash([]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
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
    this.placeText(text, this.canvas.getWidth() / 2, this.canvas.getHeight() / 2, style, false);
  }

  /**
   * Enable/disable the "click to place text" mode (the Text tool). While on, the
   * cursor is a text caret and clicking empty canvas drops an editable box.
   */
  setTextMode(enabled: boolean): void {
    this.textMode = enabled;
    this.canvas.defaultCursor = enabled ? 'text' : 'default';
  }

  /** Register the callback fired with a scene point when text mode is clicked. */
  setTextPlacementListener(cb: (point: { x: number; y: number }) => void): void {
    this.textPlacementListener = cb;
  }

  /**
   * Register the callback fired when an empty-canvas click in text mode finishes
   * an already-placed text (so the host can switch back to the Select tool).
   */
  setTextFinishListener(cb: () => void): void {
    this.textFinishListener = cb;
  }

  /**
   * Add a text box at a scene point and immediately enter in-place editing with
   * the placeholder pre-selected, so the user just starts typing (Photoshop-style).
   */
  addTextAt(x: number, y: number, style: TextStyle): void {
    this.placeText('Your text', x, y, style, true);
  }

  private placeText(
    text: string,
    x: number,
    y: number,
    style: TextStyle,
    edit: boolean,
  ): void {
    const textbox = new this.fabric.Textbox(text, {
      left: x,
      top: y,
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
    if (edit) {
      // Enter editing with the placeholder selected so the first keystroke
      // replaces it. History is recorded on editing-exit (and an untouched,
      // empty box is discarded there), so we don't commit the placement itself.
      textbox.enterEditing();
      textbox.selectAll();
    } else {
      this.commit('Add text');
    }
    this.canvas.requestRenderAll();
    this.notifySelection();
  }

  /**
   * Add a movable/resizable redaction marquee centered on the canvas. The user
   * positions it over the area to conceal; transient until {@link applyRedaction}
   * bakes it.
   */
  addRedactionMarquee(): void {
    this.addRedactionMarqueeAt(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2);
  }

  /** Add a redaction marquee centered at a scene point (used by click-to-place). */
  addRedactionMarqueeAt(cx: number, cy: number): void {
    this.cancelRedaction();
    const w = 220;
    const h = 120;
    const rect = new this.fabric.Rect({
      left: cx - w / 2,
      top: cy - h / 2,
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

  /**
   * Enable/disable click-to-place for redaction: while on, clicking empty canvas
   * drops a new marquee there (but only when one isn't already present, so you
   * reposition the existing box rather than spawning duplicates).
   */
  setRedactPlacement(enabled: boolean): void {
    this.redactPlacement = enabled;
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
      this.canvas.discardActiveObject();
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
    this.canvas.discardActiveObject();
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
    if (active.some((o) => o.get('aspId') === 'base')) {
      this.baseImage = null;
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

  /** Add an image (e.g. pasted from the OS clipboard) as a movable object. */
  async addImageObject(src: string | Blob): Promise<void> {
    const raw = typeof src === 'string' ? src : await blobToDataUrl(src);
    const url = raw.startsWith('data:') ? await downscaleDataUrl(raw, MAX_IMPORT_DIM) : raw;
    const image = await this.fabric.FabricImage.fromURL(url, {}, {});
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const scale = Math.min(1, (cw * 0.6) / (image.width || 1), (ch * 0.6) / (image.height || 1));
    image.set({
      left: cw / 2,
      top: ch / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
    });
    image.set('aspId', this.nextId());
    this.canvas.add(image);
    this.canvas.setActiveObject(image);
    this.canvas.requestRenderAll();
    this.commit('Paste image');
    this.notifySelection();
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

  get historyEntries(): readonly HistoryStep[] {
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

  // ---- templates (save / load scene) --------------------------------------

  /**
   * Serialize the whole editor — scene objects, transform/adjustment/look/frame
   * state, and the artboard — into a portable, versioned template string. The
   * inverse of {@link loadScene}.
   */
  exportScene(): string {
    const template = {
      version: 1 as const,
      snapshot: JSON.parse(this.snapshot()) as EditorSnapshot,
      artboard: this.artboard,
    };
    return JSON.stringify(template);
  }

  /**
   * Restore a template produced by {@link exportScene}. Resets the history to
   * the loaded state so it becomes the new undo baseline. Throws on malformed
   * input rather than loading a partial scene.
   */
  async loadScene(json: string): Promise<void> {
    const parsed: unknown = JSON.parse(json);
    if (!isSceneTemplate(parsed)) {
      throw new Error('Not a valid editor template');
    }
    await this.restore(JSON.stringify(parsed.snapshot));
    this.setArtboard(parsed.artboard ?? null);
    this.history.reset('Loaded template', this.snapshot());
    this.notifyLayers();
    this.notifySelection();
  }

  /**
   * Serialize the full editor state — the Fabric scene PLUS the engine's own
   * transform/adjustment/look/frame state — so a restore puts both back in sync
   * (the canvas alone does not capture rotation buckets, slider values, etc).
   */
  private snapshot(): string {
    const composite: EditorSnapshot = {
      json: this.canvas.toObject(['aspRole', 'aspId', 'aspLocked', 'aspName']),
      rotation: this.rotation,
      straighten: this.straighten,
      adjustments: { ...this.adjustments },
      looks: [...this.looks],
      frame: this.frame,
      guides: [...this.manualGuides],
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
    this.manualGuides = composite.guides ? [...composite.guides] : [];
    // Re-apply per-object lock state (serialized via aspLocked).
    for (const object of this.canvas.getObjects()) {
      if (object.get('aspLocked') === true) {
        this.setLocked(object, true);
      }
    }
    this.canvas.requestRenderAll();
    this.notifyLayers();
    this.notifyGuides();
  }

  private findBaseImage(): Fabric.FabricImage | null {
    // The background is the image tagged `aspId: 'base'`; matching by id (not
    // "first image") keeps a pasted image from being mistaken for it, and
    // returns null once the background has been deleted.
    const base = this.canvas
      .getObjects()
      .find((o) => o.isType('image') && o.get('aspId') === 'base');
    return (base as Fabric.FabricImage) ?? null;
  }

  /** Reset all edits back to the freshly-loaded image. */
  async reset(): Promise<void> {
    const first = this.history.first;
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
      return {
        id,
        label: layerLabel(object),
        locked: object.get('aspLocked') === true,
        visible: object.visible !== false,
        selected: active.includes(object),
        opacity: typeof object.opacity === 'number' ? object.opacity : 1,
        removable: true,
      };
    });
    return layers.filter((l) => l.id !== '').reverse();
  }

  private findById(id: string): Fabric.FabricObject | null {
    return this.canvas.getObjects().find((o) => o.get('aspId') === id) ?? null;
  }

  /**
   * Select a layer by id (no-op if it is locked or missing). When `additive`
   * (shift/cmd/ctrl-click in the panel), toggle the layer in/out of a
   * multi-selection instead of replacing it.
   */
  selectLayer(id: string, additive = false): void {
    const object = this.findById(id);
    // Locked layers can't be selected; the background is selectable from the
    // panel (so it can be deleted/adjusted) even though it ignores canvas clicks.
    if (!object || object.get('aspLocked') === true) {
      return;
    }
    if (additive) {
      const current = this.canvas.getActiveObjects();
      const next = current.includes(object)
        ? current.filter((o) => o !== object)
        : [...current, object];
      this.canvas.discardActiveObject();
      if (next.length > 0) {
        this.setActive(next);
      }
    } else {
      this.canvas.discardActiveObject();
      this.canvas.setActiveObject(object);
    }
    this.canvas.requestRenderAll();
    this.notifySelection();
    this.notifyLayers();
  }

  /**
   * Reorder the whole z-stack to match a display order (front-most first, as the
   * Layers panel shows it). Used by drag-and-drop reordering.
   */
  reorderLayers(displayOrderIds: readonly string[]): void {
    // The panel lists front→back; the canvas stack is back→front.
    const canvasOrder = [...displayOrderIds].reverse();
    let changed = false;
    canvasOrder.forEach((id, index) => {
      const object = this.findById(id);
      if (object && this.canvas.getObjects().indexOf(object) !== index) {
        this.canvas.moveObjectTo(object, index);
        changed = true;
      }
    });
    if (!changed) {
      return;
    }
    this.canvas.requestRenderAll();
    this.commit('Reorder layers');
    this.notifyLayers();
  }

  /** Rename a layer; an empty/blank name clears back to the auto label. */
  renameLayer(id: string, name: string): void {
    const object = this.findById(id);
    if (!object) {
      return;
    }
    const trimmed = name.trim();
    object.set('aspName', trimmed === '' ? undefined : trimmed);
    this.commit('Rename layer');
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
    if (!object) {
      return;
    }
    if (id === 'base') {
      this.baseImage = null;
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
    if (cfg.kind === 'pdf') {
      return this.exportPdf(cfg.quality);
    }
    const rasterFormat = cfg.format === 'jpeg' ? 'jpeg' : cfg.format === 'webp' ? 'webp' : 'png';
    return dataUrlToBlob(this.artboardDataUrl(rasterFormat, cfg.quality));
  }

  /**
   * Render into a single-page PDF. The page is sized to the artboard (when set)
   * or the full canvas, and the image is the matching region. jsPDF is lazy-loaded.
   */
  private async exportPdf(quality: number): Promise<Blob> {
    const art = this.artboard;
    const width = art ? art.width : this.canvas.getWidth();
    const height = art ? art.height : this.canvas.getHeight();
    const dataUrl = this.artboardDataUrl('jpeg', quality);
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: width >= height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
    });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    return pdf.output('blob');
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
    if (this.onFontsLoaded && typeof document !== 'undefined' && document.fonts) {
      document.fonts.removeEventListener('loadingdone', this.onFontsLoaded);
    }
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
  const custom = object.get('aspName');
  if (typeof custom === 'string' && custom.trim() !== '') {
    return custom;
  }
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
    return 'Group';
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
