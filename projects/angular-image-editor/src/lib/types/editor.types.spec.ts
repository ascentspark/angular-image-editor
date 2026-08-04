import { aspectOption } from './editor.types';

describe('aspectOption', () => {
  it('derives the ratio from the dimensions', () => {
    expect(aspectOption(1200, 630).ratio).toBeCloseTo(1200 / 630, 5);
  });

  it('keeps the pixel dimensions so they can drive the export size', () => {
    const option = aspectOption(1000, 1000, 'Square');
    expect(option.width).toBe(1000);
    expect(option.height).toBe(1000);
  });

  it('labels itself with the dimensions when no label is given', () => {
    expect(aspectOption(1200, 630).label).toBe('1200×630');
  });
});
