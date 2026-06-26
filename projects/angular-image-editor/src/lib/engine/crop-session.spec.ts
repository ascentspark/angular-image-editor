import { describe, it, expect } from 'vitest';
import { defaultCropFrame, clampFrame, applyRatio } from './crop-session';

describe('defaultCropFrame', () => {
  it('centers an inset of the whole canvas when ratio is null', () => {
    expect(defaultCropFrame(1000, 800, null, 0.8)).toEqual({
      left: 100,
      top: 80,
      width: 800,
      height: 640,
    });
  });

  it('fits the largest ratio rect (wide canvas, square ratio)', () => {
    // 1000x800 with 1:1 → constrained by height (800), inset 0.8 → 640
    expect(defaultCropFrame(1000, 800, 1, 0.8)).toEqual({
      left: 180,
      top: 80,
      width: 640,
      height: 640,
    });
  });

  it('fits a 16:9 ratio in a square canvas', () => {
    // 800x800, 16/9 → constrained by width (800), height 450, inset 1
    const f = defaultCropFrame(800, 800, 16 / 9, 1);
    expect(f.width).toBe(800);
    expect(Math.round(f.height)).toBe(450);
    expect(f.left).toBe(0);
  });
});

describe('clampFrame', () => {
  it('leaves an in-bounds frame unchanged', () => {
    expect(clampFrame({ left: 10, top: 10, width: 100, height: 80 }, 500, 500)).toEqual({
      left: 10,
      top: 10,
      width: 100,
      height: 80,
    });
  });

  it('nudges a frame that overflows the right/bottom edges back inside', () => {
    expect(clampFrame({ left: 450, top: 460, width: 100, height: 80 }, 500, 500)).toEqual({
      left: 400,
      top: 420,
      width: 100,
      height: 80,
    });
  });

  it('shrinks a frame larger than the canvas', () => {
    expect(clampFrame({ left: -20, top: -20, width: 600, height: 600 }, 500, 400)).toEqual({
      left: 0,
      top: 0,
      width: 500,
      height: 400,
    });
  });
});

describe('applyRatio', () => {
  it('returns a clamped frame unchanged for a null ratio', () => {
    expect(applyRatio({ left: 10, top: 10, width: 100, height: 80 }, null, 500, 500)).toEqual({
      left: 10,
      top: 10,
      width: 100,
      height: 80,
    });
  });

  it('reshapes to a square ratio keeping the center', () => {
    const out = applyRatio({ left: 100, top: 100, width: 200, height: 100 }, 1, 1000, 1000);
    // width stays 200, height becomes 200; center (200,150) preserved
    expect(out.width).toBe(200);
    expect(out.height).toBe(200);
    expect(out.left + out.width / 2).toBe(200);
    expect(out.top + out.height / 2).toBe(150);
  });

  it('shrinks to fit when the ratio would overflow the canvas', () => {
    const out = applyRatio({ left: 0, top: 0, width: 400, height: 100 }, 16 / 9, 400, 200);
    expect(out.width).toBeLessThanOrEqual(400);
    expect(out.height).toBeLessThanOrEqual(200);
    expect(Math.abs(out.width / out.height - 16 / 9)).toBeLessThan(0.01);
  });
});
