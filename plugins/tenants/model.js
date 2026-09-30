// plugins/tenants/model.js
// Main-DB only — never use tenant pool / connection strings in responses.

const { ALL_DISCOVERED_PLUGINS } = require('../../server/core/config/constants');
const {
  PLATFORM_TENANTS_NON_TOGGLEABLE_PLUGINS,
  PLATFORM_TENANTS_PLUGIN,
  isPlatformAdminLockedTenant,
  isPublicAppPlugin,
  isPluginToggleableInTenantsAdmin,
} = require('../../server/core/config/platformTenantsAdmin');
const {
  detectPluginAccessTables,
  listPluginAccess,
  applyPluginAccessChanges,
} = require('../../server/core/services/admin/tenantPluginAccess');
const {
  runKioskCatalogSeedForOwnerBestEffort,
} = require('../clubdesk/services/kioskCatalogSeedRunner');

function asRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function orgName(organization) {
  if (!organization) return null;
  if (typeof organization === 'string') {
    try {
      const parsed = JSON.parse(organization);
      return parsed?.name ? String(parsed.name) : null;
    } catch {
      return null;
    }
  }
  return organization.name ? String(organization.name) : null;
}

class TenantsModel {
  /**
   * @param {{ query: Function }} pool - main DB pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async listTenants() {
    const rows = asRows(
      await this.pool.query(
        `SELECT
           t.id,
           COALESCE(t.owner_user_id, t.user_id) AS owner_user_id,
           u.email AS owner_email,
           t.organization,
           (
             SELECT COUNT(*)::int
             FROM tenant_plugin_access tpa
             WHERE tpa.tenant_id = t.id AND tpa.enabled = true
           ) AS enabled_plugin_count
         FROM tenants t
         LEFT JOIN users u ON u.id = COALESCE(t.owner_user_id, t.user_id)
         ORDER BY t.id ASC`,
      ),
    );

    return rows.map((row) => {
      const ownerEmail = row.owner_email || null;
      const pluginsLocked = isPlatformAdminLockedTenant(ownerEmail);
      return {
        id: row.id,
        ownerUserId: row.owner_user_id,
        ownerEmail,
        organizationName: orgName(row.organization),
        enabledPluginCount: pluginsLocked
          ? ALL_DISCOVERED_PLUGINS.filter(
              (n) =>
                !PLATFORM_TENANTS_NON_TOGGLEABLE_PLUGINS.includes(n) ||
                n === PLATFORM_TENANTS_PLUGIN,
            ).length
          : (row.enabled_plugin_count ?? 0),
        pluginsLocked,
      };
    });
  }

  async getTenant(tenantId) {
    const id = Number(tenantId);
    if (!Number.isFinite(id)) {
      const err = new Error('Invalid tenant id');
      err.status = 400;
      throw err;
    }

    const rows = asRows(
      await this.pool.query(
        `SELECT
           t.id,
           COALESCE(t.owner_user_id, t.user_id) AS owner_user_id,
           u.email AS owner_email,
           t.organization
         FROM tenants t
         LEFT JOIN users u ON u.id = COALESCE(t.owner_user_id, t.user_id)
         WHERE t.id = $1`,
        [id],
      ),
    );

    if (!rows.length) {
      const err = new Error('Tenant not found');
      err.status = 404;
      throw err;
    }

    const row = rows[0];
    const ownerUserId = row.owner_user_id;
    const ownerEmail = row.owner_email || null;
    const pluginsLocked = isPlatformAdminLockedTenant(ownerEmail);

    const tables = await detectPluginAccessTables(this.pool);
    const accessRows = await listPluginAccess(this.pool, tables, row.id, ownerUserId);
    const enabledSet = new Set(
      accessRows.filter((r) => r.enabled).map((r) => String(r.plugin_name)),
    );

    // Show discovered plugins except settings + tenants (code allowlist only).
    // public-* appear as informational rows without switches.
    const listed = ALL_DISCOVERED_PLUGINS.filter(
      (name) => name !== 'settings' && name !== PLATFORM_TENANTS_PLUGIN,
    );

    const plugins = listed.map((pluginName) => {
      const publicApp = isPublicAppPlugin(pluginName);
      const toggleable = isPluginToggleableInTenantsAdmin(pluginName, pluginsLocked);
      let enabled;
      if (pluginsLocked) {
        enabled = true;
      } else if (publicApp) {
        // Informational only — not a platform enablement switch
        enabled = enabledSet.has(pluginName);
      } else if (pluginName === PLATFORM_TENANTS_PLUGIN) {
        enabled = true;
      } else {
        enabled = enabledSet.has(pluginName);
      }
      return {
        pluginName,
        enabled,
        toggleable,
        publicApp,
      };
    });

    return {
      id: row.id,
      ownerUserId,
      ownerEmail,
      organizationName: orgName(row.organization),
      plugins,
      pluginsLocked,
      reloginRequiredHint: !pluginsLocked,
    };
  }

  /**
   * @param {number|string} tenantId
   * @param {{ enable?: string[], disable?: string[], grantedByUserId: number }} body
   */
  async updatePlugins(tenantId, body) {
    const detail = await this.getTenant(tenantId);

    if (detail.pluginsLocked) {
      const err = new Error('Cannot change plugins for platform admin tenants');
      err.status = 403;
      throw err;
    }

    const enable = Array.isArray(body.enable) ? body.enable.map(String) : [];
    const disable = Array.isArray(body.disable) ? body.disable.map(String) : [];

    if (!enable.length && !disable.length) {
      const err = new Error('Provide enable and/or disable plugin arrays');
      err.status = 400;
      throw err;
    }

    const allNames = [...enable, ...disable];
    const forbidden = allNames.filter(
      (name) => PLATFORM_TENANTS_NON_TOGGLEABLE_PLUGINS.includes(name) || isPublicAppPlugin(name),
    );
    if (forbidden.length) {
      const err = new Error(`Cannot toggle plugins: ${forbidden.join(', ')}`);
      err.status = 400;
      throw err;
    }

    const allowedSet = new Set(ALL_DISCOVERED_PLUGINS);
    const unknown = allNames.filter((name) => !allowedSet.has(name));
    if (unknown.length) {
      const err = new Error(`Unknown plugins: ${unknown.join(', ')}`);
      err.status = 400;
      throw err;
    }

    await applyPluginAccessChanges(this.pool, {
      tenantId: detail.id,
      ownerUserId: detail.ownerUserId,
      enable,
      disable,
      grantedByUserId: body.grantedByUserId,
    });

    if (enable.includes('clubdesk')) {
      await runKioskCatalogSeedForOwnerBestEffort(this.pool, {
        ownerUserId: detail.ownerUserId,
        tenantId: detail.id,
      });
    }

    return this.getTenant(tenantId);
  }
}

module.exports = TenantsModel;
