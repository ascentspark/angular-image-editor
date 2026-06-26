import { describe, it, expect } from 'vitest';
import { isHeic, fitWithin, outputType } from './image-decode';

describe('isHeic', () => {
  it('detects by MIME type', () => {
    expect(isHeic('image/heic')).toBe(true);
    expect(isHeic('image/heif')).toBe(true);
    expect(isHeic('IMAGE/HEIC')).toBe(true);
  });

  it('detects by file extension when type is missing', () => {
    expect(isHeic('', 'IMG_2117.HEIC')).toBe(true);
    expect(isHeic('application/octet-stream', 'photo.heif')).toBe(true);
  });

  it('is false for normal raster types', () => {
    expect(isHeic('image/jpeg', 'photo.jpg')).toBe(false);
    expect(isHeic('image/png', 'logo.png')).toBe(false);
  });
});

describe('fitWithin', () => {
  it('leaves an in-bounds image unchanged', () => {
    expect(fitWithin(800, 600, 4096)).toEqual({ width: 800, height: 600 });
  });

  it('scales the longest edge down to maxDim, preserving aspect', () => {
    expect(fitWithin(8000, 6000, 4096)).toEqual({ width: 4096, height: 3072 });
    expect(fitWithin(6000, 8000, 4096)).toEqual({ width: 3072, height: 4096 });
  });

  it('handles zero-sized input without dividing by zero', () => {
    expect(fitWithin(0, 0, 4096)).toEqual({ width: 0, height: 0 });
  });
});

describe('outputType', () => {
  it('keeps JPEG sources as JPEG', () => {
    expect(outputType('image/jpeg')).toBe('image/jpeg');
    expect(outputType('image/jpg')).toBe('image/jpeg');
  });

  it('uses PNG for anything that may carry transparency', () => {
    expect(outputType('image/png')).toBe('image/png');
    expect(outputType('image/webp')).toBe('image/png');
    expect(outputType('')).toBe('image/png');
  });
});
