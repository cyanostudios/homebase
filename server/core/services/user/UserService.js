// server/core/services/user/UserService.js
const bcrypt = require('bcrypt');
const ServiceManager = require('../../ServiceManager');
const { USER_ROLES } = require('../../config/constants');

class UserService {
  constructor() {
    this.logger = ServiceManager.get('logger');
    // We get the pool dynamically because it might depend on context,
    // but for user management it's usually the main pool.
    // However, ServiceManager.get('database') returns an adapter, not the raw pool.
    // The previous code used a raw pool passed into setupAuthRoutes.
    // connectPool service is what we probably want for raw system queries
    // or we use the database service if it supports general queries.
    // Looking at ServiceManager, it has connectionPool service.
    // But `auth.js` was using `pool` passed from index.js.
  }

  /**
   * Get the main system database pool
   */
  _getPool() {
    // In the current architecture, the 'database' service is an adapter (PostgreSQLAdapter).
    // The 'connectionPool' service manages pools.
    // We generally need a simple query interface.
    // Let's assume we can get the default pool via ServiceManager or pass it in.
    // For now, let's use the 'database' service (PostgreSQLAdapter) which should support query().
    // We need to ensure we are using the MAIN system database, not a tenant database.

    // ServiceManager.get('database') might return a tenant-scoped adapter if initialized with req.
    // We want the global system DB.

    try {
      // Trying to get global database instance (initialized without req)
      const db = ServiceManager.get('database');
      return db;
    } catch (e) {
      // If not initialized, force initialize for global context
      ServiceManager.initialize();
      return ServiceManager.get('database');
    }
  }

  /**
   * Find user by email
   * @param {string} email
   */
  async findByEmail(email) {
    const db = this._getPool();
    // PostgreSQLAdapter.query() returns rows directly (array), not {rows: [...]}
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result && result.length > 0 ? result[0] : undefined;
  }

  /**
   * Find user by ID
   * @param {string} id
   */
  async findById(id) {
    const db = this._getPool();
    // PostgreSQLAdapter.query() returns rows directly (array), not {rows: [...]}
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result && result.length > 0 ? result[0] : undefined;
  }

  /**
   * Create a new user
   * @param {Object} userData
   */
  async createUser({ email, password, role = USER_ROLES.USER }) {
    const db = this._getPool();

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // PostgreSQLAdapter.query() returns rows directly (array), not {rows: [...]}
    const result = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, passwordHash, role],
    );

    const user = result && result.length > 0 ? result[0] : null;
    this.logger.info('User created', { userId: user.id, email: user.email });
    return user;
  }

  /**
   * Update user role
   * @param {string} email
   * @param {string} role
   */
  async updateRole(email, role) {
    const db = this._getPool();
    await db.query('UPDATE users SET role = $1 WHERE email = $2', [role, email]);
    return this.findByEmail(email);
  }

  /**
   * Delete user
   * @param {string} id
   */
  async deleteUser(id) {
    const db = this._getPool();

    // Note: Transaction management would be ideal here if we could.
    // For now keeping it simple as per previous implementation but in a service.

    // Delete from user_plugin_access
    await db.query('DELETE FROM user_plugin_access WHERE user_id = $1', [id]);

    // Delete from tenants
    await db.query('DELETE FROM tenants WHERE user_id = $1', [id]);

    // Delete from users
    // PostgreSQLAdapter.query() returns rows directly (array), not {rows: [...]}
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING email', [id]);

    return result && result.length > 0 ? result[0] : undefined;
  }

  /**
   * Get user's plugin access
   * @param {string} userId
   */
  async getPluginAccess(userId) {
    const db = this._getPool();
    // PostgreSQLAdapter.query() returns rows directly (array), not {rows: [...]}
    const result = await db.query(
      'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
      [userId],
    );
    return result ? result.map((row) => row.plugin_name) : [];
  }

  /**
   * Grant plugin access
   * @param {string} userId
   * @param {string[]} plugins
   */
  async grantPluginAccess(userId, plugins) {
    const db = this._getPool();
    for (const pluginName of plugins) {
      await db.query(
        'INSERT INTO user_plugin_access (user_id, plugin_name, enabled) VALUES ($1, $2, true)',
        [userId, pluginName],
      );
    }
  }
}

module.exports = UserService;
