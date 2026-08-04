import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render modes for the prerenderer. Every route is prerendered to static HTML so
 * search engines and LLM crawlers see each page's full content and per-route
 * metadata without running JavaScript. The interactive editor itself mounts on
 * the client (inside `@defer` blocks), so the prerendered HTML is the page's
 * prose, code panels, navigation and structured data.
 */
export const serverRoutes: ServerRoute[] = [
  // The Playwright harness is a client-only surface: it paints its fixture on a
  // canvas and has nothing a crawler wants, so prerendering it only exercises
  // DOM APIs the prerenderer does not implement.
  { path: 'e2e', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
