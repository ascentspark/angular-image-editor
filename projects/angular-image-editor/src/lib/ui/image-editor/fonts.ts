/**
 * Lazy web-font loading for the text tool.
 *
 * A chosen family is loaded by injecting the Google Fonts stylesheet once and
 * awaiting the CSS Font Loading API, so text renders in the correct font rather
 * than a fallback. System/generic stacks need no loading. SSR-safe (no-op when
 * `document` is absent), idempotent, and resolves even if loading fails (the
 * fallback simply renders).
 */

export interface FontOption {
  readonly label: string;
  /** CSS `font-family` value applied to the text object. */
  readonly value: string;
}

/** Default font choices: a system stack plus popular Google families. */
export const DEFAULT_FONTS: readonly FontOption[] = [
  { label: 'System', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Raleway', value: 'Raleway' },
  { label: 'Nunito', value: 'Nunito' },
  { label: 'Work Sans', value: 'Work Sans' },
  { label: 'Rubik', value: 'Rubik' },
  { label: 'Oswald', value: 'Oswald' },
  { label: 'Bebas Neue', value: 'Bebas Neue' },
  { label: 'Merriweather', value: 'Merriweather' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Lobster', value: 'Lobster' },
  { label: 'Pacifico', value: 'Pacifico' },
  { label: 'Dancing Script', value: 'Dancing Script' },
  { label: 'Caveat', value: 'Caveat' },
  { label: 'Roboto Mono', value: 'Roboto Mono' },
];

/**
 * A searchable catalog of popular Google Fonts for the "Add a Google font" box.
 * Names match Google's exact family names so the CSS API resolves them; the
 * input offers them as native autocomplete suggestions, so users don't have to
 * remember the precise full name.
 */
export const GOOGLE_FONTS: readonly string[] = [
  'Abril Fatface', 'Alegreya', 'Anton', 'Archivo', 'Archivo Black', 'Arvo',
  'Asap', 'Assistant', 'Barlow', 'Barlow Condensed', 'Bebas Neue', 'Bitter',
  'Bree Serif', 'Cabin', 'Cairo', 'Cardo', 'Caveat', 'Comfortaa', 'Cormorant',
  'Cormorant Garamond', 'Courier Prime', 'Crimson Text', 'DM Sans', 'DM Serif Display',
  'Dancing Script', 'Dosis', 'EB Garamond', 'Exo', 'Exo 2', 'Figtree', 'Fira Sans',
  'Fjalla One', 'Frank Ruhl Libre', 'Fraunces', 'Gelasio', 'Hind', 'IBM Plex Mono',
  'IBM Plex Sans', 'IBM Plex Serif', 'Inconsolata', 'Inter', 'Josefin Sans',
  'Jost', 'Kanit', 'Karla', 'Lato', 'Lexend', 'Libre Baskerville', 'Libre Franklin',
  'Lobster', 'Lobster Two', 'Lora', 'Manrope', 'Marcellus', 'Merriweather',
  'Merriweather Sans', 'Montserrat', 'Montserrat Alternates', 'Mukta', 'Mulish',
  'Noto Sans', 'Noto Serif', 'Nunito', 'Nunito Sans', 'Old Standard TT', 'Open Sans',
  'Oswald', 'Outfit', 'Overpass', 'PT Sans', 'PT Serif', 'Pacifico', 'Permanent Marker',
  'Playfair Display', 'Poppins', 'Prompt', 'Quicksand', 'Raleway', 'Roboto',
  'Roboto Condensed', 'Roboto Mono', 'Roboto Slab', 'Rubik', 'Sacramento', 'Sora',
  'Source Code Pro', 'Source Sans 3', 'Source Serif 4', 'Space Grotesk', 'Space Mono',
  'Spectral', 'Tajawal', 'Teko', 'Titillium Web', 'Ubuntu', 'Urbanist', 'Varela Round',
  'Vollkorn', 'Work Sans', 'Yanone Kaffeesatz', 'Zilla Slab',
];

const requested = new Set<string>();

function isGenericStack(family: string): boolean {
  return /,|system-ui|sans-serif|serif|monospace/i.test(family);
}

/** Ensure a font family is loaded; resolves immediately for generic/system stacks. */
export function ensureFontLoaded(family: string): Promise<void> {
  if (typeof document === 'undefined' || isGenericStack(family)) {
    return Promise.resolve();
  }
  const key = family.toLowerCase();
  if (!requested.has(key)) {
    requested.add(key);
    const id = `asp-font-${key.replace(/[^a-z0-9]+/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      const param = family.trim().replace(/\s+/g, '+');
      link.href = `https://fonts.googleapis.com/css2?family=${param}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }
  const fonts = document.fonts;
  if (!fonts) {
    return Promise.resolve();
  }
  return fonts
    .load(`16px "${family}"`)
    .then(() => undefined)
    .catch(() => undefined);
}
