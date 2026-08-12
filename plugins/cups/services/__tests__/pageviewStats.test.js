const { clampPageviewDays } = require('../pageviewStats');

describe('clampPageviewDays', () => {
  test('defaults to 30', () => {
    expect(clampPageviewDays(undefined)).toBe(30);
    expect(clampPageviewDays('')).toBe(30);
    expect(clampPageviewDays('nope')).toBe(30);
  });

  test('clamps to 1–90', () => {
    expect(clampPageviewDays(0)).toBe(1);
    expect(clampPageviewDays(7)).toBe(7);
    expect(clampPageviewDays(90)).toBe(90);
    expect(clampPageviewDays(999)).toBe(90);
  });
});
