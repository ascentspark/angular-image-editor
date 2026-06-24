import type { AspThemeTokens } from './tokens';

/**
 * Apply a derived theme to an element as scoped CSS custom properties.
 *
 * Tokens are set on the element's inline `style`, so they cascade only to the
 * editor's own subtree and never leak into (or clash with) the host page. Hosts
 * can still override any individual `--asp-*` variable with higher specificity.
 */
export function applyTheme(element: HTMLElement, tokens: AspThemeTokens): void {
  for (const [name, value] of Object.entries(tokens)) {
    element.style.setProperty(name, value);
  }
}
