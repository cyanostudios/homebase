import { barWidthPercent } from '../rankedBarWidth';

describe('barWidthPercent', () => {
  test('scales relative to max', () => {
    expect(barWidthPercent(27, 27)).toBe(100);
    expect(barWidthPercent(0, 27)).toBe(0);
    expect(barWidthPercent(13.5, 27)).toBe(50);
  });

  test('handles empty max', () => {
    expect(barWidthPercent(5, 0)).toBe(0);
    expect(barWidthPercent(5, -1)).toBe(0);
  });
});
