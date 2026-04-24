// plugins/cups/services/__tests__/cronRefresh.test.js
// Unit tests for runCupsAutoRefresh.
// All external dependencies (ServiceManager, TenantContextService, importFromIngest, CupsModel)
// are jest-mocked so the test runs without a live DB or network.

jest.mock('../../../../server/core/ServiceManager');
jest.mock('../../../../server/core/services/tenant/TenantContextService');
jest.mock('../importFromIngest');
jest.mock('../../model');
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Database: {},
}));

const ServiceManager = require('../../../../server/core/ServiceManager');
const TenantContextService = require('../../../../server/core/services/tenant/TenantContextService');
const { importFromIngest } = require('../importFromIngest');

const makeMainPool = (rows) => ({
  query: jest.fn().mockResolvedValue({ rows }),
});

const makeTenantPool = () => ({ pool: 'tenant-pool-mock' });

const makeConnectionPool = (tenantPool) => ({
  getTenantPool: jest.fn().mockReturnValue(tenantPool),
});

const makeImportResult = (overrides = {}) => ({
  fetched: true,
  parsed: 10,
  created: 2,
  updated: 7,
  skipped: 1,
  softDeleted: 0,
  hardDeleted: 0,
  errors: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runCupsAutoRefresh', () => {
  test('processes all opt-in users and their sources', async () => {
    const tenantPool = makeTenantPool();
    const connectionPool = makeConnectionPool(tenantPool);
    const mainPool = makeMainPool([
      {
        user_id: 1,
        settings: { autoRefresh: true, allowedIngestSourceIds: ['3', '5'] },
      },
      {
        user_id: 2,
        settings: { autoRefresh: true, allowedIngestSourceIds: ['7'] },
      },
    ]);

    ServiceManager.getMainPool = jest.fn().mockReturnValue(mainPool);
    ServiceManager.get = jest.fn().mockReturnValue(connectionPool);

    TenantContextService.mockImplementation(() => ({
      getTenantContextByUserId: jest.fn().mockResolvedValue({
        tenantConnectionString: 'postgresql://tenant/db',
      }),
    }));

    importFromIngest.mockResolvedValue(makeImportResult());

    const { runCupsAutoRefresh } = require('../cronRefresh');
    const result = await runCupsAutoRefresh();

    // Three source runs total (2 for user 1, 1 for user 2)
    expect(importFromIngest).toHaveBeenCalledTimes(3);

    // Correct sourceIds forwarded
    const calls = importFromIngest.mock.calls.map((c) => c[0].sourceId);
    expect(calls).toEqual(['3', '5', '7']);

    expect(result.usersProcessed).toBe(2);
    expect(result.usersSkipped).toBe(0);
    expect(result.results).toHaveLength(3);
    expect(result.totals.parsed).toBe(30); // 3 × 10
    expect(result.totals.created).toBe(6); // 3 × 2
  });

  test('skips users with no tenant context', async () => {
    const connectionPool = makeConnectionPool(makeTenantPool());
    const mainPool = makeMainPool([
      { user_id: 99, settings: { autoRefresh: true, allowedIngestSourceIds: ['1'] } },
    ]);

    ServiceManager.getMainPool = jest.fn().mockReturnValue(mainPool);
    ServiceManager.get = jest.fn().mockReturnValue(connectionPool);

    TenantContextService.mockImplementation(() => ({
      getTenantContextByUserId: jest.fn().mockResolvedValue(null),
    }));

    const { runCupsAutoRefresh } = require('../cronRefresh');
    const result = await runCupsAutoRefresh();

    expect(importFromIngest).not.toHaveBeenCalled();
    expect(result.usersProcessed).toBe(0);
    expect(result.usersSkipped).toBe(1);
  });

  test('skips users with empty allowedIngestSourceIds', async () => {
    const tenantPool = makeTenantPool();
    const connectionPool = makeConnectionPool(tenantPool);
    const mainPool = makeMainPool([
      { user_id: 5, settings: { autoRefresh: true, allowedIngestSourceIds: [] } },
    ]);

    ServiceManager.getMainPool = jest.fn().mockReturnValue(mainPool);
    ServiceManager.get = jest.fn().mockReturnValue(connectionPool);

    TenantContextService.mockImplementation(() => ({
      getTenantContextByUserId: jest.fn().mockResolvedValue({
        tenantConnectionString: 'postgresql://tenant/db',
      }),
    }));

    const { runCupsAutoRefresh } = require('../cronRefresh');
    const result = await runCupsAutoRefresh();

    expect(importFromIngest).not.toHaveBeenCalled();
    expect(result.usersSkipped).toBe(1);
  });

  test('records error and continues when a source import fails', async () => {
    const tenantPool = makeTenantPool();
    const connectionPool = makeConnectionPool(tenantPool);
    const mainPool = makeMainPool([
      {
        user_id: 1,
        settings: { autoRefresh: true, allowedIngestSourceIds: ['3', '5'] },
      },
    ]);

    ServiceManager.getMainPool = jest.fn().mockReturnValue(mainPool);
    ServiceManager.get = jest.fn().mockReturnValue(connectionPool);

    TenantContextService.mockImplementation(() => ({
      getTenantContextByUserId: jest.fn().mockResolvedValue({
        tenantConnectionString: 'postgresql://tenant/db',
      }),
    }));

    importFromIngest
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(makeImportResult());

    const { runCupsAutoRefresh } = require('../cronRefresh');
    const result = await runCupsAutoRefresh();

    expect(importFromIngest).toHaveBeenCalledTimes(2);
    expect(result.results[0]).toMatchObject({ sourceId: '3', error: 'fetch failed' });
    expect(result.results[1]).toMatchObject({ sourceId: '5', parsed: 10 });
    expect(result.totals.errors).toBe(1);
  });

  test('filters by userId when provided', async () => {
    const tenantPool = makeTenantPool();
    const connectionPool = makeConnectionPool(tenantPool);

    // Only user 7 should be returned by the filtered query
    const mainPool = makeMainPool([
      { user_id: 7, settings: { autoRefresh: true, allowedIngestSourceIds: ['2'] } },
    ]);

    ServiceManager.getMainPool = jest.fn().mockReturnValue(mainPool);
    ServiceManager.get = jest.fn().mockReturnValue(connectionPool);

    TenantContextService.mockImplementation(() => ({
      getTenantContextByUserId: jest.fn().mockResolvedValue({
        tenantConnectionString: 'postgresql://tenant/db',
      }),
    }));

    importFromIngest.mockResolvedValue(makeImportResult());

    const { runCupsAutoRefresh } = require('../cronRefresh');
    await runCupsAutoRefresh({ userId: 7 });

    // The mainPool query should be called with the userId param
    const queryCall = mainPool.query.mock.calls[0];
    expect(queryCall[0]).toContain('user_id = $1');
    expect(queryCall[1]).toEqual([7]);
  });
});
