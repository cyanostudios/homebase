// server/core/services/auth/AuthService.js
const bcrypt = require('bcrypt');
const ServiceManager = require('../../ServiceManager');
const UserService = require('../user/UserService');
const TenantContextService = require('../tenant/TenantContextService');
const { DEFAULT_AVAILABLE_PLUGINS, DEFAULT_USER_PLUGINS } = require('../../config/constants');

class AuthService {
  constructor() {
    this.userService = new UserService();
    this.tenantContextService = new TenantContextService();
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

    let tenantContext;
    try {
      tenantContext = await this.tenantContextService.getTenantContextByUserId(user.id);
    } catch (err) {
      this.logger.warn('Tenant context lookup failed', { userId: user.id, message: err.message });
      tenantContext = null;
    }

    // NOTE: Local/Neon tenant resolution is handled in TenantContextService.
    // AuthService should not duplicate tenant provisioning logic.

    if (!tenantContext || !tenantContext.tenantConnectionString) {
      const isLocal =
        process.env.TENANT_PROVIDER === 'local' ||
        (process.env.DATABASE_URL && !process.env.NEON_API_KEY);
      this.logger.error('No tenant database found', null, {
        userId: user.id,
        email: user.email,
        hasTenantContext: !!tenantContext,
        isLocalTenant: isLocal,
        hasTenantService: !!(
          this.tenantService && typeof this.tenantService.tenantExists === 'function'
        ),
        DATABASE_URL_set: !!process.env.DATABASE_URL,
        TENANT_PROVIDER: process.env.TENANT_PROVIDER || '(unset)',
        NEON_API_KEY_set: !!process.env.NEON_API_KEY,
      });
      throw new Error('Tenant database not configured');
    }

    let plugins = [];
    try {
      plugins = await this.tenantContextService.getTenantPluginNames(
        tenantContext.tenantId,
        tenantContext.tenantOwnerUserId,
      );
    } catch (err) {
      this.logger.warn('Tenant plugins lookup failed, using user plugins', { userId: user.id });
      plugins = await this.userService.getPluginAccess(user.id);
    }
    if (!plugins || !plugins.length) {
      plugins = await this.userService.getPluginAccess(user.id);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: plugins || [],
      },
      tenantConnectionString: tenantContext.tenantConnectionString,
      tenantId: tenantContext.tenantId,
      tenantRole: tenantContext.tenantRole,
      tenantOwnerUserId: tenantContext.tenantOwnerUserId,
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

    const db = this.userService._getPool();
    // Insert tenant (owner_user_id for multi-user; keep user_id for backward compat)
    const insertTenantSql = `
      INSERT INTO tenants (user_id, owner_user_id, neon_project_id, neon_database_name, neon_connection_string)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const tenantRows = await db.query(insertTenantSql, [
      user.id,
      user.id,
      tenantDb.projectId,
      tenantDb.databaseName,
      tenantDb.connectionString,
    ]);
    const tenantId = tenantRows[0]?.id;
    if (!tenantId) throw new Error('Failed to create tenant row');

    // Membership: owner is admin
    await db.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
       VALUES ($1, $2, 'admin', 'active', $2)`,
      [tenantId, user.id],
    );

    // Tenant plugin access (shared for all members)
    for (const pluginName of selectedPlugins) {
      await db.query(
        `INSERT INTO tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (tenant_id, plugin_name) DO NOTHING`,
        [tenantId, pluginName, user.id],
      );
    }

    // Legacy: keep user_plugin_access for backward compat until requirePlugin is switched
    await this.userService.grantPluginAccess(user.id, selectedPlugins);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: selectedPlugins,
      },
      tenantDb: { ...tenantDb, tenantId },
    };
  }
}

module.exports = AuthService;
