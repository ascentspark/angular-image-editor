import { InjectionToken, type Provider } from '@angular/core';

import type { AspBackgroundRemovalLoader, AspHeicDecoderLoader } from './engine/loaders';

/**
 * Injection tokens + provider helpers that opt a consumer INTO the editor's
 * optional, heavyweight features without those packages ever entering the core
 * library's import graph (see `engine/loaders.ts` for why that matters).
 *
 * A feature is available only when its loader is provided; otherwise the editor
 * hides/disables the corresponding tool and surfaces a clear error if it is
 * reached programmatically.
 */

/** DI token carrying the AI background-removal loader, if the consumer provided one. */
export const ASP_BACKGROUND_REMOVAL_LOADER = new InjectionToken<AspBackgroundRemovalLoader>(
  'ASP_BACKGROUND_REMOVAL_LOADER',
);

/** DI token carrying the HEIC decoder loader, if the consumer provided one. */
export const ASP_HEIC_DECODER_LOADER = new InjectionToken<AspHeicDecoderLoader>(
  'ASP_HEIC_DECODER_LOADER',
);

/**
 * Enable AI background removal / subject cut-out. Install
 * `@imgly/background-removal` in the consuming app and pass its dynamic import:
 *
 * ```ts
 * provideAspBackgroundRemoval(() => import('@imgly/background-removal'))
 * ```
 *
 * The heavy WASM/worker `import()` then lives in the consumer's bundle, not the
 * library's. Without this provider the Remove-background / Cut-out tools are hidden.
 */
export function provideAspBackgroundRemoval(loader: AspBackgroundRemovalLoader): Provider {
  return { provide: ASP_BACKGROUND_REMOVAL_LOADER, useValue: loader };
}

/**
 * Enable HEIC/HEIF image import. Install `heic2any` in the consuming app and
 * pass its dynamic import:
 *
 * ```ts
 * provideAspHeicDecoder(() => import('heic2any'))
 * ```
 *
 * Without this provider, importing a HEIC/HEIF file throws a descriptive error.
 */
export function provideAspHeicDecoder(loader: AspHeicDecoderLoader): Provider {
  return { provide: ASP_HEIC_DECODER_LOADER, useValue: loader };
}
