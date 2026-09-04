const { AppError } = require('../../../../server/core/errors/AppError');

const mockQuery = jest.fn();
const mockMainPool = { query: mockQuery };

jest.mock('../../../../server/core/ServiceManager', () => {
  return {
    getMainPool: () => mockMainPool,
  };
});

const ServiceManager = require('../../../../server/core/ServiceManager');

describe('svffFogisClient.getFogisSettings SSRF guard', () => {
  test('throws VALIDATION_ERROR when apiBaseUrl is not public HTTPS', async () => {
    const mainPool = ServiceManager.getMainPool();

    mainPool.query.mockImplementation((sql, params) => {
      const category = params?.[1];
      if (category === 'matches') {
        return Promise.resolve({
          rows: [
            {
              settings: {
                apiBaseUrl: 'http://127.0.0.1',
                apiKey: 'test-key',
              },
            },
          ],
        });
      }
      if (category === 'teams') {
        return Promise.resolve({
          rows: [
            {
              settings: { activeSeason: '2026' },
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const { getFogisSettings } = require('../svffFogisClient');

    await expect(getFogisSettings(1)).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
    });
  });
});

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
    expect(normalizeApiMatches({ game: [{ gameId: 4 }] })).toEqual([{ gameId: 4 }]);
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
