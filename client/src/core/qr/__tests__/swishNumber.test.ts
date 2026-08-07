import {
  classifySwishNumber,
  isValidSwishNumber,
  normalizeSwishNumber,
  parseSwishNumber,
} from '../swishNumber';

describe('normalizeSwishNumber', () => {
  it('strips spaces and hyphens', () => {
    expect(normalizeSwishNumber('070-123 45 67')).toBe('0701234567');
    expect(normalizeSwishNumber('123 456 78 90')).toBe('1234567890');
  });

  it('maps +46 mobile to 07…', () => {
    expect(normalizeSwishNumber('+46701234567')).toBe('0701234567');
  });

  it('maps 46XXXXXXXXX mobile to 07…', () => {
    expect(normalizeSwishNumber('46701234567')).toBe('0701234567');
  });
});

describe('isValidSwishNumber / classifySwishNumber', () => {
  it('accepts mobile 07…', () => {
    expect(isValidSwishNumber('0701234567')).toBe(true);
    expect(classifySwishNumber('0701234567')).toBe('mobile');
  });

  it('accepts corporate 123…', () => {
    expect(isValidSwishNumber('1234567890')).toBe(true);
    expect(classifySwishNumber('1234567890')).toBe('corporate');
  });

  it('rejects short, long, and non-matching', () => {
    expect(isValidSwishNumber('070123456')).toBe(false);
    expect(isValidSwishNumber('07012345678')).toBe(false);
    expect(isValidSwishNumber('0801234567')).toBe(false);
    expect(isValidSwishNumber('abc')).toBe(false);
    expect(classifySwishNumber('abc')).toBeNull();
  });
});

describe('parseSwishNumber', () => {
  it('returns normalized valid payee', () => {
    expect(parseSwishNumber('070-123 45 67')).toEqual({ ok: true, value: '0701234567' });
  });

  it('fails on empty', () => {
    expect(parseSwishNumber('')).toEqual({ ok: false, error: expect.any(String) });
  });

  it('fails on invalid', () => {
    const r = parseSwishNumber('12345');
    expect(r.ok).toBe(false);
  });
});
