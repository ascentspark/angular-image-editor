import { aspectRatioValue, centeredCropRect } from './crop';

describe('aspectRatioValue', () => {
  it('returns null for free (any ratio)', () => {
    expect(aspectRatioValue('free')).toBeNull();
  });

  it('returns numeric ratios for fixed presets', () => {
    expect(aspectRatioValue('1:1')).toBe(1);
    expect(aspectRatioValue('4:3')).toBeCloseTo(4 / 3, 5);
    expect(aspectRatioValue('16:9')).toBeCloseTo(16 / 9, 5);
    expect(aspectRatioValue('3:2')).toBeCloseTo(3 / 2, 5);
  });

  it('derives the original ratio from image dimensions', () => {
    expect(aspectRatioValue('original', 800, 600)).toBeCloseTo(4 / 3, 5);
  });

  it('returns null for original when dimensions are unknown', () => {
    expect(aspectRatioValue('original')).toBeNull();
  });
});

describe('centeredCropRect', () => {
  it('returns the full image for a free (null) ratio', () => {
    expect(centeredCropRect(800, 600, null)).toEqual({ left: 0, top: 0, width: 800, height: 600 });
  });

  it('produces a centered square for 1:1 on a landscape image', () => {
    expect(centeredCropRect(800, 600, 1)).toEqual({ left: 100, top: 0, width: 600, height: 600 });
  });

  it('produces a centered square for 1:1 on a portrait image', () => {
    expect(centeredCropRect(600, 800, 1)).toEqual({ left: 0, top: 100, width: 600, height: 600 });
  });

  it('is width-limited when the target ratio is wider than the image', () => {
    expect(centeredCropRect(800, 600, 16 / 9)).toEqual({ left: 0, top: 75, width: 800, height: 450 });
  });

  it('is height-limited when the target ratio is taller than the image', () => {
    expect(centeredCropRect(400, 800, 1)).toEqual({ left: 0, top: 200, width: 400, height: 400 });
  });
});
