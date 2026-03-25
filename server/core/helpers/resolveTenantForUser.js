// server/core/helpers/resolveTenantForUser.js
// Build tenant context on a synthetic request (same rules as tenant middleware in server/index.ts).

const ServiceManager = require('../ServiceManager');

/**
 * Apply Neon tenant pool or local (schema) context and initialize ServiceManager for this request.
 * @param {import('pg').Pool} mainPool - Auth DB pool (tenants table, user_plugin_access, …)
 * @param {object} req - Express-like request; must have session.user.id and session.currentTenantUserId set
 */
async function applyTenantContextToRequest(mainPool, req) {
  const tenantUserId = req.session?.currentTenantUserId;

  if (process.env.TENANT_PROVIDER === 'neon') {
    if (tenantUserId) {
      const connectionPool = ServiceManager.get('connectionPool');
      try {
        const r = await mainPool.query(
          'SELECT neon_connection_string FROM tenants WHERE user_id = $1 AND neon_connection_string IS NOT NULL LIMIT 1',
          [tenantUserId],
        );
        if (r.rows?.length && r.rows[0].neon_connection_string) {
          req.tenantPool = connectionPool.getTenantPool(r.rows[0].neon_connection_string);
        } else {
          req.tenantPool = undefined;
        }
      } catch {
        req.tenantPool = undefined;
      }
    } else {
      req.tenantPool = undefined;
    }
  } else {
    req.tenantPool = undefined;
  }

  ServiceManager.initialize(req);
}

module.exports = { applyTenantContextToRequest };
