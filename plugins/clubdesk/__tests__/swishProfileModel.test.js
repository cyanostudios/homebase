// plugins/clubdesk/__tests__/swishProfileModel.test.js
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

const SwishProfileModel = require('../swishProfileModel');
const { AppError } = require('../../../server/core/errors/AppError');
const { Database } = require('@homebase/core');

describe('SwishProfileModel', () => {
  let model;

  beforeEach(() => {
    model = new SwishProfileModel();
    jest.clearAllMocks();
  });

  test('normalizePayee accepts mobile and rejects short', () => {
    expect(model.normalizePayee('070-123 45 67')).toBe('0701234567');
    expect(() => model.normalizePayee('123')).toThrow(AppError);
  });

  test('create stores profile and links', async () => {
    const txQuery = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 1,
          user_id: 7,
          payee: '0701234567',
          message: 'Kiosk',
          sort_order: 1,
          created_at: null,
          updated_at: null,
        },
      ])
      .mockResolvedValueOnce([]) // DELETE links
      .mockResolvedValueOnce([]); // INSERT link

    const query = jest
      .fn()
      .mockResolvedValueOnce([{ c: 0 }]) // count
      .mockResolvedValueOnce([{ id: 10 }]) // owned lists
      .mockResolvedValueOnce([]) // available
      .mockResolvedValueOnce([{ next: 1 }]); // sort

    Database.get.mockReturnValue({
      getUserId: () => 7,
      query,
      transaction: async (fn) => fn({ query: txQuery }),
    });

    const profile = await model.create(
      {},
      { payee: '070-123 45 67', message: 'Kiosk', priceListIds: [10] },
    );
    expect(profile).toMatchObject({
      id: '1',
      payee: '0701234567',
      message: 'Kiosk',
      priceListIds: ['10'],
    });
  });

  test('create rejects unowned price list', async () => {
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest
        .fn()
        .mockResolvedValueOnce([{ c: 0 }])
        .mockResolvedValueOnce([]), // owned: none
    });
    await expect(
      model.create({}, { payee: '0701234567', priceListIds: [99] }),
    ).rejects.toMatchObject({
      statusCode: 400,
      details: [{ field: 'priceListIds' }],
    });
  });

  test('create rejects price list already linked', async () => {
    const poolQuery = jest.fn().mockResolvedValue({
      rows: [{ price_list_id: 10, profile_id: 2 }],
    });
    Database.get.mockReturnValue({
      getUserId: () => 7,
      getPool: () => ({ query: poolQuery }),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ c: 0 }])
        .mockResolvedValueOnce([{ id: 10 }]),
    });
    await expect(
      model.create({}, { payee: '0701234567', priceListIds: [10] }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
      details: [{ field: 'priceListIds' }],
    });
    expect(poolQuery).toHaveBeenCalled();
  });

  test('getAll loads links via getPool (no user_id on junction)', async () => {
    const poolQuery = jest.fn().mockResolvedValue({ rows: [{ price_list_id: 10 }] });
    Database.get.mockReturnValue({
      getUserId: () => 7,
      getPool: () => ({ query: poolQuery }),
      query: jest.fn().mockResolvedValue([
        {
          id: 1,
          user_id: 7,
          payee: '0701234567',
          message: '',
          sort_order: 1,
          created_at: null,
          updated_at: null,
        },
      ]),
    });
    const profiles = await model.getAll({});
    expect(profiles).toEqual([
      {
        id: '1',
        payee: '0701234567',
        message: '',
        sortOrder: 1,
        priceListIds: ['10'],
        createdAt: null,
        updatedAt: null,
      },
    ]);
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('clubdesk_swish_profile_price_lists'),
      [1],
    );
  });

  test('delete removes owned profile', async () => {
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn().mockResolvedValue([{ id: 3 }]),
    });
    await expect(model.delete({}, 3)).resolves.toEqual({ id: '3' });
  });

  test('delete missing profile throws 404', async () => {
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn().mockResolvedValue([]),
    });
    await expect(model.delete({}, 99)).rejects.toMatchObject({
      statusCode: 404,
      code: AppError.CODES.NOT_FOUND,
    });
  });
});
