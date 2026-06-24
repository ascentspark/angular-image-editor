/**
 * Lazily and SSR-safely load Fabric.js.
 *
 * Fabric is `import()`-ed on demand so it stays out of the initial bundle (the
 * `simple`/`basic` path can avoid pulling it until an editor actually mounts),
 * and never evaluated during server-side rendering where `document` is absent.
 * The promise is memoized so the module is fetched at most once per app.
 */

import type * as Fabric from 'fabric';

export type FabricModule = typeof Fabric;

let cached: Promise<FabricModule> | null = null;

/** Resolve the Fabric module, or reject if not running in a browser. */
export function loadFabric(): Promise<FabricModule> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('@ascentspark/angular-image-editor: Fabric.js requires a browser environment.'));
  }
  if (cached === null) {
    cached = import('fabric');
  }
  return cached;
}
