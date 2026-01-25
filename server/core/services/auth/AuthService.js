// server/core/services/auth/AuthService.js
const bcrypt = require('bcrypt');
const ServiceManager = require('../../ServiceManager');
const UserService = require('../user/UserService');
const { DEFAULT_AVAILABLE_PLUGINS, DEFAULT_USER_PLUGINS } = require('../../config/constants');

class AuthService {
  constructor() {
    this.userService = new UserService();
    this.logger = ServiceManager.get('logger');
    this.tenantService = ServiceManager.get('tenant');
  }

  /**
   * Login user
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    this.logger.info('Login attempt', { email });

    const user = await this.userService.findByEmail(email);

    if (!user) {
      this.logger.warn('Login failed: User not found', { email });
      return null;
    }

    this.logger.info('User found', { userId: user.id, email: user.email });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      this.logger.warn('Login failed: Invalid password', { userId: user.id, email: user.email });
      return null;
    }

    this.logger.info('Password validated', { userId: user.id });

    // Get plugins
    const plugins = await this.userService.getPluginAccess(user.id);

    // Get tenant
    // We access the main db via userService's pool mechanism implicitly or explicit query
    // The previous code queried 'tenants' table from main pool.
    // TenantService usually handles provisioning but maybe not simple lookup?
    // Let's use a direct query here via UserService's db access or similar.
    // Actually, TenantService should probably have a method to get tenant info.
    // But for now, let's keep it consistent with the "Refactor" scope: move logic to Service.

    // Note: In a cleaner architecture, TenantService would handle all tenant lookups.
    // But since TenantService in `ServiceManager` seems to return a Provider instance...
    // Let's assume we can query it.

    let tenantConnectionString;
    try {
      const db = this.userService._getPool();
      this.logger.info('Querying tenant database', {
        userId: user.id,
        dbType: db.constructor?.name,
      });

      // Query without userId context to avoid tenant filtering on system tables
      const tenantResult = await db.query(
        'SELECT neon_connection_string FROM tenants WHERE user_id = $1',
        [user.id],
        {}, // Empty context to avoid tenant filtering
      );

      this.logger.info('Tenant query result', {
        userId: user.id,
        resultType: typeof tenantResult,
        isArray: Array.isArray(tenantResult),
        length: tenantResult?.length,
      });

      // PostgreSQLAdapter.query() returns rows directly (array), not {rows: [...]}
      if (!tenantResult || tenantResult.length === 0) {
        this.logger.error('No tenant database found', null, { userId: user.id, email: user.email });
        throw new Error('Tenant database not configured');
      }

      tenantConnectionString = tenantResult[0].neon_connection_string;

      if (!tenantConnectionString) {
        this.logger.error('Tenant connection string is null/undefined', null, { userId: user.id });
        throw new Error('Tenant database connection string is missing');
      }

      this.logger.info('Tenant database found', {
        userId: user.id,
        hasConnectionString: !!tenantConnectionString,
      });
    } catch (error) {
      this.logger.error('Error querying tenant database', error, {
        userId: user.id,
        email: user.email,
      });
      throw error;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins,
      },
      tenantConnectionString,
    };
  }

  /**
   * Signup new user
   * @param {Object} data
   */
  async signup({ email, password, plugins }) {
    // Validate inputs
    if (!email || !password) throw new Error('Email and password required');
    if (password.length < 8) throw new Error('Password must be at least 8 characters');

    // Check existing
    const existing = await this.userService.findByEmail(email);
    if (existing) throw new Error('Email already registered');

    // Filter plugins
    // Check against CONSTANTS instead of hardcoded list
    // Fallback logic from previous code:
    // If plugins provided, validate them. If not, use defaults.

    let selectedPlugins = DEFAULT_USER_PLUGINS;

    if (plugins && Array.isArray(plugins) && plugins.length > 0) {
      const invalidPlugins = plugins.filter((p) => !DEFAULT_AVAILABLE_PLUGINS.includes(p));
      if (invalidPlugins.length > 0) {
        const error = new Error(`Invalid plugins: ${invalidPlugins.join(', ')}`);
        error.availablePlugins = DEFAULT_AVAILABLE_PLUGINS;
        throw error;
      }
      selectedPlugins = plugins;
    }

    // Create user
    const user = await this.userService.createUser({ email, password });

    // Create tenant
    this.logger.info('Creating tenant database', { userId: user.id });
    const tenantDb = await this.tenantService.createTenant(user.id, user.email);

    // Save tenant info
    const db = this.userService._getPool();
    await db.query(
      'INSERT INTO tenants (user_id, neon_project_id, neon_database_name, neon_connection_string) VALUES ($1, $2, $3, $4)',
      [user.id, tenantDb.projectId, tenantDb.databaseName, tenantDb.connectionString],
    );

    // Grant plugins
    await this.userService.grantPluginAccess(user.id, selectedPlugins);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: selectedPlugins,
      },
      tenantDb,
    };
  }
}

module.exports = AuthService;
