/**
 * Map the editor's UI adjustment values to Fabric.js filter parameters.
 *
 * Pure: produces normalized parameter specs the engine turns into Fabric filter
 * instances. Continuous "adjustment" filters live here; one-tap "look" filters
 * (grayscale/sepia/invert/sharpen/tint) carry no value and are handled by the
 * engine directly. Identity adjustments (at their registry default) are skipped
 * so the filter chain stays minimal.
 */

import { FILTER_REGISTRY } from '../registry/tool-registry';
import { ALL_FILTERS, type AspFilter } from '../types/editor.types';

export interface AdjustmentSpec {
  readonly key: AspFilter;
  /** Parameter value in Fabric's units. */
  readonly param: number;
}

/** UI-unit → Fabric-unit converters, by adjustment filter. */
const TO_FABRIC: Partial<Record<AspFilter, (ui: number) => number>> = {
  brightness: (ui) => ui / 100,
  contrast: (ui) => ui / 100,
  saturation: (ui) => ui / 100,
  vibrance: (ui) => ui / 100,
  blur: (ui) => ui / 100,
  hue: (ui) => (ui * Math.PI) / 180,
  pixelate: (ui) => ui,
  noise: (ui) => ui,
  gamma: (ui) => ui / 100,
};

const isAdjustment = (key: AspFilter): boolean => FILTER_REGISTRY[key]?.kind === 'adjustment';

/** Convert a UI adjustment value to its Fabric parameter. */
export function toFabricParam(key: AspFilter, uiValue: number): number {
  const convert = TO_FABRIC[key];
  return convert ? convert(uiValue) : uiValue;
}

/** Whether an adjustment differs from its registry default (i.e. has an effect). */
export function isAdjustmentActive(key: AspFilter, uiValue: number): boolean {
  return isAdjustment(key) && uiValue !== FILTER_REGISTRY[key].defaultValue;
}

/**
 * The non-default adjustments from a value map, in catalog order, each mapped to
 * its Fabric parameter. Non-adjustment keys are ignored.
 */
export function activeAdjustments(values: Readonly<Record<string, number>>): AdjustmentSpec[] {
  const specs: AdjustmentSpec[] = [];
  for (const key of ALL_FILTERS) {
    if (!isAdjustment(key)) {
      continue;
    }
    const value = values[key];
    if (value === undefined) {
      continue;
    }
    if (isAdjustmentActive(key, value)) {
      specs.push({ key, param: toFabricParam(key, value) });
    }
  }
  return specs;
}
