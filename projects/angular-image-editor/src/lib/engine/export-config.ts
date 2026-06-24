/**
 * Resolve an export request into a concrete, validated configuration.
 *
 * Pure: turns the public `exportFormats`/`exportQuality` inputs plus a chosen
 * format into the mime type, normalized quality, and export "kind" the engine
 * needs. Guards against a requested format that the host did not allow.
 */

import type { AspExportFormat } from '../types/editor.types';

export type ExportKind = 'raster' | 'vector' | 'json';

export interface ResolvedExport {
  readonly format: AspExportFormat;
  readonly mimeType: string;
  /** 0–1 for raster formats; always 1 for vector/json. */
  readonly quality: number;
  readonly kind: ExportKind;
}

const MIME: Record<AspExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  json: 'application/json',
};

const KIND: Record<AspExportFormat, ExportKind> = {
  png: 'raster',
  jpeg: 'raster',
  webp: 'raster',
  svg: 'vector',
  json: 'json',
};

const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/**
 * @param format requested export format.
 * @param qualityPct quality on the public 10–100 scale.
 * @param allowed formats the host permits; the first is the fallback.
 */
export function resolveExport(
  format: AspExportFormat,
  qualityPct: number,
  allowed: readonly AspExportFormat[],
): ResolvedExport {
  const resolvedFormat = allowed.includes(format) ? format : (allowed[0] ?? 'png');
  const kind = KIND[resolvedFormat];
  const quality = kind === 'raster' ? clamp(qualityPct, 10, 100) / 100 : 1;
  return {
    format: resolvedFormat,
    mimeType: MIME[resolvedFormat],
    quality,
    kind,
  };
}
