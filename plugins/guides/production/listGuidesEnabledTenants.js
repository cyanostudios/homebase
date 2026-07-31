// plugins/guides/production/listGuidesEnabledTenants.js
// Tenants the Guides production worker may touch: guides must be enabled
// (same principle as requirePlugin / tenant_plugin_access).

const { Logger } = require('@homebase/core');

const PLUGIN_NAME = 'guides';

/**
 * SQL predicate against tenants alias `t`:
 * - guides enabled on tenant_plugin_access, or
 * - no guides row yet → legacy user_plugin_access for owner
 * Explicit tenant_plugin_access.enabled=false excludes the tenant.
 */
const GUIDES_ENABLED_SQL = `
  (
    EXISTS (
      SELECT 1
      FROM tenant_plugin_access tpa
      WHERE tpa.tenant_id = t.id
        AND tpa.plugin_name = '${PLUGIN_NAME}'
        AND tpa.enabled = true
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM tenant_plugin_access tpa
        WHERE tpa.tenant_id = t.id
          AND tpa.plugin_name = '${PLUGIN_NAME}'
      )
      AND EXISTS (
        SELECT 1
        FROM user_plugin_access upa
        WHERE upa.user_id = COALESCE(t.owner_user_id, t.user_id)
          AND upa.plugin_name = '${PLUGIN_NAME}'
          AND upa.enabled = true
      )
    )
  )
`;

function isUndefinedRelationError(error) {
  return (
    error &&
    (error.code === '42P01' ||
      (typeof error.message === 'string' &&
        /tenant_plugin_access|user_plugin_access|tenants/i.test(error.message)))
  );
}

/**
 * @param {import('pg').Pool} mainPool
 * @param {{ tenantProvider?: string, databaseUrl?: string }} [options]
 * @returns {Promise<Array<{ user_id: number, email?: string, connection_string: string }>>}
 */
async function listGuidesEnabledTenants(mainPool, options = {}) {
  const tenantProvider = options.tenantProvider || process.env.TENANT_PROVIDER || 'neon';
  const isLocalProvider = tenantProvider === 'local';
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL;

  try {
    if (isLocalProvider) {
      if (!databaseUrl) return [];
      const result = await mainPool.query(`
        SELECT DISTINCT ON (u.id)
          u.id AS user_id,
          u.email
        FROM users u
        INNER JOIN tenants t ON t.user_id = u.id OR t.owner_user_id = u.id
        WHERE ${GUIDES_ENABLED_SQL}
        ORDER BY u.id
      `);
      return result.rows.map((user) => ({
        user_id: user.user_id,
        email: user.email,
        connection_string: `${databaseUrl}?options=-csearch_path%3Dtenant_${user.user_id}`,
      }));
    }

    const result = await mainPool.query(`
      SELECT
        t.user_id,
        t.neon_connection_string AS connection_string,
        u.email
      FROM tenants t
      INNER JOIN users u ON t.user_id = u.id
      WHERE t.neon_connection_string IS NOT NULL
        AND t.neon_connection_string <> ''
        AND ${GUIDES_ENABLED_SQL}
      ORDER BY t.user_id
    `);
    return result.rows;
  } catch (error) {
    if (isUndefinedRelationError(error)) {
      Logger.warn('Guides worker: plugin-access tables unavailable; skipping all tenants', {
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
    throw error;
  }
}

module.exports = {
  PLUGIN_NAME,
  GUIDES_ENABLED_SQL,
  listGuidesEnabledTenants,
};
