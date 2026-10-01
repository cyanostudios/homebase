jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  Database: { get: jest.fn() },
}));

const { normalizeGtin } = require('../model');
const { AppError } = require('../../../server/core/errors/AppError');

describe('normalizeGtin', () => {
  test('keeps empty and strips spaces from a valid code', () => {
    expect(normalizeGtin('')).toBe('');
    expect(normalizeGtin(null)).toBe('');
    expect(normalizeGtin('0731 2345 678901')).toBe('07312345678901');
    expect(normalizeGtin('12345678')).toBe('12345678');
    expect(normalizeGtin('123456789012')).toBe('123456789012');
    expect(normalizeGtin('12345678901234')).toBe('12345678901234');
  });

  test('rejects a code that is not 8, 12, 13, or 14 digits', () => {
    expect(() => normalizeGtin('12345')).toThrow(AppError);
    try {
      normalizeGtin('ABC1234567890');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
    }
  });
});
