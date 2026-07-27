const { toNullableInt } = require('../toNullableInt');

describe('toNullableInt', () => {
  it('returns null for empty / missing values', () => {
    expect(toNullableInt(undefined)).toBeNull();
    expect(toNullableInt(null)).toBeNull();
    expect(toNullableInt('')).toBeNull();
    expect(toNullableInt('  ')).toBeNull();
  });

  it('parses numeric strings and numbers', () => {
    expect(toNullableInt('25')).toBe(25);
    expect(toNullableInt(' 30 ')).toBe(30);
    expect(toNullableInt(0)).toBe(0);
    expect(toNullableInt(12)).toBe(12);
  });

  it('returns null for non-numeric strings', () => {
    expect(toNullableInt('abc')).toBeNull();
  });
});
