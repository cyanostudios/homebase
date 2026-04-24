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
