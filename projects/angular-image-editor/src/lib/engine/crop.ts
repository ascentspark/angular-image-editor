/**
 * Crop geometry. Pure functions that translate an aspect preset and image
 * dimensions into the largest centered crop rectangle of that ratio.
 */

import type { AspAspectPreset } from '../types/editor.types';

export interface CropRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const FIXED_RATIOS: Partial<Record<AspAspectPreset, number>> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
};

/**
 * The numeric width/height ratio for a preset, or `null` when the crop should
 * be free (`'free'`, or `'original'` with unknown dimensions).
 */
export function aspectRatioValue(
  preset: AspAspectPreset,
  imageW?: number,
  imageH?: number,
): number | null {
  if (preset === 'free') {
    return null;
  }
  if (preset === 'original') {
    return imageW && imageH ? imageW / imageH : null;
  }
  return FIXED_RATIOS[preset] ?? null;
}

/**
 * The largest rectangle of the given aspect `ratio` that fits inside the image,
 * centered. A `null` ratio yields the full image.
 */
export function centeredCropRect(imageW: number, imageH: number, ratio: number | null): CropRect {
  if (ratio === null) {
    return { left: 0, top: 0, width: imageW, height: imageH };
  }

  const imageRatio = imageW / imageH;
  let width: number;
  let height: number;
  if (ratio > imageRatio) {
    // Target is wider than the image → constrained by width.
    width = imageW;
    height = imageW / ratio;
  } else {
    // Target is taller (or equal) → constrained by height.
    height = imageH;
    width = imageH * ratio;
  }

  return {
    left: (imageW - width) / 2,
    top: (imageH - height) / 2,
    width,
    height,
  };
}
