// server/core/services/team/TeamService.js
// Tenant-scoped member management: list, add, update role, remove.
// Uses main DB pool (tenant_memberships, users) not tenant DB.

const ServiceManager = require('../../ServiceManager');
const UserService = require('../user/UserService');
const { TENANT_ROLES } = require('../../config/constants');

class TeamService {
  constructor(mainPool = null) {
    this.mainPool = mainPool;
    this.userService = new UserService();
    this.logger = ServiceManager.get('logger');
  }

  _getPool() {
    if (this.mainPool) return this.mainPool;
    return this.userService._getPool();
  }

  /**
   * List members of a tenant
   * @param {number} tenantId
   * @returns {Promise<Array<{ id: number, email: string, role: string, status: string, created_at: Date }>>}
   */
  async listMembers(tenantId) {
    const db = this._getPool();
    const result = await db.query(
      `SELECT tm.user_id AS id, u.email, tm.role, tm.status, tm.created_at
       FROM tenant_memberships tm
       INNER JOIN users u ON u.id = tm.user_id
       WHERE tm.tenant_id = $1
       ORDER BY tm.role DESC, u.email`,
      [tenantId],
    );
    const list = result?.rows ?? (Array.isArray(result) ? result : []);
    return list.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      status: r.status,
      created_at: r.created_at,
    }));
  }

  /**
   * Add a user to the tenant (create user if new, then add membership).
   * Caller must ensure email is not already in this tenant.
   * @param {number} tenantId
   * @param {number} createdByUserId
   * @param {{ email: string, password: string, role: string }} data
   */
  async addMember(tenantId, createdByUserId, { email, password, role }) {
    const db = this._getPool();
    const roleVal = role && Object.values(TENANT_ROLES).includes(role) ? role : TENANT_ROLES.USER;

    let user = await this.userService.findByEmail(email);
    if (!user) {
      if (!password || password.length < 8) {
        throw new Error('Password required (min 8 characters) for new user');
      }
      user = await this.userService.createUser({ email, password, role: 'user' });
    }

    const existing = await db.query(
      'SELECT 1 FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, user.id],
    );
    const exists = (existing?.rows?.length ?? (Array.isArray(existing) ? existing.length : 0)) > 0;
    if (exists) {
      throw new Error('User is already a member of this tenant');
    }

    await db.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
       VALUES ($1, $2, $3, 'active', $4)`,
      [tenantId, user.id, roleVal, createdByUserId],
    );

    return {
      id: user.id,
      email: user.email,
      role: roleVal,
      status: 'active',
    };
  }

  /**
   * Update a member's tenant role.
   * Prevents downgrading the last admin – there must always be at least one admin for the account.
   * @param {number} tenantId
   * @param {number} userId - member to update
   * @param {string} role - new role
   */
  async updateMemberRole(tenantId, userId, role) {
    if (!Object.values(TENANT_ROLES).includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${Object.values(TENANT_ROLES).join(', ')}`);
    }
    const db = this._getPool();

    const memberRow = await db.query(
      'SELECT role FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId],
    );
    const memberRows = memberRow?.rows ?? (Array.isArray(memberRow) ? memberRow : []);
    if (!memberRows.length) {
      throw new Error('Member not found in this tenant');
    }

    const currentRole = memberRows[0].role;
    if (currentRole === 'admin' && role !== 'admin') {
      const countResult = await db.query(
        "SELECT COUNT(*) AS n FROM tenant_memberships WHERE tenant_id = $1 AND role = 'admin'",
        [tenantId],
      );
      const countRows = countResult?.rows ?? (Array.isArray(countResult) ? countResult : []);
      const adminCount = parseInt(countRows[0]?.n ?? countRows[0]?.count ?? '0', 10);
      if (adminCount <= 1) {
        throw new Error(
          'Cannot change the last admin to another role. There must always be at least one admin for the account.',
        );
      }
    }

    const result = await db.query(
      'UPDATE tenant_memberships SET role = $1 WHERE tenant_id = $2 AND user_id = $3 RETURNING user_id',
      [role, tenantId, userId],
    );
    const rows = result?.rows ?? (Array.isArray(result) ? result : []);
    if (!rows.length) {
      throw new Error('Member not found in this tenant');
    }
    return { userId, role };
  }

  /**
   * Remove a member from the tenant (delete membership only; user remains in users table).
   * Prevents removing the last admin – there must always be at least one admin for the account.
   * @param {number} tenantId
   * @param {number} userId
   */
  async removeMember(tenantId, userId) {
    const db = this._getPool();

    const memberRow = await db.query(
      'SELECT role FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId],
    );
    const memberRows = memberRow?.rows ?? (Array.isArray(memberRow) ? memberRow : []);
    if (!memberRows.length) {
      throw new Error('Member not found in this tenant');
    }

    if (memberRows[0].role === 'admin') {
      const countResult = await db.query(
        "SELECT COUNT(*) AS n FROM tenant_memberships WHERE tenant_id = $1 AND role = 'admin'",
        [tenantId],
      );
      const countRows = countResult?.rows ?? (Array.isArray(countResult) ? countResult : []);
      const adminCount = parseInt(countRows[0]?.n ?? countRows[0]?.count ?? '0', 10);
      if (adminCount <= 1) {
        throw new Error(
          'Cannot remove the last admin. There must always be at least one admin for the account.',
        );
      }
    }

    const result = await db.query(
      'DELETE FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2 RETURNING user_id',
      [tenantId, userId],
    );
    const rows = result?.rows ?? (Array.isArray(result) ? result : []);
    if (!rows.length) {
      throw new Error('Member not found in this tenant');
    }
    return { userId };
  }
}

module.exports = TeamService;
