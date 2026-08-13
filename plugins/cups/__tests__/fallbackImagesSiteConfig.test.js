const mockPoolQuery = jest.fn();

jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Database: {
    get: jest.fn(),
  },
}));

const { Database } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const CupsModel = require('../model');
const { FALLBACK_IMAGES_CONFIG_KEY } = require('../services/fallbackImages');

beforeEach(() => {
  jest.clearAllMocks();
  Database.get.mockReturnValue({
    getUserId: () => 7,
    getPool: () => ({ query: mockPoolQuery }),
  });
});

describe('CupsModel fallback images site-config', () => {
  test('getFallbackImages returns [] when no row', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const model = new CupsModel();
    await expect(model.getFallbackImages({})).resolves.toEqual([]);
    expect(mockPoolQuery).toHaveBeenCalledWith(expect.stringContaining('cups_site_config'), [
      7,
      FALLBACK_IMAGES_CONFIG_KEY,
    ]);
  });

  test('getFallbackImages normalizes stored JSONB value', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          value: {
            urls: [
              'https://cdn.example/a.jpg',
              '/relative.jpg',
              'https://cdn.example/a.jpg',
              'https://app.example/api/files/1',
            ],
          },
        },
      ],
    });
    const model = new CupsModel();
    await expect(model.getFallbackImages({})).resolves.toEqual(['https://cdn.example/a.jpg']);
  });

  test('getFallbackImages returns [] when table missing (42P01)', async () => {
    const err = new Error('relation does not exist');
    err.code = '42P01';
    mockPoolQuery.mockRejectedValueOnce(err);
    const model = new CupsModel();
    await expect(model.getFallbackImages({})).resolves.toEqual([]);
  });

  test('setFallbackImages upserts normalized urls', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const model = new CupsModel();
    const saved = await model.setFallbackImages({}, [
      'https://cdn.example/a.webp',
      'https://cdn.example/a.webp',
      'javascript:bad',
    ]);
    expect(saved).toEqual(['https://cdn.example/a.webp']);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cups_site_config'),
      [7, FALLBACK_IMAGES_CONFIG_KEY, JSON.stringify({ urls: ['https://cdn.example/a.webp'] })],
    );
  });

  test('setFallbackImages returns 503 AppError when table missing', async () => {
    const err = new Error('relation does not exist');
    err.code = '42P01';
    mockPoolQuery.mockRejectedValueOnce(err);
    const model = new CupsModel();
    await expect(model.setFallbackImages({}, ['https://cdn.example/a.jpg'])).rejects.toMatchObject({
      statusCode: 503,
      code: AppError.CODES.DATABASE_ERROR,
    });
  });
});
