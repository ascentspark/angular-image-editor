import { niceStep } from './rulers';

describe('niceStep', () => {
  it('returns a 1/2/5 × 10ⁿ value', () => {
    const allowed = (v: number): boolean => {
      const pow = Math.pow(10, Math.floor(Math.log10(v)));
      const norm = Math.round((v / pow) * 1000) / 1000;
      return norm === 1 || norm === 2 || norm === 5;
    };
    for (const zoom of [0.1, 0.25, 0.5, 1, 1.7, 2, 4, 8]) {
      expect(allowed(niceStep(zoom))).toBe(true);
    }
  });

  it('keeps major ticks near the target screen spacing', () => {
    for (const zoom of [0.2, 0.5, 1, 2, 3.3, 5]) {
      const screenSpacing = niceStep(zoom, 70) * zoom;
      // Within a 2/5..10/7 band of the 70px target for any zoom.
      expect(screenSpacing).toBeGreaterThanOrEqual(28);
      expect(screenSpacing).toBeLessThanOrEqual(140);
    }
  });

  it('never grows the scene step as zoom increases (and shrinks across a wide range)', () => {
    const zooms = [0.1, 0.25, 0.5, 1, 2, 4, 8];
    for (let i = 1; i < zooms.length; i++) {
      expect(niceStep(zooms[i])).toBeLessThanOrEqual(niceStep(zooms[i - 1]));
    }
    expect(niceStep(0.25)).toBeGreaterThan(niceStep(4));
  });

  it('uses a coarse step when zoomed far out', () => {
    expect(niceStep(0.1)).toBeGreaterThanOrEqual(500);
  });
});
