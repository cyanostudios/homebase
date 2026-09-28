// Destroy Neon project / local schema, pools, share routes, and sessions for a tenant owner.
// Call while the tenants row still exists. Does not delete R2 objects.
const ServiceManager = require('../../ServiceManager');

/**
 * Normalize PostgreSQLAdapter (rows array) vs raw pg Pool ({ rows }) query results.
 * @param {unknown} result
 * @returns {object[]}
 */
function asRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * @param {number|string} ownerUserId - Platform user id that owns the tenant
 * @param {{ db?: { query: Function }, tenantService?: { deleteTenant: Function }, connectionPool?: { closeTenantPool?: Function }, logger?: { info?: Function, warn?: Function, error?: Function } }} [deps]
 */
async function teardownTenantInfrastructure(ownerUserId, deps = {}) {
  const db = deps.db || ServiceManager.get('database');
  const tenantService = deps.tenantService || ServiceManager.get('tenant');
  const connectionPool = deps.connectionPool || ServiceManager.get('connectionPool');
  const logger = deps.logger || ServiceManager.get('logger');

  const tenantRows = asRows(
    await db.query(
      `SELECT id, neon_project_id, neon_connection_string
       FROM tenants
       WHERE user_id = $1 OR owner_user_id = $1`,
      [ownerUserId],
    ),
  );

  if (tenantRows.length === 0) {
    logger?.info?.('No tenant row for teardown', { ownerUserId });
    return { skipped: true };
  }

  const tenant = tenantRows[0];
  const tenantId = tenant.id;
  const connectionString = tenant.neon_connection_string || null;
  const projectId = tenant.neon_project_id || null;

  if (connectionString && typeof connectionPool?.closeTenantPool === 'function') {
    try {
      await connectionPool.closeTenantPool(connectionString);
    } catch (err) {
      logger?.warn?.('Failed to close tenant pool during teardown', {
        ownerUserId,
        message: err?.message,
      });
    }
  }

  if (connectionString) {
    try {
      await db.query('DELETE FROM public_share_routing WHERE tenant_connection_string = $1', [
        connectionString,
      ]);
    } catch (err) {
      if (err?.code !== '42P01') throw err;
      logger?.warn?.('public_share_routing missing during tenant teardown', { ownerUserId });
    }
  }

  if (typeof tenantService?.deleteTenant === 'function') {
    try {
      await tenantService.deleteTenant(ownerUserId);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        logger?.info?.('Neon project already deleted (404)', { ownerUserId, projectId });
      } else {
        throw err;
      }
    }
  }

  let memberUserIds = [];
  try {
    memberUserIds = asRows(
      await db.query('SELECT user_id FROM tenant_memberships WHERE tenant_id = $1', [tenantId]),
    ).map((r) => String(r.user_id));
  } catch (err) {
    if (err?.code !== '42P01') throw err;
  }
  if (!memberUserIds.includes(String(ownerUserId))) {
    memberUserIds.push(String(ownerUserId));
  }

  try {
    await db.query(
      `DELETE FROM sessions
       WHERE (sess->>'tenantId') = $1
          OR (sess->'user'->>'id') = ANY($2::text[])`,
      [String(tenantId), memberUserIds],
    );
  } catch (err) {
    if (err?.code !== '42P01') throw err;
    logger?.warn?.('sessions table missing during tenant teardown', { ownerUserId });
  }

  logger?.info?.('Tenant infrastructure torn down', {
    ownerUserId,
    tenantId,
    projectId,
    hadConnectionString: Boolean(connectionString),
  });

  return { skipped: false, tenantId, projectId };
}

module.exports = {
  teardownTenantInfrastructure,
  asRows,
};
