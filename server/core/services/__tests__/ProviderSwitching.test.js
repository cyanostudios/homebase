// server/core/services/__tests__/ProviderSwitching.test.js
// Test that provider switching works correctly

const ServiceManager = require('../../ServiceManager');

const ENV_KEYS = ['TENANT_PROVIDER', 'NEON_API_KEY', 'DATABASE_URL', 'POOL_PROVIDER'];

describe('Provider Switching', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) {
      if (process.env[k] !== undefined) savedEnv[k] = process.env[k];
    }
    ServiceManager.reset();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
      else delete process.env[k];
    }
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

    test.skip('should load LocalTenantProvider when TENANT_PROVIDER=local', () => {
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
    test.skip('should load PostgresPoolProvider when POOL_PROVIDER=postgres', () => {
      process.env.TENANT_PROVIDER = 'local';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.POOL_PROVIDER = 'postgres';

      ServiceManager.initialize();
      const poolService = ServiceManager.get('connectionPool');

      expect(poolService).toBeDefined();
      expect(poolService.constructor.name).toBe('PostgresPoolProvider');
    });

    test.skip('should default to postgres provider if not specified', () => {
      process.env.TENANT_PROVIDER = 'local';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      delete process.env.POOL_PROVIDER;

      ServiceManager.initialize();
      const poolService = ServiceManager.get('connectionPool');

      expect(poolService).toBeDefined();
      expect(poolService.constructor.name).toBe('PostgresPoolProvider');
    });
  });

  describe('Service Interface Compliance', () => {
    test.skip('TenantService should have all required methods', () => {
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

    test.skip('ConnectionPoolService should have all required methods', () => {
      process.env.TENANT_PROVIDER = 'local';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
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
