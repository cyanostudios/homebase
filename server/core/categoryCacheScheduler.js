// server/core/categoryCacheScheduler.js
// Category cache scheduler: runs runJobForTenant for all tenants on startup + every 4 hours.
// Similar to FX scheduler. Fills category_cache for CDON, Fyndiq, WooCommerce.

const { runJobForTenant, getTenants } = require('../../scripts/category-cache-job');

const FETCH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

let mainPool = null;
let schedulerTimer = null;

async function runCategoryCacheJob() {
  const p = mainPool;
  if (!p) return;

  try {
    const tenants = await getTenants(p);
    if (tenants.length === 0) return;

    for (const tenant of tenants) {
      const label = tenant.schema_name ? `${tenant.email} (${tenant.schema_name})` : tenant.email;
      try {
        await runJobForTenant(tenant.connection_string, {
          owner_user_id: tenant.owner_user_id,
          email: tenant.email,
          schemaName: tenant.schema_name,
        });
      } catch (err) {
        console.warn(`[CategoryCache] Tenant ${label}:`, err?.message ?? err);
      }
    }
    console.log('[CategoryCache] Scheduled run done for', tenants.length, 'tenant(s)');
  } catch (err) {
    console.error('[CategoryCache] Job error:', err?.message ?? err);
  }
}

/**
 * Start background scheduler: run on startup, then every 4 hours.
 * Call once after server bootstrap (e.g. from core routes index).
 */
function startCategoryCacheScheduler(pool) {
  if (!pool || schedulerTimer) return;
  mainPool = pool;

  runCategoryCacheJob().then(() => {
    console.log('[CategoryCache] Initial run done');
  });

  schedulerTimer = setInterval(() => {
    runCategoryCacheJob();
  }, FETCH_INTERVAL_MS);
  console.log('[CategoryCache] Scheduler started (every 4h)');
}

module.exports = { startCategoryCacheScheduler, runCategoryCacheJob };
