// Fail-closed registration for public share routing (notes/tasks).

const ServiceManager = require('../../ServiceManager');

describe('publicShareRouting.registerPublicShareRoute', () => {
  let registerPublicShareRoute;
  let mockQuery;

  beforeEach(() => {
    jest.resetModules();
    mockQuery = jest.fn();
    jest.doMock('@homebase/core', () => ({
      Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
    }));
    jest.doMock('../../ServiceManager', () => ({
      getMainPool: () => ({ query: mockQuery }),
      initialize: jest.fn(),
      get: jest.fn(),
    }));
    ({ registerPublicShareRoute } = require('../publicShareRouting'));
  });

  afterEach(() => {
    jest.dontMock('../../ServiceManager');
    if (typeof ServiceManager.reset === 'function') {
      ServiceManager.reset();
    }
  });

  it('inserts routing row on success', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await registerPublicShareRoute('tok-abc', 'note', 'postgres://tenant');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public_share_routing'),
      ['tok-abc', 'note', 'postgres://tenant'],
    );
  });

  it('throws when public_share_routing table is missing (fail closed)', async () => {
    const err = new Error('relation "public_share_routing" does not exist');
    err.code = '42P01';
    mockQuery.mockRejectedValue(err);

    await expect(
      registerPublicShareRoute('tok-abc', 'note', 'postgres://tenant'),
    ).rejects.toMatchObject({ code: '42P01' });
  });
});
