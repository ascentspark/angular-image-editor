import { floodFillClear } from './editor-engine';

/** Build an ImageData-like object from a w×h array of [r,g,b,a] tuples. */
function makeImage(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fill(x, y);
      const p = (y * w + x) * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = a;
    }
  }
  return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
}

const alphaAt = (img: ImageData, x: number, y: number): number => img.data[(y * img.width + x) * 4 + 3];

describe('floodFillClear', () => {
  it('clears a contiguous region of the seed color', () => {
    // Left half white, right half black.
    const img = makeImage(4, 2, (x) => (x < 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    const cleared = floodFillClear(img, 0, 0, 10);
    expect(cleared).toBe(4); // the 2×2 white block
    expect(alphaAt(img, 0, 0)).toBe(0);
    expect(alphaAt(img, 1, 1)).toBe(0);
    expect(alphaAt(img, 2, 0)).toBe(255); // black side untouched
  });

  it('respects the tolerance band', () => {
    // A gradient row: 0, 20, 60, 200.
    const cols = [0, 20, 60, 200];
    const img = makeImage(4, 1, (x) => [cols[x], cols[x], cols[x], 255]);
    // tol 30 from seed 0 reaches 20 (diff 20) but not 60 (diff 60).
    const cleared = floodFillClear(img, 0, 0, 30);
    expect(cleared).toBe(2);
    expect(alphaAt(img, 1, 0)).toBe(0);
    expect(alphaAt(img, 2, 0)).toBe(255);
  });

  it('does not cross a color boundary even if same color exists beyond it', () => {
    // white | black | white  — flood from the left white must not jump the black.
    const img = makeImage(3, 1, (x) => (x === 1 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const cleared = floodFillClear(img, 0, 0, 10);
    expect(cleared).toBe(1);
    expect(alphaAt(img, 2, 0)).toBe(255); // far white untouched (not contiguous)
  });

  it('is a no-op on an already-transparent seed', () => {
    const img = makeImage(2, 1, () => [255, 255, 255, 0]);
    expect(floodFillClear(img, 0, 0, 10)).toBe(0);
  });
});
