import { describe, it, expect, vi } from 'vitest';
import {
  webFontFamilies,
  injectSvgFontCss,
  base64FromArrayBuffer,
  embedGoogleFontCss,
  embedFontsInSvg,
  type FetchLike,
  type FetchResponseLike,
} from './svg-fonts';

describe('webFontFamilies', () => {
  it('keeps named web fonts, drops generic stacks and blanks', () => {
    expect(
      webFontFamilies([
        'Lato',
        'system-ui, -apple-system, sans-serif',
        'Arial, sans-serif',
        'Playfair Display',
        '',
        '  ',
      ]),
    ).toEqual(['Lato', 'Playfair Display']);
  });

  it('de-duplicates and preserves first-seen order', () => {
    expect(webFontFamilies(['Roboto', 'Lato', 'Roboto'])).toEqual(['Roboto', 'Lato']);
  });
});

describe('injectSvgFontCss', () => {
  it('returns the svg untouched when there is no css', () => {
    const svg = '<svg><text>hi</text></svg>';
    expect(injectSvgFontCss(svg, '   ')).toBe(svg);
  });

  it('injects into an existing <defs>', () => {
    const out = injectSvgFontCss('<svg><defs><clipPath/></defs></svg>', '@font-face{}');
    expect(out).toContain('<defs><style type="text/css">');
    expect(out).toContain('@font-face{}');
    expect(out.indexOf('<style')).toBeLessThan(out.indexOf('<clipPath'));
  });

  it('creates a <defs> when none exists', () => {
    const out = injectSvgFontCss('<svg width="10">\n<text>hi</text></svg>', '@font-face{}');
    expect(out).toContain('<svg width="10"><defs><style');
  });
});

describe('base64FromArrayBuffer', () => {
  it('encodes bytes to base64', () => {
    const buf = new Uint8Array([104, 105]).buffer; // "hi"
    expect(base64FromArrayBuffer(buf)).toBe('aGk=');
  });
});

function mockFetch(map: Record<string, { ok?: boolean; text?: string; bytes?: number[] }>): FetchLike {
  return vi.fn(async (url: string): Promise<FetchResponseLike> => {
    const entry = map[url];
    if (!entry) {
      return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return {
      ok: entry.ok ?? true,
      text: async () => entry.text ?? '',
      arrayBuffer: async () => new Uint8Array(entry.bytes ?? []).buffer,
    };
  });
}

describe('embedGoogleFontCss', () => {
  const cssUrl =
    'https://fonts.googleapis.com/css2?family=Lato:wght@400;600;700&display=swap';
  const fontUrl = 'https://fonts.gstatic.com/s/lato/v1/abc.woff2';

  it('inlines the woff2 url as a base64 data URI', async () => {
    const css = `@font-face{font-family:'Lato';src:url(${fontUrl}) format('woff2');}`;
    const css2 = await embedGoogleFontCss(
      'Lato',
      mockFetch({ [cssUrl]: { text: css }, [fontUrl]: { bytes: [104, 105] } }),
    );
    expect(css2).toContain("font-family:'Lato'");
    expect(css2).toContain('data:font/woff2;base64,aGk=');
    expect(css2).not.toContain(fontUrl);
  });

  it('drops a @font-face whose font could not be inlined', async () => {
    const css = `@font-face{font-family:'Lato';src:url(${fontUrl}) format('woff2');}`;
    const css2 = await embedGoogleFontCss(
      'Lato',
      mockFetch({ [cssUrl]: { text: css }, [fontUrl]: { ok: false } }),
    );
    expect(css2.trim()).toBe('');
  });

  it('returns empty string when the stylesheet fetch fails', async () => {
    const css2 = await embedGoogleFontCss('Lato', mockFetch({ [cssUrl]: { ok: false } }));
    expect(css2).toBe('');
  });
});

describe('embedFontsInSvg', () => {
  it('returns the svg unchanged when no web fonts are used', async () => {
    const svg = '<svg><text font-family="Arial, sans-serif">hi</text></svg>';
    const out = await embedFontsInSvg(svg, ['Arial, sans-serif'], mockFetch({}));
    expect(out).toBe(svg);
  });

  it('injects embedded font css for a used web font', async () => {
    const cssUrl =
      'https://fonts.googleapis.com/css2?family=Lato:wght@400;600;700&display=swap';
    const fontUrl = 'https://fonts.gstatic.com/s/lato/v1/abc.woff2';
    const css = `@font-face{font-family:'Lato';src:url(${fontUrl}) format('woff2');}`;
    const out = await embedFontsInSvg(
      '<svg><defs/><text font-family="Lato">hi</text></svg>',
      ['Lato'],
      mockFetch({ [cssUrl]: { text: css }, [fontUrl]: { bytes: [104, 105] } }),
    );
    expect(out).toContain('<style type="text/css">');
    expect(out).toContain('data:font/woff2;base64,aGk=');
  });
});
