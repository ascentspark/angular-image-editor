/**
 * Embed the web fonts used by an exported SVG so it renders the true typeface
 * everywhere — not just in a viewer that happens to have the font installed.
 *
 * Fabric's `toSVG()` emits `<text font-family="Lato">`; standalone SVG viewers
 * that lack "Lato" silently fall back to a generic family. We fix that by
 * fetching each web font, inlining its bytes as a base64 `data:` URI inside an
 * `@font-face`, and injecting that CSS into the SVG's `<defs>`. The text stays
 * real, selectable text and the SVG stays self-contained.
 *
 * Pure parsing/encoding helpers are separated from the async network step (which
 * takes an injected `fetch`) so everything here is unit-testable.
 */

/** Minimal structural type for the bits of `fetch`'s Response we use. */
export interface FetchResponseLike {
  readonly ok: boolean;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<FetchResponseLike>;

/** A generic/system stack needs no embedding — the viewer already has it. */
function isGenericFontStack(family: string): boolean {
  return /,|system-ui|sans-serif|serif|monospace/i.test(family);
}

/**
 * The distinct, embeddable web-font family names among `families`. Generic stacks
 * and blanks are dropped; order of first appearance is preserved.
 */
export function webFontFamilies(families: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of families) {
    const name = (raw ?? '').trim();
    if (name && !isGenericFontStack(name) && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * Insert a `<style>` block into an SVG document, preferring an existing `<defs>`
 * and creating one right after the opening `<svg …>` otherwise. Returns the SVG
 * unchanged when there is no CSS to add.
 */
export function injectSvgFontCss(svg: string, css: string): string {
  if (!css.trim()) {
    return svg;
  }
  const style = `<style type="text/css">\n${css}\n</style>`;
  if (/<defs[\s>]/.test(svg)) {
    return svg.replace(/<defs([\s>])/, `<defs$1${style}`);
  }
  return svg.replace(/(<svg\b[^>]*>)/, `$1<defs>${style}</defs>`);
}

/** Base64-encode an ArrayBuffer (chunked so large fonts don't blow the call stack). */
export function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Build self-contained `@font-face` CSS for one Google font family: fetch its
 * CSS2 stylesheet, then inline every referenced `.woff2`/`.woff` as a base64
 * `data:` URI. Returns `''` (and embeds nothing) if the font can't be fetched, so
 * export degrades to the previous font-family behavior rather than failing.
 */
export async function embedGoogleFontCss(family: string, fetchFn: FetchLike): Promise<string> {
  const param = family.trim().replace(/\s+/g, '+');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${param}:wght@400;600;700&display=swap`;
  let css: string;
  try {
    const res = await fetchFn(cssUrl);
    if (!res.ok) {
      return '';
    }
    css = await res.text();
  } catch {
    return '';
  }

  const urlRe = /url\((https:\/\/[^)'"]+\.(?:woff2|woff))\)/g;
  const urls = [...new Set([...css.matchAll(urlRe)].map((m) => m[1]))];
  let out = css;
  for (const url of urls) {
    try {
      const fres = await fetchFn(url);
      if (!fres.ok) {
        continue;
      }
      const b64 = base64FromArrayBuffer(await fres.arrayBuffer());
      const mime = url.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
      out = out.split(url).join(`data:${mime};base64,${b64}`);
    } catch {
      // Leave this url() as-is; the rest of the embed still helps.
    }
  }
  // Drop @font-face blocks that still reference the network (failed inlines), so
  // the SVG never depends on a remote fetch to render.
  return out.replace(/@font-face\s*\{[^}]*\}/g, (block) =>
    /url\(https?:\/\//.test(block) ? '' : block,
  );
}

/**
 * Embed every web font used in `svg` (given the `families` collected from the
 * scene's text) as inlined `@font-face` CSS. Network fetches use the injected
 * `fetchFn`. On any failure the original SVG is returned unchanged.
 */
export async function embedFontsInSvg(
  svg: string,
  families: Iterable<string>,
  fetchFn: FetchLike,
): Promise<string> {
  const webFonts = webFontFamilies(families);
  if (!webFonts.length) {
    return svg;
  }
  const blocks = await Promise.all(webFonts.map((f) => embedGoogleFontCss(f, fetchFn)));
  const css = blocks.filter((b) => b.trim()).join('\n');
  return injectSvgFontCss(svg, css);
}
