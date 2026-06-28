/**
 * Robust raster decoding for imported images.
 *
 * Decodes a Blob into a downscaled data URL, honoring EXIF orientation (phone
 * photos are frequently rotated only via EXIF) and converting formats the
 * browser can't decode natively — HEIC/HEIF — through a consumer-INJECTED
 * decoder loader (never a direct import; see `loaders.ts`). Every failure throws
 * a descriptive Error so the caller can surface it, instead of the old `<img>`
 * path that silently produced nothing for HEIC and for images past the browser's
 * decode limits.
 *
 * Pure size/format helpers are separated from the browser decode so they can be
 * unit-tested.
 */

import type { AspHeicDecoderLoader, Heic2AnyFn } from './loaders';

const HEIC_RE = /\.(heic|heif)$/i;

/** True when the source is HEIC/HEIF, which browsers cannot decode in `<img>`. */
export function isHeic(type: string, name = ''): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'image/heic' || t === 'image/heif' || HEIC_RE.test(name);
}

/**
 * Dimensions that fit within `maxDim` on the longest edge, preserving aspect
 * ratio. Returns the input unchanged when already within bounds (or zero-sized).
 */
export function fitWithin(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDim || longest === 0) {
    return { width, height };
  }
  const scale = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Output encoding for a re-drawn import. JPEG sources (and HEIC, which we convert
 * to JPEG) have no alpha, so JPEG keeps big photos small; anything that may carry
 * transparency (PNG/WebP/GIF/unknown) is kept as PNG so alpha survives.
 */
export function outputType(sourceType: string): 'image/jpeg' | 'image/png' {
  return /jpe?g/i.test(sourceType ?? '') ? 'image/jpeg' : 'image/png';
}

/** Convert a HEIC/HEIF blob to a JPEG blob via the consumer-provided `heic2any` loader. */
async function decodeHeic(blob: Blob, loader: AspHeicDecoderLoader | null): Promise<Blob> {
  if (!loader) {
    throw new Error(
      'HEIC/HEIF import needs a decoder. Install "heic2any" and register it with ' +
        "provideAspHeicDecoder(() => import('heic2any')).",
    );
  }
  let heic2any: Heic2AnyFn;
  try {
    const mod = await loader();
    heic2any = typeof mod === 'function' ? mod : (mod.default as Heic2AnyFn);
  } catch {
    throw new Error('The HEIC decoder ("heic2any") could not be loaded.');
  }
  const out = await heic2any({ blob, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

/**
 * Decode an image Blob into a downscaled data URL whose longest edge is at most
 * `maxDim`, applying EXIF orientation. HEIC/HEIF is converted first. Throws a
 * descriptive Error when the image can't be decoded (unsupported, corrupt, or
 * past the browser's limits) or when no canvas context is available.
 */
export async function decodeImageBlob(
  blob: Blob,
  maxDim: number,
  name = '',
  heicLoader: AspHeicDecoderLoader | null = null,
): Promise<string> {
  const heic = isHeic(blob.type, name);
  const source = heic ? await decodeHeic(blob, heicLoader) : blob;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image could not be decoded — the format may be unsupported or the file too large.');
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDim);
    if (width === 0 || height === 0) {
      throw new Error('This image has no pixel data.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No 2D canvas context is available for image import.');
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    // HEIC was converted to JPEG, so report that type for the output choice.
    return canvas.toDataURL(outputType(heic ? 'image/jpeg' : blob.type), 0.92);
  } finally {
    bitmap.close();
  }
}
