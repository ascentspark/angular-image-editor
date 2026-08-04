/**
 * Resolve how many bitmap pixels a cropped export should carry.
 *
 * Pure: the crop region lives in scene (≈ CSS) coordinates, so rasterising it
 * at 1× would pin the export to whatever size the host's canvas happened to be
 * on screen — silently throwing away the source photo's real pixels. This module
 * turns "region + how much source is packed into each scene pixel + an optional
 * host target" into the Fabric `multiplier` that recovers them.
 */

/**
 * Largest bitmap area a cropped export may allocate (4096²). Mobile Safari and
 * low-end Android fail to allocate canvases much beyond this, and a failed
 * allocation loses the export entirely — better a slightly smaller image.
 */
export const MAX_EXPORT_PIXELS = 4096 * 4096;

export interface ExportScaleInput {
  /** Crop region width in scene units. */
  readonly regionWidth: number;
  /** Crop region height in scene units. */
  readonly regionHeight: number;
  /** Source image pixels per scene unit — `1 / baseImage.scaleX`; 1 when unknown. */
  readonly sourcePerScene: number;
  /** Host-requested export width in real pixels, when one was declared. */
  readonly target?: { readonly width: number } | null;
  /** Override the bitmap area cap (defaults to {@link MAX_EXPORT_PIXELS}). */
  readonly maxPixels?: number;
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;

/**
 * The Fabric render multiplier for a cropped export.
 *
 * Without a target, the region exports at source-limited resolution and never
 * below its on-screen size. With a target, the target wins up to the source's
 * real pixels — an explicit smaller target is honoured, an oversized one is not
 * allowed to fabricate detail. The result is finally clamped so the bitmap fits
 * within `maxPixels`. Degenerate input yields 1 rather than a broken export.
 */
export function exportMultiplier(input: ExportScaleInput): number {
  const { regionWidth, regionHeight, sourcePerScene, target } = input;
  if (!isPositive(regionWidth) || !isPositive(regionHeight)) {
    return 1;
  }
  // Floor at 1: a cropped export must never come out smaller than the region
  // already is on screen, even when the source is a scaled-up thumbnail.
  const sourceLimit = isPositive(sourcePerScene) ? Math.max(1, sourcePerScene) : 1;
  const wanted =
    target && isPositive(target.width)
      ? Math.min(target.width / regionWidth, sourceLimit)
      : sourceLimit;

  const maxPixels = isPositive(input.maxPixels ?? NaN)
    ? (input.maxPixels as number)
    : MAX_EXPORT_PIXELS;
  const areaLimit = Math.sqrt(maxPixels / (regionWidth * regionHeight));
  const multiplier = Math.min(wanted, areaLimit);
  return isPositive(multiplier) ? multiplier : 1;
}

/** The whole-pixel size a region rasterises to at `multiplier` (never zero). */
export function exportPixelSize(
  region: { readonly width: number; readonly height: number },
  multiplier: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(region.width * multiplier)),
    height: Math.max(1, Math.round(region.height * multiplier)),
  };
}
