// server/core/ServiceManager.js
// Central service manager for all core services

const { Pool } = require('pg');
const ConsoleAdapter = require('./services/logger/adapters/ConsoleAdapter');
const PostgreSQLAdapter = require('./services/database/adapters/PostgreSQLAdapter');

class ServiceManager {
  constructor(config = {}) {
    this.config = config;
    this.services = {};
    this.initialized = false;
  }

  /**
   * Initialize all services
   */
  initialize(req = null) {
    if (this.initialized && !req) {
      return; // Already initialized for global context
    }

    // Logger service (always available)
    if (!this.services.logger) {
      const loggerConfig = this.config.logger || { provider: 'console' };
      this.services.logger = this._initLogger(loggerConfig);
    }

    // Tenant service (for tenant provisioning)
    if (!this.services.tenant) {
      this.services.tenant = this._initTenantService();
    }

    // Connection pool service (for pool management)
    if (!this.services.connectionPool) {
      this.services.connectionPool = this._initConnectionPoolService();
    }

    // Database service (requires request context for tenant pool)
    if (req) {
      if (!this.services.database?._isTestOverride) {
        this.services.database = this._initDatabase(req);
      }
    } else if (!this.services.database) {
      // Global database service (for system operations)
      this.services.database = this._initDatabase(null);
    }

    // Email service (always available)
    if (!this.services.email) {
      const emailConfig = this.config.email || {};
      this.services.email = this._initEmailService(emailConfig);
    }

    this.initialized = true;
  }

  /**
   * Initialize logger service
   */
  _initLogger(config) {
    const provider = config.provider || 'console';

    switch (provider) {
      case 'console':
        return new ConsoleAdapter(config.console || {});
      default:
        throw new Error(`Unknown logger provider: ${provider}`);
    }
  }

  /**
   * Initialize tenant service
   */
  _initTenantService() {
    const provider =
      this.config.tenant?.provider ||
      process.env.TENANT_PROVIDER ||
      (process.env.NEON_API_KEY ? 'neon' : 'local');
    const logger = this.services.logger || new ConsoleAdapter();

    let TenantProvider;
    try {
      TenantProvider = require(
        `./services/tenant/providers/${this._capitalize(provider)}TenantProvider`,
      );
    } catch (error) {
      logger.error(`Failed to load tenant provider '${provider}':`, error);
      throw new Error(`Unknown tenant provider: ${provider}`);
    }

    const config = {
      ...this.config.tenant?.[provider],
      mainPool: this._getDefaultPool(), // Provide main pool for metadata queries
    };

    logger.info(`Initializing tenant service with provider: ${provider}`);
    return new TenantProvider(config);
  }

  /**
   * Initialize connection pool service
   */
  _initConnectionPoolService() {
    const provider =
      this.config.connectionPool?.provider || process.env.POOL_PROVIDER || 'postgres';
    const logger = this.services.logger || new ConsoleAdapter();

    try {
      const PoolProvider = require(
        `./services/connection-pool/providers/${this._capitalize(provider)}PoolProvider`,
      );
      const config = this.config.connectionPool?.[provider] || {};

      logger.info(`Initializing connection pool service with provider: ${provider}`);
      return new PoolProvider(config);
    } catch (error) {
      logger.error(`Failed to load connection pool provider '${provider}':`, error);
      throw new Error(`Unknown connection pool provider: ${provider}`);
    }
  }

  /**
   * Initialize email service
   */
  _initEmailService(config) {
    const provider = config.provider || process.env.EMAIL_PROVIDER || 'smtp';

    switch (provider) {
      case 'smtp':
        const SmtpAdapter = require('./services/email/adapters/SmtpAdapter');
        return new SmtpAdapter(config);
      case 'resend':
        const ResendAdapter = require('./services/email/adapters/ResendAdapter');
        return new ResendAdapter(config);
      default:
        throw new Error(`Unknown email provider: ${provider}`);
    }
  }

  /**
   * Initialize database service
   */
  _initDatabase(req) {
    const provider = this.config.database?.provider || 'postgres';
    const logger = this.services.logger || new ConsoleAdapter();

    switch (provider) {
      case 'postgres':
        // Use tenant pool from request if available, otherwise use default pool
        const pool = req?.tenantPool || this._getDefaultPool();
        return new PostgreSQLAdapter(pool, logger);
      default:
        throw new Error(`Unknown database provider: ${provider}`);
    }
  }

  /**
   * Get default database pool
   */
  _getDefaultPool() {
    if (!this._defaultPool) {
      const { Pool } = require('pg');
      this._defaultPool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }
    return this._defaultPool;
  }

  /**
   * Get a service by name
   * @param {string} serviceName - Name of the service
   * @param {Object} req - Optional request object for tenant context
   */
  get(serviceName, req = null) {
    // Initialize if needed
    if (!this.initialized || (req && serviceName === 'database')) {
      this.initialize(req);
    }

    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    // For database service, ensure it has the correct tenant context
    if (serviceName === 'database' && req) {
      // When overridden for testing (e.g. MockAdapter), return it directly
      if (service && service._isTestOverride) {
        return service;
      }
      return this._initDatabase(req);
    }

    return service;
  }

  /**
   * Override a service (useful for testing)
   */
  override(serviceName, service) {
    this.services[serviceName] = service;
  }

  /**
   * Reset all services (useful for testing)
   */
  reset() {
    this.services = {};
    this.initialized = false;
  }

  /**
   * Capitalize first letter of string
   * @private
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Graceful shutdown - close all services
   */
  async shutdown() {
    const logger = this.services.logger;

    if (logger) {
      logger.info('Shutting down ServiceManager...');
    }

    // Close connection pool service
    if (this.services.connectionPool) {
      await this.services.connectionPool.closeAllPools();
    }

    // Close default pool
    if (this._defaultPool) {
      await this._defaultPool.end();
      if (logger) {
        logger.info('Main auth pool closed');
      }
    }

    if (logger) {
      logger.info('ServiceManager shutdown complete');
    }
  }
}

// Create singleton instance
const serviceManager = new ServiceManager({
  database: {
    provider: process.env.DATABASE_PROVIDER || 'postgres',
  },
  logger: {
    provider: process.env.LOGGER_PROVIDER || 'console',
    console: {
      level: process.env.LOG_LEVEL || 'info',
      enableColors: process.env.NODE_ENV !== 'production',
    },
  },
  tenant: {
    provider: process.env.TENANT_PROVIDER || 'neon',
    neon: {
      apiKey: process.env.NEON_API_KEY,
      region: process.env.NEON_REGION || 'aws-eu-central-1',
    },
    local: {
      connectionString: process.env.DATABASE_URL,
    },
  },
  connectionPool: {
    provider: process.env.POOL_PROVIDER || 'postgres',
    postgres: {
      max: parseInt(process.env.POOL_MAX_SIZE || '10'),
      idleTimeoutMillis: parseInt(process.env.POOL_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.POOL_CONNECTION_TIMEOUT || '2000'),
      cleanupInterval: parseInt(process.env.POOL_CLEANUP_INTERVAL || '3600000'), // 1 hour
      maxPoolAge: parseInt(process.env.POOL_MAX_AGE || '86400000'), // 24 hours
    },
  },
  email: (() => {
    try {
      const config = require('../../config/services');
      return config.email || { provider: 'smtp' };
    } catch {
      return { provider: process.env.EMAIL_PROVIDER || 'smtp' };
    }
  })(),
});

module.exports = serviceManager;
