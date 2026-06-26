import { describe, it, expect } from 'vitest';
import { clampCornerRadius, maxCornerRadius } from './shapes';

describe('maxCornerRadius', () => {
  it('is half the shorter side (pill cap)', () => {
    expect(maxCornerRadius(160, 110)).toBe(55);
    expect(maxCornerRadius(110, 160)).toBe(55);
    expect(maxCornerRadius(200, 200)).toBe(100);
  });

  it('never goes negative', () => {
    expect(maxCornerRadius(0, 0)).toBe(0);
  });
});

describe('clampCornerRadius', () => {
  it('keeps an in-range radius unchanged', () => {
    expect(clampCornerRadius(20, 160, 110)).toBe(20);
  });

  it('caps at the pill radius', () => {
    expect(clampCornerRadius(1000, 160, 110)).toBe(55);
  });

  it('treats zero and negative as a sharp corner', () => {
    expect(clampCornerRadius(0, 160, 110)).toBe(0);
    expect(clampCornerRadius(-5, 160, 110)).toBe(0);
  });

  it('treats non-finite input as a sharp corner', () => {
    expect(clampCornerRadius(Number.NaN, 160, 110)).toBe(0);
    expect(clampCornerRadius(Number.POSITIVE_INFINITY, 160, 110)).toBe(55);
  });
});
