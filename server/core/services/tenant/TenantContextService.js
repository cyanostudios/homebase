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

  _rows(result) {
    return result?.rows ?? (Array.isArray(result) ? result : []);
  }

  /**
   * Get tenant context for a user (by membership or as owner).
   * Tries legacy query first so login works even when tenant_memberships/owner_user_id do not exist.
   * @param {number} userId - Logged-in user id
   * @returns {Promise<{ tenantId: number, tenantRole: string, tenantConnectionString: string, tenantOwnerUserId: number }|null>}
   */
  async getTenantContextByUserId(userId) {
    const db = this._getPool();
    if (!db || !db.query) return null;

    // 1) Legacy first: tenants by user_id only (no tenant_memberships / owner_user_id required)
    try {
      const legacy = await db.query(
        'SELECT id, neon_connection_string, user_id FROM tenants WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      const rows = this._rows(legacy);
      if (rows.length && rows[0].neon_connection_string) {
        return {
          tenantId: rows[0].id,
          tenantRole: 'admin',
          tenantConnectionString: rows[0].neon_connection_string,
          tenantOwnerUserId: rows[0].user_id,
        };
      }
    } catch (e) {
      this.logger.warn('Legacy tenant lookup failed', { userId, message: e.message });
    }

    // 2) With membership (tenant_memberships + tenants)
    try {
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
      const membershipRows = this._rows(withMembership);
      if (membershipRows.length && membershipRows[0].neon_connection_string) {
        return {
          tenantId: membershipRows[0].tenant_id,
          tenantRole: membershipRows[0].role,
          tenantConnectionString: membershipRows[0].neon_connection_string,
          tenantOwnerUserId: membershipRows[0].owner_user_id,
        };
      }
    } catch {
      // tenant_memberships or owner_user_id may not exist
    }

    // 3) Owner fallback (tenants.user_id or owner_user_id)
    try {
      const asOwner = await db.query(
        `SELECT id, neon_connection_string, COALESCE(owner_user_id, user_id) AS owner_user_id
         FROM tenants
         WHERE user_id = $1 OR owner_user_id = $1
         LIMIT 1`,
        [userId],
      );
      const ownerRows = this._rows(asOwner);
      if (ownerRows.length && ownerRows[0].neon_connection_string) {
        return {
          tenantId: ownerRows[0].id,
          tenantRole: 'admin',
          tenantConnectionString: ownerRows[0].neon_connection_string,
          tenantOwnerUserId: ownerRows[0].owner_user_id,
        };
      }
    } catch {
      // owner_user_id column may not exist
    }

    // 4) Local provider: no row in tenants (e.g. admin from setup-database). Create schema on first login if needed.
    const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
    if (tenantProvider === 'local') {
      try {
        const tenantService = ServiceManager.get('tenant');
        const exists = await tenantService.tenantExists(userId);
        if (!exists) {
          this.logger.info('Creating local tenant schema on first login', { userId });
          const userRow = await db.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [userId]);
          const email = this._rows(userRow)[0]?.email || '';
          try {
            await tenantService.createTenant(userId, email);
          } catch (createErr) {
            this.logger.warn('createTenant failed, will try getTenantConnection anyway', {
              userId,
              message: createErr.message,
            });
            // Schema might already exist (e.g. from setup-database or previous partial run)
          }
        }
        const connectionString = await tenantService.getTenantConnection(userId);
        if (connectionString) {
          return {
            tenantId: userId,
            tenantRole: 'admin',
            tenantConnectionString: connectionString,
            tenantOwnerUserId: userId,
          };
        }
      } catch (e) {
        this.logger.warn('Local tenant resolve failed', { userId, message: e.message });
      }
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
      const list = this._rows(byTenant);
      if (list.length) return list.map((r) => r.plugin_name);
    } catch {
      // tenant_plugin_access may not exist before migration
    }

    if (ownerUserId) {
      try {
        const byUser = await db.query(
          'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
          [ownerUserId],
        );
        const list = this._rows(byUser);
        return list.map((r) => r.plugin_name);
      } catch (e) {
        this.logger.warn('user_plugin_access lookup failed', { ownerUserId, message: e.message });
      }
    }
    return [];
  }
}

module.exports = TenantContextService;
