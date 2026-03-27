// scripts/scriptTenantContext.js
// Synthetic req.session for CLI scripts (same tenant fields as login).
// Requires DATABASE_URL and an active row in public.tenant_memberships for the user.

const { Pool } = require('pg');
const TenantContextService = require('../server/core/services/tenant/TenantContextService');
const { applyTenantContextToRequest } = require('../server/core/helpers/resolveTenantForUser');
const Bootstrap = require('../server/core/Bootstrap');

/**
 * @param {number} userId
 * @param {object} [opts]
 * @param {object} [opts.sessionExtra] merged into req.session (after canonical tenant fields)
 * @param {object} [opts.reqExtra] merged into req (e.g. body, query, params)
 * @returns {Promise<{ req: object, pool: import('pg').Pool }>}
 */
async function createScriptRequest(userId, opts = {}) {
  const { sessionExtra = {}, reqExtra = {} } = opts;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set (.env.local)');
  }

  Bootstrap.initializeServices();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tenantContextService = new TenantContextService(pool);
  const tenantContext = await tenantContextService.getTenantContextByUserId(userId);

  if (!tenantContext) {
    await pool.end().catch(() => {});
    throw new Error(
      `Tenant not resolved: no active tenant_membership for user_id=${userId}. ` +
        'Use a user that belongs to a tenant, or set PHASE1_PILOT_USER_ID.',
    );
  }

  const req = {
    session: {
      user: { id: userId },
      tenantId: tenantContext.tenantId,
      tenantRole: tenantContext.tenantRole,
      tenantOwnerUserId: tenantContext.tenantOwnerUserId,
      tenantConnectionString: tenantContext.tenantConnectionString || null,
      tenantSchemaName: tenantContext.tenantSchemaName || null,
      ...sessionExtra,
    },
    tenantPool: undefined,
    query: {},
    params: {},
    ...reqExtra,
  };

  await applyTenantContextToRequest(pool, req);
  return { req, pool };
}

module.exports = { createScriptRequest };
