// server/core/helpers/resolveTenantForUser.js
// Build tenant context on a synthetic request (same rules as tenant middleware in server/index.ts).

const ServiceManager = require('../ServiceManager');

/**
 * Apply Neon tenant pool or local (schema) context and initialize ServiceManager for this request.
 * @param {import('pg').Pool} mainPool - Main DB pool (tenants/memberships, etc.)
 * @param {object} req - Express-like request with canonical tenant session fields already set
 */
async function applyTenantContextToRequest(mainPool, req) {
  if (process.env.TENANT_PROVIDER === 'neon') {
    const conn = req.session?.tenantConnectionString;
    if (conn) {
      const connectionPool = ServiceManager.get('connectionPool');
      req.tenantPool = connectionPool.getTenantPool(conn);
    } else {
      req.tenantPool = undefined;
    }
  } else {
    // local: schema-per-tenant uses per-query SET LOCAL search_path.
    req.tenantPool = undefined;
  }

  ServiceManager.initialize(req);
}

module.exports = { applyTenantContextToRequest };
