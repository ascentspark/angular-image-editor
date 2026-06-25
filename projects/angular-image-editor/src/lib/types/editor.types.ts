/**
 * Public type contract for the editor.
 *
 * The tool and filter unions are derived from `as const` source arrays so the
 * registry (and any exhaustiveness check) is structurally guaranteed to cover
 * every member — there is one source of truth, not a union plus a parallel list
 * that can drift.
 */

/** Layout/baseline preset — sets the chrome and a default tool set. */
export type AspMode = 'viewer' | 'basic' | 'advanced' | 'full';

/**
 * A host-controllable size: a number (interpreted as `px`) or any CSS length —
 * `'600px'`, `'70%'`, `'80vh'`, `'calc(100vh - 120px)'`. Used for the editor's
 * `width`/`height` inputs. A per-mode minimum is always enforced on top so the
 * toolbars and panels keep enough room to render.
 */
export type AspSize = number | string;

/** Every tool the editor can expose, grouped by capability. Source of truth for {@link AspTool}. */
export const ALL_TOOLS = [
  // transform
  'crop',
  'rotate',
  'straighten',
  'flip',
  'resize',
  // draw / annotate
  'pen',
  'highlighter',
  'eraser',
  'shapes',
  'arrow',
  'line',
  'text',
  'sticker',
  'redact',
  'magicwand',
  'removebg',
  'selectsubject',
  // adjust / color
  'adjust',
  'filters',
  // object ops (Fabric object model)
  'select',
  'layers',
  'duplicate',
  'delete',
  'opacity',
  'align',
  'group',
  // canvas
  'background',
  'frame',
] as const;

export type AspTool = (typeof ALL_TOOLS)[number];

/** Fabric.js built-in filters exposed by the editor. Source of truth for {@link AspFilter}. */
export const ALL_FILTERS = [
  'brightness',
  'contrast',
  'saturation',
  'vibrance',
  'hue',
  'blur',
  'sharpen',
  'grayscale',
  'sepia',
  'invert',
  'pixelate',
  'noise',
  'gamma',
  'blendColor',
] as const;

export type AspFilter = (typeof ALL_FILTERS)[number];

/** Export formats. `json` serializes the re-editable Fabric scene; `pdf` embeds a raster. */
export type AspExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'json' | 'pdf';

/** A structured error surfaced via the `errorOccurred` output. */
export interface AspEditorError {
  /** Stable machine code, e.g. `'load-failed'`, `'export-failed'`, `'engine-init-failed'`. */
  readonly code: string;
  readonly message: string;
}

/** Crop aspect-ratio presets. */
export type AspAspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2' | 'original';

/**
 * A host-defined crop aspect option — e.g. a CMS target like a 1200×630 social
 * image. `ratio` is width / height; build it from explicit dimensions with
 * {@link aspectOption}.
 */
export interface AspAspectOption {
  readonly label: string;
  readonly ratio: number;
}

/** Build an {@link AspAspectOption} from explicit pixel dimensions. */
export function aspectOption(width: number, height: number, label?: string): AspAspectOption {
  return { label: label ?? `${width}×${height}`, ratio: width / height };
}
