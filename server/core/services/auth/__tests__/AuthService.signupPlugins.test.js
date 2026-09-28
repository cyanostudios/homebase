jest.mock('../../../ServiceManager', () => ({
  get: jest.fn((name) => {
    if (name === 'logger') {
      return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    }
    if (name === 'tenant') {
      return { createTenant: jest.fn() };
    }
    throw new Error(`Unexpected ServiceManager.get(${name})`);
  }),
}));

jest.mock('../../user/UserService');
jest.mock('../../tenant/TenantContextService');
jest.mock('../../../utils/tenantMainDb', () => ({
  upsertTenantRecord: jest.fn().mockResolvedValue(42),
  ensureTenantMembership: jest.fn().mockResolvedValue(undefined),
}));

const AuthService = require('../AuthService');
const UserService = require('../../user/UserService');
const ServiceManager = require('../../../ServiceManager');
const { DEFAULT_USER_PLUGINS } = require('../../../config/constants');
const { upsertTenantRecord, ensureTenantMembership } = require('../../../utils/tenantMainDb');

describe('AuthService.signup plugin grant', () => {
  let authService;
  let mockDb;
  let createTenant;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = { query: jest.fn().mockResolvedValue([]) };
    createTenant = jest.fn().mockResolvedValue({
      projectId: 'proj-1',
      databaseName: 'neondb',
      connectionString: 'postgres://tenant',
    });

    UserService.mockImplementation(() => ({
      findByEmail: jest.fn().mockResolvedValue(undefined),
      createUser: jest.fn().mockResolvedValue({
        id: 7,
        email: 'new@example.com',
        role: 'user',
      }),
      grantPluginAccess: jest.fn().mockResolvedValue(undefined),
      _getPool: () => mockDb,
    }));

    ServiceManager.get.mockImplementation((name) => {
      if (name === 'logger') {
        return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      }
      if (name === 'tenant') {
        return { createTenant };
      }
      throw new Error(`Unexpected ServiceManager.get(${name})`);
    });

    authService = new AuthService();
  });

  test('grants DEFAULT_USER_PLUGINS even when body asks for other plugins', async () => {
    const result = await authService.signup({
      email: 'new@example.com',
      password: 'password123',
      plugins: ['contacts', 'mail', 'cups', 'guides'],
    });

    expect(result.user.plugins).toEqual(DEFAULT_USER_PLUGINS);
    expect(authService.userService.grantPluginAccess).toHaveBeenCalledWith(7, DEFAULT_USER_PLUGINS);

    const pluginInserts = mockDb.query.mock.calls.filter((c) =>
      String(c[0]).includes('tenant_plugin_access'),
    );
    expect(pluginInserts).toHaveLength(DEFAULT_USER_PLUGINS.length);
    expect(pluginInserts.map((c) => c[1][1])).toEqual(DEFAULT_USER_PLUGINS);
    expect(upsertTenantRecord).toHaveBeenCalled();
    expect(ensureTenantMembership).toHaveBeenCalledWith(mockDb, 42, 7);
  });
});
