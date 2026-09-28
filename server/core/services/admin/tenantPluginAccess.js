// server/core/services/admin/tenantPluginAccess.js
// Shared upsert / list for tenant_plugin_access (+ owner user_plugin_access legacy).

/**
 * @param {{ query: Function }} pool - raw pg Pool or adapter returning { rows } / array
 * @param {string} table
 */
async function hasTable(pool, table) {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  const rows = Array.isArray(result) ? result : result.rows || [];
  return rows.length > 0;
}

/**
 * @param {{ query: Function }} pool
 */
async function detectPluginAccessTables(pool) {
  return {
    tenantPlugin: await hasTable(pool, 'tenant_plugin_access'),
    userPlugin: await hasTable(pool, 'user_plugin_access'),
  };
}

/**
 * @param {{ query: Function }} pool
 * @param {{ tenantPlugin: boolean, userPlugin: boolean }} tables
 * @param {{ tenantId: number, ownerUserId: number, pluginName: string, enabled: boolean, grantedByUserId?: number }} args
 */
async function setPluginAccess(pool, tables, args) {
  const { tenantId, ownerUserId, pluginName, enabled } = args;
  const grantedBy = args.grantedByUserId ?? ownerUserId;

  if (tables.tenantPlugin) {
    await pool.query(
      `INSERT INTO tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, plugin_name)
       DO UPDATE SET enabled = EXCLUDED.enabled, granted_at = CURRENT_TIMESTAMP`,
      [tenantId, pluginName, enabled, grantedBy],
    );
  }
  if (tables.userPlugin) {
    await pool.query(
      `INSERT INTO user_plugin_access (user_id, plugin_name, enabled, granted_by)
       VALUES ($1, $2, $3, $1)
       ON CONFLICT (user_id, plugin_name)
       DO UPDATE SET enabled = EXCLUDED.enabled`,
      [ownerUserId, pluginName, enabled],
    );
  }
}

/**
 * @param {{ query: Function }} pool
 * @param {{ tenantPlugin: boolean, userPlugin: boolean }} tables
 * @param {number} tenantId
 * @param {number} ownerUserId
 * @returns {Promise<{ plugin_name: string, enabled: boolean }[]>}
 */
async function listPluginAccess(pool, tables, tenantId, ownerUserId) {
  if (tables.tenantPlugin) {
    const result = await pool.query(
      `SELECT plugin_name, enabled FROM tenant_plugin_access WHERE tenant_id = $1 ORDER BY plugin_name`,
      [tenantId],
    );
    return Array.isArray(result) ? result : result.rows || [];
  }
  if (tables.userPlugin) {
    const result = await pool.query(
      `SELECT plugin_name, enabled FROM user_plugin_access WHERE user_id = $1 ORDER BY plugin_name`,
      [ownerUserId],
    );
    return Array.isArray(result) ? result : result.rows || [];
  }
  return [];
}

/**
 * Apply enable/disable lists for one tenant.
 * @param {{ query: Function }} pool
 * @param {{ tenantId: number, ownerUserId: number, enable?: string[], disable?: string[], grantedByUserId?: number }} args
 */
async function applyPluginAccessChanges(pool, args) {
  const tables = await detectPluginAccessTables(pool);
  if (!tables.tenantPlugin && !tables.userPlugin) {
    throw new Error(
      'Neither tenant_plugin_access nor user_plugin_access exists — run migrations first',
    );
  }

  const enable = Array.isArray(args.enable) ? args.enable : [];
  const disable = Array.isArray(args.disable) ? args.disable : [];

  for (const pluginName of disable) {
    await setPluginAccess(pool, tables, {
      tenantId: args.tenantId,
      ownerUserId: args.ownerUserId,
      pluginName,
      enabled: false,
      grantedByUserId: args.grantedByUserId,
    });
  }
  for (const pluginName of enable) {
    await setPluginAccess(pool, tables, {
      tenantId: args.tenantId,
      ownerUserId: args.ownerUserId,
      pluginName,
      enabled: true,
      grantedByUserId: args.grantedByUserId,
    });
  }

  return listPluginAccess(pool, tables, args.tenantId, args.ownerUserId);
}

module.exports = {
  hasTable,
  detectPluginAccessTables,
  setPluginAccess,
  listPluginAccess,
  applyPluginAccessChanges,
};
