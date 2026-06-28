/**
 * Loader contracts for the editor's optional, heavyweight features — AI
 * background removal (`@imgly/background-removal` + `onnxruntime-web`) and HEIC
 * decoding (`heic2any`).
 *
 * The core editor deliberately does NOT `import()` these packages. They ship
 * WASM, web workers and deep CJS graphs that the dev-server bundlers (Vite's
 * optimizer in particular) cannot pre-bundle reliably; having them in the core's
 * import graph breaks the editor for EVERY consumer, whether or not they use the
 * feature. Instead the consumer installs the package it wants and injects a
 * loader (see `providers.ts`). The heavy `import()` then lives in the consumer's
 * own code, where they own the bundler config and only they pay the cost.
 *
 * These are intentionally MINIMAL structural types describing only the call
 * surface the editor uses, so this file has zero dependency on the optional
 * packages' own type declarations.
 */

/** The `heic2any` call surface the decoder uses. */
export type Heic2AnyFn = (opts: {
  blob: Blob;
  toType?: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

/** Whatever `() => import('heic2any')` resolves to — a module namespace or the bare fn. */
export type AspHeicDecoderModule = { readonly default?: Heic2AnyFn } | Heic2AnyFn;

/**
 * A loader that resolves the `heic2any` decoder on demand. Register it with
 * `provideAspHeicDecoder(() => import('heic2any'))` to enable HEIC/HEIF import.
 */
export type AspHeicDecoderLoader = () => Promise<AspHeicDecoderModule>;

/** The `@imgly/background-removal` call surface the engine uses. */
export type RemoveBackgroundFn = (
  source: Blob | string,
  config?: { progress?: (key: string, current: number, total: number) => void },
) => Promise<Blob>;

/** Whatever `() => import('@imgly/background-removal')` resolves to. */
export interface AspBackgroundRemovalModule {
  readonly removeBackground: RemoveBackgroundFn;
}

/**
 * A loader that resolves the background-removal engine on demand. Register it
 * with `provideAspBackgroundRemoval(() => import('@imgly/background-removal'))`
 * to enable the Remove-background / Cut-out-subject tools.
 */
export type AspBackgroundRemovalLoader = () => Promise<AspBackgroundRemovalModule>;
