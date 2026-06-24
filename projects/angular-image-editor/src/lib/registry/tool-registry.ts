/**
 * Data-driven tool and filter catalog.
 *
 * The rail, options panels, and resolution all read from these tables — there
 * is no per-tool branching anywhere else. `mode`/`tools`/`disabledTools`/
 * `filters` resolve against this metadata (see `resolve-tools.ts`).
 */

import {
  ALL_FILTERS,
  ALL_TOOLS,
  type AspFilter,
  type AspMode,
  type AspTool,
} from '../types/editor.types';

export type AspToolGroup = 'transform' | 'annotate' | 'color' | 'object' | 'canvas';

export interface ToolMeta {
  readonly key: AspTool;
  readonly label: string;
  /** Iconify/Lucide icon id. */
  readonly icon: string;
  readonly group: AspToolGroup;
}

/** A filter is either a continuous "adjustment" (slider) or a one-tap "look". */
export type FilterKind = 'adjustment' | 'look';

export interface FilterMeta {
  readonly key: AspFilter;
  readonly label: string;
  readonly kind: FilterKind;
  /** Slider bounds + default for adjustments (omitted for looks). */
  readonly min?: number;
  readonly max?: number;
  readonly defaultValue?: number;
  readonly unit?: string;
}

export const TOOL_REGISTRY: Record<AspTool, ToolMeta> = {
  crop: { key: 'crop', label: 'Crop', icon: 'lucide:crop', group: 'transform' },
  rotate: { key: 'rotate', label: 'Rotate', icon: 'lucide:rotate-cw', group: 'transform' },
  straighten: { key: 'straighten', label: 'Straighten', icon: 'lucide:ruler', group: 'transform' },
  flip: { key: 'flip', label: 'Flip', icon: 'lucide:flip-horizontal-2', group: 'transform' },
  resize: { key: 'resize', label: 'Resize', icon: 'lucide:scaling', group: 'transform' },
  pen: { key: 'pen', label: 'Draw', icon: 'lucide:pencil', group: 'annotate' },
  highlighter: {
    key: 'highlighter',
    label: 'Highlight',
    icon: 'lucide:highlighter',
    group: 'annotate',
  },
  eraser: { key: 'eraser', label: 'Eraser', icon: 'lucide:eraser', group: 'annotate' },
  shapes: { key: 'shapes', label: 'Shapes', icon: 'lucide:square', group: 'annotate' },
  arrow: { key: 'arrow', label: 'Arrow', icon: 'lucide:arrow-up-right', group: 'annotate' },
  line: { key: 'line', label: 'Line', icon: 'lucide:minus', group: 'annotate' },
  text: { key: 'text', label: 'Text', icon: 'lucide:type', group: 'annotate' },
  sticker: { key: 'sticker', label: 'Sticker', icon: 'lucide:sticker', group: 'annotate' },
  redact: {
    key: 'redact',
    label: 'Redact',
    icon: 'lucide:square-dashed-mouse-pointer',
    group: 'annotate',
  },
  adjust: { key: 'adjust', label: 'Adjust', icon: 'lucide:sliders-horizontal', group: 'color' },
  filters: { key: 'filters', label: 'Filters', icon: 'lucide:contrast', group: 'color' },
  select: { key: 'select', label: 'Select', icon: 'lucide:mouse-pointer-2', group: 'object' },
  layers: { key: 'layers', label: 'Layers', icon: 'lucide:layers', group: 'object' },
  duplicate: { key: 'duplicate', label: 'Duplicate', icon: 'lucide:copy', group: 'object' },
  delete: { key: 'delete', label: 'Delete', icon: 'lucide:trash-2', group: 'object' },
  opacity: { key: 'opacity', label: 'Opacity', icon: 'lucide:droplet', group: 'object' },
  align: {
    key: 'align',
    label: 'Align',
    icon: 'lucide:align-horizontal-distribute-center',
    group: 'object',
  },
  group: { key: 'group', label: 'Group', icon: 'lucide:group', group: 'object' },
  background: {
    key: 'background',
    label: 'Background',
    icon: 'lucide:paint-bucket',
    group: 'canvas',
  },
  frame: { key: 'frame', label: 'Frame', icon: 'lucide:frame', group: 'canvas' },
};

export const FILTER_REGISTRY: Record<AspFilter, FilterMeta> = {
  brightness: {
    key: 'brightness',
    label: 'Brightness',
    kind: 'adjustment',
    min: -100,
    max: 100,
    defaultValue: 0,
  },
  contrast: {
    key: 'contrast',
    label: 'Contrast',
    kind: 'adjustment',
    min: -100,
    max: 100,
    defaultValue: 0,
  },
  saturation: {
    key: 'saturation',
    label: 'Saturation',
    kind: 'adjustment',
    min: -100,
    max: 100,
    defaultValue: 0,
  },
  vibrance: {
    key: 'vibrance',
    label: 'Vibrance',
    kind: 'adjustment',
    min: -100,
    max: 100,
    defaultValue: 0,
  },
  hue: { key: 'hue', label: 'Hue', kind: 'adjustment', min: -180, max: 180, defaultValue: 0, unit: '°' },
  blur: { key: 'blur', label: 'Blur', kind: 'adjustment', min: 0, max: 100, defaultValue: 0 },
  sharpen: { key: 'sharpen', label: 'Sharpen', kind: 'look' },
  grayscale: { key: 'grayscale', label: 'B&W', kind: 'look' },
  sepia: { key: 'sepia', label: 'Sepia', kind: 'look' },
  invert: { key: 'invert', label: 'Invert', kind: 'look' },
  pixelate: {
    key: 'pixelate',
    label: 'Pixelate',
    kind: 'adjustment',
    min: 1,
    max: 40,
    defaultValue: 1,
  },
  noise: { key: 'noise', label: 'Noise', kind: 'adjustment', min: 0, max: 200, defaultValue: 0 },
  gamma: { key: 'gamma', label: 'Gamma', kind: 'adjustment', min: 20, max: 220, defaultValue: 100 },
  blendColor: { key: 'blendColor', label: 'Tint', kind: 'look' },
};

/**
 * Curated default tool set per mode (ordered for the rail). `viewer` has no edit
 * tools; `basic` is the modal's crop/rotate/flip; `advanced` is the everyday
 * rail; `full` exposes the entire catalog.
 */
const ADVANCED_TOOLS: readonly AspTool[] = [
  'adjust',
  'filters',
  'crop',
  'rotate',
  'pen',
  'shapes',
  'text',
  'redact',
  'frame',
];

export const DEFAULT_TOOLS: Record<AspMode, readonly AspTool[]> = {
  viewer: [],
  basic: ['crop', 'rotate', 'flip'],
  advanced: ADVANCED_TOOLS,
  // full = advanced rail first, then every remaining catalog tool, in catalog order.
  full: [...ADVANCED_TOOLS, ...ALL_TOOLS.filter((t) => !ADVANCED_TOOLS.includes(t))],
};

const ADVANCED_FILTERS: readonly AspFilter[] = [
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
];

/** Default filter set per mode. `'all'` means every Fabric filter. */
export const DEFAULT_FILTERS: Record<AspMode, readonly AspFilter[] | 'all'> = {
  viewer: [],
  basic: [],
  advanced: ADVANCED_FILTERS,
  full: 'all',
};

export const ALL_FILTERS_LIST: readonly AspFilter[] = ALL_FILTERS;
export const ALL_TOOLS_LIST: readonly AspTool[] = ALL_TOOLS;
