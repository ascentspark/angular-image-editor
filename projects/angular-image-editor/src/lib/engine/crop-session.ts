/**
 * Pure geometry for the interactive crop tool. The crop frame is a rectangle in
 * scene (canvas) coordinates; these helpers keep it inside the canvas and honor
 * an optional aspect ratio. Kept free of Fabric so they can be unit-tested.
 */

export interface FrameRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The starting crop frame: the largest rectangle of `ratio` (width/height) that
 * fits the canvas, scaled by `inset` and centered. A `null` ratio uses the
 * canvas aspect (so the frame is an inset of the whole canvas).
 */
export function defaultCropFrame(
  cw: number,
  ch: number,
  ratio: number | null,
  inset = 0.8,
): FrameRect {
  let width = cw;
  let height = ch;
  if (ratio) {
    if (cw / ch > ratio) {
      height = ch;
      width = ch * ratio;
    } else {
      width = cw;
      height = cw / ratio;
    }
  }
  width *= inset;
  height *= inset;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

/**
 * Clamp a frame so it stays fully within `cw`×`ch`, shrinking it if it is larger
 * than the canvas and then nudging its origin so it fits.
 */
export function clampFrame(frame: FrameRect, cw: number, ch: number): FrameRect {
  const width = Math.min(Math.max(frame.width, 1), cw);
  const height = Math.min(Math.max(frame.height, 1), ch);
  const left = Math.min(Math.max(frame.left, 0), cw - width);
  const top = Math.min(Math.max(frame.top, 0), ch - height);
  return { left, top, width, height };
}

/**
 * Resize a frame to `ratio` (width/height) keeping its center, then fit it inside
 * the canvas. A `null` ratio just clamps the frame unchanged.
 */
export function applyRatio(
  frame: FrameRect,
  ratio: number | null,
  cw: number,
  ch: number,
): FrameRect {
  if (!ratio) {
    return clampFrame(frame, cw, ch);
  }
  const cx = frame.left + frame.width / 2;
  const cy = frame.top + frame.height / 2;
  let width = frame.width;
  let height = width / ratio;
  if (height > ch) {
    height = ch;
    width = height * ratio;
  }
  if (width > cw) {
    width = cw;
    height = width / ratio;
  }
  return clampFrame({ left: cx - width / 2, top: cy - height / 2, width, height }, cw, ch);
}
