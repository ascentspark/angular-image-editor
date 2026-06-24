import { contrastRatio, parseHex, type Rgb } from './color';
import {
  ensureContrastAA,
  mixOklab,
  oklchToSrgb,
  srgbToOklch,
  withLightness,
} from './oklch';

const close = (a: Rgb, b: Rgb, tol = 2): boolean =>
  Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;

describe('srgbToOklch / oklchToSrgb', () => {
  it('maps white to L≈1, chroma≈0', () => {
    const w = srgbToOklch({ r: 255, g: 255, b: 255 });
    expect(w.l).toBeCloseTo(1, 2);
    expect(w.c).toBeCloseTo(0, 2);
  });

  it('maps black to L≈0', () => {
    expect(srgbToOklch({ r: 0, g: 0, b: 0 }).l).toBeCloseTo(0, 2);
  });

  it('matches the reference OKLCH for pure red', () => {
    const red = srgbToOklch({ r: 255, g: 0, b: 0 });
    expect(red.l).toBeCloseTo(0.6279, 2);
    expect(red.c).toBeCloseTo(0.2577, 2);
    expect(red.h).toBeCloseTo(29.23, 0);
  });

  it('round-trips a range of colors within rounding tolerance', () => {
    for (const hex of ['#1f6feb', '#02375e', '#f4f6f9', '#50cd89', '#181c32', '#888888']) {
      const rgb = parseHex(hex);
      expect(close(oklchToSrgb(srgbToOklch(rgb)), rgb)).toBe(true);
    }
  });

  it('gamut-clamps out-of-range requests into valid sRGB', () => {
    const c = oklchToSrgb({ l: 0.5, c: 0.5, h: 140 });
    for (const v of [c.r, c.g, c.b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe('withLightness', () => {
  it('sets the OKLCH lightness while preserving hue', () => {
    const base = parseHex('#1f6feb');
    const lighter = withLightness(base, 0.9);
    expect(srgbToOklch(lighter).l).toBeCloseTo(0.9, 2);
    expect(srgbToOklch(lighter).h).toBeCloseTo(srgbToOklch(base).h, 0);
  });
});

describe('mixOklab', () => {
  it('returns endpoints at t=0 and t=1', () => {
    const a = parseHex('#000000');
    const b = parseHex('#ffffff');
    expect(close(mixOklab(a, b, 0), a)).toBe(true);
    expect(close(mixOklab(a, b, 1), b)).toBe(true);
  });

  it('returns a value between the endpoints at t=0.5', () => {
    const mid = mixOklab(parseHex('#000000'), parseHex('#ffffff'), 0.5);
    expect(mid.r).toBeGreaterThan(80);
    expect(mid.r).toBeLessThan(200);
  });
});

describe('ensureContrastAA', () => {
  it('leaves a color unchanged when it already meets the ratio', () => {
    const black = parseHex('#000000');
    const white = parseHex('#ffffff');
    expect(ensureContrastAA(black, white, 4.5)).toEqual(black);
  });

  it('darkens foreground against a light background until AA is met', () => {
    const bg = parseHex('#f4f6f9');
    const fg = parseHex('#9ec5ff'); // too light to read on a light bg
    const fixed = ensureContrastAA(fg, bg, 4.5);
    expect(contrastRatio(fixed, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('lightens foreground against a dark background until AA is met', () => {
    const bg = parseHex('#181c32');
    const fg = parseHex('#2a3a66'); // too dark to read on a dark bg
    const fixed = ensureContrastAA(fg, bg, 4.5);
    expect(contrastRatio(fixed, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves hue family while adjusting lightness', () => {
    const bg = parseHex('#f4f6f9');
    const fg = parseHex('#1f6feb');
    const fixed = ensureContrastAA(fg, bg, 4.5);
    const dh = Math.abs(srgbToOklch(fixed).h - srgbToOklch(fg).h);
    expect(Math.min(dh, 360 - dh)).toBeLessThan(12);
  });
});
