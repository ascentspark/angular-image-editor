/**
 * JSON-LD structured-data builders. Emitted as `<script type="application/ld+json">`
 * so search engines and LLM crawlers get machine-readable facts about the library
 * and each page (and FAQ rich-result eligibility).
 */

export const SITE_ORIGIN = 'https://angular-image-editor.ascentspark.com';

export function softwareApplicationLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '@ascentsparksoftware/angular-image-editor',
    description:
      'Standalone, themeable Angular 22 image editor built on Fabric.js v7 — crop, filters, draw, ' +
      'text, redact, shapes, layers, in-browser AI background removal, and PNG/JPEG/WEBP/SVG/PDF export.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    softwareVersion: '0.1.0',
    license: 'https://opensource.org/licenses/MIT',
    author: { '@type': 'Organization', name: 'Ascentspark', url: 'https://ascentspark.com' },
    codeRepository: 'https://github.com/ascentspark/angular-image-editor',
    url: SITE_ORIGIN,
  };
}

export function webPageLd(
  name: string,
  description: string,
  path: string,
): Record<string, unknown> {
  const trimmed = path.replace(/^\//, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: trimmed ? `${SITE_ORIGIN}/${trimmed}` : SITE_ORIGIN,
    isPartOf: { '@type': 'WebSite', name: 'Angular Image Editor', url: SITE_ORIGIN },
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

export function faqPageLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}
