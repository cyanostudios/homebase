// server/core/services/tenant/TenantContextService.js
// Resolves tenant id, role, connection string, and owner from user id (membership or owner fallback).

const ServiceManager = require('../../ServiceManager');

class TenantContextService {
  constructor() {
    this.logger = ServiceManager.get('logger');
  }

  _getPool() {
    const UserService = require('../user/UserService');
    const us = new UserService();
    return us._getPool();
  }

  /**
   * Get tenant context for a user (by membership or as owner).
   * Works even when tenant_memberships/owner_user_id do not exist yet (legacy DB).
   * @param {number} userId - Logged-in user id
   * @returns {Promise<{ tenantId: number, tenantRole: string, tenantConnectionString: string, tenantOwnerUserId: number }|null>}
   */
  async getTenantContextByUserId(userId) {
    const db = this._getPool();
    if (!db || !db.query) return null;

    try {
      // 1) Prefer tenant_memberships (user belongs to a tenant)
      const withMembership = await db.query(
        `SELECT tm.tenant_id, tm.role,
                t.neon_connection_string,
                COALESCE(t.owner_user_id, t.user_id) AS owner_user_id
         FROM tenant_memberships tm
         INNER JOIN tenants t ON t.id = tm.tenant_id
         WHERE tm.user_id = $1 AND tm.status = 'active'
         LIMIT 1`,
        [userId],
      );

      const membershipRows =
        withMembership?.rows ?? (Array.isArray(withMembership) ? withMembership : []);
      if (membershipRows.length && membershipRows[0].neon_connection_string) {
        return {
          tenantId: membershipRows[0].tenant_id,
          tenantRole: membershipRows[0].role,
          tenantConnectionString: membershipRows[0].neon_connection_string,
          tenantOwnerUserId: membershipRows[0].owner_user_id,
        };
      }

      // 2) Fallback: user is tenant owner (tenants.user_id or owner_user_id)
      const asOwner = await db.query(
        `SELECT id, neon_connection_string, COALESCE(owner_user_id, user_id) AS owner_user_id
         FROM tenants
         WHERE user_id = $1 OR owner_user_id = $1
         LIMIT 1`,
        [userId],
      );

      const ownerRows = asOwner?.rows ?? (Array.isArray(asOwner) ? asOwner : []);
      if (ownerRows.length && ownerRows[0].neon_connection_string) {
        return {
          tenantId: ownerRows[0].id,
          tenantRole: 'admin',
          tenantConnectionString: ownerRows[0].neon_connection_string,
          tenantOwnerUserId: ownerRows[0].owner_user_id,
        };
      }
    } catch (err) {
      // Legacy DB: no tenant_memberships or owner_user_id yet
      this.logger.info('Tenant context fallback to legacy tenants lookup', {
        userId,
        reason: err.message?.slice(0, 80),
      });
    }

    // 3) Legacy: tenants by user_id only (no owner_user_id)
    try {
      const legacy = await db.query(
        'SELECT id, neon_connection_string, user_id FROM tenants WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      const rows = legacy?.rows ?? (Array.isArray(legacy) ? legacy : []);
      if (rows.length && rows[0].neon_connection_string) {
        return {
          tenantId: rows[0].id,
          tenantRole: 'admin',
          tenantConnectionString: rows[0].neon_connection_string,
          tenantOwnerUserId: rows[0].user_id,
        };
      }
    } catch (e) {
      this.logger.error('Legacy tenant lookup failed', e, { userId });
    }

    return null;
  }

  /**
   * Get enabled plugin names for a tenant (tenant_plugin_access). Fallback: user_plugin_access for owner.
   * Works when tenant_plugin_access table does not exist yet (legacy DB).
   * @param {number} tenantId
   * @param {number} [ownerUserId] - Used for fallback if tenant_plugin_access is empty or missing
   */
  async getTenantPluginNames(tenantId, ownerUserId) {
    const db = this._getPool();
    if (!db || !db.query) return [];

    try {
      const byTenant = await db.query(
        'SELECT plugin_name FROM tenant_plugin_access WHERE tenant_id = $1 AND enabled = true',
        [tenantId],
      );
      const list = byTenant?.rows ?? (Array.isArray(byTenant) ? byTenant : []);
      if (list.length) {
        return list.map((r) => r.plugin_name);
      }
    } catch (err) {
      // tenant_plugin_access may not exist before migration
    }

    if (ownerUserId) {
      try {
        const byUser = await db.query(
          'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
          [ownerUserId],
        );
        const list = byUser?.rows ?? (Array.isArray(byUser) ? byUser : []);
        return list.map((r) => r.plugin_name);
      } catch (e) {
        this.logger.warn('user_plugin_access lookup failed', { ownerUserId, message: e.message });
      }
    }
    return [];
  }
}

module.exports = TenantContextService;
