import { activeAdjustments, isAdjustmentActive, toFabricParam } from './filter-map';

describe('toFabricParam', () => {
  it('scales bipolar -100..100 adjustments to -1..1', () => {
    expect(toFabricParam('brightness', 50)).toBeCloseTo(0.5, 5);
    expect(toFabricParam('contrast', -100)).toBeCloseTo(-1, 5);
    expect(toFabricParam('saturation', 100)).toBeCloseTo(1, 5);
    expect(toFabricParam('vibrance', -50)).toBeCloseTo(-0.5, 5);
    expect(toFabricParam('blur', 100)).toBeCloseTo(1, 5);
  });

  it('converts hue degrees to radians', () => {
    expect(toFabricParam('hue', 90)).toBeCloseTo(Math.PI / 2, 5);
    expect(toFabricParam('hue', -180)).toBeCloseTo(-Math.PI, 5);
  });

  it('passes pixelate block size and noise amount through unchanged', () => {
    expect(toFabricParam('pixelate', 8)).toBe(8);
    expect(toFabricParam('noise', 120)).toBe(120);
  });

  it('scales gamma from the 20..220 UI scale to a 0.2..2.2 multiplier', () => {
    expect(toFabricParam('gamma', 100)).toBeCloseTo(1, 5);
    expect(toFabricParam('gamma', 220)).toBeCloseTo(2.2, 5);
  });
});

describe('isAdjustmentActive', () => {
  it('is false at the registry default and true otherwise', () => {
    expect(isAdjustmentActive('brightness', 0)).toBe(false);
    expect(isAdjustmentActive('brightness', 5)).toBe(true);
    expect(isAdjustmentActive('gamma', 100)).toBe(false);
    expect(isAdjustmentActive('gamma', 120)).toBe(true);
    expect(isAdjustmentActive('pixelate', 1)).toBe(false);
    expect(isAdjustmentActive('pixelate', 6)).toBe(true);
  });
});

describe('activeAdjustments', () => {
  it('returns only non-default adjustments, mapped to fabric params', () => {
    const specs = activeAdjustments({ brightness: 0, contrast: 20, gamma: 100, blur: 50 });
    expect(specs).toEqual([
      { key: 'contrast', param: 0.2 },
      { key: 'blur', param: 0.5 },
    ]);
  });

  it('returns an empty list when all values are at their defaults', () => {
    expect(activeAdjustments({ brightness: 0, contrast: 0, hue: 0 })).toEqual([]);
  });

  it('ignores keys that are not adjustment filters', () => {
    const specs = activeAdjustments({ grayscale: 1, brightness: 10 } as Record<string, number>);
    expect(specs).toEqual([{ key: 'brightness', param: 0.1 }]);
  });
});
