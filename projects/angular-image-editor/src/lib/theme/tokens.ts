/**
 * The editor's scoped CSS custom-property contract.
 *
 * Every visual style in the library references one of these `--asp-*` variables,
 * and {@link deriveTheme} produces a value for each from the three theming inputs.
 * Hosts may override any individual variable in their own CSS for fine control.
 */

/** Color tokens derived at runtime from `baseColor` + `accentColor` + `themeMode`. */
export const COLOR_TOKEN_NAMES = [
  '--asp-bg',
  '--asp-surface',
  '--asp-surface-2',
  '--asp-surface-sunk',
  '--asp-ink',
  '--asp-ink-700',
  '--asp-ink-muted',
  '--asp-ink-faint',
  '--asp-line',
  '--asp-line-strong',
  '--asp-accent',
  '--asp-accent-ink',
  '--asp-accent-hover',
  '--asp-accent-soft',
  '--asp-accent-soft-ink',
  '--asp-ring',
  '--asp-scrim',
  '--asp-success',
  '--asp-warning',
  '--asp-error',
] as const;

/** Non-color tokens: fixed dimensional/typographic values, the same in every theme. */
export const STATIC_TOKEN_NAMES = [
  '--asp-radius-sm',
  '--asp-radius-md',
  '--asp-radius-lg',
  '--asp-radius-pill',
  '--asp-ctl-h',
  '--asp-ctl-h-sm',
  '--asp-font-mono',
] as const;

/** Every token name the editor sets on its root element. */
export const THEME_TOKEN_NAMES = [...COLOR_TOKEN_NAMES, ...STATIC_TOKEN_NAMES] as const;

export type ColorTokenName = (typeof COLOR_TOKEN_NAMES)[number];
export type StaticTokenName = (typeof STATIC_TOKEN_NAMES)[number];
export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

/** A fully-resolved theme: every token name mapped to a CSS value string. */
export type AspThemeTokens = Record<ThemeTokenName, string>;

/** Fixed values for the non-color tokens. */
export const STATIC_TOKENS: Record<StaticTokenName, string> = {
  '--asp-radius-sm': '6px',
  '--asp-radius-md': '9px',
  '--asp-radius-lg': '14px',
  '--asp-radius-pill': '999px',
  '--asp-ctl-h': '38px',
  '--asp-ctl-h-sm': '30px',
  '--asp-font-mono':
    "ui-monospace, 'SF Mono', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
};
