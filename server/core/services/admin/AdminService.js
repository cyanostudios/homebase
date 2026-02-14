// server/core/services/admin/AdminService.js
const ServiceManager = require('../../ServiceManager');
const UserService = require('../user/UserService');
const { USER_ROLES } = require('../../config/constants');

class AdminService {
  constructor() {
    this.userService = new UserService();
    this.logger = ServiceManager.get('logger');
  }

  /**
   * Update user role
   * @param {string} email
   * @param {string} role
   */
  async updateRole(email, role) {
    if (!Object.values(USER_ROLES).includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${Object.values(USER_ROLES).join(', ')}`);
    }

    return this.userService.updateRole(email, role);
  }

  /**
   * Get all tenants (by owner)
   */
  async getAllTenants() {
    const db = this.userService._getPool();
    const result = await db.query(`
      SELECT u.id, u.email, u.role, t.id AS tenant_id, t.neon_project_id, t.neon_database_name, t.neon_connection_string
      FROM users u
      INNER JOIN tenants t ON u.id = t.owner_user_id OR (t.owner_user_id IS NULL AND u.id = t.user_id)
      WHERE t.neon_connection_string IS NOT NULL
      ORDER BY u.id
    `);
    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows;
  }

  /**
   * Switch tenant for admin (resolve by owner/user_id)
   * @param {Object} adminUser
   * @param {string} targetUserId
   */
  async switchTenant(adminUser, targetUserId) {
    const db = this.userService._getPool();
    const tenantResult = await db.query(
      `SELECT id, neon_connection_string, COALESCE(owner_user_id, user_id) AS owner_user_id
       FROM tenants WHERE user_id = $1 OR owner_user_id = $1 LIMIT 1`,
      [targetUserId],
    );

    const rows = Array.isArray(tenantResult) ? tenantResult : tenantResult.rows || [];
    if (!rows.length) {
      throw new Error('Tenant not found');
    }

    const row = rows[0];
    const tenantConnectionString = row.neon_connection_string;
    const tenantId = row.id;
    const ownerUserId = row.owner_user_id;
    const dbHost = tenantConnectionString.split('@')[1]?.split('/')[0] || 'unknown';

    this.logger.info('Admin switched tenant', {
      adminId: adminUser.id,
      tenantUserId: targetUserId,
      tenantId,
      tenantDb: dbHost,
    });

    return {
      tenantConnectionString,
      targetUserId: ownerUserId ?? targetUserId,
      tenantId,
      tenantRole: 'admin',
      tenantOwnerUserId: ownerUserId ?? targetUserId,
      dbHost,
    };
  }

  /**
   * Delete tenant entry only
   * @param {string} adminId
   * @param {string} targetUserId
   */
  async deleteTenantEntry(adminId, targetUserId) {
    const db = this.userService._getPool();
    const user = await this.userService.findById(targetUserId);

    if (!user) {
      throw new Error('User not found');
    }

    const result = await db.query(
      'DELETE FROM tenants WHERE user_id = $1 OR owner_user_id = $1 RETURNING id',
      [targetUserId, targetUserId],
    );

    if (!result.rows.length) {
      throw new Error('Tenant entry not found');
    }

    this.logger.info('Admin deleted tenant entry', {
      adminId,
      tenantUserId: targetUserId,
      userEmail: user.email,
    });

    return {
      userId: targetUserId,
      email: user.email,
    };
  }

  /**
   * Delete user and all associated data
   * @param {string} adminId
   * @param {string} targetUserId
   */
  async deleteUser(adminId, targetUserId) {
    // UserService handles the cascading delete logic
    const result = await this.userService.deleteUser(targetUserId);

    if (!result) {
      throw new Error('User not found');
    }

    this.logger.info('Admin deleted user', {
      adminId,
      targetUserId,
    });

    return result;
  }
}

module.exports = AdminService;
