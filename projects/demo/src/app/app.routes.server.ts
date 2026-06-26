import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render modes for the prerenderer. Every route is prerendered to static HTML so
 * search engines and LLM crawlers see each page's full content and per-route
 * metadata without running JavaScript. The interactive editor itself mounts on
 * the client (inside `@defer` blocks), so the prerendered HTML is the page's
 * prose, code panels, navigation and structured data.
 */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Prerender }];
