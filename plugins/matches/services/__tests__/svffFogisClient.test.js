// plugins/matches/services/__tests__/svffFogisClient.test.js

const {
  normalizeApiMatches,
  parseSeasonYear,
  sanitizeExternalTeamId,
} = require('../svffFogisClient');

describe('svffFogisClient helpers', () => {
  test('normalizeApiMatches accepts array and nested keys', () => {
    expect(normalizeApiMatches([{ gameId: 1 }])).toEqual([{ gameId: 1 }]);
    expect(normalizeApiMatches({ games: [{ gameId: 2 }] })).toEqual([{ gameId: 2 }]);
    expect(normalizeApiMatches({ data: [{ gameId: 3 }] })).toEqual([{ gameId: 3 }]);
    expect(normalizeApiMatches(null)).toEqual([]);
    expect(normalizeApiMatches({})).toEqual([]);
  });

  test('parseSeasonYear extracts year or falls back to current', () => {
    expect(parseSeasonYear('2026')).toBe(2026);
    expect(parseSeasonYear('Säsong 2025/26')).toBe(2025);
    const year = parseSeasonYear('');
    expect(year).toBe(new Date().getFullYear());
  });

  test('sanitizeExternalTeamId trims and bounds length', () => {
    expect(sanitizeExternalTeamId(' 42 ')).toBe('42');
    expect(sanitizeExternalTeamId('')).toBeNull();
    expect(sanitizeExternalTeamId(null)).toBeNull();
    expect(sanitizeExternalTeamId('x'.repeat(120))).toHaveLength(100);
  });
});
