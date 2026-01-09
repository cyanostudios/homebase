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

    // Database service (requires request context for tenant pool)
    if (req) {
      this.services.database = this._initDatabase(req);
    } else if (!this.services.database) {
      // Global database service (for system operations)
      this.services.database = this._initDatabase(null);
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
});

module.exports = serviceManager;
