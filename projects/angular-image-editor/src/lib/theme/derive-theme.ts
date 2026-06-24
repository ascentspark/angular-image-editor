/**
 * Derive the full `--asp-*` token set from the three theming inputs.
 *
 * Strategy: surfaces, ink, and lines are generated as a perceptually-even
 * lightness scale tinted toward the BASE hue (so the editor blends with the
 * host's neutral palette); interactive tokens are generated from the ACCENT.
 * Text tokens are then run through {@link ensureContrastAA} against their actual
 * background so WCAG AA (AAA for primary ink) is GUARANTEED for any input pair,
 * in both light and dark — the 3 inputs alone always yield a legible result.
 */

import { contrastRatio, formatHex, parseHex, withAlpha, type Rgb } from './color';
import { ensureContrastAA, mixOklab, oklchColor, srgbToOklch, withLightness } from './oklch';
import { STATIC_TOKENS, type AspThemeTokens } from './tokens';

/** Light or dark derivation. */
export type AspThemeMode = 'light' | 'dark';

interface ModeConfig {
  /** Lightness (OKLCH) for the surface scale. */
  readonly surface: { bg: number; surface: number; surface2: number; sunk: number };
  /** Target lightness for the ink scale BEFORE AA enforcement. */
  readonly ink: { ink: number; ink700: number; muted: number; faint: number };
  /** Lightness for hairlines. */
  readonly line: { line: number; strong: number };
  /** Cap on the chroma of tinted neutrals (keeps surfaces subtle). */
  readonly neutralChroma: number;
  /** Mix toward the surface when building the soft-accent background. */
  readonly accentSoftMix: number;
  /** Lightness delta applied to the accent for its hover state. */
  readonly accentHoverDelta: number;
  /** Alpha for the focus ring. */
  readonly ringAlpha: number;
  /** Modal scrim. */
  readonly scrim: string;
  /** Semantic status colors (brand-independent). */
  readonly semantic: { success: string; warning: string; error: string };
}

const LIGHT: ModeConfig = {
  surface: { bg: 0.972, surface: 1.0, surface2: 0.986, sunk: 0.935 },
  ink: { ink: 0.22, ink700: 0.4, muted: 0.55, faint: 0.7 },
  line: { line: 0.9, strong: 0.82 },
  neutralChroma: 0.02,
  accentSoftMix: 0.86,
  accentHoverDelta: -0.06,
  ringAlpha: 0.35,
  scrim: 'rgba(15, 23, 42, 0.4)',
  semantic: { success: '#117a52', warning: '#9a6700', error: '#c01c28' },
};

const DARK: ModeConfig = {
  surface: { bg: 0.15, surface: 0.205, surface2: 0.25, sunk: 0.29 },
  ink: { ink: 0.97, ink700: 0.82, muted: 0.66, faint: 0.48 },
  line: { line: 0.33, strong: 0.42 },
  neutralChroma: 0.025,
  accentSoftMix: 0.8,
  accentHoverDelta: 0.07,
  ringAlpha: 0.42,
  scrim: 'rgba(0, 0, 0, 0.55)',
  semantic: { success: '#4ade80', warning: '#fbbf24', error: '#f87171' },
};

const AA = 4.5;
const AAA = 7;

/**
 * Build the complete theme token map.
 *
 * @param baseColor neutral anchor (hex) — surfaces/ink/lines tint toward its hue.
 * @param accentColor interactive accent (hex) — kept exactly as the brand color.
 * @param mode `'light'` or `'dark'`.
 * @throws {Error} if either color is not valid hex.
 */
export function deriveTheme(
  baseColor: string,
  accentColor: string,
  mode: AspThemeMode,
): AspThemeTokens {
  const base = parseHex(baseColor);
  const accent = parseHex(accentColor);
  const cfg = mode === 'dark' ? DARK : LIGHT;

  const baseOklch = srgbToOklch(base);
  const baseHue = baseOklch.h;
  const neutralChroma = Math.min(baseOklch.c, cfg.neutralChroma);

  /** A neutral, tinted toward the base hue, at the given OKLCH lightness. */
  const tint = (l: number): Rgb => oklchColor(l, neutralChroma, baseHue);

  const surface = tint(cfg.surface.surface);
  const bg = tint(cfg.surface.bg);
  const surface2 = tint(cfg.surface.surface2);
  const sunk = tint(cfg.surface.sunk);

  const ink = ensureContrastAA(tint(cfg.ink.ink), surface, AAA);
  const ink700 = ensureContrastAA(tint(cfg.ink.ink700), surface, AA);
  const inkMuted = ensureContrastAA(tint(cfg.ink.muted), surface, AA);
  const inkFaint = tint(cfg.ink.faint);

  const line = tint(cfg.line.line);
  const lineStrong = tint(cfg.line.strong);

  const accentL = srgbToOklch(accent).l;
  const white: Rgb = { r: 255, g: 255, b: 255 };
  const black: Rgb = { r: 0, g: 0, b: 0 };
  const betterExtreme = contrastRatio(white, accent) >= contrastRatio(black, accent) ? white : black;
  const accentInk = ensureContrastAA(betterExtreme, accent, AA);
  const accentHover = withLightness(accent, accentL + cfg.accentHoverDelta);
  const accentSoft = mixOklab(accent, surface, cfg.accentSoftMix);
  const accentSoftInk = ensureContrastAA(accent, accentSoft, AA);

  return {
    '--asp-bg': formatHex(bg),
    '--asp-surface': formatHex(surface),
    '--asp-surface-2': formatHex(surface2),
    '--asp-surface-sunk': formatHex(sunk),
    '--asp-ink': formatHex(ink),
    '--asp-ink-700': formatHex(ink700),
    '--asp-ink-muted': formatHex(inkMuted),
    '--asp-ink-faint': formatHex(inkFaint),
    '--asp-line': formatHex(line),
    '--asp-line-strong': formatHex(lineStrong),
    '--asp-accent': formatHex(accent),
    '--asp-accent-ink': formatHex(accentInk),
    '--asp-accent-hover': formatHex(accentHover),
    '--asp-accent-soft': formatHex(accentSoft),
    '--asp-accent-soft-ink': formatHex(accentSoftInk),
    '--asp-ring': withAlpha(accent, cfg.ringAlpha),
    '--asp-scrim': cfg.scrim,
    '--asp-success': cfg.semantic.success,
    '--asp-warning': cfg.semantic.warning,
    '--asp-error': cfg.semantic.error,
    ...STATIC_TOKENS,
  };
}
