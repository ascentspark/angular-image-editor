/**
 * Pure geometry helpers for the shape tools. Kept free of Fabric so they can be
 * unit-tested in isolation.
 */

/**
 * The largest meaningful corner radius for a `width`×`height` rectangle. A fully
 * rounded rectangle becomes a pill/stadium when the radius reaches half the
 * shorter side, so that is the cap.
 */
export function maxCornerRadius(width: number, height: number): number {
  return Math.max(0, Math.min(width, height) / 2);
}

/**
 * Clamp a requested corner radius into the valid `[0, maxCornerRadius]` range for
 * a `width`×`height` rectangle. Non-finite or negative input yields a sharp
 * corner (`0`).
 */
export function clampCornerRadius(radius: number, width: number, height: number): number {
  if (Number.isNaN(radius) || radius <= 0) {
    return 0;
  }
  // A finite over-large radius (or +Infinity) caps at the pill radius.
  return Math.min(radius, maxCornerRadius(width, height));
}
