// server/core/services/tenant/__tests__/TenantContextService.test.js
// Regression: tenant context resolution (membership vs owner fallback)

jest.mock('../../../ServiceManager', () => ({
  get: jest.fn(() => ({ info: () => {}, error: () => {}, warn: () => {} })),
}));

const TenantContextService = require('../TenantContextService');

describe('TenantContextService', () => {
  let service;
  let mockPool;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    service = new TenantContextService();
    service._getPool = () => mockPool;
  });

  describe('getTenantContextByUserId', () => {
    test('returns null when pool has no query', async () => {
      service._getPool = () => null;
      const ctx = await service.getTenantContextByUserId(1);
      expect(ctx).toBeNull();
    });

    test('returns context from legacy tenants (user_id) first', async () => {
      mockPool.query.mockResolvedValueOnce([
        {
          id: 10,
          neon_connection_string: 'postgres://legacy/db',
          user_id: 3,
        },
      ]);

      const ctx = await service.getTenantContextByUserId(3);
      expect(ctx).toEqual({
        tenantId: 10,
        tenantRole: 'admin',
        tenantConnectionString: 'postgres://legacy/db',
        tenantOwnerUserId: 3,
      });
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    test('returns context from tenant_memberships when legacy returns empty', async () => {
      mockPool.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          tenant_id: 10,
          role: 'editor',
          neon_connection_string: 'postgres://tenant/db',
          owner_user_id: 5,
        },
      ]);

      const ctx = await service.getTenantContextByUserId(99);
      expect(ctx).toEqual({
        tenantId: 10,
        tenantRole: 'editor',
        tenantConnectionString: 'postgres://tenant/db',
        tenantOwnerUserId: 5,
      });
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    test('falls back to owner when legacy and membership empty', async () => {
      mockPool.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 10,
            neon_connection_string: 'postgres://owner/db',
            owner_user_id: 7,
          },
        ]);

      const ctx = await service.getTenantContextByUserId(7);
      expect(ctx).toEqual({
        tenantId: 10,
        tenantRole: 'admin',
        tenantConnectionString: 'postgres://owner/db',
        tenantOwnerUserId: 7,
      });
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    test('returns null when no legacy, membership, or owner row', async () => {
      mockPool.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const ctx = await service.getTenantContextByUserId(999);
      expect(ctx).toBeNull();
    });
  });

  describe('getTenantPluginNames', () => {
    test('returns [] when no pool', async () => {
      service._getPool = () => null;
      const names = await service.getTenantPluginNames(1);
      expect(names).toEqual([]);
    });

    test('returns plugin names from tenant_plugin_access', async () => {
      mockPool.query.mockResolvedValueOnce([{ plugin_name: 'contacts' }, { plugin_name: 'notes' }]);
      const names = await service.getTenantPluginNames(10);
      expect(names).toEqual(['contacts', 'notes']);
    });

    test('falls back to user_plugin_access when tenant has no plugins', async () => {
      mockPool.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ plugin_name: 'settings' }]);
      const names = await service.getTenantPluginNames(10, 5);
      expect(names).toEqual(['settings']);
    });
  });
});
