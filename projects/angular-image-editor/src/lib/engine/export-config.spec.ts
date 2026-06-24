import { resolveExport } from './export-config';

describe('resolveExport', () => {
  it('maps a raster format with quality as a 0–1 fraction', () => {
    expect(resolveExport('png', 90, ['png', 'jpeg', 'webp'])).toEqual({
      format: 'png',
      mimeType: 'image/png',
      quality: 0.9,
      kind: 'raster',
    });
  });

  it('uses the right mime types for jpeg and webp', () => {
    expect(resolveExport('jpeg', 80, ['jpeg']).mimeType).toBe('image/jpeg');
    expect(resolveExport('webp', 80, ['webp']).mimeType).toBe('image/webp');
  });

  it('clamps quality into [10,100] before converting to a fraction', () => {
    expect(resolveExport('jpeg', 5, ['jpeg']).quality).toBeCloseTo(0.1, 5);
    expect(resolveExport('jpeg', 1000, ['jpeg']).quality).toBeCloseTo(1, 5);
  });

  it('treats svg as a vector export with quality pinned to 1', () => {
    expect(resolveExport('svg', 50, ['png', 'svg'])).toEqual({
      format: 'svg',
      mimeType: 'image/svg+xml',
      quality: 1,
      kind: 'vector',
    });
  });

  it('treats pdf as a pdf export with raster-style quality', () => {
    const r = resolveExport('pdf', 80, ['png', 'pdf']);
    expect(r.kind).toBe('pdf');
    expect(r.mimeType).toBe('application/pdf');
    expect(r.quality).toBeCloseTo(0.8, 5);
  });

  it('treats json as a serialized-scene export', () => {
    const r = resolveExport('json', 50, ['png', 'json']);
    expect(r.kind).toBe('json');
    expect(r.mimeType).toBe('application/json');
  });

  it('falls back to the first allowed format when the requested one is not allowed', () => {
    expect(resolveExport('svg', 90, ['png', 'jpeg']).format).toBe('png');
  });

  it('falls back to png when nothing is allowed', () => {
    expect(resolveExport('webp', 90, []).format).toBe('png');
  });
});
