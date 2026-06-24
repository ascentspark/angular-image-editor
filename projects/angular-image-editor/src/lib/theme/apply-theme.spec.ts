import { applyTheme } from './apply-theme';
import { deriveTheme } from './derive-theme';

describe('applyTheme', () => {
  it('sets every token as a CSS custom property on the element', () => {
    const el = document.createElement('div');
    const theme = deriveTheme('#f4f6f9', '#1f6feb', 'light');

    applyTheme(el, theme);

    expect(el.style.getPropertyValue('--asp-accent')).toBe(theme['--asp-accent']);
    expect(el.style.getPropertyValue('--asp-surface')).toBe(theme['--asp-surface']);
    expect(el.style.getPropertyValue('--asp-ink')).toBe(theme['--asp-ink']);
    expect(el.style.getPropertyValue('--asp-radius-md')).toBe(theme['--asp-radius-md']);
  });

  it('overwrites previously applied tokens when re-applied', () => {
    const el = document.createElement('div');
    applyTheme(el, deriveTheme('#f4f6f9', '#1f6feb', 'light'));
    const dark = deriveTheme('#f4f6f9', '#1f6feb', 'dark');

    applyTheme(el, dark);

    expect(el.style.getPropertyValue('--asp-surface')).toBe(dark['--asp-surface']);
  });
});
