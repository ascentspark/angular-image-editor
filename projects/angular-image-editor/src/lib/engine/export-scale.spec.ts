import { MAX_EXPORT_PIXELS, exportMultiplier, exportPixelSize } from './export-scale';

describe('exportMultiplier', () => {
  it('recovers the source pixels under the region when no target is set', () => {
    // A 2400px photo fitted into a 640px canvas: ~10.4 source px per scene px.
    expect(
      exportMultiplier({ regionWidth: 230, regionHeight: 230, sourcePerScene: 10.43 }),
    ).toBeCloseTo(10.43, 5);
  });

  it('honours an export target that is within the source resolution', () => {
    expect(
      exportMultiplier({
        regionWidth: 230,
        regionHeight: 230,
        sourcePerScene: 10.43,
        target: { width: 1000 },
      }),
    ).toBeCloseTo(1000 / 230, 5);
  });

  it('never upscales past the real source pixels for an oversized target', () => {
    expect(
      exportMultiplier({
        regionWidth: 230,
        regionHeight: 230,
        sourcePerScene: 4,
        target: { width: 4000 },
      }),
    ).toBeCloseTo(4, 5);
  });

  it('never exports smaller than the on-screen region when no target is set', () => {
    // A small photo scaled UP to fill the canvas has < 1 source px per scene px.
    expect(exportMultiplier({ regionWidth: 400, regionHeight: 400, sourcePerScene: 0.4 })).toBe(1);
  });

  it('honours a target that is deliberately smaller than the on-screen region', () => {
    expect(
      exportMultiplier({
        regionWidth: 230,
        regionHeight: 230,
        sourcePerScene: 10,
        target: { width: 100 },
      }),
    ).toBeCloseTo(100 / 230, 5);
  });

  it('clamps to the maximum canvas area so low-end devices can allocate the bitmap', () => {
    const m = exportMultiplier({ regionWidth: 3000, regionHeight: 3000, sourcePerScene: 4 });
    expect(m).toBeCloseTo(Math.sqrt(MAX_EXPORT_PIXELS / (3000 * 3000)), 5);
    expect(3000 * m * (3000 * m)).toBeLessThanOrEqual(MAX_EXPORT_PIXELS + 1);
  });

  it('respects a caller-supplied area cap', () => {
    const m = exportMultiplier({
      regionWidth: 200,
      regionHeight: 100,
      sourcePerScene: 10,
      maxPixels: 200_000,
    });
    expect(m).toBeCloseTo(Math.sqrt(200_000 / 20_000), 5);
  });

  it('falls back to 1 for a degenerate region or scale', () => {
    expect(exportMultiplier({ regionWidth: 0, regionHeight: 100, sourcePerScene: 8 })).toBe(1);
    expect(exportMultiplier({ regionWidth: -10, regionHeight: 100, sourcePerScene: 8 })).toBe(1);
    expect(exportMultiplier({ regionWidth: 100, regionHeight: NaN, sourcePerScene: 8 })).toBe(1);
    expect(exportMultiplier({ regionWidth: 100, regionHeight: 100, sourcePerScene: NaN })).toBe(1);
    expect(
      exportMultiplier({ regionWidth: 100, regionHeight: 100, sourcePerScene: Infinity }),
    ).toBe(1);
  });

  it('ignores a degenerate target rather than exporting a zero-pixel image', () => {
    expect(
      exportMultiplier({
        regionWidth: 230,
        regionHeight: 230,
        sourcePerScene: 10,
        target: { width: 0 },
      }),
    ).toBeCloseTo(10, 5);
  });
});

describe('exportPixelSize', () => {
  it('reports the delivered bitmap size as whole pixels', () => {
    expect(exportPixelSize({ width: 230, height: 230 }, 1000 / 230)).toEqual({
      width: 1000,
      height: 1000,
    });
  });

  it('never reports a zero dimension for a tiny region', () => {
    expect(exportPixelSize({ width: 0.4, height: 0.4 }, 1)).toEqual({ width: 1, height: 1 });
  });
});
