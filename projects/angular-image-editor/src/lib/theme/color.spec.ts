import { contrastRatio, formatHex, parseHex, relativeLuminance, withAlpha } from './color';

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#1f6feb')).toEqual({ r: 31, g: 111, b: 235 });
  });

  it('parses 3-digit shorthand hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('parses without a leading hash', () => {
    expect(parseHex('000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('is case insensitive', () => {
    expect(parseHex('#AABBCC')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('throws on malformed input', () => {
    expect(() => parseHex('not-a-color')).toThrow();
    expect(() => parseHex('#12')).toThrow();
    expect(() => parseHex('#12345')).toThrow();
    expect(() => parseHex('')).toThrow();
  });
});

describe('formatHex', () => {
  it('round-trips with parseHex', () => {
    expect(formatHex({ r: 31, g: 111, b: 235 })).toBe('#1f6feb');
  });

  it('clamps and rounds channel values into [0,255]', () => {
    expect(formatHex({ r: -5, g: 300, b: 127.6 })).toBe('#00ff80');
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it('is 1:1 for identical colors', () => {
    expect(contrastRatio({ r: 100, g: 120, b: 140 }, { r: 100, g: 120, b: 140 })).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    const a = { r: 31, g: 111, b: 235 };
    const b = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });
});

describe('withAlpha', () => {
  it('produces an rgba() string from an rgb color', () => {
    expect(withAlpha({ r: 31, g: 111, b: 235 }, 0.35)).toBe('rgba(31, 111, 235, 0.35)');
  });

  it('clamps alpha into [0,1]', () => {
    expect(withAlpha({ r: 0, g: 0, b: 0 }, 2)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha({ r: 0, g: 0, b: 0 }, -1)).toBe('rgba(0, 0, 0, 0)');
  });
});
