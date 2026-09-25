// plugins/sportadmin/services/cronSync.js
const { Logger } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const TenantContextService = require('../../../server/core/services/tenant/TenantContextService');
const { createWorkerReq } = require('../../guides/production/workerContext');
const SportadminModel = require('../model');
const { runSportadminSync } = require('./syncService');

/**
 * Sync all tenants that have sportadmin enabled and a configured site URL due for refresh.
 * @param {{ userId?: number }} [options]
 */
async function runSportadminCronSync({ userId } = {}) {
  Logger.info('[SportAdmin] cron sync starting', { userId: userId ?? 'all' });

  const connectionPool = ServiceManager.get('connectionPool');
  const mainPool = ServiceManager.getMainPool();

  let tenants;
  if (userId !== undefined && userId !== null) {
    const r = await mainPool.query(
      `SELECT t.id AS tenant_id, COALESCE(t.owner_user_id, t.user_id) AS user_id
         FROM tenants t
         JOIN tenant_plugin_access tpa ON tpa.tenant_id = t.id
        WHERE tpa.plugin_name = 'sportadmin' AND tpa.enabled = true
          AND COALESCE(t.owner_user_id, t.user_id) = $1`,
      [userId],
    );
    tenants = r.rows;
  } else {
    const r = await mainPool.query(
      `SELECT t.id AS tenant_id, COALESCE(t.owner_user_id, t.user_id) AS user_id
         FROM tenants t
         JOIN tenant_plugin_access tpa ON tpa.tenant_id = t.id
        WHERE tpa.plugin_name = 'sportadmin' AND tpa.enabled = true`,
    );
    tenants = r.rows;
  }

  const results = [];
  let processed = 0;
  let skipped = 0;

  for (const row of tenants) {
    const uid = Number(row.user_id);
    try {
      const ctx = await TenantContextService.getTenantContextByUserId(uid);
      const conn = ctx?.neon_connection_string || ctx?.connectionString;
      if (!conn) {
        skipped += 1;
        continue;
      }
      const tenantPool = await connectionPool.getTenantPool(conn);
      const req = createWorkerReq(tenantPool, uid);
      const model = new SportadminModel();
      const config = await model.getConfig(req);
      if (!config.site_url) {
        skipped += 1;
        continue;
      }
      if (!config.cron_enabled) {
        skipped += 1;
        continue;
      }

      const intervalMin = Number(config.refresh_interval_minutes) || 1440;
      const last = config.last_attempted_sync ? new Date(config.last_attempted_sync).getTime() : 0;
      const due = !last || Date.now() - last >= intervalMin * 60 * 1000;
      if (!due && userId === undefined) {
        skipped += 1;
        continue;
      }

      const summary = await runSportadminSync(model, req, {});
      processed += 1;
      results.push({
        userId: uid,
        ok: summary.ok,
        written: summary.written,
        errors: summary.errors?.length || 0,
      });
    } catch (e) {
      Logger.error('[SportAdmin] cron sync failed for user', e, { userId: uid });
      results.push({ userId: uid, ok: false, error: e?.message });
    }
  }

  Logger.info('[SportAdmin] cron sync completed', { processed, skipped });
  return { processed, skipped, results };
}

module.exports = { runSportadminCronSync };
