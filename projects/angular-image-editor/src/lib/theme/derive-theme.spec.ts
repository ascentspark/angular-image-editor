import { contrastRatio, formatHex, parseHex } from './color';
import { deriveTheme } from './derive-theme';
import { THEME_TOKEN_NAMES, type ThemeTokenName } from './tokens';

const PAIRS: readonly { base: string; accent: string }[] = [
  { base: '#f4f6f9', accent: '#1f6feb' }, // spec default
  { base: '#f4f6f9', accent: '#02375e' }, // deep navy (integration example)
  { base: '#fff7ed', accent: '#ea580c' }, // warm / orange
  { base: '#f0fdf4', accent: '#16a34a' }, // green
  { base: '#faf5ff', accent: '#7c3aed' }, // purple
  { base: '#1a1a1a', accent: '#e11d48' }, // dark base + rose accent
];

describe('deriveTheme', () => {
  it('emits exactly the documented --asp-* token set, with no empty values', () => {
    const theme = deriveTheme('#f4f6f9', '#1f6feb', 'light');
    expect(Object.keys(theme).sort()).toEqual([...THEME_TOKEN_NAMES].sort());
    for (const value of Object.values(theme)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for identical inputs', () => {
    expect(deriveTheme('#f4f6f9', '#1f6feb', 'light')).toEqual(
      deriveTheme('#f4f6f9', '#1f6feb', 'light'),
    );
  });

  it('preserves the accent color exactly (brand is not altered)', () => {
    const theme = deriveTheme('#f4f6f9', '#1f6feb', 'light');
    expect(theme['--asp-accent']).toBe(formatHex(parseHex('#1f6feb')));
  });

  it('throws on an invalid input color', () => {
    expect(() => deriveTheme('nope', '#1f6feb', 'light')).toThrow();
  });

  it('exposes static radius / control / font tokens', () => {
    const theme = deriveTheme('#f4f6f9', '#1f6feb', 'light');
    expect(theme['--asp-radius-sm']).toMatch(/px|rem/);
    expect(theme['--asp-ctl-h']).toMatch(/px|rem/);
    expect(theme['--asp-font-mono']).toContain('mono');
  });

  for (const mode of ['light', 'dark'] as const) {
    describe(`AA contrast guarantees (${mode})`, () => {
      for (const { base, accent } of PAIRS) {
        const theme = deriveTheme(base, accent, mode);
        const c = (fg: ThemeTokenName, bg: ThemeTokenName): number =>
          contrastRatio(parseHex(theme[fg]), parseHex(theme[bg]));

        it(`primary ink is AAA on surface for ${base}/${accent}`, () => {
          expect(c('--asp-ink', '--asp-surface')).toBeGreaterThanOrEqual(7);
        });

        it(`secondary ink is AA on surface for ${base}/${accent}`, () => {
          expect(c('--asp-ink-700', '--asp-surface')).toBeGreaterThanOrEqual(4.5);
        });

        it(`muted ink is AA on surface for ${base}/${accent}`, () => {
          expect(c('--asp-ink-muted', '--asp-surface')).toBeGreaterThanOrEqual(4.5);
        });

        it(`accent ink is AA on accent for ${base}/${accent}`, () => {
          expect(c('--asp-accent-ink', '--asp-accent')).toBeGreaterThanOrEqual(4.5);
        });

        it(`accent-soft ink is AA on accent-soft for ${base}/${accent}`, () => {
          expect(c('--asp-accent-soft-ink', '--asp-accent-soft')).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  it('produces lighter surfaces in light mode than in dark mode', () => {
    const light = deriveTheme('#f4f6f9', '#1f6feb', 'light');
    const dark = deriveTheme('#f4f6f9', '#1f6feb', 'dark');
    const lum = (hex: string): number => parseHex(hex).r; // red channel is a fine proxy for near-neutrals
    expect(lum(light['--asp-surface'])).toBeGreaterThan(lum(dark['--asp-surface']));
  });
});
