/**
 * Ruler rendering — pure drawing helpers for the measurement rulers that frame
 * the canvas. The engine owns the viewport; these functions just turn a
 * viewport into crisp tick marks and labels on a small strip canvas.
 */

/** The view transform a ruler needs: scene→screen is `scene * zoom + pan`. */
export interface RulerView {
  readonly zoom: number;
  readonly pan: number;
}

export interface RulerColors {
  readonly bg: string;
  readonly tick: string;
  readonly label: string;
}

/**
 * Choose a "nice" spacing (in scene units) between major ruler ticks so labels
 * land roughly `targetPx` apart on screen. Always a 1/2/5 × 10ⁿ value, so the
 * numbers read cleanly at any zoom.
 */
export function niceStep(zoom: number, targetPx = 70): number {
  const raw = targetPx / zoom;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow; // 1 ≤ norm < 10
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * pow;
}

/**
 * Draw a horizontal or vertical ruler onto `ctx`. The canvas backing store is
 * assumed pre-scaled by `dpr`; all coordinates here are in CSS pixels.
 *
 * @param lengthPx ruler length along the canvas (its width for `h`, height for `v`).
 * @param thickness ruler thickness (the short dimension).
 */
export function drawRuler(
  ctx: CanvasRenderingContext2D,
  orientation: 'h' | 'v',
  lengthPx: number,
  thickness: number,
  view: RulerView,
  colors: RulerColors,
): void {
  ctx.clearRect(0, 0, lengthPx, thickness);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, lengthPx, thickness);

  const step = niceStep(view.zoom);
  const subStep = step / 5;

  // Scene coordinates visible along this ruler: screen 0..lengthPx.
  const sceneStart = (0 - view.pan) / view.zoom;
  const sceneEnd = (lengthPx - view.pan) / view.zoom;
  const first = Math.floor(sceneStart / subStep) * subStep;

  ctx.strokeStyle = colors.tick;
  ctx.fillStyle = colors.label;
  ctx.lineWidth = 1;
  ctx.font = '9px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = orientation === 'h' ? 'alphabetic' : 'top';

  // A small epsilon avoids dropping a major tick to float error.
  const eps = subStep / 1000;

  for (let s = first; s <= sceneEnd; s += subStep) {
    const screen = Math.round(s * view.zoom + view.pan) + 0.5;
    const isMajor = Math.abs(s / step - Math.round(s / step)) < eps / step;
    const tickLen = isMajor ? thickness * 0.62 : thickness * 0.32;

    ctx.beginPath();
    if (orientation === 'h') {
      ctx.moveTo(screen, thickness);
      ctx.lineTo(screen, thickness - tickLen);
    } else {
      ctx.moveTo(thickness, screen);
      ctx.lineTo(thickness - tickLen, screen);
    }
    ctx.stroke();

    if (isMajor) {
      const label = String(Math.round(s));
      if (orientation === 'h') {
        ctx.fillText(label, screen + 2, thickness - tickLen - 1);
      } else {
        // Vertical ruler: rotate the label to read along the strip.
        ctx.save();
        ctx.translate(thickness - tickLen - 1, screen + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
  }
}
