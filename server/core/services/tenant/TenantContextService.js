// server/core/services/tenant/TenantContextService.js
// Canonical tenant context resolution (no legacy fallbacks).
//
// Resolves:
// - tenantId (public.tenants.id)
// - tenantRole (from tenant_memberships.role)
// - tenantOwnerUserId (public.tenants.owner_user_id)
// - tenantConnectionString (for TENANT_PROVIDER=neon; for local it's not required)
// - tenantSchemaName (for TENANT_PROVIDER=local search_path routing)

class TenantContextService {
  /**
   * @param {import('pg').Pool} mainPool - Main DB pool (public schema)
   * @param {object} [opts]
   * @param {object} [opts.logger]
   */
  constructor(mainPool, opts = {}) {
    if (!mainPool || typeof mainPool.query !== 'function') {
      throw new Error('TenantContextService requires a mainPool with query()');
    }
    this.pool = mainPool;
    this.logger = opts.logger;
  }

  /**
   * Resolve tenant context for a user by membership.
   * One user belongs to exactly one tenant (UNIQUE(user_id) in tenant_memberships).
   * @param {number} userId
   * @returns {Promise<{tenantId:number, tenantRole:string, tenantOwnerUserId:number, tenantConnectionString:(string|null), tenantSchemaName:(string|null)}|null>}
   */
  async getTenantContextByUserId(userId) {
    if (!userId) return null;

    const r = await this.pool.query(
      `SELECT
         tm.tenant_id,
         tm.role,
         t.owner_user_id,
         t.neon_connection_string,
         t.neon_database_name
       FROM public.tenant_memberships tm
       INNER JOIN public.tenants t ON t.id = tm.tenant_id
       WHERE tm.user_id = $1 AND tm.status = 'active'
       LIMIT 1`,
      [userId],
    );

    if (!r.rows?.length) return null;
    const row = r.rows[0];

    return {
      tenantId: row.tenant_id,
      tenantRole: row.role,
      tenantOwnerUserId: row.owner_user_id,
      tenantConnectionString: row.neon_connection_string || null,
      tenantSchemaName: row.neon_database_name || null,
    };
  }

  /**
   * Get enabled plugin names for a tenant.
   * @param {number} tenantId
   * @returns {Promise<string[]>}
   */
  async getTenantPluginNames(tenantId) {
    if (!tenantId) return [];
    const r = await this.pool.query(
      'SELECT plugin_name FROM public.tenant_plugin_access WHERE tenant_id = $1 AND enabled = true',
      [tenantId],
    );
    return (r.rows || []).map((x) => x.plugin_name);
  }
}

module.exports = TenantContextService;
