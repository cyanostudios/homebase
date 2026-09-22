const ServiceManager = require('../../server/core/ServiceManager');

/**
 * Mirrors server requirePlugin access check for a secondary plugin (e.g. invoices).
 */
async function isPluginEnabledForRequest(req, pluginName) {
  if (!req?.session?.user) {
    return false;
  }
  if (req.session.user.role === 'superuser') {
    return true;
  }

  const pool = ServiceManager.getMainPool();
  const tenantId = req.session.tenantId;
  if (tenantId !== undefined && tenantId !== null) {
    try {
      const result = await pool.query(
        'SELECT enabled FROM tenant_plugin_access WHERE tenant_id = $1 AND plugin_name = $2 AND enabled = true',
        [tenantId, pluginName],
      );
      if (result.rows.length > 0) {
        return true;
      }
    } catch {
      /* fall through */
    }
  }

  const fallback = await pool.query(
    'SELECT enabled FROM user_plugin_access WHERE user_id = $1 AND plugin_name = $2',
    [req.session.user.id, pluginName],
  );
  return Boolean(fallback.rows.length && fallback.rows[0].enabled);
}

module.exports = { isPluginEnabledForRequest };
