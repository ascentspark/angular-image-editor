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

/** Export formats. `json` serializes the re-editable Fabric scene. */
export type AspExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'json';

/** Crop aspect-ratio presets. */
export type AspAspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2' | 'original';
