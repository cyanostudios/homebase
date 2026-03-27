// plugins/orders/orderSyncScheduler.js
// Periodic order sync for all tenants with orders plugin enabled.

const { applyTenantContextToRequest } = require('../../server/core/helpers/resolveTenantForUser');
const TenantContextService = require('../../server/core/services/tenant/TenantContextService');
const orderSyncService = require('./orderSyncService');
const orderSyncState = require('./orderSyncState');
const analyticsCache = require('../analytics/cache');

const { SYNC_INTERVAL_MINUTES } = require('./orderSyncService');

const SYNC_INTERVAL_MS = SYNC_INTERVAL_MINUTES * 60 * 1000;
const STARTUP_DELAY_MS = 10_000;
const USER_LIST_RETRY_DELAY_MS = 1500;

let mainPool = null;
let schedulerTimer = null;
let startupTimer = null;

/**
 * @param {number} userId
 * @returns {Promise<object>} Express-like req with session + tenant context
 */
async function createSyntheticReq(mainPool, userId) {
  const tcs = new TenantContextService(mainPool);
  const tenantContext = await tcs.getTenantContextByUserId(userId);
  if (!tenantContext) {
    throw new Error(`Tenant membership not configured for user ${userId}`);
  }

  const req = {
    session: {
      user: { id: userId },
      tenantConnectionString: tenantContext.tenantConnectionString || null,
      tenantSchemaName: tenantContext.tenantSchemaName || null,
      tenantId: tenantContext.tenantId,
      tenantRole: tenantContext.tenantRole,
      tenantOwnerUserId: tenantContext.tenantOwnerUserId,
    },
  };
  await applyTenantContextToRequest(mainPool, req);
  return req;
}

async function runSyncForUser(mainPool, userId) {
  const req = await createSyntheticReq(mainPool, userId);
  const busy = await orderSyncState.isBusyForUser(req);
  if (busy) {
    console.log(`[OrderSyncScheduler] user ${userId}: skip (sync already running)`);
    return;
  }
  await orderSyncService.runSync(req);
  analyticsCache.invalidateUser(userId);
}

async function runSchedulerForAllUsers() {
  const p = mainPool;
  if (!p) return;

  try {
    let r;
    try {
      r = await p.query(
        `SELECT t.owner_user_id
         FROM public.tenant_plugin_access tpa
         INNER JOIN public.tenants t ON t.id = tpa.tenant_id
         WHERE tpa.plugin_name = 'orders' AND tpa.enabled = true
         ORDER BY t.owner_user_id`,
      );
    } catch (firstErr) {
      const firstMsg = String(firstErr?.message || firstErr);
      console.warn('[OrderSyncScheduler] tenant-list query failed (retrying once):', firstMsg);
      await new Promise((resolve) => setTimeout(resolve, USER_LIST_RETRY_DELAY_MS));
      r = await p.query(
        `SELECT t.owner_user_id
         FROM public.tenant_plugin_access tpa
         INNER JOIN public.tenants t ON t.id = tpa.tenant_id
         WHERE tpa.plugin_name = 'orders' AND tpa.enabled = true
         ORDER BY t.owner_user_id`,
      );
    }
    const rows = r.rows || r;
    for (const row of rows) {
      const userId = row.owner_user_id;
      try {
        await runSyncForUser(p, userId);
      } catch (err) {
        console.warn(`[OrderSyncScheduler] user ${userId}:`, err?.message ?? err);
      }
    }
    console.log('[OrderSyncScheduler] Run finished for', rows.length, 'user(s)');
  } catch (err) {
    console.error('[OrderSyncScheduler] Failed:', err?.message ?? err);
  }
}

/**
 * Start background scheduler: first run after STARTUP_DELAY_MS, then every SYNC_INTERVAL_MS.
 * @param {import('pg').Pool} pool - Main auth database pool
 */
function startOrderSyncScheduler(pool) {
  if (!pool || schedulerTimer) return;
  mainPool = pool;

  startupTimer = setTimeout(() => {
    startupTimer = null;
    runSchedulerForAllUsers().then(() => {
      console.log('[OrderSyncScheduler] Initial run done');
    });
  }, STARTUP_DELAY_MS);

  schedulerTimer = setInterval(() => {
    runSchedulerForAllUsers();
  }, SYNC_INTERVAL_MS);

  console.log(
    `[OrderSyncScheduler] Started (every ${SYNC_INTERVAL_MINUTES} min, first run in ${STARTUP_DELAY_MS / 1000}s)`,
  );
}

module.exports = {
  startOrderSyncScheduler,
  runSchedulerForAllUsers,
  createSyntheticReq,
};
