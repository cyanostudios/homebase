// plugins/guides/__tests__/production-settings.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
  Context: { getTenantUserId: jest.fn() },
}));

const { Context, Database } = require('@homebase/core');
const ProductionSettingsModel = require('../production/ProductionSettingsModel');

describe('ProductionSettingsModel', () => {
  beforeEach(() => {
    Context.getTenantUserId.mockReturnValue(7);
    jest.clearAllMocks();
  });

  test('get returns defaults when no row', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([]),
    });
    const model = new ProductionSettingsModel();
    await expect(model.get({})).resolves.toEqual({
      workerEnabled: false,
      pollIntervalMs: 5000,
    });
  });

  test('get returns row values', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([{ worker_enabled: true, poll_interval_ms: 60000 }]),
    });
    const model = new ProductionSettingsModel();
    await expect(model.get({})).resolves.toEqual({
      workerEnabled: true,
      pollIntervalMs: 60000,
    });
  });

  test('get falls back to defaults when table is missing', async () => {
    const err = Object.assign(new Error('relation "guide_production_settings" does not exist'), {
      code: '42P01',
    });
    Database.get.mockReturnValue({
      query: jest.fn().mockRejectedValue(err),
    });
    const model = new ProductionSettingsModel();
    await expect(model.get({})).resolves.toEqual({
      workerEnabled: false,
      pollIntervalMs: 5000,
    });
  });

  test('upsert rejects invalid poll interval', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([]),
    });
    const model = new ProductionSettingsModel();
    await expect(model.upsert({}, { pollIntervalMs: 1234 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('upsert writes enabled + interval', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ worker_enabled: true, poll_interval_ms: 30000 }]);
    Database.get.mockReturnValue({ query });
    const model = new ProductionSettingsModel();
    const result = await model.upsert({}, { workerEnabled: true, pollIntervalMs: 30000 });
    expect(result).toEqual({ workerEnabled: true, pollIntervalMs: 30000 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1]).toEqual([7, true, 30000]);
  });
});
