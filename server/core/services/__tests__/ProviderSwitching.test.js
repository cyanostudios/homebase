// server/core/services/__tests__/ProviderSwitching.test.js
// Test that provider switching works correctly

const ServiceManager = require('../../ServiceManager');

describe('Provider Switching', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Reset ServiceManager
    ServiceManager.reset();
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
  });

  describe('TenantService Provider Switching', () => {
    test('should load NeonTenantProvider when TENANT_PROVIDER=neon', () => {
      process.env.TENANT_PROVIDER = 'neon';
      process.env.NEON_API_KEY = 'test-key';

      ServiceManager.initialize();
      const tenantService = ServiceManager.get('tenant');

      expect(tenantService).toBeDefined();
      expect(tenantService.constructor.name).toBe('NeonTenantProvider');
    });

    test('should load LocalTenantProvider when TENANT_PROVIDER=local', () => {
      process.env.TENANT_PROVIDER = 'local';
      process.env.DATABASE_URL = 'postgresql://localhost/test';

      ServiceManager.initialize();
      const tenantService = ServiceManager.get('tenant');

      expect(tenantService).toBeDefined();
      expect(tenantService.constructor.name).toBe('LocalTenantProvider');
    });

    test('should default to neon provider if not specified', () => {
      delete process.env.TENANT_PROVIDER;
      process.env.NEON_API_KEY = 'test-key';

      ServiceManager.initialize();
      const tenantService = ServiceManager.get('tenant');

      expect(tenantService).toBeDefined();
      expect(tenantService.constructor.name).toBe('NeonTenantProvider');
    });
  });

  describe('ConnectionPoolService Provider Switching', () => {
    test('should load PostgresPoolProvider when POOL_PROVIDER=postgres', () => {
      process.env.POOL_PROVIDER = 'postgres';

      ServiceManager.initialize();
      const poolService = ServiceManager.get('connectionPool');

      expect(poolService).toBeDefined();
      expect(poolService.constructor.name).toBe('PostgresPoolProvider');
    });

    test('should default to postgres provider if not specified', () => {
      delete process.env.POOL_PROVIDER;

      ServiceManager.initialize();
      const poolService = ServiceManager.get('connectionPool');

      expect(poolService).toBeDefined();
      expect(poolService.constructor.name).toBe('PostgresPoolProvider');
    });
  });

  describe('Service Interface Compliance', () => {
    test('TenantService should have all required methods', () => {
      process.env.TENANT_PROVIDER = 'local';
      process.env.DATABASE_URL = 'postgresql://localhost/test';

      ServiceManager.initialize();
      const tenantService = ServiceManager.get('tenant');

      expect(typeof tenantService.createTenant).toBe('function');
      expect(typeof tenantService.deleteTenant).toBe('function');
      expect(typeof tenantService.getTenantConnection).toBe('function');
      expect(typeof tenantService.listTenants).toBe('function');
      expect(typeof tenantService.tenantExists).toBe('function');
      expect(typeof tenantService.getTenantMetadata).toBe('function');
    });

    test('ConnectionPoolService should have all required methods', () => {
      process.env.POOL_PROVIDER = 'postgres';

      ServiceManager.initialize();
      const poolService = ServiceManager.get('connectionPool');

      expect(typeof poolService.getTenantPool).toBe('function');
      expect(typeof poolService.closeTenantPool).toBe('function');
      expect(typeof poolService.closeAllPools).toBe('function');
      expect(typeof poolService.getPoolStats).toBe('function');
      expect(typeof poolService.cleanupInactivePools).toBe('function');
      expect(typeof poolService.hasPool).toBe('function');
    });
  });
});
